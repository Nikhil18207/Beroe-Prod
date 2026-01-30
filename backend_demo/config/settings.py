"""
Application Settings and Configuration
Robust configuration with graceful degradation for missing API keys
"""

import os
import logging
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator
from typing import Optional, List

# Configure module logger
logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    All API keys are optional with graceful degradation.
    """

    # OpenAI Configuration - Optional with graceful degradation
    OPENAI_API_KEY: Optional[str] = Field(default=None, description="OpenAI API key for GPT-4 features")
    OPENAI_MODEL: str = Field(default="gpt-4o", description="OpenAI model to use")
    OPENAI_TEMPERATURE: float = Field(default=0.2, ge=0.0, le=2.0)
    OPENAI_MAX_TOKENS: int = Field(default=4000, ge=100, le=128000)

    # Application Configuration
    APP_ENV: str = Field(default="development", pattern="^(development|staging|production)$")
    APP_PORT: int = Field(default=8000, ge=1, le=65535)
    APP_HOST: str = Field(default="0.0.0.0")
    LOG_LEVEL: str = Field(default="INFO", pattern="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$")

    # Data Paths
    STRUCTURED_DATA_PATH: str = "./data/structured"
    UNSTRUCTURED_DATA_PATH: str = "./data/unstructured"
    CALCULATED_DATA_PATH: str = "./data/calculated"
    RULES_PATH: str = "./data/structured/rule_book.csv"
    PROMPTS_PATH: str = "./config/prompts"

    # Confidence & Scoring Configuration
    MIN_CONFIDENCE_THRESHOLD: float = Field(default=0.60, ge=0.0, le=1.0)
    HIGH_CONFIDENCE_THRESHOLD: float = Field(default=0.85, ge=0.0, le=1.0)
    BASE_CONFIDENCE: float = Field(default=0.50, ge=0.0, le=1.0)

    # RAG Configuration
    VECTOR_DB_TYPE: str = Field(default="chromadb", pattern="^(chromadb|faiss)$")
    CHROMA_PERSIST_DIRECTORY: str = "./data/vector_db"
    FAISS_INDEX_PATH: str = "./data/faiss_db"
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSION: int = Field(default=1536, ge=256)
    RAG_CHUNK_SIZE: int = Field(default=1000, ge=100)
    RAG_CHUNK_OVERLAP: int = Field(default=200, ge=0)
    RAG_TOP_K_RESULTS: int = Field(default=5, ge=1, le=50)
    RAG_SIMILARITY_THRESHOLD: float = Field(default=0.7, ge=0.0, le=1.0)

    # API Configuration
    RATE_LIMIT_REQUESTS: int = Field(default=100, ge=1)
    RATE_LIMIT_PERIOD: int = Field(default=60, ge=1)
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:8000,http://localhost:8501"

    # Caching
    ENABLE_CACHE: bool = True
    CACHE_TTL_SECONDS: int = Field(default=3600, ge=60)
    CACHE_MAX_SIZE: int = Field(default=1000, ge=10, description="Maximum number of items in cache")
    CACHE_TYPE: str = Field(default="memory", pattern="^(memory|redis)$")

    # Monitoring
    ENABLE_MONITORING: bool = True
    ENABLE_TRACING: bool = True
    METRICS_PORT: int = Field(default=9090, ge=1, le=65535)

    # Security
    API_KEY_REQUIRED: bool = False
    API_KEY: Optional[str] = None

    # Experimental Features
    ENABLE_EXPERIMENTAL_FEATURES: bool = True
    ENABLE_MULTI_MODEL_COMPARISON: bool = False
    ENABLE_CONFIDENCE_CALIBRATION: bool = True

    # Geopolitical Risk Configuration (externalized from hardcoded values)
    HIGH_RISK_COUNTRIES: str = Field(
        default="Russia,Iran,North Korea,Venezuela,Belarus,Syria,Cuba",
        description="Comma-separated list of high geopolitical risk countries"
    )
    ELEVATED_RISK_COUNTRIES: str = Field(
        default="China,Ukraine,Myanmar,Afghanistan,Yemen,Libya,Sudan",
        description="Comma-separated list of elevated risk countries for monitoring"
    )

    # Brief Generation Defaults
    DEFAULT_SUPPLIER_DISPLAY_COUNT: int = Field(default=15, ge=5, le=50)
    DEFAULT_TOP_SUPPLIERS_COUNT: int = Field(default=5, ge=3, le=20)

    @field_validator('OPENAI_API_KEY', mode='before')
    @classmethod
    def validate_openai_key(cls, v):
        """Allow empty string to be treated as None"""
        if v == '' or v == 'your-openai-api-key':
            return None
        return v

    @property
    def high_risk_countries_list(self) -> List[str]:
        """Get high risk countries as a list"""
        return [c.strip() for c in self.HIGH_RISK_COUNTRIES.split(',') if c.strip()]

    @property
    def elevated_risk_countries_list(self) -> List[str]:
        """Get elevated risk countries as a list"""
        return [c.strip() for c in self.ELEVATED_RISK_COUNTRIES.split(',') if c.strip()]

    @property
    def cors_origins_list(self) -> List[str]:
        """Get CORS origins as a list"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(',') if origin.strip()]

    @property
    def is_llm_enabled(self) -> bool:
        """Check if LLM features are available"""
        return self.OPENAI_API_KEY is not None and len(self.OPENAI_API_KEY) > 10

    @property
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.APP_ENV == "production"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields in .env


def get_settings() -> Settings:
    """
    Factory function to get settings with graceful error handling.
    Returns a Settings instance, logging warnings for missing optional configs.
    """
    try:
        settings_instance = Settings()

        # Log warnings for missing optional but recommended settings
        if not settings_instance.is_llm_enabled:
            logger.warning(
                "OPENAI_API_KEY not configured. AI-powered features will be disabled. "
                "Set OPENAI_API_KEY in .env file to enable GPT-4 features."
            )

        if settings_instance.APP_ENV == "production" and not settings_instance.API_KEY_REQUIRED:
            logger.warning(
                "Running in production without API_KEY_REQUIRED=True. "
                "Consider enabling API key authentication for security."
            )

        return settings_instance

    except Exception as e:
        logger.error(f"Failed to load settings: {e}. Using defaults.")
        # Return settings with all defaults
        return Settings(_env_file=None)


# Global settings instance with graceful fallback
try:
    settings = Settings()
except Exception as e:
    logger.warning(f"Could not load settings from .env: {e}. Using defaults.")
    # Create settings without .env file
    settings = Settings(_env_file=None)
