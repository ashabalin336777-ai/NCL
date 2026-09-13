import json
from typing import Any, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.labels import CLIENT_ROLE_LABELS, DIFFICULTY_LABELS, INDUSTRIES
from app.models.enums import ClientRole, Difficulty, MessageRole
from app.models.knowledge_base import KnowledgeBase
from app.models.message import Message
from app.models.prompt import Prompt
from app.schemas.ai import HiddenClientCard

HISTORY_WINDOW = 10

CLIENT_RUNTIME_RULES = """Ты — AI-клиент завода или КБ в РФ. Отвечай только репликой клиента (1–4 предложения), без мета-комментариев и скобок.
Правила:
1. Твоя личность ЖЁСТКО задана карточкой: company_name и contact_name. Это твоё настоящее имя и предприятие.
2. Никогда не выдумывай другое ФИО, компанию, бренд или должность. Если представляешься — только contact_name и company_name из карточки.
3. Не раскрывай скрытую боль сразу. Давай зацепки, если менеджер компетентен.
4. Шаблоны и давление — закрывайся. Вопросы про ОТК, логистику, аналоги — оттепель.
5. «Покупка» = следующий шаг: BOM, встреча с инженером, NDA. Не перевод денег.
6. Не соглашайся из вежливости, если риски не сняты.
7. Не подтверждай обещания вне комплаенса."""

COMPLIANCE_FALLBACK = """- Не обещать поставку из Китая за 3 дня и 100% склад по всей номенклатуре.
- Склад РФ — согласованный срок; Азия + ВЭД — недели, не дни.
- Сильные аргументы: ОТК, прямые контракты, буферный склад в РФ, аналоги без переделки платы.
- Следующий шаг: BOM на просчет, встреча с инженером, NDA, опытная партия.
- «Отправьте КП» без спецификации — вежливый отказ, его нужно отработать.
- Не давить сроком или ценой."""

HINT_RUNTIME_RULES = """Ты Terra — короткий совет менеджеру (4–6 предложений). Не пиши скрипт слово в слово.
Веди к боли → презентации → следующему шагу (BOM / встреча / NDA). Не советуй обещать то, чего нет в комплаенсе."""


async def load_active_prompt(session: AsyncSession, name: str) -> Prompt:
    result = await session.execute(
        select(Prompt)
        .where(Prompt.name == name, Prompt.is_active.is_(True))
        .order_by(Prompt.version.desc())
        .limit(1)
    )
    prompt = result.scalar_one_or_none()
    if prompt is None:
        raise RuntimeError(f"Active prompt '{name}' is missing")
    return prompt


async def load_knowledge_articles(session: AsyncSession) -> list[dict[str, str]]:
    result = await session.execute(select(KnowledgeBase).order_by(KnowledgeBase.title))
    return [{"title": item.title, "content": item.content} for item in result.scalars().all()]


def format_knowledge(articles: list[dict[str, str]]) -> str:
    if not articles:
        return "База знаний пуста."
    blocks = [f"## {item['title']}\n{item['content']}" for item in articles]
    return "\n\n".join(blocks)


def format_knowledge_bullets(articles: list[dict[str, str]] | None, limit: int = 8) -> str:
    if not articles:
        return COMPLIANCE_FALLBACK
    lines: list[str] = []
    for item in articles:
        title = str(item.get("title") or "").strip()
        content = str(item.get("content") or "").replace("\r", "").strip()
        first = next((part.strip() for part in content.split("\n") if part.strip()), "")
        if len(first) > 180:
            first = first[:177].rstrip() + "…"
        if title and first:
            lines.append(f"- {title}: {first}")
        elif first:
            lines.append(f"- {first}")
        if len(lines) >= limit:
            break
    return "\n".join(lines) if lines else COMPLIANCE_FALLBACK


def compact_card(card: HiddenClientCard) -> str:
    return json.dumps(
        {
            "company": card.company_name,
            "contact": card.contact_name,
            "role": card.role_title,
            "industry": card.industry,
            "product": card.product,
            "hidden_pain": card.hidden_pain,
            "surface": card.surface_request,
            "stance": card.initial_stance,
            "trust": card.trust_triggers,
            "objections": card.planned_objections,
            "next_step": card.next_step_if_convinced,
        },
        ensure_ascii=False,
    )


def build_context_snapshot(
    prompt: Prompt,
    articles: list[dict[str, str]],
) -> dict[str, Any]:
    return {
        "prompt_name": prompt.name,
        "prompt_version": prompt.version,
        "prompt_text": prompt.system_prompt_text,
        "knowledge_base": articles,
    }


def assemble_client_system(snapshot: dict[str, Any], card: HiddenClientCard) -> str:
    bullets = format_knowledge_bullets(snapshot.get("knowledge_base") or [])
    return (
        f"{CLIENT_RUNTIME_RULES}\n\n"
        f"# Твоя личность (обязательно)\n"
        f"ФИО: {card.contact_name}\n"
        f"Компания: {card.company_name}\n"
        f"Должность: {card.role_title}\n"
        f"Отрасль: {card.industry}\n\n"
        f"# Комплаенс\n{bullets}\n\n"
        f"# Полная карточка\n{compact_card(card)}\n"
    )


def assemble_card_user_prompt(
    *,
    difficulty: Difficulty,
    client_role: ClientRole,
    industry: str | None,
) -> str:
    industry_line = industry or "выбери одну из: " + ", ".join(INDUSTRIES)
    return (
        "Сгенерируй скрытую карточку реалистичного B2B-клиента — завод или КБ в РФ.\n"
        f"Роль: {CLIENT_ROLE_LABELS[client_role]} ({client_role.value})\n"
        f"Сложность: {DIFFICULTY_LABELS[difficulty]} ({difficulty.value})\n"
        f"Отрасль: {industry_line}\n"
        "company_name и contact_name должны быть уникальными и реалистичными для РФ "
        "(не используй шаблоны вроде «Андрей Морозов» / «НПО Сигнал», если это не уместно).\n"
        "Только JSON с ключами: company_name, contact_name, role_title, industry, product, "
        "hidden_pain, surface_request, previous_experience, initial_stance, trust_triggers, "
        "planned_objections, next_step_if_convinced. "
        "trust_triggers и planned_objections — 2–6 коротких строк."
    )


def _clip(text: str, limit: int = 140) -> str:
    clean = " ".join(text.split())
    if len(clean) <= limit:
        return clean
    return clean[: limit - 1].rstrip() + "…"


def summarize_older_messages(messages: Sequence[Message]) -> str:
    lines: list[str] = []
    for item in messages[:12]:
        speaker = "Менеджер" if item.role == MessageRole.USER else "Клиент"
        lines.append(f"- {speaker}: {_clip(item.content)}")
    return "Краткое начало диалога:\n" + "\n".join(lines)


def windowed_chat_messages(
    messages: Sequence[Message],
    user_text: str | None = None,
    *,
    window: int = HISTORY_WINDOW,
) -> list[dict[str, str]]:
    older = list(messages[:-window]) if len(messages) > window else []
    recent = list(messages[-window:]) if messages else []
    history: list[dict[str, str]] = []
    if older:
        history.append({"role": "user", "content": summarize_older_messages(older)})
        history.append({"role": "assistant", "content": "Контекст принят, продолжаем текущий разговор."})
    for item in recent:
        history.append({"role": item.role.value, "content": item.content})
    if user_text:
        history.append({"role": "user", "content": user_text})
    return history


def windowed_transcript(messages: Sequence[Message], *, window: int = HISTORY_WINDOW) -> str:
    if not messages:
        return "Диалог ещё не начался."
    older = list(messages[:-window]) if len(messages) > window else []
    recent = list(messages[-window:]) if messages else []
    parts: list[str] = []
    if older:
        parts.append(summarize_older_messages(older))
        parts.append("Последние реплики:")
    for item in recent:
        speaker = "Менеджер" if item.role == MessageRole.USER else "Клиент"
        parts.append(f"{speaker}: {item.content}")
    return "\n".join(parts)


def assemble_hint_messages(
    snapshot: dict[str, Any],
    card: HiddenClientCard,
    transcript: str,
) -> list[dict[str, str]]:
    bullets = format_knowledge_bullets(snapshot.get("knowledge_base") or [])
    return [
        {"role": "system", "content": HINT_RUNTIME_RULES},
        {
            "role": "user",
            "content": (
                f"Карточка:\n{compact_card(card)}\n\n"
                f"Комплаенс:\n{bullets}\n\n"
                f"Диалог:\n{transcript}\n\n"
                "Что спросить или предложить следующим сообщением?"
            ),
        },
    ]


def assemble_radar_messages(
    *,
    system_prompt: str,
    card: HiddenClientCard,
    context_messages: Sequence[Message],
    manager_message: str,
) -> list[dict[str, str]]:
    history_lines: list[str] = []
    for item in context_messages[-5:]:
        speaker = "Менеджер" if item.role == MessageRole.USER else "Клиент"
        history_lines.append(f"{speaker}: {item.content}")
    history = "\n".join(history_lines) if history_lines else "(нет контекста)"
    card_compact = json.dumps(
        {
            "role": card.role_title,
            "industry": card.industry,
            "product": card.product,
            "hidden_pain": card.hidden_pain,
            "surface": card.surface_request,
            "stance": card.initial_stance,
        },
        ensure_ascii=False,
    )
    return [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": (
                f"Карточка клиента:\n{card_compact}\n\n"
                f"Контекст (до 5 реплик):\n{history}\n\n"
                f"Реплика менеджера для оценки:\n{manager_message}\n\n"
                "Верни только JSON с 6 ключами компетенций (0–100)."
            ),
        },
    ]
