from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import UserRole
from app.schemas.common import ORMModel
from app.schemas.types import AppEmail


class AnalysisPublic(ORMModel):
    id: UUID
    training_id: UUID
    overall_score: int
    needs_score: int
    presentation_score: int
    objections_score: int
    summary_json: dict[str, Any]
    strengths_json: list[Any]
    improvements_json: list[Any]
    cost_rub: Decimal
    created_at: datetime


class TrainingCompleteRequest(BaseModel):
    run_analysis: bool = True


class UserCreateRequest(BaseModel):
    email: AppEmail
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=1, max_length=255)
    role: UserRole = UserRole.MANAGER
    is_active: bool = True


class UserUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    role: UserRole | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=72)


class KnowledgeArticleCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)


class KnowledgeArticleUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = Field(default=None, min_length=1)


class KnowledgeArticlePublic(ORMModel):
    id: UUID
    title: str
    content: str
    created_at: datetime
    updated_at: datetime


class PromptCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    system_prompt_text: str = Field(min_length=1)
    activate: bool = True


class PromptPublic(ORMModel):
    id: UUID
    name: str
    system_prompt_text: str
    version: int
    is_active: bool
    created_at: datetime


class AISettingPublic(ORMModel):
    id: UUID
    key: str
    value: Any
    updated_at: datetime


class AISettingUpsertRequest(BaseModel):
    value: Any


class AISettingsBulkUpdate(BaseModel):
    settings: dict[str, Any]


class TrainingListItem(ORMModel):
    id: UUID
    user_id: UUID
    manager_name: str | None = None
    manager_email: str | None = None
    difficulty: str
    client_role: str
    industry: str | None = None
    status: str
    outcome: str | None = None
    overall_score: int | None = None
    total_cost_rub: Decimal
    created_at: datetime
    ended_at: datetime | None


class ManagerStats(BaseModel):
    trainings_total: int
    trainings_completed: int
    average_overall_score: float | None
    average_needs_score: float | None
    average_presentation_score: float | None
    average_objections_score: float | None
    total_cost_rub: Decimal
    outcomes: dict[str, int]
