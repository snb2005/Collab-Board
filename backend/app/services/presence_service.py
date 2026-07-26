from app.db.redis import redis_client


class PresenceService:
    async def join_whiteboard(self, whiteboard_id: str, user_id: str) -> None:
        if redis_client.client:
            await redis_client.client.sadd(f"whiteboard:{whiteboard_id}", user_id)

    async def leave_whiteboard(self, whiteboard_id: str, user_id: str) -> None:
        if redis_client.client:
            await redis_client.client.srem(f"whiteboard:{whiteboard_id}", user_id)

    async def set_cursor(self, whiteboard_id: str, user_id: str, x: float, y: float) -> None:
        if redis_client.client:
            await redis_client.client.hset(f"cursor:{whiteboard_id}", user_id, f"{x},{y}")
            await redis_client.client.expire(f"cursor:{whiteboard_id}", 60)


presence_service = PresenceService()
