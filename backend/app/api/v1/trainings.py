import json
from collections.abc import AsyncIterator
from uuid import UUID

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import CurrentUser, DbSession
from app.models.enums import MessageRole, TrainingStatus
from app.models.message import Message
from app.models.training import Training
from app.models.user import User
from app.schemas.admin import AnalysisPublic, TrainingCompleteRequest, TrainingListItem
from app.schemas.ai import AIRuntimePublic, HiddenClientCard, UsageInfo
from app.schemas.training import (
    ChatMessageRequest,
    HintPublic,
    TrainingCompleteResponse,
    TrainingCreateRequest,
    TrainingCreateResponse,
    TrainingPublic,
)
from app.services.ai_settings import load_ai_settings
from app.services.analysis import (
    complete_training,
    get_training_with_analysis,
    list_trainings,
    run_sol_analysis,
)
from app.services.llm import stream_text
from app.services.neuraldeep_models import ALLOWED_MODELS
from app.services.prompts import assemble_client_system
from app.services.training import (
    add_cost,
    can_see_hidden_card,
    create_hint,
    create_training_with_card,
    get_training_for_user,
    reply_as_client,
)

router = APIRouter(prefix="/trainings", tags=["trainings"])


def _to_public(training: Training, user: User) -> TrainingPublic:
    card = None
    if training.client_profile is not None and can_see_hidden_card(user, training):
        card = HiddenClientCard.model_validate(training.client_profile.hidden_card_json)
    analysis = None
    if getattr(training, "analysis", None) is not None:
        analysis = AnalysisPublic.model_validate(training.analysis)
    return TrainingPublic(
        id=training.id,
        difficulty=training.difficulty,
        client_role=training.client_role,
        status=training.status,
        outcome=training.outcome,
        total_cost_rub=training.total_cost_rub,
        prompt_name=training.prompt_name,
        prompt_version=training.prompt_version,
        created_at=training.created_at,
        ended_at=training.ended_at,
        messages=[item for item in training.messages],
        hints=[item for item in training.hints],
        hidden_card=card,
        analysis=analysis,
    )


@router.get("", response_model=list[TrainingListItem])
async def list_my_trainings(
    session: DbSession,
    user: CurrentUser,
    status: TrainingStatus | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[TrainingListItem]:
    return await list_trainings(session, user, status=status, limit=limit, offset=offset)


@router.post("", response_model=TrainingCreateResponse)
async def create_training(
    payload: TrainingCreateRequest,
    session: DbSession,
    user: CurrentUser,
) -> TrainingCreateResponse:
    training, usage = await create_training_with_card(session, user, payload)
    public = _to_public(training, user)
    return TrainingCreateResponse(**public.model_dump(), usage=usage)


@router.get("/{training_id}", response_model=TrainingPublic)
async def get_training(
    training_id: UUID,
    session: DbSession,
    user: CurrentUser,
) -> TrainingPublic:
    training = await get_training_with_analysis(session, training_id, user)
    return _to_public(training, user)


@router.post("/{training_id}/messages", response_model=TrainingPublic)
async def send_message(
    training_id: UUID,
    payload: ChatMessageRequest,
    session: DbSession,
    user: CurrentUser,
) -> TrainingPublic:
    training = await get_training_for_user(session, training_id, user)
    await reply_as_client(session, training, payload.content.strip())
    training = await get_training_with_analysis(session, training_id, user)
    return _to_public(training, user)


@router.post("/{training_id}/messages/stream")
async def send_message_stream(
    training_id: UUID,
    payload: ChatMessageRequest,
    session: DbSession,
    user: CurrentUser,
) -> StreamingResponse:
    training = await get_training_for_user(session, training_id, user)
    return StreamingResponse(
        _stream_reply(session, training, user, payload.content.strip()),
        media_type="text/event-stream",
    )


@router.post("/{training_id}/hints", response_model=HintPublic)
async def request_hint(
    training_id: UUID,
    session: DbSession,
    user: CurrentUser,
) -> HintPublic:
    training = await get_training_for_user(session, training_id, user)
    hint, _usage = await create_hint(session, training)
    return HintPublic.model_validate(hint)


@router.post("/{training_id}/complete", response_model=TrainingCompleteResponse)
async def finish_training(
    training_id: UUID,
    session: DbSession,
    user: CurrentUser,
    payload: TrainingCompleteRequest | None = None,
) -> TrainingCompleteResponse:
    body = payload or TrainingCompleteRequest()
    training = await get_training_for_user(session, training_id, user)
    training, _analysis, usage = await complete_training(
        session,
        training,
        user,
        run_analysis=body.run_analysis,
        aborted=False,
    )
    public = _to_public(training, user)
    return TrainingCompleteResponse(**public.model_dump(), analysis_usage=usage)


@router.post("/{training_id}/abort", response_model=TrainingPublic)
async def abort_training(
    training_id: UUID,
    session: DbSession,
    user: CurrentUser,
) -> TrainingPublic:
    training = await get_training_for_user(session, training_id, user)
    training, _analysis, _usage = await complete_training(
        session,
        training,
        user,
        run_analysis=False,
        aborted=True,
    )
    return _to_public(training, user)


@router.post("/{training_id}/analysis", response_model=AnalysisPublic)
async def analyse_training(
    training_id: UUID,
    session: DbSession,
    user: CurrentUser,
) -> AnalysisPublic:
    training = await get_training_with_analysis(session, training_id, user)
    if training.status not in {TrainingStatus.COMPLETED, TrainingStatus.ABORTED}:
        from app.core.exceptions import ConflictError

        raise ConflictError("Finish the training before running analysis")
    analysis, _usage = await run_sol_analysis(session, training)
    return AnalysisPublic.model_validate(analysis)


async def _stream_reply(
    session: AsyncSession,
    training: Training,
    user: User,
    user_text: str,
) -> AsyncIterator[str]:
    from app.core.exceptions import ConflictError

    if training.status not in {TrainingStatus.CREATED, TrainingStatus.IN_PROGRESS}:
        raise ConflictError("Training is already finished")
    if training.client_profile is None:
        raise ConflictError("Client card is not generated yet")

    runtime = await load_ai_settings(session)
    card = HiddenClientCard.model_validate(training.client_profile.hidden_card_json)
    snapshot = training.context_snapshot_json or {}
    history: list[dict[str, str]] = [
        {"role": "system", "content": assemble_client_system(snapshot, card)}
    ]
    for item in training.messages:
        history.append({"role": item.role.value, "content": item.content})
    history.append({"role": "user", "content": user_text})

    user_message = Message(
        training_id=training.id,
        role=MessageRole.USER,
        content=user_text,
        tokens_used=0,
        cost_rub=0,
    )
    session.add(user_message)
    await session.flush()

    collected: list[str] = []
    usage: UsageInfo | None = None
    async for delta, final_usage in stream_text(
        runtime,
        model=runtime.client_model_id,
        messages=history,
        temperature=0.75,
        max_tokens=450,
        session_key=f"ncl-client-{training.id}",
    ):
        if final_usage is not None:
            usage = final_usage
            break
        collected.append(delta)
        yield f"data: {json.dumps({'delta': delta}, ensure_ascii=False)}\n\n"

    text = "".join(collected).strip()
    if usage is None:
        raise RuntimeError("Stream finished without usage")
    assistant = Message(
        training_id=training.id,
        role=MessageRole.ASSISTANT,
        content=text,
        tokens_used=usage.total_tokens,
        cost_rub=usage.cost_rub,
    )
    session.add(assistant)
    add_cost(training, usage.cost_rub)
    training.status = TrainingStatus.IN_PROGRESS
    await session.commit()
    await session.refresh(assistant)
    yield (
        "data: "
        + json.dumps(
            {
                "done": True,
                "message_id": str(assistant.id),
                "cost_rub": str(usage.cost_rub),
            },
            ensure_ascii=False,
        )
        + "\n\n"
    )


ai_router = APIRouter(prefix="/ai", tags=["ai"])


@ai_router.get("/runtime", response_model=AIRuntimePublic)
async def ai_runtime(session: DbSession, _user: CurrentUser) -> AIRuntimePublic:
    runtime = await load_ai_settings(session)
    return AIRuntimePublic(
        provider="neuraldeep",
        base_url=runtime.base_url,
        client_model_id=runtime.client_model_id,
        card_model_id=runtime.card_model_id,
        hint_model_id=runtime.hint_model_id,
        analyst_model_id=runtime.analyst_model_id,
        timeout_seconds=runtime.timeout_seconds,
        tariffs=runtime.tariffs,
        allowed_models=sorted(ALLOWED_MODELS),
    )
