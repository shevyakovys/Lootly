from fastapi import APIRouter, HTTPException, status

from app.api.dependencies import CurrentUser, DbSession
from app.domain.schemas import (
    AdminUserCreate,
    AdminUserRead,
    BootstrapCreate,
    LoginRequest,
    OrganizationRead,
    TokenResponse,
)
from app.services.auth import (
    AuthenticationError,
    AuthorizationError,
    AuthService,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/bootstrap",
    response_model=AdminUserRead,
    status_code=status.HTTP_201_CREATED,
)
async def bootstrap(payload: BootstrapCreate, session: DbSession) -> AdminUserRead:
    try:
        _, user = await AuthService(session).bootstrap(payload)
    except AuthenticationError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return AdminUserRead.model_validate(user)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, session: DbSession) -> TokenResponse:
    try:
        token = await AuthService(session).login(payload.email, payload.password)
    except AuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    return TokenResponse(access_token=token)


@router.get("/me", response_model=AdminUserRead)
async def me(user: CurrentUser) -> AdminUserRead:
    return AdminUserRead.model_validate(user)


@router.post(
    "/users",
    response_model=AdminUserRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_user(
    payload: AdminUserCreate,
    session: DbSession,
    user: CurrentUser,
) -> AdminUserRead:
    try:
        created = await AuthService(session).create_user(user, payload)
    except AuthenticationError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except AuthorizationError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return AdminUserRead.model_validate(created)
