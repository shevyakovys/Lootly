from __future__ import annotations

import base64
import hashlib
import hmac
import os
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

from app.core.config import get_settings


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    derived = hashlib.scrypt(
        password.encode(),
        salt=salt,
        n=2**14,
        r=8,
        p=1,
        dklen=32,
    )
    return "scrypt$16384$8$1$" + "$".join(
        (
            base64.urlsafe_b64encode(salt).decode(),
            base64.urlsafe_b64encode(derived).decode(),
        )
    )


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, n_raw, r_raw, p_raw, salt_raw, hash_raw = encoded.split("$", 5)
        if algorithm != "scrypt":
            return False
        salt = base64.urlsafe_b64decode(salt_raw.encode())
        expected = base64.urlsafe_b64decode(hash_raw.encode())
        actual = hashlib.scrypt(
            password.encode(),
            salt=salt,
            n=int(n_raw),
            r=int(r_raw),
            p=int(p_raw),
            dklen=len(expected),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


def create_access_token(
    *,
    user_id: uuid.UUID,
    organization_id: uuid.UUID,
    role: str,
    staff_id: uuid.UUID | None,
) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "org": str(organization_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.auth_access_token_minutes),
        "iss": "lootly",
    }
    if staff_id is not None:
        payload["staff"] = str(staff_id)
    return jwt.encode(payload, settings.auth_secret_key, algorithm="HS256")


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(
        token,
        settings.auth_secret_key,
        algorithms=["HS256"],
        issuer="lootly",
        options={"require": ["exp", "sub", "org", "role"]},
    )
