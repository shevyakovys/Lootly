from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.domain.models import AdminUser, Organization, StaffMember
from app.domain.schemas import AdminUserCreate, BootstrapCreate


class AuthenticationError(ValueError):
    pass


class AuthorizationError(PermissionError):
    pass


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def bootstrap(self, payload: BootstrapCreate) -> tuple[Organization, AdminUser]:
        existing = await self.session.scalar(
            select(AdminUser.id).where(AdminUser.email == payload.email.lower())
        )
        if existing is not None:
            raise AuthenticationError("email already registered")

        organization = Organization(
            name=payload.organization_name,
            slug=payload.organization_slug,
        )
        self.session.add(organization)
        await self.session.flush()

        user = AdminUser(
            organization_id=organization.id,
            email=payload.email.lower(),
            password_hash=hash_password(payload.password),
            role="owner",
        )
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(organization)
        await self.session.refresh(user)
        return organization, user

    async def login(self, email: str, password: str) -> str:
        user = await self.session.scalar(
            select(AdminUser).where(AdminUser.email == email.lower())
        )
        if user is None or not user.active or not verify_password(password, user.password_hash):
            raise AuthenticationError("invalid credentials")
        return create_access_token(
            user_id=user.id,
            organization_id=user.organization_id,
            role=user.role,
            staff_id=user.staff_id,
        )

    async def create_user(
        self,
        owner: AdminUser,
        payload: AdminUserCreate,
    ) -> AdminUser:
        if owner.role != "owner":
            raise AuthorizationError("owner role required")

        existing = await self.session.scalar(
            select(AdminUser.id).where(AdminUser.email == payload.email.lower())
        )
        if existing is not None:
            raise AuthenticationError("email already registered")

        if payload.staff_id is not None:
            staff = await self.session.get(StaffMember, payload.staff_id)
            if staff is None or staff.organization_id != owner.organization_id:
                raise AuthorizationError("staff does not belong to organization")

        user = AdminUser(
            organization_id=owner.organization_id,
            staff_id=payload.staff_id,
            email=payload.email.lower(),
            password_hash=hash_password(payload.password),
            role=payload.role,
        )
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user
