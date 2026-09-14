from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import LLMUnavailableError
from app.models.ai_setting import AISetting
from app.services.neuraldeep_models import (
    NEURALDEEP_BASE_URL,
    assert_neuraldeep_base_url,
    assert_neuraldeep_model,
    is_blocked_model,
)

DEFAULT_TARIFFS: dict[str, dict[str, float]] = {
    "kimi-k2.6": {"input": 0.09975, "output": 0.42},
    "qwen3.6-fp8": {"input": 0.00714, "output": 0.0408},
    "qwen3.8-27b": {"input": 0.02448, "output": 0.122},
    "qwen3.6-35b-a3b": {"input": 0.00714, "output": 0.0408},
    "qwen3.6-fp8-noreason": {"input": 0.00714, "output": 0.0408},
    "qwen3.8-27b-noreason": {"input": 0.02448, "output": 0.122},
    "qwen3.6-35b-a3b-noreason": {"input": 0.00714, "output": 0.0408},
}


class AIRuntimeSettings(BaseModel):
    base_url: str
    api_key: str
    client_model_id: str
    card_model_id: str
    hint_model_id: str
    analyst_model_id: str
    radar_model_id: str
    timeout_seconds: int
    max_retries: int = 2
    default_input_rate: Decimal = Decimal("0.02448")
    default_output_rate: Decimal = Decimal("0.122")
    tariffs: dict[str, dict[str, float]] = Field(default_factory=lambda: DEFAULT_TARIFFS)
    # Наценка к себестоимости NeuralDEEP: клиент (менеджер/РОП) платит base × multiplier
    billing_markup_multiplier: Decimal = Decimal("15")

    def rate_for(self, model: str) -> tuple[Decimal, Decimal]:
        """Базовые ставки NeuralDEEP (без наценки), ₽ / 1k токенов."""
        item = self.tariffs.get(model)
        if item is None:
            return self.default_input_rate, self.default_output_rate
        return Decimal(str(item["input"])), Decimal(str(item["output"]))

    def customer_rate_for(self, model: str) -> tuple[Decimal, Decimal]:
        """Ставки для клиента: база × множитель наценки."""
        input_rate, output_rate = self.rate_for(model)
        mult = self.billing_markup_multiplier
        if mult <= 0:
            mult = Decimal("1")
        return input_rate * mult, output_rate * mult

    def customer_tariffs(self) -> dict[str, dict[str, float]]:
        mult = float(self.billing_markup_multiplier)
        if mult <= 0:
            mult = 1.0
        return {
            model: {
                "input": float(rates["input"]) * mult,
                "output": float(rates["output"]) * mult,
            }
            for model, rates in self.tariffs.items()
        }


def _as_str(value: Any, fallback: str) -> str:
    if value is None:
        return fallback
    if isinstance(value, str):
        return value
    return str(value)


def _as_int(value: Any, fallback: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def _as_decimal(value: Any, fallback: Decimal) -> Decimal:
    try:
        return Decimal(str(value))
    except Exception:  # noqa: BLE001
        return fallback


def _as_tariffs(value: Any) -> dict[str, dict[str, float]]:
    if not isinstance(value, dict):
        return dict(DEFAULT_TARIFFS)
    merged = dict(DEFAULT_TARIFFS)
    for model, rates in value.items():
        if is_blocked_model(str(model)):
            continue
        if isinstance(rates, dict) and "input" in rates and "output" in rates:
            merged[str(model)] = {
                "input": float(rates["input"]),
                "output": float(rates["output"]),
            }
    return merged


async def load_ai_settings(session: AsyncSession) -> AIRuntimeSettings:
    result = await session.execute(select(AISetting))
    stored = {row.key: row.value for row in result.scalars().all()}
    api_key = _as_str(stored.get("llm_api_key"), settings.llm_api_key).strip()
    if api_key in {"", "not-needed"}:
        api_key = settings.llm_api_key.strip()
    if not api_key or api_key == "not-needed":
        raise LLMUnavailableError(
            "Задайте LLM_API_KEY в .env — ключ NeuralDEEP PRO (sk-...)"
        )
    return AIRuntimeSettings(
        base_url=assert_neuraldeep_base_url(
            _as_str(stored.get("llm_base_url"), settings.llm_base_url or NEURALDEEP_BASE_URL)
        ),
        api_key=api_key,
        client_model_id=assert_neuraldeep_model(
            _as_str(stored.get("client_model_id"), "qwen3.6-fp8-noreason")
        ),
        card_model_id=assert_neuraldeep_model(
            _as_str(stored.get("card_model_id"), "qwen3.6-fp8-noreason")
        ),
        hint_model_id=assert_neuraldeep_model(
            _as_str(stored.get("hint_model_id"), "qwen3.6-fp8-noreason")
        ),
        analyst_model_id=assert_neuraldeep_model(
            _as_str(stored.get("analyst_model_id"), "qwen3.8-27b-noreason")
        ),
        radar_model_id=assert_neuraldeep_model(
            _as_str(stored.get("radar_model_id"), "qwen3.6-fp8-noreason")
        ),
        timeout_seconds=_as_int(stored.get("llm_timeout_seconds"), settings.llm_timeout_seconds),
        max_retries=settings.llm_max_retries,
        default_input_rate=_as_decimal(
            stored.get("cost_per_1k_input_tokens_rub"), Decimal("0.02448")
        ),
        default_output_rate=_as_decimal(
            stored.get("cost_per_1k_output_tokens_rub"), Decimal("0.122")
        ),
        tariffs=_as_tariffs(stored.get("model_tariffs")),
        billing_markup_multiplier=_as_decimal(
            stored.get("billing_markup_multiplier"), Decimal("15")
        ),
    )
