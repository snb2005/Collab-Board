from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException, status

from app.repositories.editor_request_repository import editor_request_repository
from app.repositories.user_repository import user_repository
from app.services.workspace_service import workspace_service
from app.services.collaboration_service import collaboration_service


class EditorRequestService:
    async def request_access(self, workspace_id: str, requester_id: str) -> dict:
        """Submit an editor access request. Validates viewer role, membership, and no duplicates."""
        # Verify workspace exists
        workspace = await workspace_service.get(workspace_id)

        # Verify requester is a member
        member = await workspace_service.member(workspace_id, requester_id)
        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this workspace",
            )

        # Verify requester is a viewer
        if member.role != "viewer":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only viewers can request editor access",
            )

        # Check for existing pending request
        existing = await editor_request_repository.find_pending(workspace_id, requester_id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You already have a pending editor access request",
            )

        # Create the request
        now = datetime.now(timezone.utc)
        request = {
            "_id": str(uuid4()),
            "workspace_id": workspace_id,
            "requester_id": requester_id,
            "status": "pending",
            "created_at": now,
            "handled_by": None,
            "handled_at": None,
        }
        await editor_request_repository.create(request)

        # Get requester name for notification
        requester = await user_repository.find_by_id(requester_id)
        requester_name = requester.name if requester else "Unknown"

        # Notify workspace owner
        await collaboration_service.notify(
            workspace.owner_id,
            "editor_request",
            "Editor Access Request",
            f"{requester_name} requested Editor access",
            {
                "workspace_id": workspace_id,
                "request_id": request["_id"],
                "requester_id": requester_id,
                "requester_name": requester_name,
            },
        )

        return request

    async def decide(self, request_id: str, decision: str, handler_id: str) -> dict:
        """Approve or reject an editor access request."""
        if decision not in {"approve", "reject"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Decision must be 'approve' or 'reject'",
            )

        # Find the request
        request = await editor_request_repository.find_by_id(request_id)
        if not request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Editor access request not found",
            )

        # Verify request is still pending
        if request["status"] != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Request has already been {request['status']}",
            )

        # Verify handler is workspace owner
        workspace = await workspace_service.get(request["workspace_id"])
        handler_member = await workspace_service.member(workspace.id, handler_id)
        if not handler_member or handler_member.role != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the workspace owner can approve/reject requests",
            )

        # Update status
        new_status = "approved" if decision == "approve" else "rejected"
        updated = await editor_request_repository.update_status(request_id, new_status, handler_id)

        # If approved, change role to editor
        if decision == "approve":
            await workspace_service.set_member_role(
                request["workspace_id"], request["requester_id"], "editor"
            )

        # Notify the requester
        requester_name = "Your"
        if decision == "approve":
            await collaboration_service.notify(
                request["requester_id"],
                "editor_request_approved",
                "Editor Access Approved",
                f"Your editor access request has been approved",
                {"workspace_id": request["workspace_id"], "request_id": request_id},
            )
        else:
            await collaboration_service.notify(
                request["requester_id"],
                "editor_request_rejected",
                "Editor Access Rejected",
                f"Your editor access request has been rejected",
                {"workspace_id": request["workspace_id"], "request_id": request_id},
            )

        return updated

    async def get_status(self, workspace_id: str, user_id: str) -> dict | None:
        """Get the latest request status for a user in a workspace."""
        return await editor_request_repository.latest_for_requester(workspace_id, user_id)

    async def list_pending(self, workspace_id: str) -> list[dict]:
        """List all pending requests for a workspace, enriched with requester names."""
        requests = await editor_request_repository.list_pending(workspace_id)
        enriched = []
        for req in requests:
            requester = await user_repository.find_by_id(req["requester_id"])
            req["requester_name"] = requester.name if requester else "Unknown"
            req["requester_email"] = requester.email if requester else ""
            enriched.append(req)
        return enriched


editor_request_service = EditorRequestService()
