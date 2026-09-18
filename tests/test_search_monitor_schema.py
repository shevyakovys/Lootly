import uuid
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.domain.schemas import SearchMonitorCreate


def make_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "user_id": uuid.uuid4(),
        "source": "example",
        "name": "Cheap laptops",
        "query_url": "https://example.com/search?q=laptop",
        "min_price": Decimal("100.00"),
        "max_price": Decimal("500.00"),
        "include_keywords": [" laptop ", "laptop", "16gb"],
        "exclude_keywords": ["broken"],
        "interval_seconds": 60,
    }
    payload.update(overrides)
    return payload


def test_keywords_are_normalized_and_deduplicated() -> None:
    monitor = SearchMonitorCreate.model_validate(make_payload())

    assert monitor.include_keywords == ["laptop", "16gb"]


def test_price_range_must_be_valid() -> None:
    with pytest.raises(ValidationError):
        SearchMonitorCreate.model_validate(
            make_payload(min_price=Decimal("600.00"), max_price=Decimal("500.00"))
        )


@pytest.mark.parametrize(
    "query_url",
    [
        "http://localhost/search",
        "http://127.0.0.1/search",
        "http://10.0.0.5/search",
        "file:///etc/passwd",
    ],
)
def test_unsafe_query_urls_are_rejected(query_url: str) -> None:
    with pytest.raises(ValidationError):
        SearchMonitorCreate.model_validate(make_payload(query_url=query_url))
