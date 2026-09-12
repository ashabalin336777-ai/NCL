from pydantic import BaseModel, Field

from app.schemas.types import AppEmail
from app.schemas.user import UserPublic


class LoginRequest(BaseModel):
    email: AppEmail
    password: str = Field(min_length=8, max_length=72)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=20)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(min_length=20)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserPublic
