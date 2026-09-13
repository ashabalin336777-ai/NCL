from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


RADAR_SCORE_KEYS = (
    "needs_discovery",
    "solution_presentation",
    "objection_handling",
    "closing_persistence",
    "technical_expertise",
    "risk_management",
)


def clamp_score(value: Any) -> int:
    try:
        return max(0, min(100, int(round(float(value)))))
    except (TypeError, ValueError):
        return 0


def aggregate_score(previous: int, new_score: int) -> int:
    """Cumulative radar: 70% history + 30% latest message."""
    return clamp_score(previous * 0.7 + new_score * 0.3)


def zero_radar_scores() -> dict[str, int]:
    return {key: 0 for key in RADAR_SCORE_KEYS}


class RadarScoresDraft(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    needs_discovery: int = Field(
        ge=0,
        le=100,
        validation_alias=AliasChoices("needs_discovery", "needs", "discovery"),
    )
    solution_presentation: int = Field(
        ge=0,
        le=100,
        validation_alias=AliasChoices(
            "solution_presentation", "presentation", "solution"
        ),
    )
    objection_handling: int = Field(
        ge=0,
        le=100,
        validation_alias=AliasChoices(
            "objection_handling", "objections", "objection"
        ),
    )
    closing_persistence: int = Field(
        ge=0,
        le=100,
        validation_alias=AliasChoices(
            "closing_persistence", "closing", "persistence"
        ),
    )
    technical_expertise: int = Field(
        ge=0,
        le=100,
        validation_alias=AliasChoices(
            "technical_expertise", "technical", "expertise"
        ),
    )
    risk_management: int = Field(
        ge=0,
        le=100,
        validation_alias=AliasChoices("risk_management", "risk", "risks"),
    )

    @field_validator(*RADAR_SCORE_KEYS, mode="before")
    @classmethod
    def coerce_score(cls, value: Any) -> int:
        return clamp_score(value)

    def as_dict(self) -> dict[str, int]:
        return {key: getattr(self, key) for key in RADAR_SCORE_KEYS}


class RadarScoresPublic(BaseModel):
    needs_discovery: int = 0
    solution_presentation: int = 0
    objection_handling: int = 0
    closing_persistence: int = 0
    technical_expertise: int = 0
    risk_management: int = 0


class AnalyzeMessageRequest(BaseModel):
    message_id: UUID


class AnalyzeMessageResponse(BaseModel):
    scores: RadarScoresPublic
    cost_rub: Decimal
    latency_ms: int
    cached: bool = False
