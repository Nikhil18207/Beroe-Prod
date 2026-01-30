"""
Proof Point Models
Master definitions for proof points and their mappings to initiatives.
"""

import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, DateTime, Float, Text, Boolean, JSON, Integer
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class ProofPointDefinition(Base):
    """
    Master proof point definition.
    These are the 41+ proof points from the methodology.
    """

    __tablename__ = "proof_point_definitions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # Proof Point Identity
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    # e.g., "PP_REGIONAL_SPEND", "PP_TAIL_SPEND"

    # Classification
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    # "Client Data Insights" or "Market Drivers"
    proof_type: Mapped[str] = mapped_column(String(100), nullable=False)
    # "Spend Analysis", "Supplier Analysis", "Market Price Data", etc.

    # Description
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    hypothesis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # What we're looking for

    # Evaluation Criteria
    evaluation_criteria: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # Structure: {"high": {"threshold": 0.8, "description": "..."}, "medium": {...}, "low": {...}}

    # Required Data Fields
    required_data_fields: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    # e.g., ["spend_by_region", "total_spend", "region_count"]

    # Initiative Mappings
    initiative_mappings: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # Structure: [{"initiative_id": 1, "initiative_name": "Volume Bundling", "context": "..."}]

    # Is Active
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Sort Order
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<ProofPointDefinition {self.name}>"


class ProofPoint(Base):
    """
    User-specific proof point data.
    Stores the actual data values for a user's category.
    """

    __tablename__ = "proof_points"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    definition_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True
    )

    # Proof Point Identity (copied from definition for convenience)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)

    # Extracted Data
    data_value: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # Structure varies by proof point type
    # e.g., {"top_3_regions_pct": 0.95, "regions": ["India", "Malaysia", "Indonesia"]}

    # Evaluation Results
    is_available: Mapped[bool] = mapped_column(Boolean, default=False)
    # Whether we have data to evaluate this proof point

    # Status
    source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # "spend_data", "contract", "market_data", "manual"

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<ProofPoint {self.name} - {self.is_available}>"
