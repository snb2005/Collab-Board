from fastapi import HTTPException, status

from app.models.workspace import WorkspaceMember


class PermissionService:
    @staticmethod
    def require_member(member: WorkspaceMember | None) -> WorkspaceMember:
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this workspace")
        return member

    @staticmethod
    def require_editor(member: WorkspaceMember | None) -> WorkspaceMember:
        """Require editor or owner role."""
        member = PermissionService.require_member(member)
        if member.role not in {"owner", "editor"}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Editor permission is required")
        return member

    @staticmethod
    def require_admin(member: WorkspaceMember | None) -> WorkspaceMember:
        member = PermissionService.require_member(member)
        if member.role != "owner":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin permission is required")
        return member

    @staticmethod
    def require_owner(member: WorkspaceMember | None) -> WorkspaceMember:
        member = PermissionService.require_member(member)
        if member.role != "owner":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the workspace owner can do this")
        return member


permission_service = PermissionService()
