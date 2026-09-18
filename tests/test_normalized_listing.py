from datetime import datetime
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.domain.monitoring import NormalizedListing


def make_listing(**overrides: object) -> dict[str, object]:
    data: dict[str, object] = {
        "source": "fake",
        "external_id": "123",
        "title": "Test listing",
        "price": Decimal("100"),
        "url": "https://example.com/item/123",
    }
    data.update(overrides)
    return data


def test_listing_rejects_naive_published_at() -> None:
    with pytest.raises(ValidationError):
        NormalizedListing.model_validate(
            make_listing(published_at=datetime(2026, 1, 1, 12, 0, 0))
        )


def test_listing_rejects_private_url() -> None:
    with pytest.raises(ValidationError):
        NormalizedListing.model_validate(make_listing(url="http://127.0.0.1/item/123"))
