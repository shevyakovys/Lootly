from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.deal_scoring import DealScoreResult, calculate_deal_score
from app.domain.models import Listing, MonitorListing, PriceStatistic


class PricingService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def assess(
        self,
        monitor_id: uuid.UUID,
        listing_id: uuid.UUID,
        *,
        lookback_days: int = 30,
        min_sample: int = 5,
    ) -> DealScoreResult:
        listing = await self.session.get(Listing, listing_id)
        if listing is None:
            raise LookupError(f"listing {listing_id} not found")

        cutoff = datetime.now(UTC) - timedelta(days=lookback_days)
        comparable_prices = list(
            (
                await self.session.scalars(
                    select(Listing.price)
                    .join(MonitorListing, MonitorListing.listing_id == Listing.id)
                    .where(
                        MonitorListing.monitor_id == monitor_id,
                        Listing.id != listing_id,
                        Listing.currency == listing.currency,
                        Listing.first_seen_at >= cutoff,
                    )
                )
            ).all()
        )

        result = calculate_deal_score(
            listing.price,
            [Decimal(price) for price in comparable_prices],
            min_sample=min_sample,
        )
        await self._persist(monitor_id, listing_id, result)
        return result

    async def _persist(
        self,
        monitor_id: uuid.UUID,
        listing_id: uuid.UUID,
        result: DealScoreResult,
    ) -> None:
        statement = (
            insert(PriceStatistic)
            .values(
                id=uuid.uuid4(),
                monitor_id=monitor_id,
                listing_id=listing_id,
                market_median=result.market_median,
                discount_pct=result.discount_pct,
                deal_score=result.deal_score,
                sample_size=result.sample_size,
                confidence=result.confidence,
                risk_flags=result.risk_flags,
            )
            .on_conflict_do_update(
                constraint="uq_price_statistics_monitor_listing",
                set_={
                    "market_median": result.market_median,
                    "discount_pct": result.discount_pct,
                    "deal_score": result.deal_score,
                    "sample_size": result.sample_size,
                    "confidence": result.confidence,
                    "risk_flags": result.risk_flags,
                    "calculated_at": datetime.now(UTC),
                },
            )
        )
        await self.session.execute(statement)
