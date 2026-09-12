from app.core.exceptions import LLMResponseError

NEURALDEEP_BASE_URL = "https://api.neuraldeep.ru/v1"

ALLOWED_MODELS = frozenset(
    {
        "qwen3.8-27b",
        "qwen3.8-27b-noreason",
        "qwen3.6-35b-a3b",
        "qwen3.6-35b-a3b-noreason",
        "qwen3.6-fp8",
        "qwen3.6-fp8-noreason",
        "kimi-k2.6",
        "whisper-1",
        "whisper-podlodka-turbo",
        "gigaam-v3",
    }
)

_BLOCKED_MARKERS = (
    "gpt",
    "openai",
    "chatgpt",
    "o1-",
    "o3-",
    "o4-",
    "davinci",
    "gpt-oss",
)


def is_blocked_model(model_id: str) -> bool:
    lowered = model_id.strip().lower()
    return any(marker in lowered for marker in _BLOCKED_MARKERS)


def assert_neuraldeep_model(model_id: str) -> str:
    model = model_id.strip()
    if is_blocked_model(model):
        raise LLMResponseError(
            f"Модель '{model}' запрещена: линейка GPT/OpenAI не используется. "
            "Доступны только модели NeuralDEEP."
        )
    if model not in ALLOWED_MODELS:
        raise LLMResponseError(
            f"Модель '{model}' не из каталога NeuralDEEP PRO (РФ). "
            f"Разрешены: {', '.join(sorted(ALLOWED_MODELS))}."
        )
    return model


def assert_neuraldeep_base_url(url: str) -> str:
    cleaned = url.strip().rstrip("/")
    lowered = cleaned.lower()
    if "openai.com" in lowered or "api.openai" in lowered:
        raise LLMResponseError("OpenAI API отключён. Используйте https://api.neuraldeep.ru/v1")
    if "neuraldeep.ru" not in lowered:
        return NEURALDEEP_BASE_URL
    return cleaned
