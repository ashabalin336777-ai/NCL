import asyncio
import sys

import asyncpg
from redis.asyncio import Redis

from app.core.config import settings


def _sync_dsn(async_url: str) -> str:
    return async_url.replace("postgresql+asyncpg://", "postgresql://", 1)


async def wait_for_postgres(retries: int = 40, delay: float = 1.5) -> None:
    dsn = _sync_dsn(settings.database_url)
    last_error: Exception | None = None
    for _ in range(retries):
        try:
            connection = await asyncpg.connect(dsn)
            await connection.close()
            return
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            await asyncio.sleep(delay)
    raise RuntimeError(f"PostgreSQL is not ready: {last_error}")


async def wait_for_redis(retries: int = 40, delay: float = 1.5) -> None:
    last_error: Exception | None = None
    for _ in range(retries):
        client = Redis.from_url(settings.redis_url, decode_responses=True)
        try:
            if await client.ping():
                await client.aclose()
                return
        except Exception as exc:  # noqa: BLE001
            last_error = exc
        finally:
            await client.aclose()
        await asyncio.sleep(delay)
    raise RuntimeError(f"Redis is not ready: {last_error}")


async def main() -> None:
    await wait_for_postgres()
    await wait_for_redis()
    print("Infrastructure is ready")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:  # noqa: BLE001
        print(exc, file=sys.stderr)
        sys.exit(1)
