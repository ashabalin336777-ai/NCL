from typing import Any

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator

from app.models.enums import TrainingOutcome

_VALID_OUTCOMES = {item.value for item in TrainingOutcome}


def _as_str_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        parts = [part.strip(" •-\t") for part in value.replace("\r", "").split("\n")]
        return [part for part in parts if part]
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [str(value)]


class AnalysisResultDraft(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    overall_score: int = Field(
        ge=0,
        le=10,
        validation_alias=AliasChoices("overall_score", "total_score", "score"),
    )
    needs_score: int = Field(
        ge=0,
        le=10,
        validation_alias=AliasChoices("needs_score", "need_score", "discovery_score"),
    )
    presentation_score: int = Field(
        ge=0,
        le=10,
        validation_alias=AliasChoices("presentation_score", "pitch_score"),
    )
    objections_score: int = Field(
        ge=0,
        le=10,
        validation_alias=AliasChoices(
            "objections_score", "close_score", "closing_score", "objection_score"
        ),
    )
    summary: dict[str, Any] | str = Field(
        default_factory=dict,
        validation_alias=AliasChoices("summary", "resume", "overview"),
    )
    strengths: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("strengths", "strong_points", "pros"),
    )
    improvements: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices(
            "improvements", "growth_areas", "weaknesses", "zones_of_growth"
        ),
    )
    criteria_comments: dict[str, Any] = Field(
        default_factory=dict,
        validation_alias=AliasChoices("criteria_comments", "comments", "criteria"),
    )

    @field_validator(
        "overall_score", "needs_score", "presentation_score", "objections_score", mode="before"
    )
    @classmethod
    def coerce_score(cls, value: Any) -> int:
        return max(0, min(10, int(round(float(value)))))

    @field_validator("strengths", "improvements", mode="before")
    @classmethod
    def coerce_lists(cls, value: Any) -> list[str]:
        return _as_str_list(value)

    @field_validator("criteria_comments", mode="before")
    @classmethod
    def coerce_comments(cls, value: Any) -> dict[str, Any]:
        if value is None:
            return {}
        if isinstance(value, dict):
            return value
        return {"close": str(value)}

    def normalized_summary(self) -> dict[str, Any]:
        if isinstance(self.summary, str):
            return {"text": self.summary, "outcome": TrainingOutcome.ABANDONED.value}
        text = str(self.summary.get("text") or self.summary.get("content") or "Анализ завершён")
        outcome = str(self.summary.get("outcome") or "abandoned")
        if outcome not in _VALID_OUTCOMES:
            outcome = TrainingOutcome.ABANDONED.value
        return {"text": text, "outcome": outcome}

    def normalized_comments(self) -> dict[str, str]:
        return {
            "needs": str(
                self.criteria_comments.get("needs")
                or self.criteria_comments.get("need")
                or ""
            ),
            "presentation": str(self.criteria_comments.get("presentation") or ""),
            "close": str(
                self.criteria_comments.get("close")
                or self.criteria_comments.get("closing")
                or self.criteria_comments.get("objections")
                or ""
            ),
        }
