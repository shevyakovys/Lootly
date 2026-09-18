import pytest
from pydantic import ValidationError

from app.domain.schemas import UserCreate


def test_user_requires_identity() -> None:
    with pytest.raises(ValidationError):
        UserCreate()


def test_user_accepts_email_identity() -> None:
    user = UserCreate(email="owner@example.com")

    assert user.email == "owner@example.com"
