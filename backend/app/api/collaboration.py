import io
import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from PIL import Image, ImageDraw
from reportlab.pdfgen import canvas as pdf_canvas

from app.api.dependencies import get_current_user
from app.models.user import User
from app.schemas.collaboration import (
    CommentCreate, CommentResponse, NotificationResponse,
    VersionCreate, VersionResponse,
)
from app.services.whiteboard_service import whiteboard_service
from app.services.workspace_service import workspace_service
from app.services.permission_service import permission_service
from app.services.collaboration_service import collaboration_service as svc
from app.repositories.collaboration_repository import collaboration_repository as repo

router = APIRouter(tags=["collaboration"])


def output(value):
    return {**value, "id": value["_id"]}


async def _require_member(board_id, user_id):
    b = await whiteboard_service.get(board_id)
    permission_service.require_member(await workspace_service.member(b.workspace_id, user_id))
    return b


async def _require_editor(board_id, user_id):
    b = await _require_member(board_id, user_id)
    m = await workspace_service.member(b.workspace_id, user_id)
    if m.role not in {"owner", "editor"}:
        raise HTTPException(403, "Editor permission is required")
    return b


# ── Versions ──

@router.post("/whiteboards/{board_id}/versions", response_model=VersionResponse)
async def create_version(
    board_id: str, data: VersionCreate, user: Annotated[User, Depends(get_current_user)]
):
    board = await _require_editor(board_id, user.id)
    # Check board lock
    if board.is_locked:
        raise HTTPException(403, "Board is locked. No edits are allowed.")
    value = await svc.create_version(board_id, user.id, data.message)
    if not value:
        raise HTTPException(409, "No changes since the latest version")
    enriched = await svc.enrich_version(value)
    return output(enriched)


@router.get("/whiteboards/{board_id}/versions", response_model=list[VersionResponse])
async def versions(
    board_id: str, user: Annotated[User, Depends(get_current_user)]
):
    await _require_member(board_id, user.id)
    items = await repo.versions_for(board_id)
    result = []
    for v in items:
        enriched = await svc.enrich_version(v)
        result.append(output(enriched))
    return result


@router.post("/versions/{version_id}/restore")
async def restore(version_id: str, user: Annotated[User, Depends(get_current_user)]):
    v = await repo.version(version_id)
    if not v:
        raise HTTPException(404, "Version not found")
    board = await _require_editor(v["whiteboard_id"], user.id)
    # Check board lock
    if board.is_locked:
        raise HTTPException(403, "Board is locked. No edits are allowed.")
    return await svc.restore(version_id, user.id)


# ── Comments ──

@router.post("/whiteboards/{board_id}/comments", response_model=CommentResponse)
async def comment(
    board_id: str, data: CommentCreate, user: Annotated[User, Depends(get_current_user)]
):
    b = await _require_member(board_id, user.id)
    value = await svc.add_comment(board_id, user.id, data)
    if b.created_by != user.id:
        await svc.notify(
            b.created_by, "comment", "New whiteboard comment",
            data.text, {"whiteboard_id": board_id}
        )
    return output(value)


@router.get("/whiteboards/{board_id}/comments", response_model=list[CommentResponse])
async def comments(
    board_id: str, user: Annotated[User, Depends(get_current_user)]
):
    await _require_member(board_id, user.id)
    return [output(v) for v in await repo.comments_for(board_id)]


@router.patch("/comments/{comment_id}/resolve", response_model=CommentResponse)
async def resolve(comment_id: str, user: Annotated[User, Depends(get_current_user)]):
    c = await repo.comment(comment_id)
    if not c:
        raise HTTPException(404, "Comment not found")
    await _require_editor(c["whiteboard_id"], user.id)
    return output(await repo.comment_update(comment_id, {"resolved": True}))


@router.delete("/comments/{comment_id}", status_code=204)
async def delete_comment(comment_id: str, user: Annotated[User, Depends(get_current_user)]):
    c = await repo.comment(comment_id)
    if not c:
        raise HTTPException(404, "Comment not found")
    if c["author_id"] != user.id:
        await _require_editor(c["whiteboard_id"], user.id)
    await repo.comment_delete(comment_id)


# ── Notifications ──

@router.get("/notifications", response_model=list[NotificationResponse])
async def notifications(user: Annotated[User, Depends(get_current_user)]):
    return [output(v) for v in await repo.notifications_for(user.id)]


@router.patch("/notifications/{notification_id}/read", status_code=204)
async def mark_read(notification_id: str, user: Annotated[User, Depends(get_current_user)]):
    await repo.notification_update(notification_id, {"read": True})


@router.delete("/notifications/{notification_id}", status_code=204)
async def delete_notification(notification_id: str, user: Annotated[User, Depends(get_current_user)]):
    await repo.notification_delete(notification_id)


# ── Export ──

def _compute_bounds(objects: list) -> tuple[float, float, float, float]:
    """Compute bounding box of all objects. Returns (min_x, min_y, max_x, max_y)."""
    if not objects:
        return (0, 0, 1200, 720)

    min_x, min_y = float("inf"), float("inf")
    max_x, max_y = float("-inf"), float("-inf")

    for obj in objects:
        obj_type = obj.get("type", "")
        if obj_type == "path":
            points = obj.get("points", [])
            for i in range(0, len(points) - 1, 2):
                min_x = min(min_x, points[i])
                min_y = min(min_y, points[i + 1])
                max_x = max(max_x, points[i])
                max_y = max(max_y, points[i + 1])
        else:
            x = obj.get("x", 0)
            y = obj.get("y", 0)
            w = obj.get("width", 0)
            h = obj.get("height", 0)
            min_x = min(min_x, x, x + w)
            min_y = min(min_y, y, y + h)
            max_x = max(max_x, x, x + w)
            max_y = max(max_y, y, y + h)

    if min_x == float("inf"):
        return (0, 0, 1200, 720)

    # Add padding
    padding = 40
    min_x -= padding
    min_y -= padding
    max_x += padding
    max_y += padding

    # Minimum size
    width = max(max_x - min_x, 200)
    height = max(max_y - min_y, 200)

    return (min_x, min_y, min_x + width, min_y + height)


def _draw_objects_svg(objects: list, background: str) -> str:
    """Render board objects as proper SVG elements with content-aware sizing."""
    bx1, by1, bx2, by2 = _compute_bounds(objects)
    width = bx2 - bx1
    height = by2 - by1

    shapes = []
    for obj in objects:
        obj_type = obj.get("type", "")
        color = obj.get("color", "#000")

        if obj_type == "rect":
            shapes.append(
                f'<rect x="{obj.get("x", 0)}" y="{obj.get("y", 0)}" '
                f'width="{obj.get("width", 0)}" height="{obj.get("height", 0)}" '
                f'stroke="{color}" fill="transparent" stroke-width="2" rx="3" />'
            )
        elif obj_type == "circle":
            cx = (obj.get("x", 0)) + (obj.get("width", 0)) / 2
            cy = (obj.get("y", 0)) + (obj.get("height", 0)) / 2
            rx = abs(obj.get("width", 0)) / 2
            ry = abs(obj.get("height", 0)) / 2
            shapes.append(
                f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" '
                f'stroke="{color}" fill="transparent" stroke-width="2" />'
            )
        elif obj_type == "path":
            points = obj.get("points", [])
            if points:
                pts = ",".join(str(p) for p in points)
                shapes.append(
                    f'<polyline points="{pts}" stroke="{color}" fill="none" '
                    f'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />'
                )
        elif obj_type == "arrow":
            x1 = obj.get("x", 0)
            y1 = obj.get("y", 0)
            x2 = x1 + obj.get("width", 0)
            y2 = y1 + obj.get("height", 0)
            shapes.append(
                f'<defs><marker id="arrowhead" markerWidth="10" markerHeight="10" '
                f'refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" '
                f'fill="{color}" /></marker></defs>'
                f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
                f'stroke="{color}" stroke-width="2" marker-end="url(#arrowhead)" />'
            )
        elif obj_type == "text":
            shapes.append(
                f'<text x="{obj.get("x", 20)}" y="{obj.get("y", 20)}" '
                f'fill="{color}" font-size="18" font-family="Inter, sans-serif">'
                f'{obj.get("text", "")}</text>'
            )

    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'width="{int(width)}" height="{int(height)}" '
        f'viewBox="{bx1} {by1} {width} {height}" '
        f'style="background:{background}">{"".join(shapes)}</svg>'
    )


def _draw_objects_image(objects: list, background: str, title: str) -> bytes:
    """Render board objects as a PNG image using Pillow with content-aware sizing."""
    bx1, by1, bx2, by2 = _compute_bounds(objects)
    width = max(int(bx2 - bx1), 200)
    height = max(int(by2 - by1), 200)

    image = Image.new("RGB", (width, height), background or "#ffffff")
    draw = ImageDraw.Draw(image)

    for obj in objects:
        color = obj.get("color", "#000000")
        obj_type = obj.get("type", "")
        # Offset coordinates to image space
        ox = -bx1
        oy = -by1

        if obj_type == "rect":
            x, y = obj.get("x", 0) + ox, obj.get("y", 0) + oy
            w, h = obj.get("width", 0), obj.get("height", 0)
            draw.rectangle([x, y, x + w, y + h], outline=color, width=2)
        elif obj_type == "circle":
            x, y = obj.get("x", 0) + ox, obj.get("y", 0) + oy
            w, h = obj.get("width", 0), obj.get("height", 0)
            draw.ellipse([x, y, x + w, y + h], outline=color, width=2)
        elif obj_type == "path":
            points = obj.get("points", [])
            if len(points) >= 4:
                coords = [(points[i] + ox, points[i + 1] + oy) for i in range(0, len(points) - 1, 2)]
                draw.line(coords, fill=color, width=2)
        elif obj_type == "arrow":
            x1, y1 = obj.get("x", 0) + ox, obj.get("y", 0) + oy
            x2 = x1 + obj.get("width", 0)
            y2 = y1 + obj.get("height", 0)
            draw.line([(x1, y1), (x2, y2)], fill=color, width=2)
        elif obj_type == "text":
            draw.text((obj.get("x", 20) + ox, obj.get("y", 20) + oy), obj.get("text", ""), fill=color)

    out = io.BytesIO()
    image.save(out, "PNG")
    return out.getvalue()


def _draw_objects_pdf(objects: list, title: str) -> bytes:
    """Render board objects as a PDF document with content-aware sizing."""
    bx1, by1, bx2, by2 = _compute_bounds(objects)
    width = max(int(bx2 - bx1), 200)
    height = max(int(by2 - by1), 200)

    out = io.BytesIO()
    pdf = pdf_canvas.Canvas(out, pagesize=(width, height))
    pdf.setTitle(title)

    ox = -bx1
    oy = -by1

    for obj in objects:
        color = obj.get("color", "#000000")
        obj_type = obj.get("type", "")

        try:
            if color.startswith("#") and len(color) == 7:
                r, g, b = int(color[1:3], 16) / 255, int(color[3:5], 16) / 255, int(color[5:7], 16) / 255
                pdf.setStrokeColorRGB(r, g, b)
                pdf.setFillColorRGB(r, g, b)
        except Exception:
            pass

        if obj_type == "rect":
            x = obj.get("x", 0) + ox
            y = height - (obj.get("y", 0) + oy) - obj.get("height", 0)
            pdf.rect(x, y, obj.get("width", 0), obj.get("height", 0), stroke=1, fill=0)
        elif obj_type == "circle":
            cx = obj.get("x", 0) + ox + obj.get("width", 0) / 2
            cy = height - (obj.get("y", 0) + oy + obj.get("height", 0) / 2)
            pdf.ellipse(
                cx - abs(obj.get("width", 0)) / 2, cy - abs(obj.get("height", 0)) / 2,
                cx + abs(obj.get("width", 0)) / 2, cy + abs(obj.get("height", 0)) / 2,
                stroke=1, fill=0,
            )
        elif obj_type == "path":
            points = obj.get("points", [])
            if len(points) >= 4:
                path = pdf.beginPath()
                path.moveTo(points[0] + ox, height - (points[1] + oy))
                for i in range(2, len(points) - 1, 2):
                    path.lineTo(points[i] + ox, height - (points[i + 1] + oy))
                pdf.drawPath(path, stroke=1, fill=0)
        elif obj_type == "arrow":
            x1, y1 = obj.get("x", 0) + ox, height - (obj.get("y", 0) + oy)
            x2 = x1 + obj.get("width", 0)
            y2 = height - (obj.get("y", 0) + oy + obj.get("height", 0))
            pdf.line(x1, y1, x2, y2)
        elif obj_type == "text":
            pdf.drawString(obj.get("x", 20) + ox, height - (obj.get("y", 20) + oy), obj.get("text", ""))

    pdf.save()
    return out.getvalue()


@router.get("/whiteboards/{board_id}/export/{format}")
async def export(
    board_id: str, format: str, user: Annotated[User, Depends(get_current_user)]
):
    b = await _require_member(board_id, user.id)
    data = b.board_data
    objects = data.get("objects", [])
    background = data.get("background", "#ffffff")

    if format == "json":
        return Response(
            json.dumps(data, default=str),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{b.title}.json"'},
        )

    if format == "svg":
        svg_content = _draw_objects_svg(objects, background)
        return Response(
            svg_content,
            media_type="image/svg+xml",
            headers={"Content-Disposition": f'attachment; filename="{b.title}.svg"'},
        )

    if format == "png":
        png_bytes = _draw_objects_image(objects, background, b.title)
        return Response(
            png_bytes,
            media_type="image/png",
            headers={"Content-Disposition": f'attachment; filename="{b.title}.png"'},
        )

    if format == "pdf":
        pdf_bytes = _draw_objects_pdf(objects, b.title)
        return Response(
            pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{b.title}.pdf"'},
        )

    raise HTTPException(404, "Unsupported export format. Use: json, svg, png, pdf")
