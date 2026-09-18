import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.api.dependencies import DbSession
from app.domain.schemas import (
    AppointmentCreate,
    AppointmentRead,
    AvailabilitySlot,
    CustomerCreate,
    CustomerRead,
    LocationCreate,
    LocationRead,
    OrganizationCreate,
    OrganizationRead,
    ServiceCreate,
    ServiceRead,
    StaffCreate,
    StaffRead,
)
from app.services.appointments import (
    AppointmentConflict,
    AppointmentService,
    AppointmentValidationError,
)
from app.services.availability import AvailabilityError, AvailabilityService
from app.services.catalog import CatalogService

router = APIRouter(tags=["booking"])


@router.post("/organizations", response_model=OrganizationRead, status_code=status.HTTP_201_CREATED)
async def create_organization(payload: OrganizationCreate, session: DbSession) -> OrganizationRead:
    item = await CatalogService(session).create_organization(payload)
    return OrganizationRead.model_validate(item)


@router.post("/locations", response_model=LocationRead, status_code=status.HTTP_201_CREATED)
async def create_location(payload: LocationCreate, session: DbSession) -> LocationRead:
    item = await CatalogService(session).create_location(payload)
    return LocationRead.model_validate(item)


@router.post("/staff", response_model=StaffRead, status_code=status.HTTP_201_CREATED)
async def create_staff(payload: StaffCreate, session: DbSession) -> StaffRead:
    item = await CatalogService(session).create_staff(payload)
    return StaffRead.model_validate(item)


@router.post("/services", response_model=ServiceRead, status_code=status.HTTP_201_CREATED)
async def create_service(payload: ServiceCreate, session: DbSession) -> ServiceRead:
    item = await CatalogService(session).create_service(payload)
    return ServiceRead.model_validate(item)


@router.post("/customers", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
async def create_customer(payload: CustomerCreate, session: DbSession) -> CustomerRead:
    item = await CatalogService(session).create_customer(payload)
    return CustomerRead.model_validate(item)


@router.get("/availability", response_model=list[AvailabilitySlot])
async def availability(
    location_id: uuid.UUID,
    service_id: uuid.UUID,
    staff_id: uuid.UUID,
    session: DbSession,
    day: Annotated[date, Query()],
) -> list[AvailabilitySlot]:
    try:
        return await AvailabilityService(session).slots(
            location_id=location_id,
            service_id=service_id,
            staff_id=staff_id,
            day=day,
        )
    except AvailabilityError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/appointments", response_model=AppointmentRead, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    payload: AppointmentCreate,
    session: DbSession,
) -> AppointmentRead:
    try:
        item = await AppointmentService(session).create(payload)
    except AppointmentConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except AppointmentValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return AppointmentRead.model_validate(item)


@router.post("/appointments/{appointment_id}/cancel", response_model=AppointmentRead)
async def cancel_appointment(appointment_id: uuid.UUID, session: DbSession) -> AppointmentRead:
    try:
        item = await AppointmentService(session).cancel(appointment_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="appointment not found") from exc
    return AppointmentRead.model_validate(item)
