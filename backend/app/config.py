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
        env_file="../.env",
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

    # Together.ai (open source models - Llama, Mistral, Qwen)
    together_api_key: str = ""
    together_model: str = "meta-llama/Llama-3.3-70B-Instruct-Turbo"

    # Groq (ultra-fast inference)
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # Local LLM (Ollama + Qwen 2.5) - For local development only
    local_llm_enabled: bool = False
    local_llm_model: str = "qwen2.5:7b"
    local_llm_base_url: str = "http://localhost:11434"

    # LLM Provider Selection
    # - openai: Use OpenAI API (paid, high quality)
    # - together: Use Together.ai (open source models)
    # - groq: Use Groq (ultra-fast, free tier)
    # - local: Use local Ollama/Qwen (development only)
    # - hybrid: Try OpenAI first, fallback to local
    llm_provider: Literal["openai", "together", "groq", "local", "hybrid"] = "openai"

    # Supplier Intelligence (PP8) - Uses OpenAI for real-time analysis
    supplier_intel_model: str = "gpt-4o-mini"

    # Serper API for real-time web search in supplier intelligence
    serper_api_key: str = ""

    # File Upload - Supports large files (N million rows)
    max_upload_size_mb: int = 2048  # 2GB max for large datasets
    upload_dir: str = "./uploads"
    allowed_extensions: str = ".csv,.xlsx,.xls,.pdf,.docx"

    # Large File Processing (for N million rows)
    upload_chunk_size: int = 50000  # Rows per processing chunk
    upload_batch_size: int = 5000   # Rows per DB transaction

    # CORS - Frontend URLs
    # Set CORS_ORIGINS env var in Railway with your Vercel URL
    # Example: ["https://your-app.vercel.app","http://localhost:3000"]
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000"
    ]

    # Frontend URL (for production - set in Railway env vars)
    frontend_url: str = "http://localhost:3000"

    # Logging
    log_level: str = "INFO"
    log_format: str = "json"

    # Super Admin Secret (for promoting users to Super Admin role)
    super_admin_secret: str = "beroe-super-admin-2024"

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
