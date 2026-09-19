from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.dependencies import CurrentUser, DbSession
from app.domain.schemas import AnalyticsOverview, NotificationRead
from app.services.analytics import AnalyticsService
from app.services.notifications import NotificationService

router = APIRouter(tags=["operations"])


@router.get("/analytics/overview", response_model=AnalyticsOverview)
async def analytics_overview(
    session: DbSession,
    user: CurrentUser,
    start_at: Annotated[datetime | None, Query()] = None,
    end_at: Annotated[datetime | None, Query()] = None,
) -> AnalyticsOverview:
    values = await AnalyticsService(session).overview(
        user.organization_id,
        start_at=start_at,
        end_at=end_at,
    )
    return AnalyticsOverview.model_validate(values)


@router.get("/notifications", response_model=list[NotificationRead])
async def notifications(
    session: DbSession,
    user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[NotificationRead]:
    rows = await NotificationService(session).list_for_organization(
        user.organization_id,
        limit=limit,
    )
    return [NotificationRead.model_validate(row) for row in rows]
