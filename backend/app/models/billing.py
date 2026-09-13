import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import BillingLedgerType


class BillingAccount(Base):
    __tablename__ = "billing_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    balance_rub: Mapped[Decimal] = mapped_column(
        Numeric(14, 4), nullable=False, default=Decimal("0")
    )
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="RUB")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class BillingLedger(Base):
    __tablename__ = "billing_ledger"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    type: Mapped[BillingLedgerType] = mapped_column(
        Enum(
            BillingLedgerType,
            name="billing_ledger_type",
            native_enum=False,
            length=32,
            values_callable=lambda items: [item.value for item in items],
        ),
        nullable=False,
    )
    amount_rub: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    ref_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ref_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    external_payment_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    meta_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
