import uuid

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_password_hash_round_trip() -> None:
    encoded = hash_password("very-secure-password")

    assert encoded != "very-secure-password"
    assert verify_password("very-secure-password", encoded) is True
    assert verify_password("wrong-password", encoded) is False


def test_access_token_contains_tenant_and_role() -> None:
    user_id = uuid.uuid4()
    organization_id = uuid.uuid4()

    token = create_access_token(
        user_id=user_id,
        organization_id=organization_id,
        role="owner",
        staff_id=None,
    )
    claims = decode_access_token(token)

    assert claims["sub"] == str(user_id)
    assert claims["org"] == str(organization_id)
    assert claims["role"] == "owner"
