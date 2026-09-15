import asyncio
import json
import logging
from collections.abc import AsyncIterator
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.core.exceptions import LLMResponseError, LLMTimeoutError, RateLimitError
from app.schemas.ai import UsageInfo
from app.services.ai_settings import AIRuntimeSettings
from app.services.neuraldeep_models import assert_neuraldeep_model

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

ChatMessage = dict[str, str]

_http_client: httpx.AsyncClient | None = None

DEFAULT_LLM_TIMEOUT_SEC = 180
STT_MIN_TIMEOUT_SEC = 300


def http_timeout(seconds: int, *, write: float | None = None) -> httpx.Timeout:
    """Read timeout for LLM/STT; write must be high enough for large audio uploads."""
    write_sec = float(write if write is not None else max(120.0, float(seconds)))
    # Pool wait must not be tiny: streaming chat can briefly occupy connections.
    return httpx.Timeout(connect=30.0, read=float(seconds), write=write_sec, pool=60.0)


def base_read_timeout(runtime: AIRuntimeSettings) -> int:
    return max(int(runtime.timeout_seconds), DEFAULT_LLM_TIMEOUT_SEC)


def timeout_for_messages(runtime: AIRuntimeSettings, messages: list[ChatMessage]) -> int:
    """Long pasted/voice replies need extra time before first token."""
    chars = sum(len(str(item.get("content") or "")) for item in messages)
    # ~1s per ~600 characters of prompt, capped.
    boost = min(180, max(0, chars // 600))
    return base_read_timeout(runtime) + boost


def timeout_for_audio(runtime: AIRuntimeSettings, content_bytes: int) -> int:
    """Short clips should finish quickly; scale only for large payloads."""
    mb = max(1, (content_bytes + 1024 * 1024 - 1) // (1024 * 1024))
    if content_bytes < 512 * 1024:
        return max(base_read_timeout(runtime), 90)
    sized = 90 + mb * 45
    return max(base_read_timeout(runtime), STT_MIN_TIMEOUT_SEC, sized)


_stt_client: httpx.AsyncClient | None = None


async def llm_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=http_timeout(DEFAULT_LLM_TIMEOUT_SEC),
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
        )
    return _http_client


async def stt_client() -> httpx.AsyncClient:
    """Separate client so chat streams do not starve speech recognition."""
    global _stt_client
    if _stt_client is None or _stt_client.is_closed:
        _stt_client = httpx.AsyncClient(
            timeout=http_timeout(90),
            limits=httpx.Limits(max_keepalive_connections=4, max_connections=8),
        )
    return _stt_client


async def close_llm_client() -> None:
    global _http_client
    global _stt_client
    if _http_client is not None:
        await _http_client.aclose()
        _http_client = None
    if _stt_client is not None:
        await _stt_client.aclose()
        _stt_client = None


def money(value: Decimal | float | int) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def calc_cost(
    runtime: AIRuntimeSettings,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
) -> Decimal:
    """Стоимость для клиента: тариф NeuralDEEP × billing_markup_multiplier."""
    input_rate, output_rate = runtime.customer_rate_for(model)
    raw = (Decimal(prompt_tokens) / Decimal(1000) * input_rate) + (
        Decimal(completion_tokens) / Decimal(1000) * output_rate
    )
    return money(raw)


def usage_from_payload(
    runtime: AIRuntimeSettings,
    model: str,
    payload: dict[str, Any],
    fallback_completion: str = "",
) -> UsageInfo:
    usage = payload.get("usage") or {}
    prompt_tokens = int(usage.get("prompt_tokens") or 0)
    completion_tokens = int(usage.get("completion_tokens") or 0)
    if prompt_tokens == 0 and completion_tokens == 0:
        completion_tokens = estimate_tokens(fallback_completion)
    total = int(usage.get("total_tokens") or (prompt_tokens + completion_tokens))
    return UsageInfo(
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total,
        cost_rub=calc_cost(runtime, model, prompt_tokens, completion_tokens),
    )


def _headers(runtime: AIRuntimeSettings) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {runtime.api_key}",
        "Content-Type": "application/json",
    }


def _raise_http_error(response: httpx.Response) -> None:
    if response.status_code == 429:
        raise RateLimitError("Слишком много запросов, подождите немного")
    if response.status_code in {401, 403}:
        raise LLMResponseError("Ошибка авторизации AI-сервиса")
    raise LLMResponseError(f"Ошибка AI-сервиса ({response.status_code})")


async def _post_completion(
    runtime: AIRuntimeSettings,
    payload: dict[str, Any],
    *,
    read_timeout: int | None = None,
) -> dict[str, Any]:
    assert_neuraldeep_model(str(payload["model"]))
    url = f"{runtime.base_url}/chat/completions"
    client = await llm_client()
    timeout_sec = read_timeout if read_timeout is not None else base_read_timeout(runtime)
    try:
        response = await client.post(
            url,
            headers=_headers(runtime),
            json=payload,
            timeout=http_timeout(timeout_sec),
        )
    except httpx.TimeoutException as exc:
        raise LLMTimeoutError() from exc
    except httpx.RequestError as exc:
        raise LLMResponseError("Не удалось подключиться к AI-сервису") from exc
    if response.status_code >= 400:
        _raise_http_error(response)
    return response.json()


def _message_text(payload: dict[str, Any]) -> str:
    choices = payload.get("choices") or []
    if not choices:
        return ""
    message = choices[0].get("message") or {}
    return str(message.get("content") or "")


async def complete_text(
    runtime: AIRuntimeSettings,
    *,
    model: str,
    messages: list[ChatMessage],
    temperature: float,
    max_tokens: int,
    session_key: str,
    max_retries: int | None = None,
    read_timeout: int | None = None,
) -> tuple[str, UsageInfo]:
    last_error: Exception | None = None
    retries = runtime.max_retries if max_retries is None else max_retries
    effective_timeout = (
        read_timeout if read_timeout is not None else timeout_for_messages(runtime, messages)
    )
    for attempt in range(retries + 1):
        try:
            payload = await _post_completion(
                runtime,
                {
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "user": session_key,
                },
                read_timeout=effective_timeout,
            )
            content = _message_text(payload).strip()
            if not content:
                raise LLMResponseError("LLM returned an empty message")
            return content, usage_from_payload(runtime, model, payload, content)
        except LLMTimeoutError as exc:
            last_error = exc
        except RateLimitError as exc:
            last_error = exc
        except LLMResponseError as exc:
            if "rejected the API key" in str(exc):
                raise
            last_error = exc
        if attempt < retries:
            await asyncio.sleep(0.8 * (attempt + 1))
            continue
        break
    if isinstance(last_error, LLMTimeoutError):
        raise last_error
    raise LLMResponseError("LLM request failed") from last_error


def _extract_json_object(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise LLMResponseError("LLM did not return JSON")
    return text[start : end + 1]


async def complete_structured(
    runtime: AIRuntimeSettings,
    *,
    model: str,
    messages: list[ChatMessage],
    schema: type[T],
    temperature: float,
    max_tokens: int,
    session_key: str,
    max_retries: int | None = None,
    read_timeout: int | None = None,
) -> tuple[T, UsageInfo]:
    last_error: Exception | None = None
    working_messages = list(messages)
    schema_keys = ", ".join(schema.model_fields.keys())
    retries = runtime.max_retries if max_retries is None else max_retries
    effective_timeout = (
        read_timeout if read_timeout is not None else timeout_for_messages(runtime, messages)
    )
    for attempt in range(retries + 1):
        try:
            payload = await _post_completion(
                runtime,
                {
                    "model": model,
                    "messages": working_messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "user": session_key,
                    "response_format": {"type": "json_object"},
                },
                read_timeout=effective_timeout,
            )
            raw = _message_text(payload)
            parsed = schema.model_validate_json(_extract_json_object(raw))
            return parsed, usage_from_payload(runtime, model, payload, raw)
        except (ValidationError, LLMResponseError, json.JSONDecodeError) as exc:
            logger.warning("Structured output attempt %s failed: %s", attempt + 1, exc)
            last_error = exc
            if attempt < retries:
                working_messages = [
                    *working_messages,
                    {
                        "role": "user",
                        "content": (
                            "Предыдущий ответ неверный. Верни ТОЛЬКО один JSON-объект "
                            f"строго с ключами: {schema_keys}. "
                            "Не возвращай карточку клиента и не пиши текст вне JSON. "
                            f"Ошибка: {exc}."
                        ),
                    },
                ]
        except LLMTimeoutError as exc:
            last_error = exc
        except RateLimitError as exc:
            last_error = exc
        if attempt < retries:
            await asyncio.sleep(0.8 * (attempt + 1))
    if isinstance(last_error, LLMTimeoutError):
        raise last_error
    raise LLMResponseError("LLM returned invalid structured JSON") from last_error


async def stream_text(
    runtime: AIRuntimeSettings,
    *,
    model: str,
    messages: list[ChatMessage],
    temperature: float,
    max_tokens: int,
    session_key: str,
    max_retries: int | None = None,
    read_timeout: int | None = None,
) -> AsyncIterator[tuple[str, UsageInfo | None]]:
    assert_neuraldeep_model(model)
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "user": session_key,
        "stream": True,
        "stream_options": {"include_usage": True},
    }
    url = f"{runtime.base_url}/chat/completions"
    last_error: Exception | None = None
    retries = runtime.max_retries if max_retries is None else max_retries
    timeout_sec = (
        read_timeout if read_timeout is not None else timeout_for_messages(runtime, messages)
    )

    for attempt in range(retries + 1):
        collected: list[str] = []
        final_usage: UsageInfo | None = None
        try:
            client = await llm_client()
            async with client.stream(
                "POST",
                url,
                headers=_headers(runtime),
                json=payload,
                timeout=http_timeout(timeout_sec),
            ) as response:
                if response.status_code >= 400:
                    await response.aread()
                    _raise_http_error(response)
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    chunk = json.loads(data)
                    usage = chunk.get("usage")
                    if usage:
                        final_usage = usage_from_payload(runtime, model, {"usage": usage})
                    choices = chunk.get("choices") or []
                    if not choices:
                        continue
                    delta = (choices[0].get("delta") or {}).get("content") or ""
                    if delta:
                        collected.append(delta)
                        yield delta, None

            text = "".join(collected).strip()
            if not text:
                raise LLMResponseError("LLM returned an empty stream")
            if final_usage is None:
                prompt_tokens = estimate_tokens(json.dumps(messages, ensure_ascii=False))
                completion_tokens = estimate_tokens(text)
                final_usage = UsageInfo(
                    model=model,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=prompt_tokens + completion_tokens,
                    cost_rub=calc_cost(runtime, model, prompt_tokens, completion_tokens),
                )
            yield "", final_usage
            return
        except httpx.TimeoutException as exc:
            if collected:
                raise LLMTimeoutError() from exc
            last_error = LLMTimeoutError()
            last_error.__cause__ = exc
        except httpx.RequestError as exc:
            logger.warning(
                "LLM stream connect failed (attempt %s): %s", attempt + 1, exc
            )
            if collected:
                raise LLMResponseError("Не удалось подключиться к AI-сервису") from exc
            last_error = LLMResponseError("Не удалось подключиться к AI-сервису")
            last_error.__cause__ = exc
        except LLMResponseError as exc:
            if "авторизации" in str(exc).lower() or "api key" in str(exc).lower():
                raise
            if collected:
                raise
            last_error = exc
        if attempt < retries:
            await asyncio.sleep(0.8 * (attempt + 1))
            continue
        break

    if isinstance(last_error, LLMTimeoutError):
        raise last_error
    raise LLMResponseError("Не удалось подключиться к AI-сервису") from last_error


async def transcribe_audio(
    runtime: AIRuntimeSettings,
    *,
    content: bytes,
    filename: str,
    content_type: str,
    model: str = "whisper-1",
    language: str = "ru",
    _attempted: set[str] | None = None,
    _network_tries: int = 0,
) -> tuple[str, UsageInfo]:
    """Speech-to-text через NeuralDEEP (OpenAI-compatible /audio/transcriptions)."""
    model = assert_neuraldeep_model(model)
    url = f"{runtime.base_url.rstrip('/')}/audio/transcriptions"
    headers = {"Authorization": f"Bearer {runtime.api_key}"}
    files = {"file": (filename, content, content_type or "application/octet-stream")}
    data = {
        "model": model,
        "language": language,
        "response_format": "json",
    }
    timeout_sec = timeout_for_audio(runtime, len(content))
    attempted = set(_attempted or set())
    attempted.add(model)
    fallbacks = ["whisper-1", "gigaam-v3", "whisper-podlodka-turbo"]

    try:
        client = await stt_client()
        response = await client.post(
            url,
            headers=headers,
            files=files,
            data=data,
            timeout=http_timeout(timeout_sec, write=max(60.0, float(timeout_sec))),
        )
    except httpx.ConnectTimeout as exc:
        raise LLMTimeoutError(
            "Не удалось подключиться к сервису распознавания. Проверьте сеть и попробуйте ещё раз."
        ) from exc
    except httpx.PoolTimeout as exc:
        raise LLMTimeoutError(
            "Сервис распознавания сейчас занят. Подождите пару секунд и повторите запись."
        ) from exc
    except httpx.WriteTimeout as exc:
        raise LLMTimeoutError(
            "Не удалось отправить аудио на распознавание. Попробуйте ещё раз."
        ) from exc
    except httpx.ReadTimeout as exc:
        next_model = next((item for item in fallbacks if item not in attempted), None)
        if next_model:
            logger.warning("STT read timeout on %s, falling back to %s", model, next_model)
            return await transcribe_audio(
                runtime,
                content=content,
                filename=filename,
                content_type=content_type,
                model=next_model,
                language=language,
                _attempted=attempted,
                _network_tries=_network_tries,
            )
        raise LLMTimeoutError(
            "Распознавание речи не успело завершиться. Повторите короче или отправьте текстом."
        ) from exc
    except httpx.TimeoutException as exc:
        raise LLMTimeoutError(
            "Распознавание речи не успело завершиться. Повторите короче или отправьте текстом."
        ) from exc
    except httpx.RequestError as exc:
        logger.warning(
            "STT network error model=%s file=%s bytes=%s try=%s: %s: %s",
            model,
            filename,
            len(content),
            _network_tries,
            type(exc).__name__,
            exc,
        )
        if _network_tries < 1:
            global _stt_client
            if _stt_client is not None:
                await _stt_client.aclose()
                _stt_client = None
            await asyncio.sleep(0.4)
            return await transcribe_audio(
                runtime,
                content=content,
                filename=filename,
                content_type=content_type,
                model=model,
                language=language,
                _attempted=attempted - {model},
                _network_tries=_network_tries + 1,
            )
        next_model = next((item for item in fallbacks if item not in attempted), None)
        if next_model:
            return await transcribe_audio(
                runtime,
                content=content,
                filename=filename,
                content_type=content_type,
                model=next_model,
                language=language,
                _attempted=attempted,
                _network_tries=0,
            )
        raise LLMResponseError(
            "Не удалось связаться с сервисом распознавания. Повторите запись через несколько секунд."
        ) from exc

    if response.status_code >= 400:
        detail = response.text[:400]
        logger.warning("STT error %s model=%s: %s", response.status_code, model, detail)
        if response.status_code == 429:
            raise RateLimitError("Слишком много запросов, подождите немного")
        if response.status_code in {401, 403}:
            raise LLMResponseError("Ошибка авторизации сервиса распознавания")
        next_model = next((item for item in fallbacks if item not in attempted), None)
        if next_model:
            return await transcribe_audio(
                runtime,
                content=content,
                filename=filename,
                content_type=content_type,
                model=next_model,
                language=language,
                _attempted=attempted,
                _network_tries=_network_tries,
            )
        raise LLMResponseError("Сервис распознавания временно недоступен. Попробуйте ещё раз.")

    payload = response.json()
    text = str(payload.get("text") or "").strip()
    if not text:
        raise LLMResponseError("Не расслышали речь. Говорите чуть громче и повторите запись.")

    usage = usage_from_payload(runtime, model, payload if "usage" in payload else {}, text)
    if usage.total_tokens <= 0:
        approx = estimate_tokens(text)
        usage = UsageInfo(
            model=model,
            prompt_tokens=approx,
            completion_tokens=0,
            total_tokens=approx,
            cost_rub=calc_cost(runtime, model, approx, 0),
        )
    return text, usage
