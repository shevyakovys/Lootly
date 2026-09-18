from decimal import Decimal

from app.domain.deal_scoring import DealScoreResult
from app.domain.models import SearchMonitor
from app.services.notifications import should_notify


def assessment(score: str | None) -> DealScoreResult:
    return DealScoreResult(
        deal_score=Decimal(score) if score is not None else None,
        sample_size=5,
        confidence=Decimal("0.25"),
    )


def test_monitor_without_threshold_notifies() -> None:
    monitor = SearchMonitor(min_deal_score=None)

    assert should_notify(monitor, assessment(None)) is True


def test_threshold_requires_known_score() -> None:
    monitor = SearchMonitor(min_deal_score=Decimal("5"))

    assert should_notify(monitor, assessment(None)) is False


def test_threshold_filters_low_score() -> None:
    monitor = SearchMonitor(min_deal_score=Decimal("7"))

    assert should_notify(monitor, assessment("6.99")) is False
    assert should_notify(monitor, assessment("7.00")) is True
