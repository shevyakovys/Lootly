from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LOOTLY_", env_file=".env", extra="ignore")

    app_name: str = "Lootly API"
    environment: str = "development"
    database_url: str = "postgresql+asyncpg://lootly:lootly@postgres:5432/lootly"
    redis_url: str = "redis://redis:6379/0"
    scheduler_poll_seconds: float = 0.25
    scheduler_batch_size: int = 100
    monitor_lock_seconds: int = 180
    telegram_bot_token: str | None = None
    telegram_timeout_seconds: float = 10.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
