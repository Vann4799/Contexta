from functools import lru_cache

from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "contexta_chunks"
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = "test-secret"
    supabase_jwks_url: str = ""
    supabase_storage_bucket: str = "contexta-documents"
    api_cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    deepseek_api_key: str = ""
    deepseek_model: str = "deepseek-v4-pro"
    deepseek_max_tokens: int = 1200
    embedding_provider: str = "deterministic"
    embedding_model_name: str = "BAAI/bge-m3"
    embedding_device: str = ""
    embedding_dimensions: int = 384

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        if getattr(init_settings, "init_kwargs", None):
            return (init_settings,)
        return init_settings, env_settings, dotenv_settings, file_secret_settings

    def validate_security(self) -> None:
        if (
            self.environment not in {"development", "test"}
            and self.supabase_jwt_secret == "test-secret"
            and not self.resolved_supabase_jwks_url
        ):
            raise ValueError(
                "supabase_jwt_secret must be changed or supabase_jwks_url must be set outside development or test"
            )

    @property
    def resolved_supabase_jwks_url(self) -> str:
        if self.supabase_jwks_url:
            return self.supabase_jwks_url
        if self.supabase_url:
            return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        return ""

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.api_cors_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_security()
    return settings
