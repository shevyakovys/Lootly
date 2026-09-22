from app.core.config import Settings


def test_railway_postgresql_url_is_normalized_for_asyncpg() -> None:
    settings = Settings(
        database_url="postgresql://user:pass@postgres.railway.internal:5432/railway"
    )

    assert (
        settings.database_url
        == "postgresql+asyncpg://user:pass@postgres.railway.internal:5432/railway"
    )


def test_postgres_short_scheme_is_normalized_for_asyncpg() -> None:
    settings = Settings(database_url="postgres://user:pass@host:5432/db")

    assert settings.database_url == "postgresql+asyncpg://user:pass@host:5432/db"
