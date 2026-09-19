"""Add public booking analytics events.

Revision ID: 0004_public_booking_events
Revises: 0003_mvp_operations
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_public_booking_events"
down_revision: str | None = "0003_mvp_operations"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "public_booking_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_key", sa.String(length=100), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id",
            "session_key",
            "event_type",
            name="uq_public_booking_event_session_type",
        ),
    )
    op.create_index(
        "ix_public_booking_events_organization_id",
        "public_booking_events",
        ["organization_id"],
    )
    op.create_index(
        "ix_public_booking_events_session_key",
        "public_booking_events",
        ["session_key"],
    )
    op.create_index(
        "ix_public_booking_events_event_type",
        "public_booking_events",
        ["event_type"],
    )
    op.create_index(
        "ix_public_booking_events_created_at",
        "public_booking_events",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_table("public_booking_events")
