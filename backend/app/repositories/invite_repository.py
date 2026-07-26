import secrets
from datetime import datetime, timezone
from uuid import uuid4

from app.db.mongodb import database
from app.db.redis import redis_client


class InviteRepository:
    _invites: dict[str, dict] = {}

    async def create(self, record: dict) -> dict:
        """Store invite token in Redis (with TTL) and MongoDB for persistence."""
        token = record["token"]
        ttl_seconds = int((record["expires_at"] - datetime.now(timezone.utc)).total_seconds())

        if redis_client.client and ttl_seconds > 0:
            import json
            await redis_client.client.setex(
                f"invite:{token}",
                ttl_seconds,
                json.dumps(record, default=str),
            )

        if database.db is not None:
            await database.db.invite_tokens.insert_one(record)
        else:
            self._invites[token] = record

        return record

    async def find(self, token: str) -> dict | None:
        """Look up invite token — Redis first, then MongoDB, then in-memory."""
        # Try Redis first (fastest, respects TTL)
        if redis_client.client:
            import json
            data = await redis_client.client.get(f"invite:{token}")
            if data:
                result = json.loads(data)
                # Ensure datetime fields are proper
                if isinstance(result.get("expires_at"), str):
                    result["expires_at"] = datetime.fromisoformat(result["expires_at"])
                if isinstance(result.get("created_at"), str):
                    result["created_at"] = datetime.fromisoformat(result["created_at"])
                return result

        # Fallback to MongoDB
        if database.db is not None:
            record = await database.db.invite_tokens.find_one({"token": token, "revoked": False})
            if record:
                # Check if expired
                if record.get("expires_at") and record["expires_at"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
                    return None
                return record
            return None

        # In-memory fallback
        record = self._invites.get(token)
        if record and not record.get("revoked", False):
            expires = record.get("expires_at")
            if isinstance(expires, str):
                expires = datetime.fromisoformat(expires)
            if expires and expires.replace(tzinfo=None) < datetime.now(timezone.utc).replace(tzinfo=None):
                return None
            return record
        return None

    async def revoke(self, token: str) -> bool:
        """Revoke an invite token."""
        # Remove from Redis
        if redis_client.client:
            await redis_client.client.delete(f"invite:{token}")

        # Mark revoked in MongoDB
        if database.db is not None:
            result = await database.db.invite_tokens.update_one(
                {"token": token}, {"$set": {"revoked": True}}
            )
            return result.modified_count > 0

        # In-memory
        if token in self._invites:
            self._invites[token]["revoked"] = True
            return True
        return False

    async def revoke_all(self, workspace_id: str) -> int:
        """Revoke all active invite tokens for a workspace."""
        count = 0

        if database.db is not None:
            tokens = await database.db.invite_tokens.find({
                "workspace_id": workspace_id, "revoked": False
            }).to_list(None)
            for tok in tokens:
                if redis_client.client:
                    await redis_client.client.delete(f"invite:{tok['token']}")
                count += 1
            await database.db.invite_tokens.update_many(
                {"workspace_id": workspace_id, "revoked": False},
                {"$set": {"revoked": True}},
            )
        else:
            for tok in list(self._invites.values()):
                if tok["workspace_id"] == workspace_id and not tok.get("revoked", False):
                    tok["revoked"] = True
                    if redis_client.client:
                        await redis_client.client.delete(f"invite:{tok['token']}")
                    count += 1

        return count

    async def list_active(self, workspace_id: str) -> list[dict]:
        """List all non-expired, non-revoked tokens for a workspace."""
        now = datetime.now(timezone.utc)

        if database.db is not None:
            records = await database.db.invite_tokens.find({
                "workspace_id": workspace_id,
                "revoked": False,
                "expires_at": {"$gt": now},
            }).sort("created_at", -1).to_list(None)
            return records

        return sorted(
            [
                r for r in self._invites.values()
                if r["workspace_id"] == workspace_id
                and not r.get("revoked", False)
                and r["expires_at"] > now
            ],
            key=lambda x: x["created_at"],
            reverse=True,
        )


invite_repository = InviteRepository()
