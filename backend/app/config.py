"""
Application Configuration
Centralized settings management using Pydantic Settings.
"""

from functools import lru_cache
from typing import List, Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # Application
    app_name: str = "Beroe AI Procurement Platform"
    app_version: str = "1.0.0"
    debug: bool = False
    environment: Literal["development", "staging", "production"] = "development"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 1

    # Database
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/beroe_procurement"
    database_sync_url: str = "postgresql://postgres:password@localhost:5432/beroe_procurement"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT Authentication
    jwt_secret_key: str = "your-super-secret-jwt-key-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"
    openai_embedding_model: str = "text-embedding-3-small"

    # Local LLM (Ollama + Qwen 2.5)
    local_llm_enabled: bool = True
    local_llm_model: str = "qwen2.5:7b"
    local_llm_base_url: str = "http://localhost:11434"

    # LLM Provider: "local" for Ollama only, "openai" for OpenAI only, "hybrid" for both
    llm_provider: Literal["openai", "local", "hybrid"] = "local"

    # File Upload
    max_upload_size_mb: int = 50
    upload_dir: str = "./uploads"
    allowed_extensions: str = ".csv,.xlsx,.xls,.pdf,.docx"

    # CORS
    cors_origins: List[str] = ["http://localhost:3000", "http://localhost:3004", "http://localhost:3014", "http://localhost:3050", "http://localhost:3092"]

    # Logging
    log_level: str = "INFO"
    log_format: str = "json"

    @property
    def allowed_extensions_list(self) -> List[str]:
        """Parse allowed extensions into a list."""
        return [ext.strip() for ext in self.allowed_extensions.split(",")]

    @property
    def max_upload_size_bytes(self) -> int:
        """Convert MB to bytes."""
        return self.max_upload_size_mb * 1024 * 1024


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Global settings instance
settings = get_settings()
