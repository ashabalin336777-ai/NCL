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
        for item in sorted(data, key=lambda x: str(x.get("id") or "")):
            mid = str(item.get("id") or "")
            print(mid)


if __name__ == "__main__":
    asyncio.run(main())
