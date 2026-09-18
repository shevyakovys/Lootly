from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import Listing, MonitorListing, PriceStatistic, SearchMonitor
from app.services.search_monitors import SearchMonitorNotFound


@dataclass(frozen=True, slots=True)
class SearchResultRow:
    listing: Listing
    matched_at: datetime
    statistics: PriceStatistic | None


class SearchResultsService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_for_monitor(
        self,
        monitor_id: uuid.UUID,
        *,
        limit: int = 50,
        offset: int = 0,
        min_deal_score: Decimal | None = None,
    ) -> list[SearchResultRow]:
        if await self.session.get(SearchMonitor, monitor_id) is None:
            raise SearchMonitorNotFound(str(monitor_id))

        statement = (
            select(Listing, MonitorListing.first_matched_at, PriceStatistic)
            .join(MonitorListing, MonitorListing.listing_id == Listing.id)
            .outerjoin(
                PriceStatistic,
                and_(
                    PriceStatistic.monitor_id == monitor_id,
                    PriceStatistic.listing_id == Listing.id,
                ),
            )
            .where(MonitorListing.monitor_id == monitor_id)
            .order_by(MonitorListing.first_matched_at.desc())
            .limit(limit)
            .offset(offset)
        )
        if min_deal_score is not None:
            statement = statement.where(PriceStatistic.deal_score >= min_deal_score)

        rows = (await self.session.execute(statement)).all()
        return [
            SearchResultRow(
                listing=row[0],
                matched_at=row[1],
                statistics=row[2],
            )
            for row in rows
        ]
