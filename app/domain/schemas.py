from __future__ import annotations

import uuid
from datetime import date, datetime, time
from decimal import Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(pattern=r"^[a-z0-9-]+$", min_length=2, max_length=100)


class OrganizationRead(OrganizationCreate):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    created_at: datetime


class LocationCreate(BaseModel):
    organization_id: uuid.UUID
    name: str = Field(min_length=1, max_length=200)
    timezone: str = "Europe/Moscow"
    address: str | None = None

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("unknown IANA timezone") from exc
        return value


class LocationRead(LocationCreate):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    active: bool


class StaffCreate(BaseModel):
    organization_id: uuid.UUID
    location_id: uuid.UUID
    name: str = Field(min_length=1, max_length=200)


class StaffRead(StaffCreate):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    active: bool


class ServiceCreate(BaseModel):
    organization_id: uuid.UUID
    name: str = Field(min_length=1, max_length=200)
    duration_minutes: int = Field(gt=0, le=1440)
    price: Decimal = Field(ge=0)


class ServiceRead(ServiceCreate):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    active: bool


class CustomerCreate(BaseModel):
    organization_id: uuid.UUID
    name: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=3, max_length=50)
    email: str | None = Field(default=None, max_length=320)
    note: str | None = None


class CustomerRead(CustomerCreate):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    created_at: datetime


class WorkingHoursCreate(BaseModel):
    staff_id: uuid.UUID
    weekday: int = Field(ge=0, le=6)
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def valid_interval(self) -> WorkingHoursCreate:
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class TimeOffCreate(BaseModel):
    staff_id: uuid.UUID
    start_at: datetime
    end_at: datetime
    reason: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def valid_interval(self) -> TimeOffCreate:
        if self.start_at.tzinfo is None or self.end_at.tzinfo is None:
            raise ValueError("time off timestamps must be timezone-aware")
        if self.end_at <= self.start_at:
            raise ValueError("end_at must be after start_at")
        return self


class AvailabilityQuery(BaseModel):
    location_id: uuid.UUID
    service_id: uuid.UUID
    staff_id: uuid.UUID
    day: date


class AvailabilitySlot(BaseModel):
    start_at: datetime
    end_at: datetime


class AppointmentCreate(BaseModel):
    organization_id: uuid.UUID
    location_id: uuid.UUID
    staff_id: uuid.UUID
    service_id: uuid.UUID
    customer_id: uuid.UUID
    start_at: datetime
    note: str | None = None
    booking_key: str | None = Field(default=None, max_length=100)

    @field_validator("start_at")
    @classmethod
    def timezone_required(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("start_at must be timezone-aware")
        return value


class AppointmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    location_id: uuid.UUID
    staff_id: uuid.UUID
    service_id: uuid.UUID
    customer_id: uuid.UUID
    start_at: datetime
    end_at: datetime
    duration_minutes: int
    price: Decimal
    status: str
    note: str | None
    booking_key: str | None
    created_at: datetime


class WorkingHoursRead(WorkingHoursCreate):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID


class TimeOffRead(TimeOffCreate):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID


class StaffServiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    staff_id: uuid.UUID
    service_id: uuid.UUID


class AppointmentReschedule(BaseModel):
    start_at: datetime

    @field_validator("start_at")
    @classmethod
    def timezone_required(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("start_at must be timezone-aware")
        return value


class AppointmentStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def supported_status(cls, value: str) -> str:
        allowed = {"booked", "confirmed", "completed", "canceled", "no_show"}
        if value not in allowed:
            raise ValueError("unsupported appointment status")
        return value


class PublicOrganizationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str


class PublicLocationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    timezone: str
    address: str | None


class PublicServiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    duration_minutes: int
    price: Decimal


class PublicStaffRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class PublicAvailabilitySlot(AvailabilitySlot):
    staff_id: uuid.UUID


class PublicBookingCreate(BaseModel):
    location_id: uuid.UUID
    service_id: uuid.UUID
    staff_id: uuid.UUID
    start_at: datetime
    customer_name: str = Field(min_length=1, max_length=200)
    customer_phone: str = Field(min_length=3, max_length=50)
    customer_email: str | None = Field(default=None, max_length=320)
    note: str | None = None
    booking_key: str | None = Field(default=None, max_length=100)

    @field_validator("start_at")
    @classmethod
    def timezone_required(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("start_at must be timezone-aware")
        return value
