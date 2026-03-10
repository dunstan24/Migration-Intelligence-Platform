"""
cache/redis_client.py
Redis client — HTTP response cache + background job queue broker
Per README: /api/data/* responses cached with TTL
"""
import logging
from config import settings

logger = logging.getLogger(__name__)
_redis = None


async def get_redis():
    global _redis
    if _redis is None:
        try:
            import redis.asyncio as aioredis
            _redis = await aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
            )
        except Exception as e:
            logger.warning(f"Redis unavailable: {e} — running without cache")
            _redis = None
    return _redis


async def get_cache(key: str) -> str | None:
    """Check Redis cache — return value or None (MISS)."""
    r = await get_redis()
    if not r:
        return None
    try:
        return await r.get(key)
    except Exception:
        return None


async def set_cache(key: str, value: str, ttl: int = None) -> None:
    """Set Redis cache with TTL (seconds). Default dari settings.CACHE_DEFAULT_TTL."""
    r = await get_redis()
    if not r:
        return
    try:
        await r.setex(key, ttl or settings.CACHE_DEFAULT_TTL, value)
    except Exception as e:
        logger.warning(f"Cache set failed: {e}")
