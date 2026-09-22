from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LOOTLY_", env_file=".env", extra="ignore")

    app_name: str = "Lootly Booking API"
    environment: str = "development"
    database_url: str = "postgresql+asyncpg://lootly:lootly@postgres:5432/lootly"
    default_slot_step_minutes: int = 15
    auth_secret_key: str = "development-only-change-me"
    auth_access_token_minutes: int = 480
    notification_webhook_url: str | None = None
    notification_timeout_seconds: float = 5.0
    notification_batch_size: int = 100
    reminder_hours_before: int = 24
    frontend_origin: str = "http://localhost:3000"
    public_rate_limit_per_minute: int = 120

    @field_validator("database_url")
    @classmethod
    def normalize_async_postgres_url(cls, value: str) -> str:
        if value.startswith("postgres://"):
            return "postgresql+asyncpg://" + value[len("postgres://") :]
        if value.startswith("postgresql://"):
            return "postgresql+asyncpg://" + value[len("postgresql://") :]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
