from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException, status

from app.core.security import hash_password, verify_password
from app.models.workspace import Workspace, WorkspaceMember
from app.repositories.user_repository import user_repository
from app.repositories.workspace_repository import workspace_repository
from app.schemas.workspace import WorkspaceCreate, WorkspaceMemberResponse, WorkspaceResponse, WorkspaceUpdate


class WorkspaceService:
    async def create(self, data: WorkspaceCreate, owner_id: str) -> WorkspaceResponse:
        now = datetime.now(timezone.utc)
        workspace = await workspace_repository.create({
            "_id": str(uuid4()), "name": data.name.strip(), "description": data.description.strip(), "owner_id": owner_id,
            "visibility": data.visibility, "password_hash": hash_password(data.password) if data.password else None,
            "created_at": now, "updated_at": now,
        })
        member = await workspace_repository.add_member(workspace.id, owner_id, "owner")
        return await self.to_response(workspace, member)

    async def get(self, workspace_id: str) -> Workspace:
        workspace = await workspace_repository.find(workspace_id)
        if not workspace:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
        return workspace

    async def member(self, workspace_id: str, user_id: str) -> WorkspaceMember | None:
        return await workspace_repository.member(workspace_id, user_id)

    async def mine(self, user_id: str) -> list[WorkspaceResponse]:
        workspaces = await workspace_repository.workspaces_for_user(user_id)
        return [await self.to_response(workspace, await self.member(workspace.id, user_id)) for workspace in workspaces]

    async def search(self, query: str, user_id: str) -> list[WorkspaceResponse]:
        workspaces = await workspace_repository.search_all(query.strip())
        return [await self.to_response(workspace, await self.member(workspace.id, user_id)) for workspace in workspaces]

    async def update(self, workspace: Workspace, data: WorkspaceUpdate, requester_id: str) -> WorkspaceResponse:
        changes = data.model_dump(exclude_unset=True, exclude={"password", "clear_password"})
        if data.visibility == "public":
            changes["password_hash"] = None
        if data.password is not None:
            if data.visibility == "public" or (data.visibility is None and workspace.visibility == "public"):
                raise HTTPException(status_code=422, detail="Public workspaces cannot have a password")
            changes["password_hash"] = hash_password(data.password)
        elif data.clear_password:
            changes["password_hash"] = None
        if "name" in changes:
            changes["name"] = changes["name"].strip()
        if "description" in changes:
            changes["description"] = changes["description"].strip()
        updated = await workspace_repository.update(workspace.id, changes)
        return await self.to_response(updated, await self.member(updated.id, requester_id))

    async def delete(self, workspace_id: str) -> None:
        await workspace_repository.delete(workspace_id)

    async def join(self, workspace: Workspace, user_id: str, password: str | None) -> WorkspaceResponse:
        existing = await self.member(workspace.id, user_id)
        if existing:
            return await self.to_response(workspace, existing)
        if workspace.visibility == "private":
            if not workspace.password_hash or not password or not verify_password(password, workspace.password_hash):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="A valid workspace password is required")
        member = await workspace_repository.add_member(workspace.id, user_id, "viewer" if workspace.visibility == "private" else "editor")
        return await self.to_response(workspace, member)

    async def leave(self, workspace: Workspace, user_id: str) -> None:
        if workspace.owner_id == user_id:
            raise HTTPException(status_code=400, detail="Transfer ownership or delete the workspace instead of leaving it")
        await workspace_repository.remove_member(workspace.id, user_id)

    async def members(self, workspace_id: str) -> list[WorkspaceMemberResponse]:
        members = await workspace_repository.members_for_workspace(workspace_id)
        response = []
        for member in members:
            user = await user_repository.find_by_id(member.user_id)
            if user:
                response.append(WorkspaceMemberResponse(user_id=user.id, name=user.name, email=user.email, role=member.role, joined_at=member.joined_at))
        return response

    async def set_member_role(self, workspace_id: str, user_id: str, role: str) -> WorkspaceMember:
        member = await workspace_repository.member(workspace_id, user_id)
        if not member:
            raise HTTPException(status_code=404, detail="Workspace member not found")
        if member.role == "owner":
            raise HTTPException(status_code=400, detail="The owner role cannot be changed")
        return await workspace_repository.update_member_role(workspace_id, user_id, role)

    async def to_response(self, workspace: Workspace, member: WorkspaceMember | None) -> WorkspaceResponse:
        members = await workspace_repository.members_for_workspace(workspace.id)
        return WorkspaceResponse(id=workspace.id, name=workspace.name, description=workspace.description, owner_id=workspace.owner_id,
            visibility=workspace.visibility, is_password_protected=bool(workspace.password_hash), role=member.role if member else None,
            member_count=len(members), created_at=workspace.created_at, updated_at=workspace.updated_at)


workspace_service = WorkspaceService()
