from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_current_user
from app.models.user import User
from app.schemas.whiteboard import WhiteboardCreate, WhiteboardResponse, WhiteboardUpdate
from app.services.permission_service import permission_service
from app.services.whiteboard_service import whiteboard_service
from app.services.workspace_service import workspace_service

router = APIRouter(tags=["whiteboards"])


async def _require_editor(workspace_id: str, user_id: str):
    """Ensure user is a member with editor or owner role."""
    member = permission_service.require_member(
        await workspace_service.member(workspace_id, user_id)
    )
    if member.role not in {"owner", "editor"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Editor permission is required",
        )
    return member


@router.get("/workspaces/{workspace_id}/whiteboards", response_model=list[WhiteboardResponse])
async def list_whiteboards(
    workspace_id: str, user: Annotated[User, Depends(get_current_user)]
):
    permission_service.require_member(
        await workspace_service.member(workspace_id, user.id)
    )
    return await whiteboard_service.list(workspace_id)


@router.post(
    "/workspaces/{workspace_id}/whiteboards",
    response_model=WhiteboardResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_whiteboard(
    workspace_id: str, data: WhiteboardCreate,
    user: Annotated[User, Depends(get_current_user)],
):
    await _require_editor(workspace_id, user.id)
    return await whiteboard_service.create(workspace_id, data, user.id)


@router.get("/whiteboards/{whiteboard_id}", response_model=WhiteboardResponse)
async def get_whiteboard(
    whiteboard_id: str, user: Annotated[User, Depends(get_current_user)]
):
    board = await whiteboard_service.get(whiteboard_id)
    permission_service.require_member(
        await workspace_service.member(board.workspace_id, user.id)
    )
    return board


@router.patch("/whiteboards/{whiteboard_id}", response_model=WhiteboardResponse)
async def update_whiteboard(
    whiteboard_id: str, data: WhiteboardUpdate,
    user: Annotated[User, Depends(get_current_user)],
):
    board = await whiteboard_service.get(whiteboard_id)
    # Check board is not locked
    if board.is_locked:
        raise HTTPException(status_code=403, detail="Board is locked. No edits are allowed.")
    await _require_editor(board.workspace_id, user.id)
    return await whiteboard_service.update(board, data)


@router.delete("/whiteboards/{whiteboard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_whiteboard(
    whiteboard_id: str, user: Annotated[User, Depends(get_current_user)]
):
    board = await whiteboard_service.get(whiteboard_id)
    if board.is_locked:
        raise HTTPException(status_code=403, detail="Board is locked. No edits are allowed.")
    await _require_editor(board.workspace_id, user.id)
    await whiteboard_service.delete(board.id)


# ── Board Lock ──

@router.post("/whiteboards/{whiteboard_id}/lock", response_model=WhiteboardResponse)
async def lock_whiteboard(
    whiteboard_id: str, user: Annotated[User, Depends(get_current_user)]
):
    """Lock a whiteboard. Owner-only."""
    board = await whiteboard_service.get(whiteboard_id)
    permission_service.require_owner(
        await workspace_service.member(board.workspace_id, user.id)
    )
    return await whiteboard_service.lock(whiteboard_id, user.id)


@router.post("/whiteboards/{whiteboard_id}/unlock", response_model=WhiteboardResponse)
async def unlock_whiteboard(
    whiteboard_id: str, user: Annotated[User, Depends(get_current_user)]
):
    """Unlock a whiteboard. Owner-only."""
    board = await whiteboard_service.get(whiteboard_id)
    permission_service.require_owner(
        await workspace_service.member(board.workspace_id, user.id)
    )
    return await whiteboard_service.unlock(whiteboard_id, user.id)
