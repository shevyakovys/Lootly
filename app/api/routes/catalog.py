import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from app.api.dependencies import CurrentUser, DbSession
from app.domain.schemas import (
    CustomerRead,
    CustomerUpdate,
    LocationRead,
    LocationUpdate,
    ServiceRead,
    ServiceUpdate,
    StaffRead,
    StaffUpdate,
    TimeOffRead,
    WorkingHoursRead,
)
from app.services.authorization import TenantAccessDenied, TenantGuard, require_manager
from app.services.catalog import CatalogService
from app.services.schedules import ScheduleService

router = APIRouter(prefix="/catalog", tags=["catalog"])


def _forbidden(exc: TenantAccessDenied) -> HTTPException:
    return HTTPException(status_code=403, detail=str(exc))


@router.get("/locations", response_model=list[LocationRead])
async def locations(session: DbSession, user: CurrentUser) -> list[LocationRead]:
    items = await CatalogService(session).list_locations(user.organization_id)
    return [LocationRead.model_validate(item) for item in items]


@router.patch("/locations/{item_id}", response_model=LocationRead)
async def update_location(
    item_id: uuid.UUID,
    payload: LocationUpdate,
    session: DbSession,
    user: CurrentUser,
) -> LocationRead:
    try:
        require_manager(user)
        item = await TenantGuard(session, user).location(item_id)
    except TenantAccessDenied as exc:
        raise _forbidden(exc) from exc
    updated = await CatalogService(session).update_location(item, payload)
    return LocationRead.model_validate(updated)


@router.get("/staff", response_model=list[StaffRead])
async def staff(session: DbSession, user: CurrentUser) -> list[StaffRead]:
    items = await CatalogService(session).list_staff(user.organization_id)
    if user.role == "staff":
        items = [item for item in items if item.id == user.staff_id]
    return [StaffRead.model_validate(item) for item in items]


@router.patch("/staff/{item_id}", response_model=StaffRead)
async def update_staff(
    item_id: uuid.UUID,
    payload: StaffUpdate,
    session: DbSession,
    user: CurrentUser,
) -> StaffRead:
    try:
        require_manager(user)
        item = await TenantGuard(session, user).staff(item_id)
    except TenantAccessDenied as exc:
        raise _forbidden(exc) from exc
    updated = await CatalogService(session).update_staff(item, payload)
    return StaffRead.model_validate(updated)


@router.get("/services", response_model=list[ServiceRead])
async def services(session: DbSession, user: CurrentUser) -> list[ServiceRead]:
    items = await CatalogService(session).list_services(user.organization_id)
    return [ServiceRead.model_validate(item) for item in items]


@router.patch("/services/{item_id}", response_model=ServiceRead)
async def update_service(
    item_id: uuid.UUID,
    payload: ServiceUpdate,
    session: DbSession,
    user: CurrentUser,
) -> ServiceRead:
    try:
        require_manager(user)
        item = await TenantGuard(session, user).service(item_id)
    except TenantAccessDenied as exc:
        raise _forbidden(exc) from exc
    updated = await CatalogService(session).update_service(item, payload)
    return ServiceRead.model_validate(updated)


@router.get("/customers", response_model=list[CustomerRead])
async def customers(
    session: DbSession,
    user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=1000)] = 500,
) -> list[CustomerRead]:
    items = await CatalogService(session).list_customers(user.organization_id)
    return [CustomerRead.model_validate(item) for item in items[:limit]]


@router.patch("/customers/{item_id}", response_model=CustomerRead)
async def update_customer(
    item_id: uuid.UUID,
    payload: CustomerUpdate,
    session: DbSession,
    user: CurrentUser,
) -> CustomerRead:
    try:
        require_manager(user)
        item = await TenantGuard(session, user).customer(item_id)
    except TenantAccessDenied as exc:
        raise _forbidden(exc) from exc
    updated = await CatalogService(session).update_customer(item, payload)
    return CustomerRead.model_validate(updated)


@router.get("/staff/{staff_id}/working-hours", response_model=list[WorkingHoursRead])
async def list_working_hours(
    staff_id: uuid.UUID,
    session: DbSession,
    user: CurrentUser,
) -> list[WorkingHoursRead]:
    try:
        await TenantGuard(session, user).staff(staff_id)
    except TenantAccessDenied as exc:
        raise _forbidden(exc) from exc
    items = await ScheduleService(session).working_hours(staff_id)
    return [WorkingHoursRead.model_validate(item) for item in items]


@router.delete("/working-hours/{item_id}", status_code=204)
async def delete_working_hours(
    item_id: uuid.UUID,
    session: DbSession,
    user: CurrentUser,
) -> None:
    try:
        require_manager(user)
        service = ScheduleService(session)
        item = await service.get_working_hours(item_id)
        await TenantGuard(session, user).staff(item.staff_id)
        await service.delete_working_hours(item_id)
    except (LookupError, TenantAccessDenied) as exc:
        raise HTTPException(status_code=404, detail="working hours not found") from exc


@router.get("/staff/{staff_id}/time-off", response_model=list[TimeOffRead])
async def list_time_off(
    staff_id: uuid.UUID,
    session: DbSession,
    user: CurrentUser,
) -> list[TimeOffRead]:
    try:
        await TenantGuard(session, user).staff(staff_id)
    except TenantAccessDenied as exc:
        raise _forbidden(exc) from exc
    items = await ScheduleService(session).time_off(staff_id)
    return [TimeOffRead.model_validate(item) for item in items]


@router.delete("/time-off/{item_id}", status_code=204)
async def delete_time_off(
    item_id: uuid.UUID,
    session: DbSession,
    user: CurrentUser,
) -> None:
    try:
        require_manager(user)
        service = ScheduleService(session)
        item = await service.get_time_off(item_id)
        await TenantGuard(session, user).staff(item.staff_id)
        await service.delete_time_off(item_id)
    except (LookupError, TenantAccessDenied) as exc:
        raise HTTPException(status_code=404, detail="time off not found") from exc
