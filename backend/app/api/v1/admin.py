from uuid import UUID

from fastapi import APIRouter, Query
from sqlalchemy import inspect as sa_inspect

from app.api.v1.deps import CurrentAdmin, CurrentUser, DbSession
from app.models.enums import TrainingStatus
from app.models.user import User
from app.schemas.admin import (
    AISettingPublic,
    AISettingsBulkUpdate,
    AISettingUpsertRequest,
    AnalysisPublic,
    KnowledgeArticleCreate,
    KnowledgeArticlePublic,
    KnowledgeArticleUpdate,
    ManagerStats,
    PromptCreateRequest,
    PromptPublic,
    TrainingCompleteRequest,
    TrainingListItem,
    UserCreateRequest,
    UserUpdateRequest,
)
from app.schemas.ai import HiddenClientCard
from app.schemas.common import APIMessage
from app.schemas.training import TrainingCompleteResponse, TrainingPublic
from app.schemas.user import UserPublic
from app.services import admin as admin_service
from app.services.analysis import (
    complete_training,
    get_training_with_analysis,
    list_trainings,
    manager_stats,
    run_sol_analysis,
)
from app.services.training import can_see_hidden_card

admin_router = APIRouter(prefix="/admin", tags=["admin"])
stats_router = APIRouter(prefix="/stats", tags=["stats"])


def training_to_public(training, user: User) -> TrainingPublic:
    card = None
    if training.client_profile is not None and can_see_hidden_card(user, training):
        card = HiddenClientCard.model_validate(training.client_profile.hidden_card_json)
    analysis = None
    state = sa_inspect(training)
    if "analysis" not in state.unloaded and training.analysis is not None:
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
        messages=training.messages,
        hints=training.hints,
        hidden_card=card,
        analysis=analysis,
    )


@admin_router.get("/users", response_model=list[UserPublic])
async def admin_list_users(session: DbSession, _admin: CurrentAdmin) -> list[UserPublic]:
    users = await admin_service.list_users(session)
    return [UserPublic.model_validate(item) for item in users]


@admin_router.post("/users", response_model=UserPublic)
async def admin_create_user(
    payload: UserCreateRequest,
    session: DbSession,
    _admin: CurrentAdmin,
) -> UserPublic:
    user = await admin_service.create_user(session, payload)
    return UserPublic.model_validate(user)


@admin_router.patch("/users/{user_id}", response_model=UserPublic)
async def admin_update_user(
    user_id: UUID,
    payload: UserUpdateRequest,
    session: DbSession,
    _admin: CurrentAdmin,
) -> UserPublic:
    user = await admin_service.update_user(session, user_id, payload)
    return UserPublic.model_validate(user)


@admin_router.get("/knowledge", response_model=list[KnowledgeArticlePublic])
async def admin_list_knowledge(
    session: DbSession,
    _admin: CurrentAdmin,
) -> list[KnowledgeArticlePublic]:
    items = await admin_service.list_knowledge(session)
    return [KnowledgeArticlePublic.model_validate(item) for item in items]


@admin_router.post("/knowledge", response_model=KnowledgeArticlePublic)
async def admin_create_knowledge(
    payload: KnowledgeArticleCreate,
    session: DbSession,
    _admin: CurrentAdmin,
) -> KnowledgeArticlePublic:
    item = await admin_service.create_knowledge(session, payload)
    return KnowledgeArticlePublic.model_validate(item)


@admin_router.patch("/knowledge/{article_id}", response_model=KnowledgeArticlePublic)
async def admin_update_knowledge(
    article_id: UUID,
    payload: KnowledgeArticleUpdate,
    session: DbSession,
    _admin: CurrentAdmin,
) -> KnowledgeArticlePublic:
    item = await admin_service.update_knowledge(session, article_id, payload)
    return KnowledgeArticlePublic.model_validate(item)


@admin_router.delete("/knowledge/{article_id}", response_model=APIMessage)
async def admin_delete_knowledge(
    article_id: UUID,
    session: DbSession,
    _admin: CurrentAdmin,
) -> APIMessage:
    await admin_service.delete_knowledge(session, article_id)
    return APIMessage(detail="Knowledge article deleted")


@admin_router.get("/prompts", response_model=list[PromptPublic])
async def admin_list_prompts(
    session: DbSession,
    _admin: CurrentAdmin,
    name: str | None = None,
) -> list[PromptPublic]:
    items = await admin_service.list_prompts(session, name=name)
    return [PromptPublic.model_validate(item) for item in items]


@admin_router.post("/prompts", response_model=PromptPublic)
async def admin_create_prompt(
    payload: PromptCreateRequest,
    session: DbSession,
    _admin: CurrentAdmin,
) -> PromptPublic:
    item = await admin_service.create_prompt_version(session, payload)
    return PromptPublic.model_validate(item)


@admin_router.post("/prompts/{prompt_id}/activate", response_model=PromptPublic)
async def admin_activate_prompt(
    prompt_id: UUID,
    session: DbSession,
    _admin: CurrentAdmin,
) -> PromptPublic:
    item = await admin_service.activate_prompt(session, prompt_id)
    return PromptPublic.model_validate(item)


@admin_router.get("/settings", response_model=list[AISettingPublic])
async def admin_list_settings(
    session: DbSession,
    _admin: CurrentAdmin,
) -> list[AISettingPublic]:
    items = await admin_service.list_settings(session)
    return [AISettingPublic.model_validate(item) for item in items]


@admin_router.put("/settings/{key}", response_model=AISettingPublic)
async def admin_upsert_setting(
    key: str,
    payload: AISettingUpsertRequest,
    session: DbSession,
    _admin: CurrentAdmin,
) -> AISettingPublic:
    item = await admin_service.upsert_setting(session, key, payload.value)
    return AISettingPublic.model_validate(item)


@admin_router.put("/settings", response_model=list[AISettingPublic])
async def admin_bulk_settings(
    payload: AISettingsBulkUpdate,
    session: DbSession,
    _admin: CurrentAdmin,
) -> list[AISettingPublic]:
    items = await admin_service.bulk_upsert_settings(session, payload)
    return [AISettingPublic.model_validate(item) for item in items]


@admin_router.get("/trainings", response_model=list[TrainingListItem])
async def admin_list_trainings(
    session: DbSession,
    admin: CurrentAdmin,
    status: TrainingStatus | None = None,
    manager_id: UUID | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[TrainingListItem]:
    return await list_trainings(
        session,
        admin,
        status=status,
        manager_id=manager_id,
        limit=limit,
        offset=offset,
    )


@stats_router.get("/me", response_model=ManagerStats)
async def my_stats(session: DbSession, user: CurrentUser) -> ManagerStats:
    return await manager_stats(session, user)


@stats_router.get("/managers/{manager_id}", response_model=ManagerStats)
async def manager_stats_admin(
    manager_id: UUID,
    session: DbSession,
    admin: CurrentAdmin,
) -> ManagerStats:
    return await manager_stats(session, admin, manager_id=manager_id)
