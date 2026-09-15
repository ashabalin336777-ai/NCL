"""Ensure Sol model tariffs exist in ai_settings.model_tariffs."""
import asyncio

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.ai_setting import AISetting
from app.services.ai_settings import DEFAULT_TARIFFS


async def main() -> None:
    async with SessionLocal() as session:
        result = await session.execute(
            select(AISetting).where(AISetting.key == "model_tariffs")
        )
        row = result.scalar_one_or_none()
        current = dict(row.value) if row and isinstance(row.value, dict) else {}
        changed = False
        for model, rates in DEFAULT_TARIFFS.items():
            if model not in current:
                current[model] = rates
                changed = True
                print("added tariff", model)
        if row is None:
            session.add(AISetting(key="model_tariffs", value=current or DEFAULT_TARIFFS))
            changed = True
            print("created model_tariffs")
        elif changed:
            row.value = current
        if changed:
            await session.commit()
        else:
            print("tariffs ok")


if __name__ == "__main__":
    asyncio.run(main())
