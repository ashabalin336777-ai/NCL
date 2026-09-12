from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.models.enums import UserRole
from app.schemas.common import ORMModel
from app.schemas.types import AppEmail


class UserPublic(ORMModel):
    id: UUID
    email: AppEmail
    role: UserRole
    is_active: bool
    full_name: str = Field(min_length=1, max_length=255)
    created_at: datetime
