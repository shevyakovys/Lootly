import uuid
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.api.dependencies import DbSession
from app.domain.schemas import (
    SearchMonitorCreate,
    SearchMonitorRead,
    SearchMonitorUpdate,
    SearchResultRead,
    MonitoringRunRead,
)
from app.services.monitor_runs import MonitoringRunService
from app.services.search_monitors import SearchMonitorNotFound, SearchMonitorService
from app.services.search_results import SearchResultsService

router = APIRouter(prefix="/search-monitors", tags=["search-monitors"])


@router.post("", response_model=SearchMonitorRead, status_code=status.HTTP_201_CREATED)
async def create_monitor(payload: SearchMonitorCreate, session: DbSession) -> SearchMonitorRead:
    monitor = await SearchMonitorService(session).create(payload)
    return SearchMonitorRead.model_validate(monitor)


@router.get("", response_model=list[SearchMonitorRead])
async def list_monitors(
    session: DbSession, user_id: Annotated[uuid.UUID | None, Query()] = None
) -> list[SearchMonitorRead]:
    monitors = await SearchMonitorService(session).list(user_id=user_id)
    return [SearchMonitorRead.model_validate(monitor) for monitor in monitors]


@router.get("/{monitor_id}", response_model=SearchMonitorRead)
async def get_monitor(monitor_id: uuid.UUID, session: DbSession) -> SearchMonitorRead:
    try:
        monitor = await SearchMonitorService(session).get(monitor_id)
    except SearchMonitorNotFound as exc:
        raise HTTPException(status_code=404, detail="Search monitor not found") from exc
    return SearchMonitorRead.model_validate(monitor)


@router.patch("/{monitor_id}", response_model=SearchMonitorRead)
async def update_monitor(
    monitor_id: uuid.UUID, payload: SearchMonitorUpdate, session: DbSession
) -> SearchMonitorRead:
    try:
        monitor = await SearchMonitorService(session).update(monitor_id, payload)
    except SearchMonitorNotFound as exc:
        raise HTTPException(status_code=404, detail="Search monitor not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return SearchMonitorRead.model_validate(monitor)


@router.delete("/{monitor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_monitor(monitor_id: uuid.UUID, session: DbSession) -> Response:
    try:
        await SearchMonitorService(session).delete(monitor_id)
    except SearchMonitorNotFound as exc:
        raise HTTPException(status_code=404, detail="Search monitor not found") from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{monitor_id}/listings", response_model=list[SearchResultRead])
async def list_monitor_results(
    monitor_id: uuid.UUID,
    session: DbSession,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    min_deal_score: Annotated[Decimal | None, Query(ge=0, le=10)] = None,
) -> list[SearchResultRead]:
    try:
        rows = await SearchResultsService(session).list_for_monitor(
            monitor_id,
            limit=limit,
            offset=offset,
            min_deal_score=min_deal_score,
        )
    except SearchMonitorNotFound as exc:
        raise HTTPException(status_code=404, detail="Search monitor not found") from exc

    return [
        SearchResultRead(
            listing_id=row.listing.id,
            external_id=row.listing.external_id,
            title=row.listing.title,
            description=row.listing.description,
            price=row.listing.price,
            currency=row.listing.currency,
            url=row.listing.url,
            location=row.listing.location,
            seller_name=row.listing.seller_name,
            published_at=row.listing.published_at,
            first_seen_at=row.listing.first_seen_at,
            matched_at=row.matched_at,
            market_median=row.statistics.market_median if row.statistics else None,
            discount_pct=row.statistics.discount_pct if row.statistics else None,
            deal_score=row.statistics.deal_score if row.statistics else None,
            sample_size=row.statistics.sample_size if row.statistics else None,
            confidence=row.statistics.confidence if row.statistics else None,
            risk_flags=row.statistics.risk_flags if row.statistics else [],
        )
        for row in rows
    ]


@router.get("/{monitor_id}/runs", response_model=list[MonitoringRunRead])
async def list_monitor_runs(
    monitor_id: uuid.UUID,
    session: DbSession,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[MonitoringRunRead]:
    try:
        runs = await MonitoringRunService(session).list_for_monitor(
            monitor_id,
            limit=limit,
        )
    except SearchMonitorNotFound as exc:
        raise HTTPException(status_code=404, detail="Search monitor not found") from exc
    return [MonitoringRunRead.model_validate(run) for run in runs]
