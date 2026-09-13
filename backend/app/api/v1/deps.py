from typing import Annotated
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.redis import get_redis
from app.core.security import decode_token
from app.models.enums import UserRole
from app.models.user import User
from app.services.auth import get_user_by_id
from app.services.training import is_staff

bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[AsyncSession, Depends(get_db)]
RedisClient = Annotated[Redis, Depends(get_redis)]


async def get_current_user(
    session: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    if credentials is None:
        raise UnauthorizedError()
    try:
        payload = decode_token(credentials.credentials, "access")
        user_id = UUID(str(payload["sub"]))
    except (ValueError, TypeError) as exc:
        raise UnauthorizedError() from exc

    user = await get_user_by_id(session, str(user_id))
    if user is None:
        raise UnauthorizedError()
    if not user.is_active:
        raise UnauthorizedError("Account is disabled")
    return user


async def get_current_admin(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    """РОП (admin) или developer — операционные admin-эндпоинты команды."""
    if not is_staff(user):
        raise ForbiddenError("Admin role required")
    return user


async def get_current_rop(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if user.role not in {UserRole.ADMIN, UserRole.DEVELOPER}:
        raise ForbiddenError("ROP role required")
    return user


async def get_current_developer(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if user.role != UserRole.DEVELOPER:
        raise ForbiddenError("Developer role required")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentAdmin = Annotated[User, Depends(get_current_admin)]
CurrentRop = Annotated[User, Depends(get_current_rop)]
CurrentDeveloper = Annotated[User, Depends(get_current_developer)]
