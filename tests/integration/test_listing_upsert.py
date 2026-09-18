import os
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.domain.models import Listing, ListingSnapshot
from app.domain.monitoring import NormalizedListing
from app.services.listings import ListingService


@pytest_asyncio.fixture
async def session() -> AsyncSession:
    database_url = os.environ["LOOTLY_DATABASE_URL"]
    engine = create_async_engine(database_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.execute(
            text("TRUNCATE listing_snapshots, listings RESTART IDENTITY CASCADE")
        )

    async with factory() as db_session:
        yield db_session
        await db_session.rollback()

    await engine.dispose()


def make_listing(price: str = "100.00") -> NormalizedListing:
    return NormalizedListing(
        source="fake",
        external_id="listing-1",
        title="Test item",
        price=Decimal(price),
        url="https://example.com/items/listing-1",
    )


@pytest.mark.asyncio
async def test_upsert_is_idempotent(session: AsyncSession) -> None:
    service = ListingService(session)

    first = await service.upsert(make_listing())
    second = await service.upsert(make_listing())
    await session.commit()

    count = await session.scalar(select(func.count()).select_from(Listing))
    snapshots = await session.scalar(select(func.count()).select_from(ListingSnapshot))

    assert first.created is True
    assert second.created is False
    assert first.listing.id == second.listing.id
    assert count == 1
    assert snapshots == 1


@pytest.mark.asyncio
async def test_price_change_adds_snapshot(session: AsyncSession) -> None:
    service = ListingService(session)

    await service.upsert(make_listing("100.00"))
    changed = await service.upsert(make_listing("90.00"))
    await session.commit()

    snapshots = await session.scalar(select(func.count()).select_from(ListingSnapshot))

    assert changed.created is False
    assert changed.price_changed is True
    assert changed.listing.price == Decimal("90.00")
    assert snapshots == 2
