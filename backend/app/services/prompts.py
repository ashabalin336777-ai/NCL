from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.labels import CLIENT_ROLE_LABELS, DIFFICULTY_LABELS
from app.models.enums import ClientRole, Difficulty
from app.models.knowledge_base import KnowledgeBase
from app.models.prompt import Prompt
from app.schemas.ai import HiddenClientCard


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
    kb = format_knowledge(snapshot.get("knowledge_base") or [])
    prompt_text = str(snapshot.get("prompt_text") or "")
    return (
        f"{prompt_text}\n\n"
        f"# Скрытая карточка этой тренировки\n"
        f"{card.model_dump_json(indent=2)}\n\n"
        f"# Снимок базы знаний (нельзя обещать то, чего здесь нет)\n"
        f"{kb}\n"
    )


def assemble_card_user_prompt(
    *,
    difficulty: Difficulty,
    client_role: ClientRole,
    industry: str | None,
) -> str:
    industry_line = industry or "выбери одну из: " + ", ".join(
        ["Медицина", "IoT", "Промышленная автоматизация", "ВПК", "Бытовая электроника"]
    )
    return (
        "Сгенерируй скрытую карточку реалистичного B2B-клиента — завод или КБ в РФ, "
        "закупка электронных компонентов.\n"
        f"Роль: {CLIENT_ROLE_LABELS[client_role]} ({client_role.value})\n"
        f"Сложность: {DIFFICULTY_LABELS[difficulty]} ({difficulty.value})\n"
        f"Отрасль: {industry_line}\n"
        "Верни JSON строго с этими ключами:\n"
        "company_name, contact_name, role_title, industry, product, hidden_pain, "
        "surface_request, previous_experience, initial_stance, trust_triggers, "
        "planned_objections, next_step_if_convinced.\n"
        "trust_triggers и planned_objections — массивы из 2–6 коротких строк. "
        "Карточка конкретная. Не пиши ничего кроме JSON."
    )


def assemble_hint_messages(
    snapshot: dict[str, Any],
    card: HiddenClientCard,
    transcript: str,
) -> list[dict[str, str]]:
    return [
        {
            "role": "system",
            "content": str(snapshot.get("prompt_text") or ""),
        },
        {
            "role": "user",
            "content": (
                "Скрытая карточка клиента (менеджер её не видит, ты используешь только "
                "чтобы понять, куда вести разговор):\n"
                f"{card.model_dump_json()}\n\n"
                f"Снимок базы знаний:\n{format_knowledge(snapshot.get('knowledge_base') or [])}\n\n"
                f"Текущий диалог:\n{transcript}\n\n"
                "Дай короткий совет Terra: что спросить или предложить следующим сообщением."
            ),
        },
    ]
