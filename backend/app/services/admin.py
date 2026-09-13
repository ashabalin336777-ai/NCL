from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import hash_password
from app.models.ai_setting import AISetting
from app.models.knowledge_base import KnowledgeBase
from app.models.prompt import Prompt
from app.models.user import User
from app.schemas.admin import (
    AISettingsBulkUpdate,
    KnowledgeArticleCreate,
    KnowledgeArticleUpdate,
    PromptCreateRequest,
    UserCreateRequest,
    UserUpdateRequest,
)
from app.services.neuraldeep_models import (
    assert_neuraldeep_base_url,
    assert_neuraldeep_model,
    is_blocked_model,
)

MODEL_KEYS = {
    "client_model_id",
    "card_model_id",
    "hint_model_id",
    "analyst_model_id",
    "radar_model_id",
}


async def list_users(session: AsyncSession) -> list[User]:
    result = await session.execute(select(User).order_by(User.created_at.desc()))
    return list(result.scalars().all())


async def create_user(session: AsyncSession, payload: UserCreateRequest) -> User:
    existing = await session.execute(select(User).where(User.email == payload.email.lower()))
    if existing.scalar_one_or_none() is not None:
        raise ConflictError("User with this email already exists")
    user = User(
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        is_active=payload.is_active,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def update_user(
    session: AsyncSession,
    user_id: UUID,
    payload: UserUpdateRequest,
) -> User:
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise NotFoundError("User not found")
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.password is not None:
        user.hashed_password = hash_password(payload.password)
    await session.commit()
    await session.refresh(user)
    return user


async def list_knowledge(session: AsyncSession) -> list[KnowledgeBase]:
    result = await session.execute(select(KnowledgeBase).order_by(KnowledgeBase.title))
    return list(result.scalars().all())


async def create_knowledge(
    session: AsyncSession,
    payload: KnowledgeArticleCreate,
) -> KnowledgeBase:
    article = KnowledgeBase(title=payload.title, content=payload.content)
    session.add(article)
    await session.commit()
    await session.refresh(article)
    return article


async def update_knowledge(
    session: AsyncSession,
    article_id: UUID,
    payload: KnowledgeArticleUpdate,
) -> KnowledgeBase:
    result = await session.execute(select(KnowledgeBase).where(KnowledgeBase.id == article_id))
    article = result.scalar_one_or_none()
    if article is None:
        raise NotFoundError("Knowledge article not found")
    if payload.title is not None:
        article.title = payload.title
    if payload.content is not None:
        article.content = payload.content
    await session.commit()
    await session.refresh(article)
    return article


async def delete_knowledge(session: AsyncSession, article_id: UUID) -> None:
    result = await session.execute(select(KnowledgeBase).where(KnowledgeBase.id == article_id))
    article = result.scalar_one_or_none()
    if article is None:
        raise NotFoundError("Knowledge article not found")
    await session.delete(article)
    await session.commit()


async def list_prompts(session: AsyncSession, name: str | None = None) -> list[Prompt]:
    query = select(Prompt).order_by(Prompt.name, Prompt.version.desc())
    if name:
        query = query.where(Prompt.name == name)
    result = await session.execute(query)
    return list(result.scalars().all())


async def create_prompt_version(
    session: AsyncSession,
    payload: PromptCreateRequest,
) -> Prompt:
    result = await session.execute(
        select(func.coalesce(func.max(Prompt.version), 0)).where(Prompt.name == payload.name)
    )
    next_version = int(result.scalar_one()) + 1

    if payload.activate:
        current = await session.execute(
            select(Prompt).where(Prompt.name == payload.name, Prompt.is_active.is_(True))
        )
        for item in current.scalars().all():
            item.is_active = False

    prompt = Prompt(
        name=payload.name,
        system_prompt_text=payload.system_prompt_text,
        version=next_version,
        is_active=payload.activate,
    )
    session.add(prompt)
    await session.commit()
    await session.refresh(prompt)
    return prompt


async def activate_prompt(session: AsyncSession, prompt_id: UUID) -> Prompt:
    result = await session.execute(select(Prompt).where(Prompt.id == prompt_id))
    prompt = result.scalar_one_or_none()
    if prompt is None:
        raise NotFoundError("Prompt not found")

    siblings = await session.execute(select(Prompt).where(Prompt.name == prompt.name))
    for item in siblings.scalars().all():
        item.is_active = item.id == prompt.id
    await session.commit()
    await session.refresh(prompt)
    return prompt


def _sanitize_setting(key: str, value: Any) -> Any:
    if key == "llm_base_url":
        return assert_neuraldeep_base_url(str(value))
    if key in MODEL_KEYS:
        return assert_neuraldeep_model(str(value))
    if key == "model_tariffs" and isinstance(value, dict):
        cleaned: dict[str, Any] = {}
        for model, rates in value.items():
            if is_blocked_model(str(model)):
                continue
            cleaned[str(model)] = rates
        return cleaned
    return value


async def list_settings(session: AsyncSession) -> list[AISetting]:
    result = await session.execute(select(AISetting).order_by(AISetting.key))
    return list(result.scalars().all())


async def upsert_setting(session: AsyncSession, key: str, value: Any) -> AISetting:
    safe_value = _sanitize_setting(key, value)
    result = await session.execute(select(AISetting).where(AISetting.key == key))
    row = result.scalar_one_or_none()
    if row is None:
        row = AISetting(key=key, value=safe_value)
        session.add(row)
    else:
        row.value = safe_value
    await session.commit()
    await session.refresh(row)
    return row


async def bulk_upsert_settings(
    session: AsyncSession,
    payload: AISettingsBulkUpdate,
) -> list[AISetting]:
    updated: list[AISetting] = []
    for key, value in payload.settings.items():
        updated.append(await upsert_setting(session, key, value))
    return updated
