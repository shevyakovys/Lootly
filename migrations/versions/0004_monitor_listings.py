"""Link listings to search monitors.

Revision ID: 0004_monitor_listings
Revises: 0003_monitor_schedule
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_monitor_listings"
down_revision: str | None = "0003_monitor_schedule"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "monitor_listings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("monitor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("listing_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "first_matched_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "last_matched_at",
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
            name="uq_monitor_listings_monitor_listing",
        ),
    )
    op.create_index(
        op.f("ix_monitor_listings_listing_id"),
        "monitor_listings",
        ["listing_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_monitor_listings_monitor_id"),
        "monitor_listings",
        ["monitor_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_monitor_listings_monitor_id"),
        table_name="monitor_listings",
    )
    op.drop_index(
        op.f("ix_monitor_listings_listing_id"),
        table_name="monitor_listings",
    )
    op.drop_table("monitor_listings")
