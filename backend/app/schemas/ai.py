from decimal import Decimal
from typing import Any

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.models.enums import ClientRole, Difficulty


class HiddenClientCardDraft(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    company_name: str = Field(
        min_length=2,
        max_length=160,
        validation_alias=AliasChoices("company_name", "client_name", "company"),
    )
    contact_name: str = Field(
        default="Не указано",
        min_length=2,
        max_length=120,
        validation_alias=AliasChoices("contact_name", "name", "person_name"),
    )
    role_title: str = Field(
        default="Снабженец",
        min_length=2,
        max_length=120,
        validation_alias=AliasChoices("role_title", "role", "position"),
    )
    industry: str = Field(min_length=2, max_length=80)
    product: str = Field(min_length=2, max_length=240)
    hidden_pain: str = Field(min_length=10, max_length=1600)
    surface_request: str = Field(min_length=5, max_length=500)
    previous_experience: str = Field(
        min_length=5,
        max_length=1000,
        validation_alias=AliasChoices("previous_experience", "past_experience"),
    )
    initial_stance: str = Field(
        min_length=5,
        max_length=500,
        validation_alias=AliasChoices("initial_stance", "initial_position"),
    )
    trust_triggers: list[str] = Field(min_length=2, max_length=8)
    planned_objections: list[str] = Field(
        min_length=2,
        max_length=8,
        validation_alias=AliasChoices("planned_objections", "objections"),
    )
    next_step_if_convinced: str = Field(
        default="Отправить BOM на бесплатный просчет",
        min_length=5,
        max_length=240,
        validation_alias=AliasChoices(
            "next_step_if_convinced", "next_step", "desired_next_step"
        ),
    )


class HiddenClientCard(HiddenClientCardDraft):
    difficulty: Difficulty
    role_code: ClientRole


class UsageInfo(BaseModel):
    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    cost_rub: Decimal


class AIRuntimePublic(BaseModel):
    provider: str
    base_url: str
    client_model_id: str
    card_model_id: str
    hint_model_id: str
    analyst_model_id: str
    timeout_seconds: int
    tariffs: dict[str, Any]
    allowed_models: list[str]
