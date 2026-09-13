from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Query

from app.api.v1.deps import CurrentDeveloper, DbSession
from app.core.exceptions import AppError
from app.schemas.admin import (
    AISettingPublic,
    AISettingsBulkUpdate,
    AISettingUpsertRequest,
    BillingAccountPublic,
    BillingLedgerPublic,
    BillingTopupRequest,
    KnowledgeArticleCreate,
    KnowledgeArticlePublic,
    KnowledgeArticleUpdate,
    PromptCreateRequest,
    PromptPublic,
    UserCreateRequest,
    UserUpdateRequest,
)
from app.schemas.common import APIMessage
from app.schemas.user import UserPublic
from app.services import admin as admin_service
from app.services import billing as billing_service

router = APIRouter(prefix="/dev", tags=["developer"])


@router.get("/billing", response_model=BillingAccountPublic)
async def get_billing(
    session: DbSession,
    _dev: CurrentDeveloper,
) -> BillingAccountPublic:
    account = await billing_service.get_or_create_account(session)
    reserve = await billing_service.min_reserve_rub(session)
    return BillingAccountPublic(
        balance_rub=Decimal(account.balance_rub),
        currency=account.currency,
        updated_at=account.updated_at,
        min_reserve_rub=reserve,
    )


@router.post("/billing/topup", response_model=BillingLedgerPublic)
async def billing_topup(
    payload: BillingTopupRequest,
    session: DbSession,
    developer: CurrentDeveloper,
) -> BillingLedgerPublic:
    try:
        entry = await billing_service.topup(
            session,
            amount_rub=payload.amount_rub,
            created_by=developer.id,
            note=payload.note,
        )
    except ValueError as exc:
        raise AppError(400, str(exc)) from exc
    await session.commit()
    await session.refresh(entry)
    return BillingLedgerPublic.model_validate(entry)


@router.get("/billing/ledger", response_model=list[BillingLedgerPublic])
async def billing_ledger(
    session: DbSession,
    _dev: CurrentDeveloper,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[BillingLedgerPublic]:
    items = await billing_service.list_ledger(session, limit=limit, offset=offset)
    return [BillingLedgerPublic.model_validate(item) for item in items]


@router.get("/users", response_model=list[UserPublic])
async def list_users(session: DbSession, _dev: CurrentDeveloper) -> list[UserPublic]:
    users = await admin_service.list_users(session)
    return [UserPublic.model_validate(item) for item in users]


@router.post("/users", response_model=UserPublic)
async def create_user(
    payload: UserCreateRequest,
    session: DbSession,
    developer: CurrentDeveloper,
) -> UserPublic:
    user = await admin_service.create_user(session, payload, actor=developer)
    return UserPublic.model_validate(user)


@router.patch("/users/{user_id}", response_model=UserPublic)
async def update_user(
    user_id: UUID,
    payload: UserUpdateRequest,
    session: DbSession,
    developer: CurrentDeveloper,
) -> UserPublic:
    user = await admin_service.update_user(session, user_id, payload, actor=developer)
    return UserPublic.model_validate(user)


@router.get("/knowledge", response_model=list[KnowledgeArticlePublic])
async def list_knowledge(
    session: DbSession,
    _dev: CurrentDeveloper,
) -> list[KnowledgeArticlePublic]:
    items = await admin_service.list_knowledge(session)
    return [KnowledgeArticlePublic.model_validate(item) for item in items]


@router.post("/knowledge", response_model=KnowledgeArticlePublic)
async def create_knowledge(
    payload: KnowledgeArticleCreate,
    session: DbSession,
    _dev: CurrentDeveloper,
) -> KnowledgeArticlePublic:
    item = await admin_service.create_knowledge(session, payload)
    return KnowledgeArticlePublic.model_validate(item)


@router.patch("/knowledge/{article_id}", response_model=KnowledgeArticlePublic)
async def update_knowledge(
    article_id: UUID,
    payload: KnowledgeArticleUpdate,
    session: DbSession,
    _dev: CurrentDeveloper,
) -> KnowledgeArticlePublic:
    item = await admin_service.update_knowledge(session, article_id, payload)
    return KnowledgeArticlePublic.model_validate(item)


@router.delete("/knowledge/{article_id}", response_model=APIMessage)
async def delete_knowledge(
    article_id: UUID,
    session: DbSession,
    _dev: CurrentDeveloper,
) -> APIMessage:
    await admin_service.delete_knowledge(session, article_id)
    return APIMessage(detail="Knowledge article deleted")


@router.get("/prompts", response_model=list[PromptPublic])
async def list_prompts(
    session: DbSession,
    _dev: CurrentDeveloper,
    name: str | None = None,
) -> list[PromptPublic]:
    items = await admin_service.list_prompts(session, name=name)
    return [PromptPublic.model_validate(item) for item in items]


@router.post("/prompts", response_model=PromptPublic)
async def create_prompt(
    payload: PromptCreateRequest,
    session: DbSession,
    _dev: CurrentDeveloper,
) -> PromptPublic:
    item = await admin_service.create_prompt_version(session, payload)
    return PromptPublic.model_validate(item)


@router.post("/prompts/{prompt_id}/activate", response_model=PromptPublic)
async def activate_prompt(
    prompt_id: UUID,
    session: DbSession,
    _dev: CurrentDeveloper,
) -> PromptPublic:
    item = await admin_service.activate_prompt(session, prompt_id)
    return PromptPublic.model_validate(item)


@router.get("/settings", response_model=list[AISettingPublic])
async def list_settings(
    session: DbSession,
    _dev: CurrentDeveloper,
) -> list[AISettingPublic]:
    items = await admin_service.list_settings(session)
    return [AISettingPublic.model_validate(item) for item in items]


@router.put("/settings/{key}", response_model=AISettingPublic)
async def upsert_setting(
    key: str,
    payload: AISettingUpsertRequest,
    session: DbSession,
    _dev: CurrentDeveloper,
) -> AISettingPublic:
    item = await admin_service.upsert_setting(session, key, payload.value)
    return AISettingPublic.model_validate(item)


@router.put("/settings", response_model=list[AISettingPublic])
async def bulk_settings(
    payload: AISettingsBulkUpdate,
    session: DbSession,
    _dev: CurrentDeveloper,
) -> list[AISettingPublic]:
    items = await admin_service.bulk_upsert_settings(session, payload)
    return [AISettingPublic.model_validate(item) for item in items]
