"""Add monitoring run telemetry.

Revision ID: 0008_monitoring_runs
Revises: 0007_polling_interval_ms
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008_monitoring_runs"
down_revision: str | None = "0007_polling_interval_ms"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "monitoring_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("monitor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("fetched", sa.Integer(), nullable=False),
        sa.Column("accepted", sa.Integer(), nullable=False),
        sa.Column("created", sa.Integer(), nullable=False),
        sa.Column("updated", sa.Integer(), nullable=False),
        sa.Column("new_matches", sa.Integer(), nullable=False),
        sa.Column("error_type", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(
            ["monitor_id"],
            ["search_monitors.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_monitoring_runs_monitor_id"),
        "monitoring_runs",
        ["monitor_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_monitoring_runs_status"),
        "monitoring_runs",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_monitoring_runs_status"), table_name="monitoring_runs")
    op.drop_index(op.f("ix_monitoring_runs_monitor_id"), table_name="monitoring_runs")
    op.drop_table("monitoring_runs")
