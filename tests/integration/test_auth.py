import os

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.domain.schemas import BootstrapCreate
from app.services.auth import AuthenticationError, AuthService


@pytest_asyncio.fixture
async def session() -> AsyncSession:
    engine = create_async_engine(os.environ["LOOTLY_DATABASE_URL"])
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.execute(
            text(
                "TRUNCATE admin_users, appointments, time_off, working_hours, staff_services, "
                "customers, services, staff_members, locations, organizations "
                "RESTART IDENTITY CASCADE"
            )
        )
    async with factory() as db_session:
        yield db_session
        await db_session.rollback()
    await engine.dispose()


@pytest.mark.asyncio
async def test_bootstrap_and_login(session: AsyncSession) -> None:
    service = AuthService(session)
    _, user = await service.bootstrap(
        BootstrapCreate(
            organization_name="Studio",
            organization_slug="secure-studio",
            email="owner@example.com",
            password="very-secure-password",
        )
    )

    token = await service.login("owner@example.com", "very-secure-password")

    assert user.role == "owner"
    assert token

    with pytest.raises(AuthenticationError):
        await service.login("owner@example.com", "wrong-password")
