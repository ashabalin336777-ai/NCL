"""Raise stored llm_timeout_seconds if below the new floor."""
import asyncio

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.ai_setting import AISetting

FLOOR = 180


async def main() -> None:
    async with SessionLocal() as session:
        result = await session.execute(
            select(AISetting).where(AISetting.key == "llm_timeout_seconds")
        )
        row = result.scalar_one_or_none()
        if row is None:
            session.add(AISetting(key="llm_timeout_seconds", value=FLOOR))
            await session.commit()
            print(f"created llm_timeout_seconds={FLOOR}")
            return
        try:
            current = int(row.value)
        except (TypeError, ValueError):
            current = 0
        if current < FLOOR:
            row.value = FLOOR
            await session.commit()
            print(f"updated llm_timeout_seconds {current} -> {FLOOR}")
        else:
            print(f"ok llm_timeout_seconds={current}")


if __name__ == "__main__":
    asyncio.run(main())
