"""Initial users and search monitors.

Revision ID: 0001_initial
Revises:
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("telegram_id", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("telegram_id"),
    )
    op.create_table(
        "search_monitors",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("query_url", sa.Text(), nullable=False),
        sa.Column("min_price", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("max_price", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("include_keywords", sa.JSON(), nullable=False),
        sa.Column("exclude_keywords", sa.JSON(), nullable=False),
        sa.Column("region", sa.String(length=160), nullable=True),
        sa.Column("interval_seconds", sa.Integer(), nullable=False),
        sa.Column("min_deal_score", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_search_monitors_enabled"),
        "search_monitors",
        ["enabled"],
        unique=False,
    )
    op.create_index(
        op.f("ix_search_monitors_source"),
        "search_monitors",
        ["source"],
        unique=False,
    )
    op.create_index(
        op.f("ix_search_monitors_user_id"),
        "search_monitors",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_search_monitors_user_id"), table_name="search_monitors")
    op.drop_index(op.f("ix_search_monitors_source"), table_name="search_monitors")
    op.drop_index(op.f("ix_search_monitors_enabled"), table_name="search_monitors")
    op.drop_table("search_monitors")
    op.drop_table("users")
