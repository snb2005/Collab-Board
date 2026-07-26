import logging

import redis.asyncio as redis

from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisClient:
    client: redis.Redis | None = None

    async def connect(self) -> None:
        try:
            self.client = redis.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=1)
            await self.client.ping()
            logger.info("Connected to Redis")
        except Exception:
            self.client = None
            logger.warning("Redis unavailable; refresh-token revocation is disabled")

    async def close(self) -> None:
        if self.client:
            await self.client.aclose()


redis_client = RedisClient()
