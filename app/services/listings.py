from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import Listing, ListingSnapshot
from app.domain.monitoring import NormalizedListing


@dataclass(frozen=True, slots=True)
class ListingUpsertResult:
    listing: Listing
    created: bool
    price_changed: bool


class ListingService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def upsert(self, item: NormalizedListing) -> ListingUpsertResult:
        listing_id = uuid.uuid4()
        insert_statement = (
            insert(Listing)
            .values(
                id=listing_id,
                source=item.source,
                external_id=item.external_id,
                title=item.title,
                description=item.description,
                price=item.price,
                currency=item.currency,
                url=item.url,
                location=item.location,
                seller_name=item.seller_name,
                published_at=item.published_at,
                raw_payload=item.raw_payload,
            )
            .on_conflict_do_nothing(
                index_elements=[Listing.source, Listing.external_id],
            )
            .returning(Listing.id)
        )
        created_id = await self.session.scalar(insert_statement)

        if created_id is not None:
            listing = await self.session.get(Listing, created_id)
            if listing is None:
                raise RuntimeError("inserted listing could not be loaded")
            self.session.add(ListingSnapshot(listing_id=listing.id, price=listing.price))
            await self.session.flush()
            return ListingUpsertResult(listing=listing, created=True, price_changed=False)

        existing = await self.session.scalar(
            select(Listing)
            .where(
                Listing.source == item.source,
                Listing.external_id == item.external_id,
            )
            .with_for_update()
        )
        if existing is None:
            raise RuntimeError("listing conflict occurred but existing row was not found")

        price_changed = existing.price != item.price
        existing.title = item.title
        existing.description = item.description
        existing.price = item.price
        existing.currency = item.currency
        existing.url = item.url
        existing.location = item.location
        existing.seller_name = item.seller_name
        existing.published_at = item.published_at
        existing.raw_payload = item.raw_payload
        existing.last_seen_at = datetime.now(UTC)

        if price_changed:
            self.session.add(ListingSnapshot(listing_id=existing.id, price=item.price))

        await self.session.flush()
        return ListingUpsertResult(
            listing=existing,
            created=False,
            price_changed=price_changed,
        )
