from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "NeuroCloser — NCL Sales Trainer"
    app_env: str = "development"
    secret_key: str = Field(..., min_length=16)

    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    database_url: str
    redis_url: str
    cors_origins: str = "http://localhost"

    llm_base_url: str = "https://api.neuraldeep.ru/v1"
    llm_api_key: str = ""
    llm_timeout_seconds: int = 180
    llm_max_retries: int = 2

    seed_admin_email: str = "admin@ncl.local"
    seed_admin_password: str = "ChangeMe_Admin_123"
    seed_manager_password: str = "ChangeMe_Manager_123"
    seed_developer_email: str = "dev@ncl.local"
    seed_developer_password: str = "ChangeMe_Dev_123"
    seed_billing_balance_rub: float = 5000.0

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        if not value.startswith("postgresql+asyncpg://"):
            raise ValueError("DATABASE_URL must use postgresql+asyncpg://")
        return value

    @field_validator("llm_base_url")
    @classmethod
    def validate_llm_base_url(cls, value: str) -> str:
        lowered = value.lower()
        if "openai.com" in lowered or "api.openai" in lowered:
            raise ValueError("OpenAI API is disabled; use https://api.neuraldeep.ru/v1")
        if "neuraldeep.ru" not in lowered:
            return "https://api.neuraldeep.ru/v1"
        return value.rstrip("/")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
