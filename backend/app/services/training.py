from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    LLMResponseError,
    LLMTimeoutError,
    NotFoundError,
)
from app.models.client_profile import ClientProfile
from app.models.enums import MessageRole, TrainingStatus, UserRole
from app.models.hint import Hint
from app.models.message import Message
from app.models.training import Training
from app.models.user import User
from app.schemas.ai import HiddenClientCard, HiddenClientCardDraft, UsageInfo
from app.schemas.training import TrainingCreateRequest
from app.services.ai_settings import load_ai_settings
from app.services.llm import ChatMessage, complete_structured, complete_text
from app.services.prompts import (
    assemble_card_user_prompt,
    assemble_client_system,
    assemble_hint_messages,
    build_context_snapshot,
    load_active_prompt,
    load_knowledge_articles,
    windowed_chat_messages,
    windowed_transcript,
)


def _load_options() -> list:
    return [
        selectinload(Training.messages),
        selectinload(Training.hints),
        selectinload(Training.client_profile),
        selectinload(Training.analysis),
    ]


async def get_training_for_user(
    session: AsyncSession,
    training_id: UUID,
    user: User,
) -> Training:
    result = await session.execute(
        select(Training)
        .options(*_load_options())
        .where(Training.id == training_id)
        .execution_options(populate_existing=True)
    )
    training = result.scalar_one_or_none()
    if training is None:
        raise NotFoundError("Training not found")
    if user.role != UserRole.ADMIN and training.user_id != user.id:
        raise ForbiddenError("Training belongs to another manager")
    return training


def can_see_hidden_card(user: User, training: Training) -> bool:
    if user.role == UserRole.ADMIN:
        return True
    return training.status in {TrainingStatus.COMPLETED, TrainingStatus.ABORTED}


def add_cost(training: Training, amount: Decimal) -> None:
    training.total_cost_rub = Decimal(training.total_cost_rub) + amount


def transcript(training: Training) -> str:
    lines: list[str] = []
    for message in training.messages:
        speaker = "Менеджер" if message.role == MessageRole.USER else "Клиент"
        lines.append(f"{speaker}: {message.content}")
    return "\n".join(lines) if lines else "Диалог ещё не начался."


def _fallback_card_draft(payload: TrainingCreateRequest) -> HiddenClientCardDraft:
    industry = payload.resolved_industry() or "Промышленная автоматизация"
    return HiddenClientCardDraft(
        company_name=f"НПО «Сигнал» ({industry})",
        contact_name="Андрей Морозов",
        role_title="Снабженец",
        industry=industry,
        product="Плата управления и электронные компоненты серийной линейки",
        hidden_pain=(
            "Текущий поставщик срывает сроки и есть риск контрафакта после смены канала. "
            "Боимся остановки линии и штрафов по контракту."
        ),
        surface_request="Смотрим варианты по микросхемам и пассивке, нужен резервный канал.",
        previous_experience="Работали с одним дистрибьютором и точечно брали с рынка.",
        initial_stance="Скептичен, но готов слушать, если снимут риск по срокам и качеству.",
        trust_triggers=["ОТК и входной контроль", "склад в РФ", "прямые контракты"],
        planned_objections=["У нас уже есть рамочник", "Ваши цены выше рынка"],
        next_step_if_convinced="Отправить BOM на бесплатный просчет",
    )


def _card_from_training(training: Training) -> HiddenClientCard:
    if training.client_profile is None:
        raise ConflictError("Client card is not generated yet")
    return HiddenClientCard.model_validate(training.client_profile.hidden_card_json)


async def create_training_with_card(
    session: AsyncSession,
    user: User,
    payload: TrainingCreateRequest,
) -> tuple[Training, UsageInfo]:
    runtime = await load_ai_settings(session)
    client_prompt = await load_active_prompt(session, "client")
    card_prompt = await load_active_prompt(session, "card_generator")
    articles = await load_knowledge_articles(session)
    snapshot = build_context_snapshot(client_prompt, articles)

    training = Training(
        user_id=user.id,
        difficulty=payload.difficulty,
        client_role=payload.client_role,
        status=TrainingStatus.CREATED,
        prompt_name=client_prompt.name,
        prompt_version=client_prompt.version,
        context_snapshot_json=snapshot,
    )
    session.add(training)
    await session.flush()

    try:
        draft, card_usage = await complete_structured(
            runtime,
            model=runtime.card_model_id,
            messages=[
                {"role": "system", "content": card_prompt.system_prompt_text},
                {
                    "role": "user",
                    "content": assemble_card_user_prompt(
                        difficulty=payload.difficulty,
                        client_role=payload.client_role,
                        industry=payload.resolved_industry(),
                    ),
                },
            ],
            schema=HiddenClientCardDraft,
            temperature=0.7,
            max_tokens=700,
            max_retries=1,
            session_key=f"ncl-card-{training.id}",
        )
    except (LLMTimeoutError, LLMResponseError):
        draft = _fallback_card_draft(payload)
        card_usage = UsageInfo(
            model="fallback",
            prompt_tokens=0,
            completion_tokens=0,
            total_tokens=0,
            cost_rub=Decimal("0"),
        )
    card = HiddenClientCard(
        **draft.model_dump(),
        difficulty=payload.difficulty,
        role_code=payload.client_role,
    )

    session.add(
        ClientProfile(
            training_id=training.id,
            hidden_card_json=card.model_dump(mode="json"),
        )
    )
    add_cost(training, card_usage.cost_rub)

    try:
        opening, opening_usage = await complete_text(
            runtime,
            model=runtime.client_model_id,
            messages=[
                {"role": "system", "content": assemble_client_system(snapshot, card)},
                {
                    "role": "user",
                    "content": (
                        "Начни диалог одной короткой репликой клиента. "
                        "Ты сам вышел на связь или отвечаешь на холодный контакт. "
                        "Не раскрывай скрытую боль. Без кавычек и пояснений."
                    ),
                },
            ],
            temperature=0.8,
            max_tokens=220,
            max_retries=1,
            session_key=f"ncl-client-{training.id}",
        )
    except (LLMTimeoutError, LLMResponseError):
        opening = (
            "Добрый день. Это по поставкам электронных компонентов — "
            "есть вопрос по текущим закупкам, удобно пару минут?"
        )
        opening_usage = UsageInfo(
            model="fallback",
            prompt_tokens=0,
            completion_tokens=0,
            total_tokens=0,
            cost_rub=Decimal("0"),
        )
    session.add(
        Message(
            training_id=training.id,
            role=MessageRole.ASSISTANT,
            content=opening,
            tokens_used=opening_usage.total_tokens,
            cost_rub=opening_usage.cost_rub,
        )
    )
    add_cost(training, opening_usage.cost_rub)
    training.status = TrainingStatus.IN_PROGRESS
    await session.commit()
    training = await get_training_for_user(session, training.id, user)
    total_usage = UsageInfo(
        model=f"{card_usage.model}+{opening_usage.model}",
        prompt_tokens=card_usage.prompt_tokens + opening_usage.prompt_tokens,
        completion_tokens=card_usage.completion_tokens + opening_usage.completion_tokens,
        total_tokens=card_usage.total_tokens + opening_usage.total_tokens,
        cost_rub=card_usage.cost_rub + opening_usage.cost_rub,
    )
    return training, total_usage


def _require_active(training: Training) -> None:
    if training.status not in {TrainingStatus.CREATED, TrainingStatus.IN_PROGRESS}:
        raise ConflictError("Training is already finished")
    if training.client_profile is None:
        raise ConflictError("Client card is not generated yet")


async def reply_as_client(
    session: AsyncSession,
    training: Training,
    user_text: str,
) -> tuple[Message, Message, UsageInfo]:
    _require_active(training)
    runtime = await load_ai_settings(session)
    card = _card_from_training(training)
    snapshot = training.context_snapshot_json or {}
    history: list[ChatMessage] = [
        {"role": "system", "content": assemble_client_system(snapshot, card)},
        *windowed_chat_messages(training.messages, user_text),
    ]

    user_message = Message(
        training_id=training.id,
        role=MessageRole.USER,
        content=user_text,
        tokens_used=0,
        cost_rub=Decimal("0"),
    )
    session.add(user_message)
    await session.flush()

    reply, usage = await complete_text(
        runtime,
        model=runtime.client_model_id,
        messages=history,
        temperature=0.75,
        max_tokens=220,
        max_retries=1,
        session_key=f"ncl-client-{training.id}",
    )
    assistant_message = Message(
        training_id=training.id,
        role=MessageRole.ASSISTANT,
        content=reply,
        tokens_used=usage.total_tokens,
        cost_rub=usage.cost_rub,
    )
    session.add(assistant_message)
    add_cost(training, usage.cost_rub)
    training.status = TrainingStatus.IN_PROGRESS
    await session.commit()
    await session.refresh(user_message)
    await session.refresh(assistant_message)
    return user_message, assistant_message, usage


async def create_hint(session: AsyncSession, training: Training) -> tuple[Hint, UsageInfo]:
    _require_active(training)
    runtime = await load_ai_settings(session)
    hint_prompt = await load_active_prompt(session, "terra_hint")
    articles = (training.context_snapshot_json or {}).get("knowledge_base") or []
    snapshot = {
        "prompt_text": hint_prompt.system_prompt_text,
        "knowledge_base": articles,
    }
    card = _card_from_training(training)
    last_message_id = training.messages[-1].id if training.messages else None
    dialog = windowed_transcript(training.messages)
    hint_messages = assemble_hint_messages(snapshot, card, dialog)
    user_prompt = hint_messages[1]["content"]
    reply, usage = await complete_text(
        runtime,
        model=runtime.hint_model_id,
        messages=hint_messages,
        temperature=0.4,
        max_tokens=280,
        max_retries=1,
        session_key=f"ncl-terra-{training.id}",
    )
    hint = Hint(
        training_id=training.id,
        message_id=last_message_id,
        prompt_text=user_prompt,
        response_text=reply,
        tokens_used=usage.total_tokens,
        cost_rub=usage.cost_rub,
    )
    session.add(hint)
    add_cost(training, usage.cost_rub)
    await session.commit()
    await session.refresh(hint)
    return hint, usage
