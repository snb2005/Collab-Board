import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException, status

from app.repositories.invite_repository import invite_repository
from app.services.workspace_service import workspace_service


EXPIRATION_MAP = {
    "1h": timedelta(hours=1),
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
}


class InviteService:
    async def generate(self, workspace_id: str, owner_id: str, expiration: str) -> dict:
        """Generate an invite link for a workspace. Owner-only."""
        # Validate workspace exists
        workspace = await workspace_service.get(workspace_id)

        # Validate owner
        member = await workspace_service.member(workspace_id, owner_id)
        if not member or member.role != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the workspace owner can generate invite links",
            )

        # Validate expiration
        delta = EXPIRATION_MAP.get(expiration)
        if not delta:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid expiration. Use: {', '.join(EXPIRATION_MAP.keys())}",
            )

        now = datetime.now(timezone.utc)
        token = secrets.token_urlsafe(32)

        record = {
            "_id": str(uuid4()),
            "token": token,
            "workspace_id": workspace_id,
            "created_by": owner_id,
            "expires_at": now + delta,
            "revoked": False,
            "created_at": now,
        }

        await invite_repository.create(record)
        return record

    async def join_via_invite(self, token: str, user_id: str) -> dict:
        """Join a workspace via invite token. Bypasses password for private workspaces."""
        # Find the token
        invite = await invite_repository.find(token)
        if not invite:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid or expired invite link",
            )

        workspace_id = invite["workspace_id"]
        workspace = await workspace_service.get(workspace_id)

        # Check if already a member
        existing = await workspace_service.member(workspace_id, user_id)
        if existing:
            return {
                "workspace": await workspace_service.to_response(workspace, existing),
                "already_member": True,
            }

        # Determine role based on workspace visibility
        if workspace.visibility == "public":
            role = "editor"
        else:
            role = "viewer"

        # Join directly — bypassing password check
        from app.repositories.workspace_repository import workspace_repository
        member = await workspace_repository.add_member(workspace_id, user_id, role)

        return {
            "workspace": await workspace_service.to_response(workspace, member),
            "already_member": False,
        }

    async def validate_token(self, token: str) -> dict:
        """Validate a token and return workspace info without joining."""
        invite = await invite_repository.find(token)
        if not invite:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid or expired invite link",
            )
        workspace = await workspace_service.get(invite["workspace_id"])
        return {
            "workspace_id": workspace.id,
            "workspace_name": workspace.name,
            "workspace_description": workspace.description,
            "visibility": workspace.visibility,
            "expires_at": invite["expires_at"],
        }

    async def revoke(self, workspace_id: str, token: str, owner_id: str) -> None:
        """Revoke a single invite token."""
        member = await workspace_service.member(workspace_id, owner_id)
        if not member or member.role != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the workspace owner can revoke invite links",
            )
        revoked = await invite_repository.revoke(token)
        if not revoked:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invite token not found",
            )

    async def revoke_all(self, workspace_id: str, owner_id: str) -> int:
        """Revoke all active invite tokens for a workspace."""
        member = await workspace_service.member(workspace_id, owner_id)
        if not member or member.role != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the workspace owner can revoke invite links",
            )
        return await invite_repository.revoke_all(workspace_id)

    async def list_active(self, workspace_id: str, owner_id: str) -> list[dict]:
        """List all active invite tokens for a workspace. Owner-only."""
        member = await workspace_service.member(workspace_id, owner_id)
        if not member or member.role != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the workspace owner can view invite links",
            )
        return await invite_repository.list_active(workspace_id)


invite_service = InviteService()
