import asyncio
import time

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.ai_setting import AISetting
from app.services.ai_settings import load_ai_settings
from app.services.llm import complete_text


async def main() -> None:
    async with SessionLocal() as session:
        runtime = await load_ai_settings(session)
        for model in ("qwen3.8-27b-noreason", "qwen3.6-fp8-noreason"):
            t0 = time.perf_counter()
            try:
                text, usage = await complete_text(
                    runtime,
                    model=model,
                    messages=[
                        {"role": "system", "content": "Ответь одним коротким JSON: {\"ok\": true}"},
                        {"role": "user", "content": "ping"},
                    ],
                    temperature=0,
                    max_tokens=40,
                    session_key="ncl-bench",
                    max_retries=0,
                    read_timeout=60,
                )
                print(model, f"{time.perf_counter()-t0:.1f}s", usage.total_tokens, text[:80])
            except Exception as exc:
                print(model, f"{time.perf_counter()-t0:.1f}s", type(exc).__name__, exc)

        row = await session.execute(
            select(AISetting).where(AISetting.key == "analyst_model_id")
        )
        setting = row.scalar_one_or_none()
        print("current_analyst", setting.value if setting else None)


if __name__ == "__main__":
    asyncio.run(main())
