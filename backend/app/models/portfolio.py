"""
Portfolio Models
Stores user's procurement portfolio - categories and locations.
"""

import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, DateTime, Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class PortfolioCategory(Base):
    """User's procurement category in their portfolio."""

    __tablename__ = "portfolio_categories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Category Details
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    spend: Mapped[float] = mapped_column(Float, nullable=False)  # Annual spend in USD
    currency: Mapped[str] = mapped_column(String(10), default="USD")

    # Additional Metadata
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    industry: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Sort Order
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="portfolio_categories")
    locations: Mapped[List["PortfolioLocation"]] = relationship(
        "PortfolioLocation",
        back_populates="category",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<PortfolioCategory {self.name} - ${self.spend:,.0f}>"

    @property
    def location_names(self) -> List[str]:
        """Get list of location names."""
        return [loc.name for loc in self.locations]


class PortfolioLocation(Base):
    """Location associated with a portfolio category."""

    __tablename__ = "portfolio_locations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("portfolio_categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Location Details
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    country_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    region: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Spend at this location (optional breakdown)
    spend_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    spend_percentage: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    category: Mapped["PortfolioCategory"] = relationship(
        "PortfolioCategory",
        back_populates="locations"
    )

    def __repr__(self) -> str:
        return f"<PortfolioLocation {self.name}>"
