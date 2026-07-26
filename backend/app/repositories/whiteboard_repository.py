from datetime import datetime, timezone
from uuid import uuid4
from app.db.mongodb import database
from app.models.whiteboard import Whiteboard

class WhiteboardRepository:
    _memory: dict[str, dict] = {}
    async def create(self, workspace_id: str, title: str, created_by: str) -> Whiteboard:
        now = datetime.now(timezone.utc)
        record = {"_id": str(uuid4()), "workspace_id": workspace_id, "title": title, "board_data": {"objects": [], "background": "#ffffff", "zoom": 1}, "created_by": created_by, "created_at": now, "updated_at": now}
        if database.db is not None: await database.db.whiteboards.insert_one(record)
        else: self._memory[record["_id"]] = record
        return Whiteboard.model_validate(record)
    async def find(self, whiteboard_id: str) -> Whiteboard | None:
        record = await database.db.whiteboards.find_one({"_id": whiteboard_id}) if database.db is not None else self._memory.get(whiteboard_id)
        return Whiteboard.model_validate(record) if record else None
    async def list_for_workspace(self, workspace_id: str) -> list[Whiteboard]:
        if database.db is not None: records = await database.db.whiteboards.find({"workspace_id": workspace_id}).sort("updated_at", -1).to_list(None)
        else: records = sorted((item for item in self._memory.values() if item["workspace_id"] == workspace_id), key=lambda item: item["updated_at"], reverse=True)
        return [Whiteboard.model_validate(record) for record in records]
    async def update(self, whiteboard_id: str, changes: dict) -> Whiteboard | None:
        changes["updated_at"] = datetime.now(timezone.utc)
        if database.db is not None: await database.db.whiteboards.update_one({"_id": whiteboard_id}, {"$set": changes})
        elif whiteboard_id in self._memory: self._memory[whiteboard_id].update(changes)
        return await self.find(whiteboard_id)
    async def delete(self, whiteboard_id: str) -> None:
        if database.db is not None: await database.db.whiteboards.delete_one({"_id": whiteboard_id})
        else: self._memory.pop(whiteboard_id, None)

whiteboard_repository = WhiteboardRepository()
