"""
Session Schemas
Pydantic models for analysis sessions.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum
import uuid


class SessionStatus(str, Enum):
    """Analysis session status."""
    CREATED = "created"
    UPLOADING = "uploading"
    PROCESSING = "processing"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    FAILED = "failed"


class SavingsSummary(BaseModel):
    """Savings calculation summary."""
    total_savings_low: float
    total_savings_high: float
    confidence_score: float
    confidence_bucket: str  # "Low", "Medium", "High"


class SessionCreate(BaseModel):
    """Create a new analysis session."""
    category_name: str = Field(..., min_length=1, max_length=255)
    category_spend: float = Field(..., gt=0)
    addressable_spend_pct: float = Field(default=0.8, ge=0, le=1)
    savings_benchmark_low: float = Field(default=0.04, ge=0, le=1)
    savings_benchmark_high: float = Field(default=0.10, ge=0, le=1)
    maturity_score: float = Field(default=2.5, ge=1, le=5)
    goals: Optional[Dict[str, int]] = None
    # Structure: {"cost": 40, "risk": 35, "esg": 25}


class SessionUpdate(BaseModel):
    """Update session parameters."""
    name: Optional[str] = Field(None, max_length=255)
    category_name: Optional[str] = Field(None, max_length=255)
    category_spend: Optional[float] = Field(None, gt=0)
    addressable_spend_pct: Optional[float] = Field(None, ge=0, le=1)
    savings_benchmark_low: Optional[float] = Field(None, ge=0, le=1)
    savings_benchmark_high: Optional[float] = Field(None, ge=0, le=1)
    maturity_score: Optional[float] = Field(None, ge=1, le=5)
    goals: Optional[Dict[str, int]] = None


class AgentLog(BaseModel):
    """Agent execution log entry."""
    timestamp: str
    agent_name: str
    message: str


class CategoryCalculation(BaseModel):
    """Detailed category-level calculation."""
    category_id: str
    category_name: str
    spend: float
    addressable_spend_pct: float
    addressable_spend: float
    savings_benchmark_low: float
    savings_benchmark_high: float
    maturity_score: float
    maturity_adjusted_savings_low: float
    maturity_adjusted_savings_high: float
    confidence_score: float
    confidence_bucket: str
    confidence_adjusted_savings_pct_low: float
    confidence_adjusted_savings_pct_high: float
    confidence_adjusted_savings_low: float
    confidence_adjusted_savings_high: float


class OpportunityCalculation(BaseModel):
    """Detailed opportunity-level calculation."""
    opportunity_id: str
    opportunity_name: str
    lever_theme: str
    maturity_score: float
    savings_benchmark_low: float
    savings_benchmark_high: float
    num_proof_points: int
    low_flag_count: int
    medium_flag_count: int
    high_flag_count: int
    initiative_impact_score: float
    initiative_impact_bucket: str
    intermediate_calc: float
    initiative_weightage: float
    initiative_savings_low: float
    initiative_savings_high: float


class DetailedResults(BaseModel):
    """Complete detailed calculation results."""
    category_calculation: CategoryCalculation
    opportunity_calculations: List[OpportunityCalculation]


class ValidationResults(BaseModel):
    """Validation check results."""
    weightage_sum: float
    savings_match_category: bool


class SessionResponse(BaseModel):
    """Session response with full details."""
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    status: SessionStatus
    status_message: Optional[str] = None

    # Category Info
    category_name: str
    category_spend: float
    addressable_spend_pct: float
    addressable_spend: Optional[float] = None

    # Benchmarks
    savings_benchmark_low: float
    savings_benchmark_high: float
    maturity_score: float

    # Goals
    goals: Optional[Dict[str, int]] = None

    # Results
    savings_summary: Optional[SavingsSummary] = None
    detailed_results: Optional[DetailedResults] = None
    validation: Optional[ValidationResults] = None

    # Agent Logs
    agent_logs: Optional[List[AgentLog]] = None

    # Timestamps
    created_at: datetime
    updated_at: datetime
    processing_started_at: Optional[datetime] = None
    processing_completed_at: Optional[datetime] = None
    processing_duration_seconds: Optional[float] = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_model(cls, session, opportunities=None):
        """Create response from SQLAlchemy model."""
        savings_summary = None
        if session.total_savings_low is not None:
            savings_summary = SavingsSummary(
                total_savings_low=session.total_savings_low,
                total_savings_high=session.total_savings_high,
                confidence_score=session.confidence_score or 0,
                confidence_bucket=session.confidence_bucket or "Low"
            )

        return cls(
            id=session.id,
            user_id=session.user_id,
            name=session.name,
            status=session.status,
            status_message=session.status_message,
            category_name=session.category_name,
            category_spend=session.category_spend,
            addressable_spend_pct=session.addressable_spend_pct,
            addressable_spend=session.addressable_spend,
            savings_benchmark_low=session.savings_benchmark_low,
            savings_benchmark_high=session.savings_benchmark_high,
            maturity_score=session.maturity_score,
            goals=session.goals,
            savings_summary=savings_summary,
            detailed_results=session.detailed_results,
            agent_logs=session.agent_logs,
            created_at=session.created_at,
            updated_at=session.updated_at,
            processing_started_at=session.processing_started_at,
            processing_completed_at=session.processing_completed_at,
            processing_duration_seconds=session.processing_duration_seconds
        )
