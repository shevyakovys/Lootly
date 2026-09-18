from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str | None] = mapped_column(String(320), unique=True, nullable=True)
    telegram_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    monitors: Mapped[list[SearchMonitor]] = relationship(back_populates="user")


class SearchMonitor(Base):
    __tablename__ = "search_monitors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    source: Mapped[str] = mapped_column(String(64), index=True)
    name: Mapped[str] = mapped_column(String(160))
    query_url: Mapped[str] = mapped_column(Text)
    min_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    max_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    include_keywords: Mapped[list[str]] = mapped_column(JSON, default=list)
    exclude_keywords: Mapped[list[str]] = mapped_column(JSON, default=list)
    region: Mapped[str | None] = mapped_column(String(160), nullable=True)
    interval_seconds: Mapped[int] = mapped_column(default=60)
    min_deal_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    next_check_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="monitors")
    matches: Mapped[list[MonitorListing]] = relationship(
        back_populates="monitor",
        cascade="all, delete-orphan",
    )


class Listing(Base):
    __tablename__ = "listings"
    __table_args__ = (
        UniqueConstraint("source", "external_id", name="uq_listings_source_external_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source: Mapped[str] = mapped_column(String(64), index=True)
    external_id: Mapped[str] = mapped_column(String(255))
    title: Mapped[str] = mapped_column(String(512))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    currency: Mapped[str] = mapped_column(String(8), default="RUB")
    url: Mapped[str] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    seller_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    snapshots: Mapped[list[ListingSnapshot]] = relationship(
        back_populates="listing",
        cascade="all, delete-orphan",
    )
    matches: Mapped[list[MonitorListing]] = relationship(
        back_populates="listing",
        cascade="all, delete-orphan",
    )


class MonitorListing(Base):
    __tablename__ = "monitor_listings"
    __table_args__ = (
        UniqueConstraint(
            "monitor_id",
            "listing_id",
            name="uq_monitor_listings_monitor_listing",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    monitor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("search_monitors.id", ondelete="CASCADE"),
        index=True,
    )
    listing_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("listings.id", ondelete="CASCADE"),
        index=True,
    )
    first_matched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    last_matched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    monitor: Mapped[SearchMonitor] = relationship(back_populates="matches")
    listing: Mapped[Listing] = relationship(back_populates="matches")


class ListingSnapshot(Base):
    __tablename__ = "listing_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("listings.id", ondelete="CASCADE"), index=True
    )
    price: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    observed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    listing: Mapped[Listing] = relationship(back_populates="snapshots")


class PriceStatistic(Base):
    __tablename__ = "price_statistics"
    __table_args__ = (
        UniqueConstraint(
            "monitor_id",
            "listing_id",
            name="uq_price_statistics_monitor_listing",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    monitor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("search_monitors.id", ondelete="CASCADE"),
        index=True,
    )
    listing_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("listings.id", ondelete="CASCADE"),
        index=True,
    )
    market_median: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    discount_pct: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    deal_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    sample_size: Mapped[int] = mapped_column(nullable=False)
    confidence: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    risk_flags: Mapped[list[str]] = mapped_column(JSON, default=list)
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
