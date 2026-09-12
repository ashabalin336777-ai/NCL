from fastapi import APIRouter, Request

from app.api.v1.deps import CurrentUser, DbSession, RedisClient
from app.core.exceptions import RateLimitError, UnauthorizedError
from app.core.security import (
    create_token,
    decode_token,
    refresh_ttl_seconds,
)
from app.schemas.auth import LoginRequest, LogoutRequest, RefreshRequest, TokenResponse
from app.schemas.common import APIMessage
from app.schemas.user import UserPublic
from app.services.auth import authenticate_user, get_user_by_id

router = APIRouter(prefix="/auth", tags=["auth"])

LOGIN_WINDOW_SECONDS = 60
LOGIN_MAX_ATTEMPTS = 8


def _token_pair(user_id: str) -> tuple[str, str, str]:
    access = create_token(user_id, "access")
    refresh = create_token(user_id, "refresh")
    refresh_payload = decode_token(refresh, "refresh")
    return access, refresh, str(refresh_payload["jti"])


async def _enforce_login_limit(redis: RedisClient, request: Request, email: str) -> None:
    client_ip = request.client.host if request.client else "unknown"
    key = f"login-limit:{client_ip}:{email.lower()}"
    attempts = await redis.incr(key)
    if attempts == 1:
        await redis.expire(key, LOGIN_WINDOW_SECONDS)
    if attempts > LOGIN_MAX_ATTEMPTS:
        raise RateLimitError()


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    session: DbSession,
    redis: RedisClient,
) -> TokenResponse:
    await _enforce_login_limit(redis, request, payload.email)
    user = await authenticate_user(session, payload.email, payload.password)
    access, refresh, jti = _token_pair(str(user.id))
    await redis.setex(f"refresh:{jti}", refresh_ttl_seconds(), str(user.id))
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user=UserPublic.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(
    payload: RefreshRequest,
    session: DbSession,
    redis: RedisClient,
) -> TokenResponse:
    try:
        token_payload = decode_token(payload.refresh_token, "refresh")
    except ValueError as exc:
        raise UnauthorizedError("Invalid refresh token") from exc

    jti = str(token_payload["jti"])
    user_id = str(token_payload["sub"])
    stored = await redis.get(f"refresh:{jti}")
    if stored is None or stored != user_id:
        raise UnauthorizedError("Refresh token is expired or revoked")

    user = await get_user_by_id(session, user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("Account is disabled")

    await redis.delete(f"refresh:{jti}")
    access, refresh, new_jti = _token_pair(str(user.id))
    await redis.setex(f"refresh:{new_jti}", refresh_ttl_seconds(), str(user.id))
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user=UserPublic.model_validate(user),
    )


@router.post("/logout", response_model=APIMessage)
async def logout(payload: LogoutRequest, redis: RedisClient) -> APIMessage:
    try:
        token_payload = decode_token(payload.refresh_token, "refresh")
        await redis.delete(f"refresh:{token_payload['jti']}")
    except ValueError:
        pass
    return APIMessage(detail="Logged out")


@router.get("/me", response_model=UserPublic)
async def me(user: CurrentUser) -> UserPublic:
    return UserPublic.model_validate(user)
