"""
Common Schemas
Shared schema definitions used across the API.
"""

from typing import Any, Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field
from datetime import datetime

T = TypeVar("T")


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "healthy"
    service: str = "Beroe AI Procurement Platform"
    version: str = "1.0.0"
    environment: str = "development"
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Component status
    database: str = "connected"
    redis: str = "connected"
    llm_provider: str = "available"

    # Optional details
    active_sessions: Optional[int] = None


class ErrorResponse(BaseModel):
    """Standard error response."""
    status: str = "error"
    message: str
    detail: Optional[str] = None
    error_code: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated list response."""
    items: List[T]
    total: int
    page: int = 1
    page_size: int = 20
    total_pages: int = 1

    @classmethod
    def create(
        cls,
        items: List[T],
        total: int,
        page: int = 1,
        page_size: int = 20
    ) -> "PaginatedResponse[T]":
        total_pages = (total + page_size - 1) // page_size if page_size > 0 else 1
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )


class MessageResponse(BaseModel):
    """Simple message response."""
    status: str = "success"
    message: str


class DeleteResponse(BaseModel):
    """Delete operation response."""
    status: str = "success"
    deleted: bool = True
    id: str
