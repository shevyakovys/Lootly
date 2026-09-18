"""Add millisecond polling interval.

Revision ID: 0007_polling_interval_ms
Revises: 0006_notifications
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_polling_interval_ms"
down_revision: str | None = "0006_notifications"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "search_monitors",
        sa.Column("poll_interval_ms", sa.Integer(), nullable=True),
    )
    op.execute("UPDATE search_monitors SET poll_interval_ms = interval_seconds * 1000")
    op.alter_column(
        "search_monitors",
        "poll_interval_ms",
        nullable=False,
        server_default="60000",
    )
    op.drop_column("search_monitors", "interval_seconds")


def downgrade() -> None:
    op.add_column(
        "search_monitors",
        sa.Column("interval_seconds", sa.Integer(), nullable=True),
    )
    op.execute(
        "UPDATE search_monitors "
        "SET interval_seconds = GREATEST(1, poll_interval_ms / 1000)"
    )
    op.alter_column(
        "search_monitors",
        "interval_seconds",
        nullable=False,
        server_default="60",
    )
    op.drop_column("search_monitors", "poll_interval_ms")
