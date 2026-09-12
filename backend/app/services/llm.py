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


def http_timeout(seconds: int) -> httpx.Timeout:
    return httpx.Timeout(connect=25.0, read=float(seconds), write=30.0, pool=15.0)


async def llm_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=http_timeout(120),
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
        )
    return _http_client


async def close_llm_client() -> None:
    global _http_client
    if _http_client is not None:
        await _http_client.aclose()
        _http_client = None


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
    input_rate, output_rate = runtime.rate_for(model)
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
        raise RateLimitError("NeuralDEEP rate limit exceeded")
    if response.status_code in {401, 403}:
        raise LLMResponseError("NeuralDEEP rejected the API key")
    raise LLMResponseError(f"NeuralDEEP error {response.status_code}")


async def _post_completion(
    runtime: AIRuntimeSettings,
    payload: dict[str, Any],
) -> dict[str, Any]:
    assert_neuraldeep_model(str(payload["model"]))
    url = f"{runtime.base_url}/chat/completions"
    client = await llm_client()
    try:
        response = await client.post(
            url,
            headers=_headers(runtime),
            json=payload,
            timeout=http_timeout(max(runtime.timeout_seconds, 120)),
        )
    except httpx.TimeoutException as exc:
        raise LLMTimeoutError() from exc
    except httpx.RequestError as exc:
        raise LLMResponseError("NeuralDEEP connection failed") from exc
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
) -> tuple[str, UsageInfo]:
    last_error: Exception | None = None
    retries = runtime.max_retries if max_retries is None else max_retries
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
) -> tuple[T, UsageInfo]:
    last_error: Exception | None = None
    working_messages = list(messages)
    schema_keys = ", ".join(schema.model_fields.keys())
    retries = runtime.max_retries if max_retries is None else max_retries
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
                timeout=http_timeout(max(runtime.timeout_seconds, 120)),
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
                "NeuralDEEP stream connect failed (attempt %s): %s", attempt + 1, exc
            )
            if collected:
                raise LLMResponseError("NeuralDEEP connection failed") from exc
            last_error = LLMResponseError("NeuralDEEP connection failed")
            last_error.__cause__ = exc
        except LLMResponseError as exc:
            if "rejected the API key" in str(exc):
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
    raise LLMResponseError("NeuralDEEP connection failed") from last_error


async def transcribe_audio(
    runtime: AIRuntimeSettings,
    *,
    content: bytes,
    filename: str,
    content_type: str,
    model: str = "whisper-podlodka-turbo",
    language: str = "ru",
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
    try:
        client = await llm_client()
        response = await client.post(
            url,
            headers=headers,
            files=files,
            data=data,
            timeout=http_timeout(max(runtime.timeout_seconds, 120)),
        )
    except httpx.TimeoutException as exc:
        raise LLMTimeoutError() from exc
    except httpx.RequestError as exc:
        raise LLMResponseError("NeuralDEEP connection failed") from exc

    if response.status_code >= 400:
        detail = response.text[:400]
        logger.warning("NeuralDEEP STT error %s: %s", response.status_code, detail)
        if response.status_code == 429:
            raise RateLimitError("NeuralDEEP rate limit exceeded")
        if response.status_code in {401, 403}:
            raise LLMResponseError("NeuralDEEP rejected the API key")
        # fallback model once
        if model != "whisper-1":
            return await transcribe_audio(
                runtime,
                content=content,
                filename=filename,
                content_type=content_type,
                model="whisper-1",
                language=language,
            )
        raise LLMResponseError(f"Speech recognition error {response.status_code}")

    payload = response.json()
    text = str(payload.get("text") or "").strip()
    if not text:
        raise LLMResponseError("Пустой результат распознавания речи")

    # Whisper часто не отдаёт usage — считаем оценку по длине
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
