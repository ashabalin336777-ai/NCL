from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel

from app.api.v1.deps import CurrentUser, DbSession
from app.core.exceptions import LLMResponseError
from app.schemas.ai import UsageInfo
from app.services.ai_settings import load_ai_settings
from app.services.audio_convert import to_wav_pcm16k_async
from app.services.llm import transcribe_audio

router = APIRouter(prefix="/speech", tags=["speech"])

MAX_AUDIO_BYTES = 8 * 1024 * 1024
# whisper-1 — стабильный sync STT NeuralDEEP для коротких клипов.
SPEECH_MODEL = "whisper-1"


class TranscribeResponse(BaseModel):
    text: str
    model: str
    usage: UsageInfo | None = None


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_speech(
    session: DbSession,
    _user: CurrentUser,
    file: UploadFile = File(...),
) -> TranscribeResponse:
    content = await file.read()
    if not content:
        raise LLMResponseError("Пустой аудиофайл")
    if len(content) > MAX_AUDIO_BYTES:
        raise LLMResponseError("Аудио слишком большое (макс. 8 МБ)")

    runtime = await load_ai_settings(session)
    filename = file.filename or "speech.webm"
    content, filename = await to_wav_pcm16k_async(content, filename)
    content_type = (
        "audio/wav"
        if filename.lower().endswith(".wav")
        else (file.content_type or "application/octet-stream")
    )
    text, usage = await transcribe_audio(
        runtime,
        content=content,
        filename=filename,
        content_type=content_type,
        model=SPEECH_MODEL,
        language="ru",
    )
    return TranscribeResponse(text=text, model=usage.model or SPEECH_MODEL, usage=usage)
