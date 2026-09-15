import asyncio

import httpx

from app.core.database import SessionLocal
from app.services.ai_settings import load_ai_settings


async def main() -> None:
    async with SessionLocal() as session:
        runtime = await load_ai_settings(session)
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(
            f"{runtime.base_url.rstrip('/')}/models",
            headers={"Authorization": f"Bearer {runtime.api_key}"},
        )
        data = resp.json().get("data") or []
        for item in data:
            mid = str(item.get("id") or "")
            if "qwen" in mid.lower() and ("27" in mid or "35" in mid or "fp8" in mid or "int4" in mid):
                print(mid)


if __name__ == "__main__":
    asyncio.run(main())
