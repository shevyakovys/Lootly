"""Add monitor scheduling state.

Revision ID: 0003_monitor_schedule
Revises: 0002_listings
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_monitor_schedule"
down_revision: str | None = "0002_listings"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "search_monitors",
        sa.Column(
            "next_check_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        op.f("ix_search_monitors_next_check_at"),
        "search_monitors",
        ["next_check_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_search_monitors_next_check_at"),
        table_name="search_monitors",
    )
    op.drop_column("search_monitors", "next_check_at")
