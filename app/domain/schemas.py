from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.url_security import UnsafeExternalUrl, ensure_public_http_url


class SearchMonitorBase(BaseModel):
    source: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=160)
    query_url: str = Field(min_length=1, max_length=4096)
    min_price: Decimal | None = Field(default=None, ge=0)
    max_price: Decimal | None = Field(default=None, ge=0)
    include_keywords: list[str] = Field(default_factory=list)
    exclude_keywords: list[str] = Field(default_factory=list)
    region: str | None = Field(default=None, max_length=160)
    poll_interval_ms: int = Field(default=60_000, ge=500, le=86_400_000)
    min_deal_score: Decimal | None = Field(default=None, ge=0, le=10)
    enabled: bool = True

    @field_validator("source")
    @classmethod
    def normalize_source(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("query_url")
    @classmethod
    def validate_query_url(cls, value: str) -> str:
        try:
            return ensure_public_http_url(value)
        except UnsafeExternalUrl as exc:
            raise ValueError(str(exc)) from exc

    @field_validator("include_keywords", "exclude_keywords")
    @classmethod
    def normalize_keywords(cls, value: list[str]) -> list[str]:
        cleaned = [keyword.strip() for keyword in value if keyword.strip()]
        return list(dict.fromkeys(cleaned))

    @model_validator(mode="after")
    def validate_price_range(self) -> SearchMonitorBase:
        if (
            self.min_price is not None
            and self.max_price is not None
            and self.min_price > self.max_price
        ):
            raise ValueError("min_price must not exceed max_price")
        return self


class SearchMonitorCreate(SearchMonitorBase):
    user_id: uuid.UUID


class SearchMonitorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    query_url: str | None = Field(default=None, min_length=1, max_length=4096)
    min_price: Decimal | None = Field(default=None, ge=0)
    max_price: Decimal | None = Field(default=None, ge=0)
    include_keywords: list[str] | None = None
    exclude_keywords: list[str] | None = None
    region: str | None = Field(default=None, max_length=160)
    poll_interval_ms: int | None = Field(default=None, ge=500, le=86_400_000)
    min_deal_score: Decimal | None = Field(default=None, ge=0, le=10)
    enabled: bool | None = None

    @field_validator("query_url")
    @classmethod
    def validate_query_url(cls, value: str | None) -> str | None:
        if value is None:
            return value
        try:
            return ensure_public_http_url(value)
        except UnsafeExternalUrl as exc:
            raise ValueError(str(exc)) from exc

    @field_validator("include_keywords", "exclude_keywords")
    @classmethod
    def normalize_keywords(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        cleaned = [keyword.strip() for keyword in value if keyword.strip()]
        return list(dict.fromkeys(cleaned))


class SearchMonitorRead(SearchMonitorBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class UserCreate(BaseModel):
    email: str | None = Field(default=None, min_length=3, max_length=320)
    telegram_id: str | None = Field(default=None, min_length=1, max_length=64)

    @model_validator(mode="after")
    def require_identity(self) -> UserCreate:
        if self.email is None and self.telegram_id is None:
            raise ValueError("email or telegram_id is required")
        return self


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str | None
    telegram_id: str | None
    created_at: datetime


class SearchResultRead(BaseModel):
    listing_id: uuid.UUID
    external_id: str
    title: str
    description: str | None
    price: Decimal
    currency: str
    url: str
    location: str | None
    seller_name: str | None
    published_at: datetime | None
    first_seen_at: datetime
    matched_at: datetime
    market_median: Decimal | None = None
    discount_pct: Decimal | None = None
    deal_score: Decimal | None = None
    sample_size: int | None = None
    confidence: Decimal | None = None
    risk_flags: list[str] = Field(default_factory=list)


class MonitoringRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    monitor_id: uuid.UUID
    status: str
    started_at: datetime
    finished_at: datetime
    duration_ms: int
    fetched: int
    accepted: int
    created: int
    updated: int
    new_matches: int
    error_type: str | None
