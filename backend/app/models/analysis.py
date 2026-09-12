import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Numeric, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Analysis(Base):
    __tablename__ = "analyses"
    __table_args__ = (
        CheckConstraint("overall_score >= 0 AND overall_score <= 10", name="ck_overall_score"),
        CheckConstraint("needs_score >= 0 AND needs_score <= 10", name="ck_needs_score"),
        CheckConstraint(
            "presentation_score >= 0 AND presentation_score <= 10",
            name="ck_presentation_score",
        ),
        CheckConstraint(
            "objections_score >= 0 AND objections_score <= 10",
            name="ck_objections_score",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    training_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("trainings.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    overall_score: Mapped[int] = mapped_column(Integer, nullable=False)
    needs_score: Mapped[int] = mapped_column(Integer, nullable=False)
    presentation_score: Mapped[int] = mapped_column(Integer, nullable=False)
    objections_score: Mapped[int] = mapped_column(Integer, nullable=False)
    summary_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    strengths_json: Mapped[list[Any]] = mapped_column(JSONB, nullable=False)
    improvements_json: Mapped[list[Any]] = mapped_column(JSONB, nullable=False)
    cost_rub: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), nullable=False, default=Decimal("0")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    training: Mapped["Training"] = relationship(back_populates="analysis")
