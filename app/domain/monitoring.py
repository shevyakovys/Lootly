from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.core.url_security import UnsafeExternalUrl, ensure_public_http_url


class MonitorQuery(BaseModel):
    source: str
    query_url: str
    min_price: Decimal | None = None
    max_price: Decimal | None = None
    include_keywords: list[str] = Field(default_factory=list)
    exclude_keywords: list[str] = Field(default_factory=list)
    region: str | None = None


class NormalizedListing(BaseModel):
    source: str = Field(min_length=1, max_length=64)
    external_id: str = Field(min_length=1, max_length=255)
    title: str = Field(min_length=1, max_length=512)
    description: str | None = None
    price: Decimal = Field(ge=0)
    currency: str = Field(default="RUB", min_length=1, max_length=8)
    url: str = Field(min_length=1, max_length=4096)
    location: str | None = Field(default=None, max_length=255)
    seller_name: str | None = Field(default=None, max_length=255)
    published_at: datetime | None = None
    raw_payload: dict[str, Any] = Field(default_factory=dict)

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        try:
            return ensure_public_http_url(value)
        except UnsafeExternalUrl as exc:
            raise ValueError(str(exc)) from exc

    @field_validator("published_at")
    @classmethod
    def require_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("published_at must be timezone-aware")
        return value.astimezone(UTC) if value is not None else None


class MonitoringRunResult(BaseModel):
    fetched: int = 0
    accepted: int = 0
    created: int = 0
    updated: int = 0
