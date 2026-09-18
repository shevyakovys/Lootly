from datetime import time

import pytest
from pydantic import ValidationError

from app.domain.schemas import LocationCreate, ServiceCreate, WorkingHoursCreate


def test_location_rejects_unknown_timezone() -> None:
    with pytest.raises(ValidationError):
        LocationCreate(
            organization_id="00000000-0000-0000-0000-000000000001",
            name="Main",
            timezone="Mars/Olympus",
        )


def test_service_requires_positive_duration() -> None:
    with pytest.raises(ValidationError):
        ServiceCreate(
            organization_id="00000000-0000-0000-0000-000000000001",
            name="Haircut",
            duration_minutes=0,
            price="1000",
        )


def test_working_hours_require_increasing_interval() -> None:
    with pytest.raises(ValidationError):
        WorkingHoursCreate(
            staff_id="00000000-0000-0000-0000-000000000001",
            weekday=0,
            start_time=time(18, 0),
            end_time=time(9, 0),
        )
