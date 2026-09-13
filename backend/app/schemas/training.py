from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.domain.labels import INDUSTRIES
from app.models.enums import ClientRole, Difficulty, MessageRole, TrainingOutcome, TrainingStatus
from app.schemas.admin import AnalysisPublic
from app.schemas.ai import ClientBriefPublic, HiddenClientCard, UsageInfo
from app.schemas.common import ORMModel
from app.schemas.radar import RadarScoresPublic


class TrainingCreateRequest(BaseModel):
    difficulty: Difficulty
    client_role: ClientRole
    industry: str | None = Field(default=None, max_length=80)

    def resolved_industry(self) -> str | None:
        if self.industry is None or not self.industry.strip():
            return None
        cleaned = self.industry.strip()
        for item in INDUSTRIES:
            if item.lower() == cleaned.lower():
                return item
        return cleaned


class ChatMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=8000)


class MessagePublic(ORMModel):
    id: UUID
    role: MessageRole
    content: str
    tokens_used: int
    cost_rub: Decimal
    created_at: datetime


class HintPublic(ORMModel):
    id: UUID
    response_text: str
    tokens_used: int
    cost_rub: Decimal
    created_at: datetime


class TrainingPublic(ORMModel):
    id: UUID
    difficulty: Difficulty
    client_role: ClientRole
    status: TrainingStatus
    outcome: TrainingOutcome | None
    total_cost_rub: Decimal
    prompt_name: str | None
    prompt_version: int | None
    created_at: datetime
    ended_at: datetime | None
    messages: list[MessagePublic] = Field(default_factory=list)
    hints: list[HintPublic] = Field(default_factory=list)
    client_brief: ClientBriefPublic | None = None
    client_label: str | None = None
    hidden_card: HiddenClientCard | None = None
    analysis: AnalysisPublic | None = None
    radar_scores: RadarScoresPublic | None = None


class TrainingCreateResponse(TrainingPublic):
    usage: UsageInfo


class TrainingCompleteResponse(TrainingPublic):
    analysis_usage: UsageInfo | None = None
