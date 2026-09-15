"""Curated Sol (analyst) models for developer admin."""

from __future__ import annotations

from typing import TypedDict


class SolModelOption(TypedDict):
    id: str
    title: str
    comment: str
    recommended: bool


SOL_JSON_GUARD = (
    "НЕ используй теги <think> или рассуждения, выдавай ТОЛЬКО валидный JSON."
)

# Optimized NeuralDEEP shortlist for Sol JSON analysis.
SOL_MODEL_OPTIONS: tuple[SolModelOption, ...] = (
    {
        "id": "qwen3.8-27b-noreason",
        "title": "Qwen3.8-27B-noreason",
        "comment": "Эталонное качество. Максимальная точность понимания контекста и строгого JSON.",
        "recommended": False,
    },
    {
        "id": "qwen3.8-27b-fp8-noreason",
        "title": "Qwen3.8-27B-FP8-noreason",
        "comment": "Оптимальный баланс. Минимальная потеря качества при более высокой скорости.",
        "recommended": False,
    },
    {
        "id": "qwen3.6-35b-a3b-noreason",
        "title": "Qwen3.6-35B-A3B-noreason (MoE)",
        "comment": (
            "Рекомендуемый вариант для Sol. 35B общих параметров (высокая эрудиция), "
            "но только 3B активных на токен — высокая скорость."
        ),
        "recommended": True,
    },
    {
        "id": "qwen3.8-27b-int4-noreason",
        "title": "Qwen3.8-27B-Int4-noreason",
        "comment": "Бюджетный вариант. Приемлемое качество для анализа при меньшей стоимости.",
        "recommended": False,
    },
)

SOL_MODEL_IDS: frozenset[str] = frozenset(item["id"] for item in SOL_MODEL_OPTIONS)
DEFAULT_SOL_MODEL_ID = "qwen3.6-35b-a3b-noreason"


def assert_sol_model(model_id: str) -> str:
    from app.core.exceptions import LLMResponseError

    model = model_id.strip()
    if model not in SOL_MODEL_IDS:
        allowed = ", ".join(sorted(SOL_MODEL_IDS))
        raise LLMResponseError(
            f"Модель Sol '{model}' недоступна. Выберите одну из: {allowed}."
        )
    return model
