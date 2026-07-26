from datetime import datetime, timezone
from uuid import uuid4

from app.db.mongodb import database
from app.models.editor_request import EditorAccessRequest


class EditorRequestRepository:
    _requests: dict[str, dict] = {}

    async def create(self, record: dict) -> dict:
        if database.db is not None:
            await database.db.editor_access_requests.insert_one(record)
        else:
            self._requests[record["_id"]] = record
        return record

    async def find_by_id(self, request_id: str) -> dict | None:
        if database.db is not None:
            return await database.db.editor_access_requests.find_one({"_id": request_id})
        return self._requests.get(request_id)

    async def find_pending(self, workspace_id: str, requester_id: str) -> dict | None:
        """Check if a pending request already exists for this user in this workspace."""
        if database.db is not None:
            return await database.db.editor_access_requests.find_one({
                "workspace_id": workspace_id,
                "requester_id": requester_id,
                "status": "pending",
            })
        for req in self._requests.values():
            if (req["workspace_id"] == workspace_id
                    and req["requester_id"] == requester_id
                    and req["status"] == "pending"):
                return req
        return None

    async def list_pending(self, workspace_id: str) -> list[dict]:
        """List all pending requests for a workspace."""
        if database.db is not None:
            return await database.db.editor_access_requests.find({
                "workspace_id": workspace_id,
                "status": "pending",
            }).sort("created_at", -1).to_list(None)
        return sorted(
            [r for r in self._requests.values()
             if r["workspace_id"] == workspace_id and r["status"] == "pending"],
            key=lambda x: x["created_at"],
            reverse=True,
        )

    async def latest_for_requester(self, workspace_id: str, requester_id: str) -> dict | None:
        """Get the most recent request (any status) for a user in a workspace."""
        if database.db is not None:
            cursor = database.db.editor_access_requests.find({
                "workspace_id": workspace_id,
                "requester_id": requester_id,
            }).sort("created_at", -1).limit(1)
            results = await cursor.to_list(1)
            return results[0] if results else None
        matches = [
            r for r in self._requests.values()
            if r["workspace_id"] == workspace_id and r["requester_id"] == requester_id
        ]
        if not matches:
            return None
        return max(matches, key=lambda x: x["created_at"])

    async def update_status(self, request_id: str, status: str, handled_by: str) -> dict | None:
        """Update the status of an editor access request."""
        now = datetime.now(timezone.utc)
        changes = {"status": status, "handled_by": handled_by, "handled_at": now}
        if database.db is not None:
            await database.db.editor_access_requests.update_one(
                {"_id": request_id}, {"$set": changes}
            )
            return await self.find_by_id(request_id)
        if request_id in self._requests:
            self._requests[request_id].update(changes)
            return self._requests[request_id]
        return None


editor_request_repository = EditorRequestRepository()
