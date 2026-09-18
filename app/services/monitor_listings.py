from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import MonitorListing


@dataclass(frozen=True, slots=True)
class MonitorListingLinkResult:
    match: MonitorListing
    created: bool


class MonitorListingService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def link(
        self,
        monitor_id: uuid.UUID,
        listing_id: uuid.UUID,
    ) -> MonitorListingLinkResult:
        match_id = uuid.uuid4()
        statement = (
            insert(MonitorListing)
            .values(
                id=match_id,
                monitor_id=monitor_id,
                listing_id=listing_id,
            )
            .on_conflict_do_nothing(
                index_elements=[
                    MonitorListing.monitor_id,
                    MonitorListing.listing_id,
                ],
            )
            .returning(MonitorListing.id)
        )
        created_id = await self.session.scalar(statement)

        if created_id is not None:
            match = await self.session.get(MonitorListing, created_id)
            if match is None:
                raise RuntimeError("inserted monitor-listing match could not be loaded")
            await self.session.flush()
            return MonitorListingLinkResult(match=match, created=True)

        existing = await self.session.scalar(
            select(MonitorListing)
            .where(
                MonitorListing.monitor_id == monitor_id,
                MonitorListing.listing_id == listing_id,
            )
            .with_for_update()
        )
        if existing is None:
            raise RuntimeError("monitor-listing conflict occurred but row was not found")

        existing.last_matched_at = datetime.now(UTC)
        await self.session.flush()
        return MonitorListingLinkResult(match=existing, created=False)
