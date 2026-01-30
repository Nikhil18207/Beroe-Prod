"""
Opportunity Models
Stores procurement opportunities identified by the Dual Orchestrator.
"""

import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, DateTime, Float, ForeignKey, Integer, Text, Boolean, Enum as SQLEnum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.database import Base

if TYPE_CHECKING:
    from app.models.session import AnalysisSession
    from app.models.proof_point import ProofPoint


class LeverTheme(str, enum.Enum):
    """Opportunity lever themes - the 4 implemented for demo."""
    VOLUME_BUNDLING = "Volume Bundling"
    TARGET_PRICING = "Target Pricing"
    RISK_MANAGEMENT = "Risk Management"
    RESPEC_PACK = "Re-specification Pack"
    # Future: Add remaining 7 initiatives
    # TECHNICAL_DATA_MINING = "Technical Data Mining"
    # RE_SPEC_SPECS = "Re-specification (Specs)"
    # GLOBALIZATION = "Globalization"
    # SUPPLIER_CONCENTRATION_RISK = "Supplier Concentration Risk"
    # FINANCIAL_RISK = "Financial Risk"
    # GEOPOLITICAL_RISK = "Geopolitical Risk"
    # PRICE_VOLATILITY_RISK = "Price Volatility Risk"


class ImpactBucket(str, enum.Enum):
    """Impact classification."""
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


class OpportunityStatus(str, enum.Enum):
    """Opportunity workflow status."""
    POTENTIAL = "potential"
    QUALIFIED = "qualified"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    IMPLEMENTED = "implemented"


class Opportunity(Base):
    """Procurement opportunity identified by analysis."""

    __tablename__ = "opportunities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("analysis_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Opportunity Identity
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    lever_theme: Mapped[LeverTheme] = mapped_column(SQLEnum(LeverTheme), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Impact Metrics
    impact_score: Mapped[float] = mapped_column(Float, default=0.0)
    impact_bucket: Mapped[ImpactBucket] = mapped_column(
        SQLEnum(ImpactBucket),
        default=ImpactBucket.LOW
    )
    weightage: Mapped[float] = mapped_column(Float, default=0.0)  # Weight in total savings

    # Savings Estimates
    savings_low: Mapped[float] = mapped_column(Float, default=0.0)
    savings_high: Mapped[float] = mapped_column(Float, default=0.0)
    savings_benchmark_low: Mapped[float] = mapped_column(Float, default=0.02)
    savings_benchmark_high: Mapped[float] = mapped_column(Float, default=0.05)

    # Additional Metrics
    effort_estimate: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # e.g., "3-6 months"
    risk_impact: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # e.g., "-2"
    esg_impact: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # e.g., "+1"
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)

    # Proof Points Summary
    num_proof_points: Mapped[int] = mapped_column(Integer, default=0)
    num_validated_proof_points: Mapped[int] = mapped_column(Integer, default=0)
    flag_counts: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)
    # Structure: {"low": 0, "medium": 0, "high": 0, "not_tested": 0}

    # Status
    status: Mapped[OpportunityStatus] = mapped_column(
        SQLEnum(OpportunityStatus),
        default=OpportunityStatus.POTENTIAL
    )
    is_new: Mapped[bool] = mapped_column(Boolean, default=True)
    questions_to_answer: Mapped[int] = mapped_column(Integer, default=0)

    # Generated Content (LLM)
    tests: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    # Structure: [{"text": "...", "completed": true}]
    recommendations: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    # Structure: [{"text": "...", "checked": false}]
    insights: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    # Structure: [{"title": "...", "content": "..."}]

    # Maturity Score (for this specific opportunity)
    maturity_score: Mapped[float] = mapped_column(Float, default=2.5)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    session: Mapped["AnalysisSession"] = relationship("AnalysisSession", back_populates="opportunities")
    proof_points: Mapped[List["OpportunityProofPoint"]] = relationship(
        "OpportunityProofPoint",
        back_populates="opportunity",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Opportunity {self.name[:50]} - {self.lever_theme.value}>"

    def update_flag_counts(self) -> None:
        """Recalculate flag counts from proof points."""
        counts = {"low": 0, "medium": 0, "high": 0, "not_tested": 0}
        for pp in self.proof_points:
            if pp.impact_flag:
                flag_key = pp.impact_flag.lower().replace(" ", "_")
                if flag_key in counts:
                    counts[flag_key] += 1
        self.flag_counts = counts
        self.num_validated_proof_points = counts["low"] + counts["medium"] + counts["high"]


class OpportunityProofPoint(Base):
    """Proof point evaluation result for an opportunity."""

    __tablename__ = "opportunity_proof_points"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    opportunity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("opportunities.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    proof_point_definition_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("proof_point_definitions.id"),
        nullable=True
    )

    # Proof Point Identity
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    proof_type: Mapped[str] = mapped_column(String(100), nullable=False)
    # Types: "Market Price Data", "Supplier Analysis", "Contract Terms", etc.

    # Evaluation Results
    impact_flag: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    # Values: "Low", "Medium", "High", "Not Tested"
    test_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    test_result: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_tested: Mapped[bool] = mapped_column(Boolean, default=False)
    is_validated: Mapped[bool] = mapped_column(Boolean, default=False)

    # LLM-generated insight
    insight: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    context: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Context explains how this proof point relates to this specific opportunity

    # Raw Data (what was analyzed)
    raw_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    evaluated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    validated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    opportunity: Mapped["Opportunity"] = relationship("Opportunity", back_populates="proof_points")

    def __repr__(self) -> str:
        return f"<OpportunityProofPoint {self.name} - {self.impact_flag}>"
