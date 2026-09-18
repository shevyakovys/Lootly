from fastapi import APIRouter, status

from app.api.dependencies import DbSession
from app.domain.schemas import UserCreate, UserRead
from app.services.users import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, session: DbSession) -> UserRead:
    user = await UserService(session).create(payload)
    return UserRead.model_validate(user)


@router.get("", response_model=list[UserRead])
async def list_users(session: DbSession) -> list[UserRead]:
    users = await UserService(session).list()
    return [UserRead.model_validate(user) for user in users]
