import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Numeric, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class MessageAnalysis(Base):
    __tablename__ = "message_analyses"
    __table_args__ = (
        CheckConstraint(
            "needs_discovery >= 0 AND needs_discovery <= 100",
            name="ck_radar_needs_discovery",
        ),
        CheckConstraint(
            "solution_presentation >= 0 AND solution_presentation <= 100",
            name="ck_radar_solution_presentation",
        ),
        CheckConstraint(
            "objection_handling >= 0 AND objection_handling <= 100",
            name="ck_radar_objection_handling",
        ),
        CheckConstraint(
            "closing_persistence >= 0 AND closing_persistence <= 100",
            name="ck_radar_closing_persistence",
        ),
        CheckConstraint(
            "technical_expertise >= 0 AND technical_expertise <= 100",
            name="ck_radar_technical_expertise",
        ),
        CheckConstraint(
            "risk_management >= 0 AND risk_management <= 100",
            name="ck_radar_risk_management",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    training_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("trainings.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    needs_discovery: Mapped[int] = mapped_column(Integer, nullable=False)
    solution_presentation: Mapped[int] = mapped_column(Integer, nullable=False)
    objection_handling: Mapped[int] = mapped_column(Integer, nullable=False)
    closing_persistence: Mapped[int] = mapped_column(Integer, nullable=False)
    technical_expertise: Mapped[int] = mapped_column(Integer, nullable=False)
    risk_management: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_scores_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    cost_rub: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), nullable=False, default=Decimal("0")
    )
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    training: Mapped["Training"] = relationship(back_populates="message_analyses")
    message: Mapped["Message"] = relationship(back_populates="message_analysis")
