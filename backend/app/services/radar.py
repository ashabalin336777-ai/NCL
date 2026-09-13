import logging
import time
from collections import defaultdict
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, LLMTimeoutError, NotFoundError
from app.models.enums import MessageRole, TrainingStatus
from app.models.message import Message
from app.models.message_analysis import MessageAnalysis
from app.models.training import Training
from app.models.user import User
from app.schemas.radar import (
    RADAR_SCORE_KEYS,
    AnalyzeMessageResponse,
    RadarScoresDraft,
    RadarScoresPublic,
    aggregate_score,
    zero_radar_scores,
)
from app.services.ai_settings import load_ai_settings
from app.services.llm import complete_structured
from app.services.prompts import assemble_radar_messages, load_active_prompt
from app.services.training import (
    _card_from_training,
    _require_active,
    add_cost,
    get_training_for_user,
)

logger = logging.getLogger(__name__)

# NeuralDEEP structured radar usually needs 8–20s; hard-cancel via wait_for breaks the shared HTTP client.
RADAR_LLM_TIMEOUT_SEC = 25
RADAR_RATE_LIMIT_SEC = 2.0

# training_id -> monotonic timestamp of last LLM radar call
_last_radar_call: dict[UUID, float] = defaultdict(float)


def scores_from_analysis(row: MessageAnalysis) -> dict[str, int]:
    return {
        "needs_discovery": row.needs_discovery,
        "solution_presentation": row.solution_presentation,
        "objection_handling": row.objection_handling,
        "closing_persistence": row.closing_persistence,
        "technical_expertise": row.technical_expertise,
        "risk_management": row.risk_management,
    }


def public_from_dict(scores: dict[str, int]) -> RadarScoresPublic:
    return RadarScoresPublic(**{key: int(scores.get(key, 0)) for key in RADAR_SCORE_KEYS})


async def latest_radar_scores(
    session: AsyncSession,
    training_id: UUID,
) -> dict[str, int]:
    result = await session.execute(
        select(MessageAnalysis)
        .where(MessageAnalysis.training_id == training_id)
        .order_by(MessageAnalysis.created_at.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return zero_radar_scores()
    return scores_from_analysis(row)


def radar_scores_from_training(training: Training) -> dict[str, int]:
    rows = list(getattr(training, "message_analyses", None) or [])
    if not rows:
        return zero_radar_scores()
    latest = max(rows, key=lambda item: item.created_at)
    return scores_from_analysis(latest)


async def analyze_manager_message(
    session: AsyncSession,
    user: User,
    training_id: UUID,
    message_id: UUID,
) -> AnalyzeMessageResponse:
    training = await get_training_for_user(session, training_id, user)
    if training.status not in {TrainingStatus.CREATED, TrainingStatus.IN_PROGRESS}:
        # Allow read of cached analysis even after complete; only block new LLM on inactive
        existing = await session.execute(
            select(MessageAnalysis).where(MessageAnalysis.message_id == message_id)
        )
        cached = existing.scalar_one_or_none()
        if cached is not None:
            return AnalyzeMessageResponse(
                scores=public_from_dict(scores_from_analysis(cached)),
                cost_rub=cached.cost_rub,
                latency_ms=cached.latency_ms,
                cached=True,
            )
        raise ConflictError("Training is not active")

    message = next((item for item in training.messages if item.id == message_id), None)
    if message is None:
        result = await session.execute(
            select(Message).where(
                Message.id == message_id,
                Message.training_id == training.id,
            )
        )
        message = result.scalar_one_or_none()
    if message is None:
        raise NotFoundError("Message not found")
    if message.role != MessageRole.USER:
        raise ConflictError("Radar analyzes only manager messages")

    existing = await session.execute(
        select(MessageAnalysis).where(MessageAnalysis.message_id == message_id)
    )
    cached_row = existing.scalar_one_or_none()
    if cached_row is not None:
        return AnalyzeMessageResponse(
            scores=public_from_dict(scores_from_analysis(cached_row)),
            cost_rub=cached_row.cost_rub,
            latency_ms=cached_row.latency_ms,
            cached=True,
        )

    previous = await latest_radar_scores(session, training.id)
    now = time.monotonic()
    last_call = _last_radar_call[training.id]
    if now - last_call < RADAR_RATE_LIMIT_SEC:
        return AnalyzeMessageResponse(
            scores=public_from_dict(previous),
            cost_rub=Decimal("0"),
            latency_ms=0,
            cached=True,
        )

    try:
        _require_active(training)
        card = _card_from_training(training)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Radar skipped: %s", exc)
        return AnalyzeMessageResponse(
            scores=public_from_dict(previous),
            cost_rub=Decimal("0"),
            latency_ms=0,
            cached=True,
        )

    ordered = sorted(training.messages, key=lambda item: item.created_at)
    context_messages = [item for item in ordered if item.id != message.id][-5:]

    started = time.perf_counter()
    try:
        runtime = await load_ai_settings(session)
        prompt = await load_active_prompt(session, "radar_analyzer")
        llm_messages = assemble_radar_messages(
            system_prompt=prompt.system_prompt_text,
            card=card,
            context_messages=context_messages,
            manager_message=message.content,
        )
        _last_radar_call[training.id] = time.monotonic()
        draft, usage = await complete_structured(
            runtime,
            model=runtime.radar_model_id,
            messages=llm_messages,
            schema=RadarScoresDraft,
            temperature=0.2,
            max_tokens=220,
            session_key=f"ncl-radar-{training.id}",
            max_retries=0,
            read_timeout=RADAR_LLM_TIMEOUT_SEC,
        )
        raw = draft.as_dict()
        aggregated = {
            key: aggregate_score(previous[key], raw[key]) for key in RADAR_SCORE_KEYS
        }
        latency_ms = int((time.perf_counter() - started) * 1000)
        row = MessageAnalysis(
            training_id=training.id,
            message_id=message.id,
            needs_discovery=aggregated["needs_discovery"],
            solution_presentation=aggregated["solution_presentation"],
            objection_handling=aggregated["objection_handling"],
            closing_persistence=aggregated["closing_persistence"],
            technical_expertise=aggregated["technical_expertise"],
            risk_management=aggregated["risk_management"],
            raw_scores_json=raw,
            cost_rub=usage.cost_rub,
            latency_ms=latency_ms,
        )
        session.add(row)
        add_cost(training, usage.cost_rub)
        await session.commit()
        await session.refresh(row)
        return AnalyzeMessageResponse(
            scores=public_from_dict(aggregated),
            cost_rub=usage.cost_rub,
            latency_ms=latency_ms,
            cached=False,
        )
    except LLMTimeoutError:
        logger.warning(
            "Radar timed out for message %s after %.0fms; keeping previous scores",
            message_id,
            (time.perf_counter() - started) * 1000,
        )
        return AnalyzeMessageResponse(
            scores=public_from_dict(previous),
            cost_rub=Decimal("0"),
            latency_ms=int((time.perf_counter() - started) * 1000),
            cached=True,
        )
    except Exception as exc:  # noqa: BLE001 — radar must not break chat UX
        logger.warning("Radar analysis failed for message %s: %s", message_id, exc)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return AnalyzeMessageResponse(
            scores=public_from_dict(previous),
            cost_rub=Decimal("0"),
            latency_ms=latency_ms,
            cached=True,
        )
