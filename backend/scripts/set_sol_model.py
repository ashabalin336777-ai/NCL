import asyncio

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.ai_setting import AISetting

TARGET = "qwen3.6-35b-a3b-noreason"
OLD = {
    "qwen3.8-27b-noreason",
    "qwen3.8-27b",
    "neuraldeep/qwen2.5-72b-instruct",
    "qwen3.6-fp8-noreason",
    "qwen3.6-fp8",
}


async def main() -> None:
    async with SessionLocal() as session:
        result = await session.execute(
            select(AISetting).where(AISetting.key == "analyst_model_id")
        )
        row = result.scalar_one_or_none()
        if row is None:
            session.add(AISetting(key="analyst_model_id", value=TARGET))
            await session.commit()
            print("created", TARGET)
            return
        current = str(row.value).strip()
        if current != TARGET:
            print(f"{current} -> {TARGET}")
            row.value = TARGET
            await session.commit()
        else:
            print("ok", current)


if __name__ == "__main__":
    asyncio.run(main())
