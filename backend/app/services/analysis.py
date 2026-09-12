from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID
import json
import logging

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, NotFoundError
from app.models.analysis import Analysis
from app.models.enums import TrainingOutcome, TrainingStatus, UserRole
from app.models.training import Training
from app.models.user import User
from app.schemas.admin import ManagerStats, TrainingListItem
from app.schemas.ai import HiddenClientCard, UsageInfo
from app.schemas.analysis import AnalysisResultDraft
from app.services.ai_settings import load_ai_settings
from app.services.llm import complete_structured
from app.services.prompts import format_knowledge_bullets, load_active_prompt
from app.services.training import (
    _card_from_training,
    _load_options,
    _require_active,
    add_cost,
    get_training_for_user,
    transcript,
)

logger = logging.getLogger(__name__)


def _analysis_options() -> list:
    return [*_load_options(), selectinload(Training.analysis)]


async def get_training_with_analysis(
    session: AsyncSession,
    training_id: UUID,
    user: User,
) -> Training:
    result = await session.execute(
        select(Training)
        .options(*_analysis_options())
        .where(Training.id == training_id)
        .execution_options(populate_existing=True)
    )
    training = result.scalar_one_or_none()
    if training is None:
        raise NotFoundError("Training not found")
    if user.role != UserRole.ADMIN and training.user_id != user.id:
        from app.core.exceptions import ForbiddenError

        raise ForbiddenError("Training belongs to another manager")
    return training


def assemble_analyst_user_prompt(training: Training, card: HiddenClientCard) -> str:
    snapshot = training.context_snapshot_json or {}
    kb = format_knowledge_bullets(snapshot.get("knowledge_base") or [])
    card_brief = {
        "company": card.company_name,
        "role": card.role_title,
        "industry": card.industry,
        "product": card.product,
        "hidden_pain": card.hidden_pain,
        "next_step": card.next_step_if_convinced,
    }
    return (
        "Разбери диалог менеджера. НЕ генерируй карточку клиента.\n\n"
        f"Карточка:\n{json.dumps(card_brief, ensure_ascii=False)}\n\n"
        f"Комплаенс:\n{kb}\n\n"
        f"Диалог:\n{transcript(training)}\n\n"
        "Один JSON: overall_score, needs_score, presentation_score, objections_score, "
        "summary (text + outcome), strengths, improvements, "
        "criteria_comments (needs, presentation, close). "
        "Баллы 0–10. outcome: next_step_agreed|polite_reject|hard_reject|abandoned."
    )


async def run_sol_analysis(
    session: AsyncSession,
    training: Training,
) -> tuple[Analysis, UsageInfo]:
    if training.analysis is not None:
        raise ConflictError("Analysis already exists for this training")
    if not training.messages:
        raise ConflictError("Cannot analyse empty training")

    runtime = await load_ai_settings(session)
    analyst_prompt = await load_active_prompt(session, "sol_analyst")
    card = _card_from_training(training)

    draft, usage = await complete_structured(
        runtime,
        model=runtime.analyst_model_id,
        messages=[
            {"role": "system", "content": analyst_prompt.system_prompt_text},
            {"role": "user", "content": assemble_analyst_user_prompt(training, card)},
        ],
        schema=AnalysisResultDraft,
        temperature=0.2,
        max_tokens=900,
        session_key=f"ncl-sol-{training.id}",
    )

    summary = draft.normalized_summary()
    comments = draft.normalized_comments()
    summary["criteria_comments"] = comments

    analysis = Analysis(
        training_id=training.id,
        overall_score=draft.overall_score,
        needs_score=draft.needs_score,
        presentation_score=draft.presentation_score,
        objections_score=draft.objections_score,
        summary_json=summary,
        strengths_json=list(draft.strengths),
        improvements_json=list(draft.improvements),
        cost_rub=usage.cost_rub,
    )
    session.add(analysis)
    add_cost(training, usage.cost_rub)

    outcome_value = summary.get("outcome")
    try:
        training.outcome = TrainingOutcome(outcome_value)
    except ValueError:
        training.outcome = TrainingOutcome.ABANDONED

    await session.commit()
    await session.refresh(analysis)
    return analysis, usage


async def complete_training(
    session: AsyncSession,
    training: Training,
    user: User,
    *,
    run_analysis: bool = True,
    aborted: bool = False,
) -> tuple[Training, Analysis | None, UsageInfo | None]:
    _require_active(training)
    training.ended_at = datetime.now(timezone.utc)
    training.status = TrainingStatus.ABORTED if aborted else TrainingStatus.COMPLETED
    if aborted and training.outcome is None:
        training.outcome = TrainingOutcome.ABANDONED

    analysis: Analysis | None = None
    usage: UsageInfo | None = None
    await session.commit()

    if run_analysis and not aborted:
        try:
            training = await get_training_with_analysis(session, training.id, user)
            analysis, usage = await run_sol_analysis(session, training)
        except Exception as exc:  # noqa: BLE001 — сессия уже завершена; разбор можно повторить
            logger.exception("Sol analysis failed for training %s: %s", training.id, exc)
            await session.rollback()
            analysis = None
            usage = None

    training = await get_training_with_analysis(session, training.id, user)
    return training, analysis, usage


def _list_query(
    *,
    user: User,
    status: TrainingStatus | None = None,
    manager_id: UUID | None = None,
) -> Select[tuple[Training]]:
    query = (
        select(Training)
        .options(selectinload(Training.analysis), selectinload(Training.user))
        .order_by(Training.created_at.desc())
    )
    if user.role != UserRole.ADMIN:
        query = query.where(Training.user_id == user.id)
    elif manager_id is not None:
        query = query.where(Training.user_id == manager_id)
    if status is not None:
        query = query.where(Training.status == status)
    return query


async def list_trainings(
    session: AsyncSession,
    user: User,
    *,
    status: TrainingStatus | None = None,
    manager_id: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[TrainingListItem]:
    result = await session.execute(
        _list_query(user=user, status=status, manager_id=manager_id).limit(limit).offset(offset)
    )
    items: list[TrainingListItem] = []
    for training in result.scalars().all():
        manager = training.user
        items.append(
            TrainingListItem(
                id=training.id,
                user_id=training.user_id,
                manager_name=manager.full_name if manager else None,
                manager_email=manager.email if manager else None,
                difficulty=training.difficulty.value,
                client_role=training.client_role.value,
                status=training.status.value,
                outcome=training.outcome,
                overall_score=training.analysis.overall_score if training.analysis else None,
                total_cost_rub=training.total_cost_rub,
                created_at=training.created_at,
                ended_at=training.ended_at,
            )
        )
    return items


async def manager_stats(
    session: AsyncSession,
    user: User,
    *,
    manager_id: UUID | None = None,
) -> ManagerStats:
    target_id = manager_id if user.role == UserRole.ADMIN and manager_id else user.id
    if user.role != UserRole.ADMIN and manager_id and manager_id != user.id:
        from app.core.exceptions import ForbiddenError

        raise ForbiddenError("Cannot view another manager stats")

    totals = await session.execute(
        select(
            func.count(Training.id),
            func.coalesce(func.sum(Training.total_cost_rub), 0),
        ).where(Training.user_id == target_id)
    )
    trainings_total, total_cost = totals.one()

    completed = await session.execute(
        select(func.count(Training.id)).where(
            Training.user_id == target_id,
            Training.status == TrainingStatus.COMPLETED,
        )
    )
    trainings_completed = int(completed.scalar_one())

    scores = await session.execute(
        select(
            func.avg(Analysis.overall_score),
            func.avg(Analysis.needs_score),
            func.avg(Analysis.presentation_score),
            func.avg(Analysis.objections_score),
        )
        .join(Training, Training.id == Analysis.training_id)
        .where(Training.user_id == target_id)
    )
    avg_overall, avg_needs, avg_presentation, avg_objections = scores.one()

    outcomes_raw = await session.execute(
        select(Training.outcome, func.count(Training.id))
        .where(Training.user_id == target_id, Training.outcome.is_not(None))
        .group_by(Training.outcome)
    )
    outcomes: dict[str, int] = {
        (row[0].value if row[0] else "unknown"): int(row[1]) for row in outcomes_raw.all()
    }

    def _avg(value: Any) -> float | None:
        if value is None:
            return None
        return round(float(value), 2)

    return ManagerStats(
        trainings_total=int(trainings_total or 0),
        trainings_completed=trainings_completed,
        average_overall_score=_avg(avg_overall),
        average_needs_score=_avg(avg_needs),
        average_presentation_score=_avg(avg_presentation),
        average_objections_score=_avg(avg_objections),
        total_cost_rub=Decimal(str(total_cost or 0)),
        outcomes=outcomes,
    )
