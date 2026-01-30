"""
Analysis Session Model
Stores the state of procurement analysis sessions.
"""

import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, DateTime, Text, JSON, ForeignKey, Float, Integer, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.opportunity import Opportunity
    from app.models.spend_data import SpendData
    from app.models.document import Document


class SessionStatus(str, enum.Enum):
    """Analysis session status."""
    CREATED = "created"
    UPLOADING = "uploading"
    PROCESSING = "processing"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    FAILED = "failed"


class AnalysisSession(Base):
    """Analysis session model - tracks a complete analysis workflow."""

    __tablename__ = "analysis_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    # Session Info
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="New Analysis")
    status: Mapped[SessionStatus] = mapped_column(
        SQLEnum(SessionStatus),
        default=SessionStatus.CREATED
    )
    status_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Category Being Analyzed
    category_name: Mapped[str] = mapped_column(String(255), nullable=False)
    category_spend: Mapped[float] = mapped_column(Float, nullable=False)
    addressable_spend_pct: Mapped[float] = mapped_column(Float, default=0.8)
    addressable_spend: Mapped[float] = mapped_column(Float, nullable=True)

    # Benchmarks
    savings_benchmark_low: Mapped[float] = mapped_column(Float, default=0.04)
    savings_benchmark_high: Mapped[float] = mapped_column(Float, default=0.10)
    maturity_score: Mapped[float] = mapped_column(Float, default=2.5)

    # Goals (from user preferences)
    goals: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # Structure: {"cost": 40, "risk": 35, "esg": 25}

    # Results - Savings Summary
    total_savings_low: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    total_savings_high: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    confidence_bucket: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Processing Metadata
    processing_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    processing_completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    processing_duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Agent Logs (for debugging/transparency)
    agent_logs: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=list)
    # Structure: [{"timestamp": "...", "agent_name": "...", "message": "..."}]

    # Detailed Results (stored as JSON for flexibility)
    detailed_results: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="sessions")
    opportunities: Mapped[List["Opportunity"]] = relationship(
        "Opportunity",
        back_populates="session",
        cascade="all, delete-orphan"
    )
    spend_data: Mapped[Optional["SpendData"]] = relationship(
        "SpendData",
        back_populates="session",
        uselist=False,
        cascade="all, delete-orphan"
    )
    documents: Mapped[List["Document"]] = relationship(
        "Document",
        back_populates="session",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<AnalysisSession {self.id} - {self.category_name}>"

    def add_log(self, agent_name: str, message: str) -> None:
        """Add a log entry to the session."""
        if self.agent_logs is None:
            self.agent_logs = []
        self.agent_logs.append({
            "timestamp": datetime.utcnow().isoformat(),
            "agent_name": agent_name,
            "message": message
        })
