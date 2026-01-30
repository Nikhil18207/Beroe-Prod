"""
Spend Data Models
Stores uploaded spend data and parsed rows.
"""

import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, DateTime, Float, ForeignKey, Integer, Text, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base

if TYPE_CHECKING:
    from app.models.session import AnalysisSession


class SpendData(Base):
    """Uploaded spend data file metadata and summary."""

    __tablename__ = "spend_data"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("analysis_sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )

    # File Info
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)

    # Parsed Data Summary
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    column_count: Mapped[int] = mapped_column(Integer, default=0)
    columns: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # ["supplier_name", "category", "spend_usd", "country", ...]

    # Column Mapping (detected fields)
    column_mapping: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # Structure: {
    #   "supplier": "supplier_name",
    #   "spend": "spend_usd",
    #   "country": "country",
    #   "category": "category"
    # }

    # Data Availability Flags
    has_supplier_data: Mapped[bool] = mapped_column(Boolean, default=False)
    has_location_data: Mapped[bool] = mapped_column(Boolean, default=False)
    has_volume_data: Mapped[bool] = mapped_column(Boolean, default=False)
    has_price_data: Mapped[bool] = mapped_column(Boolean, default=False)
    has_category_data: Mapped[bool] = mapped_column(Boolean, default=False)

    # Aggregated Stats
    total_spend: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    unique_suppliers: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    unique_locations: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    unique_categories: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Spend Distribution (precomputed for dashboard)
    spend_by_supplier: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # Structure: {"supplier_name": amount, ...} (top 10)
    spend_by_location: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # Structure: {"country": amount, ...} (top 10)
    spend_by_category: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # Structure: {"category": amount, ...}

    # Processing Status
    is_processed: Mapped[bool] = mapped_column(Boolean, default=False)
    processing_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    session: Mapped["AnalysisSession"] = relationship("AnalysisSession", back_populates="spend_data")
    rows: Mapped[List["SpendDataRow"]] = relationship(
        "SpendDataRow",
        back_populates="spend_data",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<SpendData {self.filename} - {self.row_count} rows>"


class SpendDataRow(Base):
    """Individual spend data row (stored for analysis)."""

    __tablename__ = "spend_data_rows"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    spend_data_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("spend_data.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Core Fields (normalized)
    supplier_name: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, index=True)
    category: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    spend_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="USD")

    # Location Fields
    country: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    region: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Volume & Price
    volume: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    volume_unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    unit_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Additional Fields
    transaction_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    po_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    invoice_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Raw Row Data (for reference)
    raw_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    spend_data: Mapped["SpendData"] = relationship("SpendData", back_populates="rows")

    def __repr__(self) -> str:
        return f"<SpendDataRow {self.supplier_name} - ${self.spend_amount}>"
