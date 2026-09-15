import asyncio
import io
import struct
import time
import wave

import httpx

from app.core.database import SessionLocal
from app.services.ai_settings import load_ai_settings
from app.services.llm import stt_client, transcribe_audio


def make_wav(seconds: float = 1.0, rate: int = 16000) -> bytes:
    frames = int(rate * seconds)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        data = b"".join(struct.pack("<h", (i % 37) * 40) for i in range(frames))
        wf.writeframes(data)
    return buf.getvalue()


async def main() -> None:
    async with SessionLocal() as session:
        runtime = await load_ai_settings(session)

    wav = make_wav(1.2)
    print("base", runtime.base_url)
    print("wav", len(wav))

    client = await stt_client()
    t0 = time.perf_counter()
    try:
        resp = await client.post(
            f"{runtime.base_url.rstrip('/')}/audio/transcriptions",
            headers={"Authorization": f"Bearer {runtime.api_key}"},
            data={"model": "whisper-1", "language": "ru", "response_format": "json"},
            files={"file": ("speech.wav", wav, "audio/wav")},
        )
        print("direct", resp.status_code, f"{time.perf_counter()-t0:.1f}s", resp.text[:200])
    except Exception as exc:
        print("direct err", type(exc).__name__, f"{time.perf_counter()-t0:.1f}s", exc)

    t1 = time.perf_counter()
    try:
        text, usage = await transcribe_audio(
            runtime,
            content=wav,
            filename="speech.wav",
            content_type="audio/wav",
            model="whisper-1",
        )
        print("helper", repr(text), usage.model, f"{time.perf_counter()-t1:.1f}s")
    except Exception as exc:
        print("helper err", type(exc).__name__, f"{time.perf_counter()-t1:.1f}s", exc)


if __name__ == "__main__":
    asyncio.run(main())
