"""Try STT with a generated short wav and list audio models."""
import asyncio
import io
import struct
import time
import wave

import httpx

from app.core.database import SessionLocal
from app.services.ai_settings import load_ai_settings


def make_wav(seconds: float = 1.0, rate: int = 16000) -> bytes:
    frames = int(rate * seconds)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        # quiet tone-ish silence with tiny noise so it's not empty
        data = b"".join(struct.pack("<h", (i % 37) * 20) for i in range(frames))
        wf.writeframes(data)
    return buf.getvalue()


async def main() -> None:
    async with SessionLocal() as session:
        runtime = await load_ai_settings(session)

    wav = make_wav(1.5)
    print("wav_bytes", len(wav))

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(connect=30, read=120, write=120, pool=60)
    ) as client:
        resp = await client.get(
            f"{runtime.base_url.rstrip('/')}/models",
            headers={"Authorization": f"Bearer {runtime.api_key}"},
        )
        models = resp.json().get("data") or []
        audioish = []
        for item in models:
            mid = str(item.get("id") or "")
            blob = str(item).lower()
            if any(k in blob for k in ("whisper", "audio", "speech", "gigaam", "stt", "asr")):
                audioish.append(mid)
        print("audio_models", audioish[:50])

        for model in ("whisper-1", "whisper-podlodka-turbo", "gigaam-v3"):
            t0 = time.perf_counter()
            try:
                resp = await client.post(
                    f"{runtime.base_url.rstrip('/')}/audio/transcriptions",
                    headers={"Authorization": f"Bearer {runtime.api_key}"},
                    data={"model": model, "language": "ru", "response_format": "json"},
                    files={"file": ("speech.wav", wav, "audio/wav")},
                )
                print(model, resp.status_code, f"{time.perf_counter()-t0:.1f}s", resp.text[:250])
            except Exception as exc:
                print(model, type(exc).__name__, f"{time.perf_counter()-t0:.1f}s", exc)


if __name__ == "__main__":
    asyncio.run(main())
