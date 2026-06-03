from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"
    qdrant_url: str = "http://localhost:6333"
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = "test-secret"
    supabase_storage_bucket: str = "contexta-documents"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    def validate_security(self) -> None:
        if (
            self.environment not in {"development", "test"}
            and self.supabase_jwt_secret == "test-secret"
        ):
            raise ValueError(
                "supabase_jwt_secret must be changed outside development or test"
            )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_security()
    return settings
