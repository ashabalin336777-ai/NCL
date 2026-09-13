"""billing tables and developer role support

Revision ID: 004_billing
Revises: 003_radar
Create Date: 2026-09-13
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "004_billing"
down_revision: Union[str, None] = "003_radar"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "billing_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "balance_rub",
            sa.Numeric(14, 4),
            nullable=False,
            server_default="0",
        ),
        sa.Column("currency", sa.String(length=8), nullable=False, server_default="RUB"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_table(
        "billing_ledger",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("amount_rub", sa.Numeric(14, 4), nullable=False),
        sa.Column("balance_after", sa.Numeric(14, 4), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=False),
        sa.Column("ref_type", sa.String(length=64), nullable=True),
        sa.Column("ref_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("provider", sa.String(length=64), nullable=True),
        sa.Column("external_payment_id", sa.String(length=255), nullable=True),
        sa.Column("meta_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_billing_ledger_created_at", "billing_ledger", ["created_at"])
    op.create_index("ix_billing_ledger_type", "billing_ledger", ["type"])


def downgrade() -> None:
    op.drop_index("ix_billing_ledger_type", table_name="billing_ledger")
    op.drop_index("ix_billing_ledger_created_at", table_name="billing_ledger")
    op.drop_table("billing_ledger")
    op.drop_table("billing_accounts")
