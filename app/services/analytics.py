from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import Appointment, NotificationOutbox


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
            await self.session.scalar(
                select(func.count()).select_from(customer_counts)
            )
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

        return {
            "bookings_created": total,
            "public_bookings": public,
            "completed": completed,
            "canceled": canceled,
            "no_show": no_show,
            "cancellation_rate": canceled / total if total else 0.0,
            "no_show_rate": no_show / total if total else 0.0,
            "average_lead_time_hours": float(lead or 0.0),
            "repeat_customer_rate": repeats / customers if customers else 0.0,
            "notification_delivery_rate": sent / delivered_total if delivered_total else 0.0,
        }

    async def _count(self, filters: list[object]) -> int:
        value = await self.session.scalar(
            select(func.count(Appointment.id)).where(*filters)
        )
        return int(value or 0)
