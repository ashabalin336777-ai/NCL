import asyncio
import logging
import shutil
import subprocess
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

_FFMPEG = shutil.which("ffmpeg")


def ffmpeg_available() -> bool:
    return bool(_FFMPEG)


def to_wav_pcm16k(content: bytes, filename: str) -> tuple[bytes, str]:
    """Convert browser audio (webm/ogg/mp4/…) to 16 kHz mono WAV for Whisper."""
    suffix = Path(filename).suffix.lower() or ".webm"
    if suffix == ".wav" and content[:4] == b"RIFF":
        return content, "speech.wav"

    if not _FFMPEG:
        return content, filename

    with tempfile.TemporaryDirectory(prefix="ncl-stt-") as tmp:
        src = Path(tmp) / f"input{suffix}"
        dst = Path(tmp) / "speech.wav"
        src.write_bytes(content)
        cmd = [
            _FFMPEG,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(src),
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            str(dst),
        ]
        try:
            subprocess.run(cmd, check=True, capture_output=True, timeout=60)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
            detail = ""
            if isinstance(exc, subprocess.CalledProcessError):
                detail = (exc.stderr or b"").decode("utf-8", errors="ignore")[:300]
            logger.warning("ffmpeg convert failed for %s: %s", filename, detail or exc)
            return content, filename
        if not dst.exists() or dst.stat().st_size < 44:
            logger.warning("ffmpeg produced empty wav for %s", filename)
            return content, filename
        return dst.read_bytes(), "speech.wav"


async def to_wav_pcm16k_async(content: bytes, filename: str) -> tuple[bytes, str]:
    return await asyncio.to_thread(to_wav_pcm16k, content, filename)
