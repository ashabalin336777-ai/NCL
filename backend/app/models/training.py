import uuid
from datetime import datetime
from decimal import Decimal

from typing import Any

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import ClientRole, Difficulty, TrainingOutcome, TrainingStatus


class Training(Base):
    __tablename__ = "trainings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    difficulty: Mapped[Difficulty] = mapped_column(
        Enum(
            Difficulty,
            name="difficulty",
            native_enum=False,
            length=16,
            values_callable=lambda items: [item.value for item in items],
        ),
        nullable=False,
    )
    client_role: Mapped[ClientRole] = mapped_column(
        Enum(
            ClientRole,
            name="client_role",
            native_enum=False,
            length=32,
            values_callable=lambda items: [item.value for item in items],
        ),
        nullable=False,
    )
    status: Mapped[TrainingStatus] = mapped_column(
        Enum(
            TrainingStatus,
            name="training_status",
            native_enum=False,
            length=16,
            values_callable=lambda items: [item.value for item in items],
        ),
        nullable=False,
        default=TrainingStatus.CREATED,
        index=True,
    )
    outcome: Mapped[TrainingOutcome | None] = mapped_column(
        Enum(
            TrainingOutcome,
            name="training_outcome",
            native_enum=False,
            length=32,
            values_callable=lambda items: [item.value for item in items],
        ),
        nullable=True,
    )
    total_cost_rub: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), nullable=False, default=Decimal("0")
    )
    prompt_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    prompt_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    context_snapshot_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="trainings")
    client_profile: Mapped["ClientProfile | None"] = relationship(
        back_populates="training",
        uselist=False,
        cascade="all, delete-orphan",
    )
    messages: Mapped[list["Message"]] = relationship(
        back_populates="training",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )
    hints: Mapped[list["Hint"]] = relationship(
        back_populates="training",
        cascade="all, delete-orphan",
    )
    analysis: Mapped["Analysis | None"] = relationship(
        back_populates="training",
        uselist=False,
        cascade="all, delete-orphan",
    )
    message_analyses: Mapped[list["MessageAnalysis"]] = relationship(
        back_populates="training",
        cascade="all, delete-orphan",
        order_by="MessageAnalysis.created_at",
    )
