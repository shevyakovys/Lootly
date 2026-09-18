from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LOOTLY_", env_file=".env", extra="ignore")

    app_name: str = "Lootly Booking API"
    environment: str = "development"
    database_url: str = "postgresql+asyncpg://lootly:lootly@postgres:5432/lootly"
    default_slot_step_minutes: int = 15


@lru_cache
def get_settings() -> Settings:
    return Settings()
