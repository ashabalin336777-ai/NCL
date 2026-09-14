import asyncio
from decimal import Decimal
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.db.seed_content import (
    ANALYST_SYSTEM_PROMPT,
    CARD_SYSTEM_PROMPT,
    CLIENT_SYSTEM_PROMPT,
    HINT_SYSTEM_PROMPT,
    KNOWLEDGE_ARTICLES,
    RADAR_SYSTEM_PROMPT,
)
from app.services.ai_settings import DEFAULT_TARIFFS
from app.models.ai_setting import AISetting
from app.models.billing import BillingAccount
from app.models.enums import UserRole
from app.models.knowledge_base import KnowledgeBase
from app.models.prompt import Prompt
from app.models.user import User

DEFAULT_SETTINGS: dict[str, Any] = {
    "llm_base_url": "https://api.neuraldeep.ru/v1",
    "llm_api_key": settings.llm_api_key,
    "client_model_id": "qwen3.6-fp8-noreason",
    "card_model_id": "qwen3.6-fp8-noreason",
    "hint_model_id": "qwen3.6-fp8-noreason",
    "analyst_model_id": "qwen3.8-27b-noreason",
    "radar_model_id": "qwen3.6-fp8-noreason",
    "cost_per_1k_input_tokens_rub": 0.02448,
    "cost_per_1k_output_tokens_rub": 0.122,
    "llm_timeout_seconds": settings.llm_timeout_seconds,
    "model_tariffs": DEFAULT_TARIFFS,
    "billing_min_reserve_rub": 5,
    "billing_markup_multiplier": 15,
}

PLACEHOLDER_SETTINGS: dict[str, set[Any]] = {
    "llm_base_url": {
        "http://llm-inference:8000/v1",
        "https://api.openai.com/v1",
        "https://api.openai.com/v1/",
    },
    "llm_api_key": {"not-needed", ""},
    "client_model_id": {"neuraldeep/qwen2.5-72b-instruct", "qwen3.8-27b-noreason", "qwen3.8-27b"},
    "card_model_id": {"qwen3.8-27b-noreason", "qwen3.8-27b"},
    "hint_model_id": {"neuraldeep/saiga-llama3"},
    "analyst_model_id": {"neuraldeep/qwen2.5-72b-instruct", "qwen3.8-27b"},
    "cost_per_1k_input_tokens_rub": {0.15},
    "cost_per_1k_output_tokens_rub": {0.4, 0.40},
}

DEFAULT_PROMPTS: list[tuple[str, str]] = [
    ("client", CLIENT_SYSTEM_PROMPT),
    ("terra_hint", HINT_SYSTEM_PROMPT),
    ("sol_analyst", ANALYST_SYSTEM_PROMPT),
    ("card_generator", CARD_SYSTEM_PROMPT),
    ("radar_analyzer", RADAR_SYSTEM_PROMPT),
]


async def _ensure_user(
    session: AsyncSession,
    email: str,
    password: str,
    role: UserRole,
    full_name: str,
) -> None:
    result = await session.execute(select(User).where(User.email == email.lower()))
    if result.scalar_one_or_none() is not None:
        return
    session.add(
        User(
            email=email.lower(),
            hashed_password=hash_password(password),
            role=role,
            is_active=True,
            full_name=full_name,
        )
    )


async def _ensure_setting(session: AsyncSession, key: str, value: Any) -> None:
    result = await session.execute(select(AISetting).where(AISetting.key == key))
    row = result.scalar_one_or_none()
    if row is None:
        session.add(AISetting(key=key, value=value))
        return
    placeholders = PLACEHOLDER_SETTINGS.get(key)
    if not placeholders:
        return
    current = row.value
    if isinstance(current, (dict, list)):
        return
    if current in placeholders:
        row.value = value


async def _ensure_prompt(session: AsyncSession, name: str, text: str) -> None:
    result = await session.execute(
        select(Prompt).where(Prompt.name == name, Prompt.version == 1)
    )
    if result.scalar_one_or_none() is not None:
        return
    session.add(
        Prompt(name=name, system_prompt_text=text, version=1, is_active=True)
    )


async def _ensure_article(session: AsyncSession, title: str, content: str) -> None:
    result = await session.execute(select(KnowledgeBase).where(KnowledgeBase.title == title))
    if result.scalar_one_or_none() is not None:
        return
    session.add(KnowledgeBase(title=title, content=content))


async def _ensure_billing_account(session: AsyncSession, balance: Decimal) -> None:
    result = await session.execute(select(BillingAccount).limit(1))
    if result.scalar_one_or_none() is not None:
        return
    session.add(
        BillingAccount(id=uuid4(), balance_rub=balance, currency="RUB")
    )


async def seed() -> None:
    async with SessionLocal() as session:
        await _ensure_user(
            session,
            settings.seed_developer_email,
            settings.seed_developer_password,
            UserRole.DEVELOPER,
            "Разработчик NCL",
        )
        await _ensure_user(
            session,
            settings.seed_admin_email,
            settings.seed_admin_password,
            UserRole.ADMIN,
            "Елена Соколова",
        )
        await _ensure_user(
            session,
            "manager1@ncl.local",
            settings.seed_manager_password,
            UserRole.MANAGER,
            "Иван Петров",
        )
        await _ensure_user(
            session,
            "manager2@ncl.local",
            settings.seed_manager_password,
            UserRole.MANAGER,
            "Анна Козлова",
        )
        await _ensure_user(
            session,
            "manager3@ncl.local",
            settings.seed_manager_password,
            UserRole.MANAGER,
            "Дмитрий Орлов",
        )

        for key, value in DEFAULT_SETTINGS.items():
            await _ensure_setting(session, key, value)

        for name, text in DEFAULT_PROMPTS:
            await _ensure_prompt(session, name, text)

        for title, content in KNOWLEDGE_ARTICLES:
            await _ensure_article(session, title, content)

        await _ensure_billing_account(
            session, Decimal(str(settings.seed_billing_balance_rub))
        )

        await session.commit()
        print("Seed completed")


if __name__ == "__main__":
    asyncio.run(seed())
