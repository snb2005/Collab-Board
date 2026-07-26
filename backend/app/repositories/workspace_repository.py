from datetime import datetime, timezone
from uuid import uuid4

from app.db.mongodb import database
from app.models.workspace import Workspace, WorkspaceMember


class WorkspaceRepository:
    _workspaces: dict[str, dict] = {}
    _members: dict[tuple[str, str], dict] = {}

    async def create(self, record: dict) -> Workspace:
        if database.db is not None:
            await database.db.workspaces.insert_one(record)
        else:
            self._workspaces[record["_id"]] = record
        return Workspace.model_validate(record)

    async def find(self, workspace_id: str) -> Workspace | None:
        record = await database.db.workspaces.find_one({"_id": workspace_id}) if database.db is not None else self._workspaces.get(workspace_id)
        return Workspace.model_validate(record) if record else None

    async def update(self, workspace_id: str, changes: dict) -> Workspace | None:
        changes["updated_at"] = datetime.now(timezone.utc)
        if database.db is not None:
            await database.db.workspaces.update_one({"_id": workspace_id}, {"$set": changes})
        elif workspace_id in self._workspaces:
            self._workspaces[workspace_id].update(changes)
        return await self.find(workspace_id)

    async def delete(self, workspace_id: str) -> None:
        if database.db is not None:
            await database.db.workspaces.delete_one({"_id": workspace_id})
            await database.db.workspace_members.delete_many({"workspace_id": workspace_id})
        else:
            self._workspaces.pop(workspace_id, None)
            for key in [key for key in self._members if key[0] == workspace_id]:
                self._members.pop(key)

    async def add_member(self, workspace_id: str, user_id: str, role: str) -> WorkspaceMember:
        record = {"_id": str(uuid4()), "workspace_id": workspace_id, "user_id": user_id, "role": role, "joined_at": datetime.now(timezone.utc)}
        if database.db is not None:
            await database.db.workspace_members.update_one({"workspace_id": workspace_id, "user_id": user_id}, {"$setOnInsert": record}, upsert=True)
            record = await database.db.workspace_members.find_one({"workspace_id": workspace_id, "user_id": user_id})
        else:
            record = self._members.setdefault((workspace_id, user_id), record)
        return WorkspaceMember.model_validate(record)

    async def member(self, workspace_id: str, user_id: str) -> WorkspaceMember | None:
        record = await database.db.workspace_members.find_one({"workspace_id": workspace_id, "user_id": user_id}) if database.db is not None else self._members.get((workspace_id, user_id))
        return WorkspaceMember.model_validate(record) if record else None

    async def update_member_role(self, workspace_id: str, user_id: str, role: str) -> WorkspaceMember | None:
        if database.db is not None:
            await database.db.workspace_members.update_one({"workspace_id": workspace_id, "user_id": user_id}, {"$set": {"role": role}})
        elif (workspace_id, user_id) in self._members:
            self._members[(workspace_id, user_id)]["role"] = role
        return await self.member(workspace_id, user_id)

    async def remove_member(self, workspace_id: str, user_id: str) -> None:
        if database.db is not None:
            await database.db.workspace_members.delete_one({"workspace_id": workspace_id, "user_id": user_id})
        else:
            self._members.pop((workspace_id, user_id), None)

    async def members_for_workspace(self, workspace_id: str) -> list[WorkspaceMember]:
        if database.db is not None:
            records = await database.db.workspace_members.find({"workspace_id": workspace_id}).to_list(None)
        else:
            records = [record for (wid, _), record in self._members.items() if wid == workspace_id]
        return [WorkspaceMember.model_validate(record) for record in records]

    async def workspace_ids_for_user(self, user_id: str) -> list[str]:
        if database.db is not None:
            records = await database.db.workspace_members.find({"user_id": user_id}, {"workspace_id": 1}).to_list(None)
            return [record["workspace_id"] for record in records]
        return [wid for (wid, uid) in self._members if uid == user_id]

    async def workspaces_for_user(self, user_id: str) -> list[Workspace]:
        ids = await self.workspace_ids_for_user(user_id)
        if database.db is not None:
            records = await database.db.workspaces.find({"_id": {"$in": ids}}).sort("updated_at", -1).to_list(None)
        else:
            records = sorted((self._workspaces[wid] for wid in ids if wid in self._workspaces), key=lambda item: item["updated_at"], reverse=True)
        return [Workspace.model_validate(record) for record in records]

    async def search_all(self, query: str) -> list[Workspace]:
        """Search all workspaces (public + private) by name or description."""
        if database.db is not None:
            filter_query = {"$or": [{"name": {"$regex": query, "$options": "i"}}, {"description": {"$regex": query, "$options": "i"}}]}
            records = await database.db.workspaces.find(filter_query).sort("updated_at", -1).limit(30).to_list(None)
        else:
            query = query.lower()
            records = [record for record in self._workspaces.values() if query in record["name"].lower() or query in record["description"].lower()]
        return [Workspace.model_validate(record) for record in records]


workspace_repository = WorkspaceRepository()
