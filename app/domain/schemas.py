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
    booking_source: str = "admin"

    @field_validator("booking_source")
    @classmethod
    def supported_booking_source(cls, value: str) -> str:
        if value not in {"admin", "public"}:
            raise ValueError("unsupported booking source")
        return value

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
    booking_source: str
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


class BootstrapCreate(BaseModel):
    organization_name: str = Field(min_length=1, max_length=200)
    organization_slug: str = Field(pattern=r"^[a-z0-9-]+$", min_length=2, max_length=100)
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=10, max_length=200)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=200)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AdminUserCreate(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=10, max_length=200)
    role: str
    staff_id: uuid.UUID | None = None

    @field_validator("role")
    @classmethod
    def supported_role(cls, value: str) -> str:
        if value not in {"owner", "admin", "staff"}:
            raise ValueError("unsupported role")
        return value

    @model_validator(mode="after")
    def staff_role_requires_staff(self) -> AdminUserCreate:
        if self.role == "staff" and self.staff_id is None:
            raise ValueError("staff role requires staff_id")
        return self


class AdminUserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    staff_id: uuid.UUID | None
    email: str
    role: str
    active: bool
    created_at: datetime


class LocationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    timezone: str | None = None
    address: str | None = None
    active: bool | None = None

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value: str | None) -> str | None:
        if value is None:
            return value
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("unknown IANA timezone") from exc
        return value


class StaffUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    active: bool | None = None


class ServiceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    duration_minutes: int | None = Field(default=None, gt=0, le=1440)
    price: Decimal | None = Field(default=None, ge=0)
    active: bool | None = None


class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, min_length=3, max_length=50)
    email: str | None = Field(default=None, max_length=320)
    note: str | None = None


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    appointment_id: uuid.UUID
    event_type: str
    due_at: datetime
    status: str
    attempts: int
    sent_at: datetime | None
    created_at: datetime


class AnalyticsOverview(BaseModel):
    bookings_created: int
    public_bookings: int
    completed: int
    canceled: int
    no_show: int
    online_booking_conversion: float
    staff_utilization: float
    cancellation_rate: float
    no_show_rate: float
    average_lead_time_hours: float
    repeat_customer_rate: float
    notification_delivery_rate: float


class PublicBookingEventCreate(BaseModel):
    session_key: str = Field(min_length=8, max_length=100)
    event_type: str = "page_view"

    @field_validator("event_type")
    @classmethod
    def supported_event_type(cls, value: str) -> str:
        if value != "page_view":
            raise ValueError("unsupported public booking event")
        return value
