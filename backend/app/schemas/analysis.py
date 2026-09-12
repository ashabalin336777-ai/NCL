from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import TrainingOutcome

_VALID_OUTCOMES = {item.value for item in TrainingOutcome}


class AnalysisResultDraft(BaseModel):
    model_config = ConfigDict(extra="ignore")

    overall_score: int = Field(ge=0, le=10)
    needs_score: int = Field(ge=0, le=10)
    presentation_score: int = Field(ge=0, le=10)
    objections_score: int = Field(ge=0, le=10)
    summary: dict[str, Any] | str = Field(default_factory=dict)
    strengths: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
    criteria_comments: dict[str, Any] = Field(default_factory=dict)

    @field_validator("overall_score", "needs_score", "presentation_score", "objections_score", mode="before")
    @classmethod
    def coerce_score(cls, value: Any) -> int:
        return max(0, min(10, int(round(float(value)))))

    def normalized_summary(self) -> dict[str, Any]:
        if isinstance(self.summary, str):
            return {"text": self.summary, "outcome": TrainingOutcome.ABANDONED.value}
        text = str(self.summary.get("text") or "Анализ завершён")
        outcome = str(self.summary.get("outcome") or "abandoned")
        if outcome not in _VALID_OUTCOMES:
            outcome = TrainingOutcome.ABANDONED.value
        return {"text": text, "outcome": outcome}

    def normalized_comments(self) -> dict[str, str]:
        return {
            "needs": str(self.criteria_comments.get("needs") or ""),
            "presentation": str(self.criteria_comments.get("presentation") or ""),
            "close": str(self.criteria_comments.get("close") or ""),
        }
