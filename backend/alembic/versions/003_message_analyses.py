"""message analyses for realtime competency radar

Revision ID: 003_radar
Revises: 002_snapshot
Create Date: 2026-09-13
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003_radar"
down_revision: Union[str, None] = "002_snapshot"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "message_analyses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("training_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("message_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("needs_discovery", sa.Integer(), nullable=False),
        sa.Column("solution_presentation", sa.Integer(), nullable=False),
        sa.Column("objection_handling", sa.Integer(), nullable=False),
        sa.Column("closing_persistence", sa.Integer(), nullable=False),
        sa.Column("technical_expertise", sa.Integer(), nullable=False),
        sa.Column("risk_management", sa.Integer(), nullable=False),
        sa.Column(
            "raw_scores_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("cost_rub", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("latency_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["training_id"], ["trainings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["message_id"], ["messages.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("message_id", name="uq_message_analyses_message_id"),
        sa.CheckConstraint(
            "needs_discovery >= 0 AND needs_discovery <= 100",
            name="ck_radar_needs_discovery",
        ),
        sa.CheckConstraint(
            "solution_presentation >= 0 AND solution_presentation <= 100",
            name="ck_radar_solution_presentation",
        ),
        sa.CheckConstraint(
            "objection_handling >= 0 AND objection_handling <= 100",
            name="ck_radar_objection_handling",
        ),
        sa.CheckConstraint(
            "closing_persistence >= 0 AND closing_persistence <= 100",
            name="ck_radar_closing_persistence",
        ),
        sa.CheckConstraint(
            "technical_expertise >= 0 AND technical_expertise <= 100",
            name="ck_radar_technical_expertise",
        ),
        sa.CheckConstraint(
            "risk_management >= 0 AND risk_management <= 100",
            name="ck_radar_risk_management",
        ),
    )
    op.create_index(
        "ix_message_analyses_training_id",
        "message_analyses",
        ["training_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_message_analyses_training_id", table_name="message_analyses")
    op.drop_table("message_analyses")
