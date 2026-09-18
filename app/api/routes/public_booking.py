import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.api.dependencies import DbSession
from app.domain.schemas import (
    AppointmentRead,
    PublicAvailabilitySlot,
    PublicBookingCreate,
    PublicLocationRead,
    PublicOrganizationRead,
    PublicServiceRead,
    PublicStaffRead,
)
from app.services.appointments import AppointmentConflict, AppointmentValidationError
from app.services.availability import AvailabilityError
from app.services.public_booking import (
    PublicBookingNotFound,
    PublicBookingService,
    PublicBookingValidationError,
)

router = APIRouter(prefix="/public", tags=["public-booking"])


@router.get("/{slug}", response_model=PublicOrganizationRead)
async def public_organization(slug: str, session: DbSession) -> PublicOrganizationRead:
    try:
        item = await PublicBookingService(session).organization(slug)
    except PublicBookingNotFound as exc:
        raise HTTPException(status_code=404, detail="organization not found") from exc
    return PublicOrganizationRead.model_validate(item)


@router.get("/{slug}/locations", response_model=list[PublicLocationRead])
async def public_locations(slug: str, session: DbSession) -> list[PublicLocationRead]:
    service = PublicBookingService(session)
    try:
        organization = await service.organization(slug)
    except PublicBookingNotFound as exc:
        raise HTTPException(status_code=404, detail="organization not found") from exc
    items = await service.locations(organization.id)
    return [PublicLocationRead.model_validate(item) for item in items]


@router.get("/{slug}/services", response_model=list[PublicServiceRead])
async def public_services(slug: str, session: DbSession) -> list[PublicServiceRead]:
    service = PublicBookingService(session)
    try:
        organization = await service.organization(slug)
    except PublicBookingNotFound as exc:
        raise HTTPException(status_code=404, detail="organization not found") from exc
    items = await service.services(organization.id)
    return [PublicServiceRead.model_validate(item) for item in items]


@router.get("/{slug}/staff", response_model=list[PublicStaffRead])
async def public_staff(
    slug: str,
    location_id: uuid.UUID,
    service_id: uuid.UUID,
    session: DbSession,
) -> list[PublicStaffRead]:
    booking = PublicBookingService(session)
    try:
        organization = await booking.organization(slug)
    except PublicBookingNotFound as exc:
        raise HTTPException(status_code=404, detail="organization not found") from exc
    items = await booking.staff(
        organization_id=organization.id,
        location_id=location_id,
        service_id=service_id,
    )
    return [PublicStaffRead.model_validate(item) for item in items]


@router.get("/{slug}/availability", response_model=list[PublicAvailabilitySlot])
async def public_availability(
    slug: str,
    location_id: uuid.UUID,
    service_id: uuid.UUID,
    day: Annotated[date, Query()],
    session: DbSession,
    staff_id: uuid.UUID | None = None,
) -> list[PublicAvailabilitySlot]:
    booking = PublicBookingService(session)
    try:
        organization = await booking.organization(slug)
        return await booking.availability(
            organization_id=organization.id,
            location_id=location_id,
            service_id=service_id,
            day=day,
            staff_id=staff_id,
        )
    except PublicBookingNotFound as exc:
        raise HTTPException(status_code=404, detail="organization not found") from exc
    except (PublicBookingValidationError, AvailabilityError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post(
    "/{slug}/appointments",
    response_model=AppointmentRead,
    status_code=status.HTTP_201_CREATED,
)
async def public_book(
    slug: str,
    payload: PublicBookingCreate,
    session: DbSession,
) -> AppointmentRead:
    try:
        item = await PublicBookingService(session).book(slug, payload)
    except PublicBookingNotFound as exc:
        raise HTTPException(status_code=404, detail="organization not found") from exc
    except AppointmentConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except (PublicBookingValidationError, AppointmentValidationError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return AppointmentRead.model_validate(item)
