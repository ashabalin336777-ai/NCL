from fastapi import APIRouter
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import DbSession, RedisClient
from app.core.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


@router.get("/ready")
async def ready(session: DbSession, redis: RedisClient) -> dict[str, str]:
    await _check_db(session)
    await _check_redis(redis)
    return {"status": "ready"}


async def _check_db(session: AsyncSession) -> None:
    await session.execute(text("SELECT 1"))


async def _check_redis(redis: Redis) -> None:
    pong = await redis.ping()
    if not pong:
        raise RuntimeError("Redis ping failed")
