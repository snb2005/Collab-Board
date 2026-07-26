from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies import get_current_user
from app.models.user import User
from app.schemas.workspace import (
    JoinWorkspaceRequest, MemberRoleUpdate, WorkspaceCreate,
    WorkspaceMemberResponse, WorkspaceResponse, WorkspaceUpdate,
)
from app.schemas.collaboration import InviteCreateRequest
from app.services.permission_service import permission_service
from app.services.workspace_service import workspace_service
from app.services.editor_request_service import editor_request_service
from app.services.invite_service import invite_service

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    data: WorkspaceCreate, user: Annotated[User, Depends(get_current_user)]
):
    return await workspace_service.create(data, user.id)


@router.get("/mine", response_model=list[WorkspaceResponse])
async def my_workspaces(user: Annotated[User, Depends(get_current_user)]):
    return await workspace_service.mine(user.id)


@router.get("/search", response_model=list[WorkspaceResponse])
async def search_workspaces(
    user: Annotated[User, Depends(get_current_user)],
    q: str = Query(default="", max_length=100),
):
    return await workspace_service.search(q, user.id)


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: str, user: Annotated[User, Depends(get_current_user)]
):
    workspace = await workspace_service.get(workspace_id)
    member = await workspace_service.member(workspace_id, user.id)
    if workspace.visibility == "private" and not member:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return await workspace_service.to_response(workspace, member)


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: str, data: WorkspaceUpdate,
    user: Annotated[User, Depends(get_current_user)],
):
    workspace = await workspace_service.get(workspace_id)
    permission_service.require_admin(
        await workspace_service.member(workspace_id, user.id)
    )
    return await workspace_service.update(workspace, data, user.id)


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    workspace_id: str, user: Annotated[User, Depends(get_current_user)]
):
    workspace = await workspace_service.get(workspace_id)
    permission_service.require_owner(
        await workspace_service.member(workspace_id, user.id)
    )
    await workspace_service.delete(workspace.id)


@router.post("/{workspace_id}/join", response_model=WorkspaceResponse)
async def join_workspace(
    workspace_id: str, data: JoinWorkspaceRequest,
    user: Annotated[User, Depends(get_current_user)],
):
    return await workspace_service.join(
        await workspace_service.get(workspace_id), user.id, data.password
    )


@router.post("/{workspace_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_workspace(
    workspace_id: str, user: Annotated[User, Depends(get_current_user)]
):
    workspace = await workspace_service.get(workspace_id)
    permission_service.require_member(
        await workspace_service.member(workspace_id, user.id)
    )
    await workspace_service.leave(workspace, user.id)


# ── Editor Access Requests ──

@router.post("/{workspace_id}/editor-requests", status_code=status.HTTP_201_CREATED)
async def request_editor_access(
    workspace_id: str, user: Annotated[User, Depends(get_current_user)]
):
    """Submit a request for editor access. Viewer-only, validated by service."""
    request = await editor_request_service.request_access(workspace_id, user.id)
    return {"id": request["_id"], **{k: v for k, v in request.items() if k != "_id"}}


@router.get("/{workspace_id}/editor-requests")
async def list_editor_requests(
    workspace_id: str, user: Annotated[User, Depends(get_current_user)]
):
    """List all pending editor access requests. Owner-only."""
    permission_service.require_owner(
        await workspace_service.member(workspace_id, user.id)
    )
    requests = await editor_request_service.list_pending(workspace_id)
    return [{"id": r["_id"], **{k: v for k, v in r.items() if k != "_id"}} for r in requests]


@router.get("/{workspace_id}/editor-requests/my-status")
async def my_editor_request_status(
    workspace_id: str, user: Annotated[User, Depends(get_current_user)]
):
    """Check the current user's editor access request status."""
    permission_service.require_member(
        await workspace_service.member(workspace_id, user.id)
    )
    request = await editor_request_service.get_status(workspace_id, user.id)
    if not request:
        return {"status": None}
    return {"id": request["_id"], **{k: v for k, v in request.items() if k != "_id"}}


@router.post("/{workspace_id}/editor-requests/{request_id}/{decision}")
async def decide_editor_request(
    workspace_id: str, request_id: str, decision: str,
    user: Annotated[User, Depends(get_current_user)],
):
    """Approve or reject an editor access request. Owner-only, validated by service."""
    result = await editor_request_service.decide(request_id, decision, user.id)
    return {"id": result["_id"], **{k: v for k, v in result.items() if k != "_id"}}


# ── Invite Links ──

@router.post("/{workspace_id}/invites", status_code=status.HTTP_201_CREATED)
async def create_invite(
    workspace_id: str, data: InviteCreateRequest,
    user: Annotated[User, Depends(get_current_user)],
):
    """Generate an invite link. Owner-only."""
    result = await invite_service.generate(workspace_id, user.id, data.expiration)
    return {"id": result["_id"], **{k: v for k, v in result.items() if k != "_id"}}


@router.get("/{workspace_id}/invites")
async def list_invites(
    workspace_id: str, user: Annotated[User, Depends(get_current_user)]
):
    """List all active invite links. Owner-only."""
    invites = await invite_service.list_active(workspace_id, user.id)
    return [{"id": inv["_id"], **{k: v for k, v in inv.items() if k != "_id"}} for inv in invites]


@router.delete("/{workspace_id}/invites/{token}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invite(
    workspace_id: str, token: str,
    user: Annotated[User, Depends(get_current_user)],
):
    """Revoke a single invite token. Owner-only."""
    await invite_service.revoke(workspace_id, token, user.id)


@router.delete("/{workspace_id}/invites", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_all_invites(
    workspace_id: str, user: Annotated[User, Depends(get_current_user)]
):
    """Revoke all active invite tokens. Owner-only."""
    await invite_service.revoke_all(workspace_id, user.id)


# ── Members ──

@router.get("/{workspace_id}/members", response_model=list[WorkspaceMemberResponse])
async def list_members(
    workspace_id: str, user: Annotated[User, Depends(get_current_user)]
):
    permission_service.require_member(
        await workspace_service.member(workspace_id, user.id)
    )
    return await workspace_service.members(workspace_id)


@router.patch("/{workspace_id}/members/{member_id}", response_model=WorkspaceMemberResponse)
async def change_member_role(
    workspace_id: str, member_id: str, data: MemberRoleUpdate,
    user: Annotated[User, Depends(get_current_user)],
):
    permission_service.require_owner(
        await workspace_service.member(workspace_id, user.id)
    )
    member = await workspace_service.set_member_role(workspace_id, member_id, data.role)
    target = await workspace_service.members(workspace_id)
    return next(item for item in target if item.user_id == member.user_id)


@router.delete("/{workspace_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    workspace_id: str, member_id: str,
    user: Annotated[User, Depends(get_current_user)],
):
    current_member = permission_service.require_owner(
        await workspace_service.member(workspace_id, user.id)
    )
    target_member = await workspace_service.member(workspace_id, member_id)
    if not target_member:
        raise HTTPException(status_code=404, detail="Workspace member not found")
    if target_member.role == "owner":
        raise HTTPException(status_code=403, detail="You cannot remove the owner")
    await workspace_service.leave(
        await workspace_service.get(workspace_id), member_id
    )
