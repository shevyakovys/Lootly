import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.domain.monitoring import MonitoringRunResult
from app.services.monitor_runs import MonitoringRunService


class FakeSession:
    def __init__(self) -> None:
        self.added = None

    def add(self, value: object) -> None:
        self.added = value

    async def commit(self) -> None:
        return None

    async def refresh(self, value: object) -> None:
        return None


@pytest.mark.asyncio
async def test_record_success_calculates_duration_and_counts() -> None:
    session = FakeSession()
    service = MonitoringRunService(session)  # type: ignore[arg-type]
    started = datetime.now(UTC)
    finished = started + timedelta(milliseconds=1250)

    run = await service.record_success(
        uuid.uuid4(),
        started_at=started,
        finished_at=finished,
        result=MonitoringRunResult(fetched=10, accepted=4, created=3, updated=1, new_matches=2),
    )

    assert run.status == "success"
    assert run.duration_ms == 1250
    assert run.fetched == 10
    assert run.new_matches == 2


@pytest.mark.asyncio
async def test_record_failure_keeps_only_error_type() -> None:
    session = FakeSession()
    service = MonitoringRunService(session)  # type: ignore[arg-type]
    started = datetime.now(UTC)

    run = await service.record_failure(
        uuid.uuid4(),
        started_at=started,
        finished_at=started + timedelta(milliseconds=25),
        error=RuntimeError("secret detail should not be persisted"),
    )

    assert run.status == "failed"
    assert run.error_type == "RuntimeError"
