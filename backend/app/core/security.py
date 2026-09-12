from datetime import datetime, timedelta, timezone
from typing import Any, Literal
from uuid import uuid4

import bcrypt
import jwt
from jwt import InvalidTokenError

from app.core.config import settings

TokenType = Literal["access", "refresh"]


def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > 72:
        raise ValueError("Password must be at most 72 bytes")
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))


def _expire_delta(token_type: TokenType) -> timedelta:
    if token_type == "access":
        return timedelta(minutes=settings.jwt_access_token_expire_minutes)
    return timedelta(days=settings.jwt_refresh_token_expire_days)


def create_token(subject: str, token_type: TokenType, extra: dict[str, Any] | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "jti": str(uuid4()),
        "iat": now,
        "exp": now + _expire_delta(token_type),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str, expected_type: TokenType) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except InvalidTokenError as exc:
        raise ValueError("Invalid token") from exc

    if payload.get("type") != expected_type:
        raise ValueError("Unexpected token type")
    if not payload.get("sub") or not payload.get("jti"):
        raise ValueError("Malformed token")
    return payload


def refresh_ttl_seconds() -> int:
    return settings.jwt_refresh_token_expire_days * 24 * 60 * 60
