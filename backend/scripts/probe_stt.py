import asyncio
import time

import httpx
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.ai_setting import AISetting
from app.services.ai_settings import load_ai_settings


async def main() -> None:
    async with SessionLocal() as session:
        runtime = await load_ai_settings(session)
        row = await session.execute(
            select(AISetting).where(AISetting.key == "llm_timeout_seconds")
        )
        print("timeout setting", row.scalar_one().value)

    print("base", runtime.base_url)
    print("key_prefix", (runtime.api_key or "")[:10])

    async with httpx.AsyncClient(timeout=httpx.Timeout(connect=20, read=60, write=60, pool=20)) as client:
        t0 = time.perf_counter()
        try:
            resp = await client.get(
                f"{runtime.base_url.rstrip('/')}/models",
                headers={"Authorization": f"Bearer {runtime.api_key}"},
            )
            print("models", resp.status_code, f"{time.perf_counter()-t0:.1f}s", resp.text[:500])
        except Exception as exc:
            print("models err", type(exc).__name__, f"{time.perf_counter()-t0:.1f}s", exc)

        # Generate minimal valid-ish webm is hard; send tiny bytes to see API reaction.
        for model in ("whisper-podlodka-turbo", "whisper-1"):
            t1 = time.perf_counter()
            try:
                resp = await client.post(
                    f"{runtime.base_url.rstrip('/')}/audio/transcriptions",
                    headers={"Authorization": f"Bearer {runtime.api_key}"},
                    data={"model": model, "language": "ru", "response_format": "json"},
                    files={"file": ("speech.webm", b"\x1a\x45\xdf\xa3" + b"0" * 4000, "audio/webm")},
                )
                print(
                    "stt",
                    model,
                    resp.status_code,
                    f"{time.perf_counter()-t1:.1f}s",
                    resp.text[:400],
                )
            except Exception as exc:
                print("stt err", model, type(exc).__name__, f"{time.perf_counter()-t1:.1f}s", exc)


if __name__ == "__main__":
    asyncio.run(main())
