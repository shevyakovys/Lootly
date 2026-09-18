import uuid

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.api.dependencies import DbSession
from app.domain.schemas import SearchMonitorCreate, SearchMonitorRead, SearchMonitorUpdate
from app.services.search_monitors import SearchMonitorNotFound, SearchMonitorService

router = APIRouter(prefix="/search-monitors", tags=["search-monitors"])


@router.post("", response_model=SearchMonitorRead, status_code=status.HTTP_201_CREATED)
async def create_monitor(payload: SearchMonitorCreate, session: DbSession) -> SearchMonitorRead:
    monitor = await SearchMonitorService(session).create(payload)
    return SearchMonitorRead.model_validate(monitor)


@router.get("", response_model=list[SearchMonitorRead])
async def list_monitors(
    session: DbSession, user_id: uuid.UUID | None = Query(default=None)
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
