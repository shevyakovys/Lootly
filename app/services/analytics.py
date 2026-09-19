from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import (
    Appointment,
    Location,
    NotificationOutbox,
    PublicBookingEvent,
    StaffMember,
    WorkingHours,
)


class AnalyticsService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def overview(
        self,
        organization_id: uuid.UUID,
        *,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
    ) -> dict[str, int | float]:
        start = start_at or datetime.now(UTC) - timedelta(days=30)
        end = end_at or datetime.now(UTC) + timedelta(days=1)
        base = [
            Appointment.organization_id == organization_id,
            Appointment.created_at >= start,
            Appointment.created_at < end,
        ]

        total = await self._count(base)
        public = await self._count([*base, Appointment.booking_source == "public"])
        completed = await self._count([*base, Appointment.status == "completed"])
        canceled = await self._count([*base, Appointment.status == "canceled"])
        no_show = await self._count([*base, Appointment.status == "no_show"])

        page_views = int(
            await self.session.scalar(
                select(func.count(PublicBookingEvent.id)).where(
                    PublicBookingEvent.organization_id == organization_id,
                    PublicBookingEvent.event_type == "page_view",
                    PublicBookingEvent.created_at >= start,
                    PublicBookingEvent.created_at < end,
                )
            )
            or 0
        )

        lead = await self.session.scalar(
            select(
                func.coalesce(
                    func.avg(
                        func.extract(
                            "epoch",
                            Appointment.start_at - Appointment.created_at,
                        )
                        / 3600.0
                    ),
                    0.0,
                )
            ).where(*base)
        )

        customer_counts = (
            select(
                Appointment.customer_id,
                func.count(Appointment.id).label("visit_count"),
            )
            .where(
                Appointment.organization_id == organization_id,
                Appointment.created_at >= start,
                Appointment.created_at < end,
            )
            .group_by(Appointment.customer_id)
            .subquery()
        )
        customers = int(
            await self.session.scalar(select(func.count()).select_from(customer_counts))
            or 0
        )
        repeats = int(
            await self.session.scalar(
                select(func.count())
                .select_from(customer_counts)
                .where(customer_counts.c.visit_count > 1)
            )
            or 0
        )

        sent = int(
            await self.session.scalar(
                select(func.count(NotificationOutbox.id)).where(
                    NotificationOutbox.organization_id == organization_id,
                    NotificationOutbox.status == "sent",
                    NotificationOutbox.created_at >= start,
                    NotificationOutbox.created_at < end,
                )
            )
            or 0
        )
        delivered_total = int(
            await self.session.scalar(
                select(func.count(NotificationOutbox.id)).where(
                    NotificationOutbox.organization_id == organization_id,
                    NotificationOutbox.status.in_(["sent", "failed"]),
                    NotificationOutbox.created_at >= start,
                    NotificationOutbox.created_at < end,
                )
            )
            or 0
        )

        utilization = await self._staff_utilization(organization_id, start, end)

        return {
            "bookings_created": total,
            "public_bookings": public,
            "completed": completed,
            "canceled": canceled,
            "no_show": no_show,
            "online_booking_conversion": min(public / page_views, 1.0) if page_views else 0.0,
            "staff_utilization": utilization,
            "cancellation_rate": canceled / total if total else 0.0,
            "no_show_rate": no_show / total if total else 0.0,
            "average_lead_time_hours": float(lead or 0.0),
            "repeat_customer_rate": repeats / customers if customers else 0.0,
            "notification_delivery_rate": sent / delivered_total if delivered_total else 0.0,
        }

    async def _staff_utilization(
        self,
        organization_id: uuid.UUID,
        start: datetime,
        end: datetime,
    ) -> float:
        staff_rows = (
            await self.session.execute(
                select(StaffMember, Location)
                .join(Location, Location.id == StaffMember.location_id)
                .where(
                    StaffMember.organization_id == organization_id,
                    StaffMember.active.is_(True),
                    Location.active.is_(True),
                )
            )
        ).all()
        if not staff_rows:
            return 0.0

        staff_ids = [row[0].id for row in staff_rows]
        hours = list(
            (
                await self.session.scalars(
                    select(WorkingHours).where(WorkingHours.staff_id.in_(staff_ids))
                )
            ).all()
        )
        hours_by_staff: dict[uuid.UUID, list[WorkingHours]] = {}
        for item in hours:
            hours_by_staff.setdefault(item.staff_id, []).append(item)

        scheduled_seconds = 0.0
        for staff, location in staff_rows:
            tz = ZoneInfo(location.timezone)
            local_day = start.astimezone(tz).date()
            last_day = (end - timedelta(microseconds=1)).astimezone(tz).date()
            while local_day <= last_day:
                for interval in hours_by_staff.get(staff.id, []):
                    if interval.weekday != local_day.weekday():
                        continue
                    local_start = datetime.combine(
                        local_day,
                        interval.start_time,
                        tzinfo=tz,
                    ).astimezone(UTC)
                    local_end = datetime.combine(
                        local_day,
                        interval.end_time,
                        tzinfo=tz,
                    ).astimezone(UTC)
                    clipped_start = max(local_start, start)
                    clipped_end = min(local_end, end)
                    if clipped_end > clipped_start:
                        scheduled_seconds += (clipped_end - clipped_start).total_seconds()
                local_day += timedelta(days=1)

        if scheduled_seconds <= 0:
            return 0.0

        occupied = await self.session.scalar(
            select(
                func.coalesce(
                    func.sum(
                        func.extract(
                            "epoch",
                            func.least(Appointment.end_at, end)
                            - func.greatest(Appointment.start_at, start),
                        )
                    ),
                    0.0,
                )
            ).where(
                Appointment.organization_id == organization_id,
                Appointment.status.in_(["booked", "confirmed", "completed", "no_show"]),
                Appointment.start_at < end,
                Appointment.end_at > start,
            )
        )
        occupied_seconds = float(occupied or 0.0)
        return min(occupied_seconds / scheduled_seconds, 1.0)

    async def _count(self, filters: Sequence[ColumnElement[bool]]) -> int:
        value = await self.session.scalar(
            select(func.count(Appointment.id)).where(*filters)
        )
        return int(value or 0)
