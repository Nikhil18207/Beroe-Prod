"""
Database Configuration
PostgreSQL with SQLAlchemy async support.
Engine is created lazily to prevent startup crashes if DB is misconfigured.
"""

from typing import AsyncGenerator, Optional
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker, AsyncEngine
from sqlalchemy.orm import declarative_base
import logging

logger = logging.getLogger(__name__)

# Base class for models
Base = declarative_base()

_async_engine: Optional[AsyncEngine] = None
_AsyncSessionLocal: Optional[async_sessionmaker] = None


def _get_settings():
    """Import settings lazily to avoid circular imports."""
    from app.config import settings
    return settings


def get_engine() -> AsyncEngine:
    """Get or create the async engine (lazy initialization)."""
    global _async_engine
    if _async_engine is None:
        settings = _get_settings()
        _async_engine = create_async_engine(
            settings.database_url,
            echo=settings.debug,
            future=True,
        )
    return _async_engine


def get_session_factory() -> async_sessionmaker:
    """Get or create the async session factory (lazy initialization)."""
    global _AsyncSessionLocal
    if _AsyncSessionLocal is None:
        _AsyncSessionLocal = async_sessionmaker(
            bind=get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
    return _AsyncSessionLocal


def async_session_factory():
    """Return a new async session (callable alias for use in WebSockets/chat). Usage: async with async_session_factory() as db:"""
    return get_session_factory()()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency to get database session.
    Usage: db: AsyncSession = Depends(get_db)
    """
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database tables."""
    engine = get_engine()
    async with engine.begin() as conn:
        # Import all models here to ensure they're registered
        from app.models import (
            user, session, portfolio, opportunity, proof_point,
            document, conversation, spend_data
        )

        # Create all tables
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """Close database connections."""
    global _async_engine
    if _async_engine is not None:
        await _async_engine.dispose()
        _async_engine = None
