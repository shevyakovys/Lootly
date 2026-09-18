import uuid
from unittest.mock import Mock

import pytest

from app.scheduler import enqueue_monitor
from app.services.scheduler import ClaimedMonitor, PollingTier


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("tier", "actor_name"),
    [
        (PollingTier.REALTIME, "check_monitor_realtime"),
        (PollingTier.FAST, "check_monitor_fast"),
        (PollingTier.STANDARD, "check_monitor"),
    ],
)
async def test_enqueue_monitor_routes_to_expected_actor(
    monkeypatch: pytest.MonkeyPatch,
    tier: PollingTier,
    actor_name: str,
) -> None:
    import app.scheduler as scheduler

    actors = {
        "check_monitor_realtime": Mock(),
        "check_monitor_fast": Mock(),
        "check_monitor": Mock(),
    }
    for name, actor in actors.items():
        actor.send = Mock()
        monkeypatch.setattr(scheduler, name, actor)

    monitor_id = uuid.uuid4()
    await enqueue_monitor(ClaimedMonitor(monitor_id=monitor_id, tier=tier))

    actors[actor_name].send.assert_called_once_with(str(monitor_id))
