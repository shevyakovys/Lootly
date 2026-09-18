import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.registry import AdapterRegistry
from app.domain.monitoring import MonitoringRunResult
from app.services.monitoring import MonitoringService


async def run_monitoring_check(
    monitor_id: uuid.UUID,
    session: AsyncSession,
    registry: AdapterRegistry,
) -> MonitoringRunResult:
    return await MonitoringService(session, registry).run(monitor_id)
