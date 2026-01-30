"""
Health Check Endpoints
System health and status monitoring.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime

from app.database import get_db
from app.config import settings
from app.schemas.common import HealthResponse

router = APIRouter()


@router.get("/", response_model=HealthResponse)
async def root_health():
    """
    Root endpoint - basic health check.
    Used by frontend on login page.
    """
    return HealthResponse(
        status="healthy",
        service=settings.app_name,
        version=settings.app_version,
        environment=settings.environment,
        timestamp=datetime.utcnow()
    )


@router.get("/health", response_model=HealthResponse)
async def detailed_health(db: AsyncSession = Depends(get_db)):
    """
    Detailed health check with component status.
    Checks database connectivity and LLM availability.
    """
    # Check database
    db_status = "disconnected"
    try:
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)[:50]}"

    # Check Redis (placeholder - implement if using Redis)
    redis_status = "not_configured"

    # Check LLM provider
    llm_status = "configured" if settings.openai_api_key else "not_configured"
    if settings.llm_provider == "hybrid":
        llm_status = f"hybrid (openai: {'yes' if settings.openai_api_key else 'no'}, local: {'yes' if settings.local_llm_enabled else 'no'})"

    return HealthResponse(
        status="healthy" if db_status == "connected" else "degraded",
        service=settings.app_name,
        version=settings.app_version,
        environment=settings.environment,
        timestamp=datetime.utcnow(),
        database=db_status,
        redis=redis_status,
        llm_provider=llm_status
    )
