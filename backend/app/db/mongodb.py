import logging
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings

logger = logging.getLogger(__name__)


class Database:
    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None

    async def connect(self) -> None:
        try:
            self.client = AsyncIOMotorClient(settings.mongodb_url, serverSelectionTimeoutMS=1500)
            await self.client.admin.command("ping")
            self.db = self.client[settings.mongodb_database]
            await self.db.users.create_index("email", unique=True)
            await self.db.workspaces.create_index("owner_id")
            await self.db.workspaces.create_index("visibility")
            await self.db.workspace_members.create_index([("workspace_id", 1), ("user_id", 1)], unique=True)
            await self.db.workspace_members.create_index("user_id")
            await self.db.whiteboards.create_index("workspace_id")
            await self.db.versions.create_index([("whiteboard_id", 1), ("version_number", 1)])
            await self.db.comments.create_index("whiteboard_id")
            await self.db.notifications.create_index([("user_id", 1), ("read", 1)])
            await self.db.editor_access_requests.create_index([("workspace_id", 1), ("requester_id", 1), ("status", 1)])
            await self.db.invite_tokens.create_index("token", unique=True)
            await self.db.invite_tokens.create_index([("workspace_id", 1), ("revoked", 1)])
            logger.info("Connected to MongoDB")
        except Exception:
            self.client = None
            self.db = None
            logger.warning("MongoDB unavailable; using in-memory development repository")

    async def close(self) -> None:
        if self.client:
            self.client.close()


database = Database()
