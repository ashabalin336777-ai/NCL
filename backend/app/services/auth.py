from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UnauthorizedError
from app.core.security import verify_password
from app.models.user import User


async def authenticate_user(session: AsyncSession, email: str, password: str) -> User:
    result = await session.execute(select(User).where(User.email == email.lower()))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(password, user.hashed_password):
        raise UnauthorizedError("Invalid email or password")
    if not user.is_active:
        raise UnauthorizedError("Account is disabled")
    return user


async def get_user_by_id(session: AsyncSession, user_id: str | UUID) -> User | None:
    lookup_id = user_id if isinstance(user_id, UUID) else UUID(str(user_id))
    result = await session.execute(select(User).where(User.id == lookup_id))
    return result.scalar_one_or_none()
