"""
Portfolio Schemas
Pydantic models for portfolio management.
"""

from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
import uuid


class PortfolioLocationCreate(BaseModel):
    """Create a location for a portfolio category."""
    name: str = Field(..., min_length=1, max_length=255)
    country_code: Optional[str] = Field(None, max_length=10)
    region: Optional[str] = Field(None, max_length=100)
    spend_amount: Optional[float] = Field(None, ge=0)
    spend_percentage: Optional[float] = Field(None, ge=0, le=100)


class PortfolioLocationResponse(BaseModel):
    """Location response."""
    id: uuid.UUID
    name: str
    country_code: Optional[str] = None
    region: Optional[str] = None
    spend_amount: Optional[float] = None
    spend_percentage: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PortfolioCategoryCreate(BaseModel):
    """Create a new portfolio category."""
    name: str = Field(..., min_length=1, max_length=255)
    spend: float = Field(default=0, ge=0, description="Annual spend in USD (can be 0 if calculated from CSV)")
    currency: str = Field(default="USD", max_length=10)
    description: Optional[str] = Field(None, max_length=500)
    industry: Optional[str] = Field(None, max_length=100)
    locations: Optional[List[str]] = Field(default=None)
    # List of location names to add (max 10 enforced in endpoint)


class PortfolioCategoryUpdate(BaseModel):
    """Update a portfolio category."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    spend: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = Field(None, max_length=10)
    description: Optional[str] = Field(None, max_length=500)
    industry: Optional[str] = Field(None, max_length=100)
    locations: Optional[List[str]] = Field(default=None)
    # If provided, replaces all locations (max 10 enforced in endpoint)


class PortfolioCategoryResponse(BaseModel):
    """Portfolio category response."""
    id: uuid.UUID
    name: str
    spend: float
    currency: str
    description: Optional[str] = None
    industry: Optional[str] = None
    locations: List[str] = []
    sort_order: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_model(cls, category):
        """Create response from SQLAlchemy model."""
        return cls(
            id=category.id,
            name=category.name,
            spend=category.spend,
            currency=category.currency,
            description=category.description,
            industry=category.industry,
            locations=[loc.name for loc in category.locations],
            sort_order=category.sort_order,
            created_at=category.created_at,
            updated_at=category.updated_at
        )


class PortfolioCategorySimple(BaseModel):
    """Simplified category for frontend compatibility."""
    id: str
    name: str
    spend: float
    locations: List[str] = []

    @classmethod
    def from_model(cls, category):
        """Create from SQLAlchemy model."""
        return cls(
            id=str(category.id),
            name=category.name,
            spend=category.spend,
            locations=[loc.name for loc in category.locations]
        )


class PortfolioDataResponse(BaseModel):
    """Portfolio data wrapper for frontend compatibility."""
    categories: List[PortfolioCategorySimple]
    total_spend: float
    total_categories: int


class PortfolioResponse(BaseModel):
    """Full portfolio response - matches frontend expectation."""
    success: bool = True
    data: PortfolioDataResponse

    @classmethod
    def from_categories(cls, categories: List):
        """Create response from list of category models."""
        category_responses = [
            PortfolioCategorySimple.from_model(cat)
            for cat in categories
        ]
        total_spend = sum(cat.spend for cat in categories)
        return cls(
            success=True,
            data=PortfolioDataResponse(
                categories=category_responses,
                total_spend=total_spend,
                total_categories=len(categories)
            )
        )


class CategoryCreateResponse(BaseModel):
    """Response for category creation - matches frontend expectation."""
    success: bool = True
    data: PortfolioCategorySimple


class CategoryDeleteResponse(BaseModel):
    """Response for category deletion - matches frontend expectation."""
    success: bool = True
    deleted: PortfolioCategorySimple


class SpendDataResponse(BaseModel):
    """Response for spend data - matches frontend expectation."""
    success: bool = True
    data: Optional[dict] = None
    message: Optional[str] = None


class SpendUploadResponse(BaseModel):
    """Response for spend data upload."""
    success: bool = True
    message: str
    data: PortfolioDataResponse


class LocationListResponse(BaseModel):
    """List of available locations."""
    locations: List[str]
    total: int
