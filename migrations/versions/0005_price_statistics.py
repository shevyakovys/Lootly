"""Add price statistics.

Revision ID: 0005_price_statistics
Revises: 0004_monitor_listings
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_price_statistics"
down_revision: str | None = "0004_monitor_listings"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "price_statistics",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("monitor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("listing_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("market_median", sa.Numeric(18, 2), nullable=True),
        sa.Column("discount_pct", sa.Numeric(8, 2), nullable=True),
        sa.Column("deal_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("sample_size", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.Numeric(5, 2), nullable=False),
        sa.Column("risk_flags", sa.JSON(), nullable=False),
        sa.Column(
            "calculated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["listing_id"],
            ["listings.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["monitor_id"],
            ["search_monitors.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "monitor_id",
            "listing_id",
            name="uq_price_statistics_monitor_listing",
        ),
    )
    op.create_index(
        op.f("ix_price_statistics_monitor_id"),
        "price_statistics",
        ["monitor_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_price_statistics_listing_id"),
        "price_statistics",
        ["listing_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_price_statistics_listing_id"),
        table_name="price_statistics",
    )
    op.drop_index(
        op.f("ix_price_statistics_monitor_id"),
        table_name="price_statistics",
    )
    op.drop_table("price_statistics")
