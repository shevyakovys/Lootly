import os
import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.domain.models import Listing, MonitorListing, PriceStatistic, SearchMonitor, User
from app.services.pricing import PricingService


@pytest_asyncio.fixture
async def session() -> AsyncSession:
    database_url = os.environ["LOOTLY_DATABASE_URL"]
    engine = create_async_engine(database_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.execute(
            text(
                "TRUNCATE price_statistics, monitor_listings, listing_snapshots, "
                "listings, search_monitors, users RESTART IDENTITY CASCADE"
            )
        )

    async with factory() as db_session:
        yield db_session
        await db_session.rollback()

    await engine.dispose()


@pytest.mark.asyncio
async def test_pricing_service_persists_single_assessment(session: AsyncSession) -> None:
    user_id = uuid.uuid4()
    monitor_id = uuid.uuid4()
    target_id = uuid.uuid4()

    session.add(User(id=user_id, email="pricing@example.com"))
    session.add(
        SearchMonitor(
            id=monitor_id,
            user_id=user_id,
            source="fake",
            name="Pricing test",
            query_url="https://example.com/search",
        )
    )

    prices = ["100", "105", "110", "115", "120", "80"]
    listing_ids: list[uuid.UUID] = []
    for index, price in enumerate(prices):
        listing_id = target_id if index == len(prices) - 1 else uuid.uuid4()
        listing_ids.append(listing_id)
        session.add(
            Listing(
                id=listing_id,
                source="fake",
                external_id=f"listing-{index}",
                title="Comparable item",
                price=Decimal(price),
                currency="RUB",
                url=f"https://example.com/items/{index}",
            )
        )
        session.add(
            MonitorListing(
                id=uuid.uuid4(),
                monitor_id=monitor_id,
                listing_id=listing_id,
            )
        )

    await session.commit()

    service = PricingService(session)
    first = await service.assess(monitor_id, target_id)
    second = await service.assess(monitor_id, target_id)
    await session.commit()

    count = await session.scalar(select(func.count()).select_from(PriceStatistic))
    stored = await session.scalar(
        select(PriceStatistic).where(
            PriceStatistic.monitor_id == monitor_id,
            PriceStatistic.listing_id == target_id,
        )
    )

    assert first.market_median == Decimal("110")
    assert first.discount_pct == Decimal("27.27")
    assert first.deal_score is not None
    assert second == first
    assert count == 1
    assert stored is not None
    assert stored.sample_size == 5
