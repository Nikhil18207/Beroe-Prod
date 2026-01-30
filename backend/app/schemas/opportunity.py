"""
Opportunity Schemas
Pydantic models for opportunities and proof points.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum
import uuid


class LeverTheme(str, Enum):
    """Opportunity lever themes."""
    VOLUME_BUNDLING = "Volume Bundling"
    TARGET_PRICING = "Target Pricing"
    RISK_MANAGEMENT = "Risk Management"
    RESPEC_PACK = "Re-specification Pack"


class ImpactBucket(str, Enum):
    """Impact classification."""
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


class OpportunityStatus(str, Enum):
    """Opportunity workflow status."""
    POTENTIAL = "potential"
    QUALIFIED = "qualified"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class ProofPointResponse(BaseModel):
    """Proof point evaluation result."""
    id: uuid.UUID
    name: str
    proof_type: str
    impact_flag: Optional[str] = None  # "Low", "Medium", "High", "Not Tested"
    test_score: Optional[float] = None
    test_result: Optional[str] = None
    is_tested: bool = False
    is_validated: bool = False
    insight: Optional[str] = None
    context: Optional[str] = None

    model_config = {"from_attributes": True}


class TestItem(BaseModel):
    """Test description item."""
    text: str
    completed: bool = False


class RecommendationItem(BaseModel):
    """Recommendation item."""
    text: str
    checked: bool = False


class OpportunityCreate(BaseModel):
    """Create a new opportunity (manual addition)."""
    name: str = Field(..., min_length=1, max_length=500)
    lever_theme: LeverTheme
    description: Optional[str] = None
    maturity_score: float = Field(default=2.5, ge=1, le=5)
    savings_benchmark_low: float = Field(default=0.02, ge=0, le=1)
    savings_benchmark_high: float = Field(default=0.05, ge=0, le=1)


class OpportunityUpdate(BaseModel):
    """Update an opportunity."""
    name: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    status: Optional[OpportunityStatus] = None
    maturity_score: Optional[float] = Field(None, ge=1, le=5)
    is_new: Optional[bool] = None


class FlagCounts(BaseModel):
    """Proof point flag counts."""
    low: int = 0
    medium: int = 0
    high: int = 0
    not_tested: int = 0


class OpportunityResponse(BaseModel):
    """Opportunity response schema."""
    id: uuid.UUID
    session_id: uuid.UUID
    name: str
    lever_theme: str
    description: Optional[str] = None

    # Impact Metrics
    impact_score: float
    impact_bucket: str
    weightage: float

    # Savings
    savings_low: float
    savings_high: float

    # Additional Metrics
    effort_estimate: Optional[str] = None
    risk_impact: Optional[str] = None
    esg_impact: Optional[str] = None
    confidence_score: float

    # Proof Points Summary
    num_proof_points: int
    num_validated_proof_points: int = 0
    flag_counts: FlagCounts

    # Status
    status: str
    is_new: bool = True
    questions_to_answer: int = 0

    # Timestamps
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_model(cls, opp):
        """Create response from SQLAlchemy model."""
        flag_counts = FlagCounts(**(opp.flag_counts or {}))
        return cls(
            id=opp.id,
            session_id=opp.session_id,
            name=opp.name,
            lever_theme=opp.lever_theme.value if hasattr(opp.lever_theme, 'value') else opp.lever_theme,
            description=opp.description,
            impact_score=opp.impact_score,
            impact_bucket=opp.impact_bucket.value if hasattr(opp.impact_bucket, 'value') else opp.impact_bucket,
            weightage=opp.weightage,
            savings_low=opp.savings_low,
            savings_high=opp.savings_high,
            effort_estimate=opp.effort_estimate,
            risk_impact=opp.risk_impact,
            esg_impact=opp.esg_impact,
            confidence_score=opp.confidence_score,
            num_proof_points=opp.num_proof_points,
            num_validated_proof_points=opp.num_validated_proof_points,
            flag_counts=flag_counts,
            status=opp.status.value if hasattr(opp.status, 'value') else opp.status,
            is_new=opp.is_new,
            questions_to_answer=opp.questions_to_answer,
            created_at=opp.created_at,
            updated_at=opp.updated_at
        )


class OpportunityDetailResponse(OpportunityResponse):
    """Detailed opportunity response with proof points and generated content."""

    # Proof Points
    proof_points: List[ProofPointResponse] = []

    # Generated Content
    tests: Optional[List[TestItem]] = None
    recommendations: Optional[List[RecommendationItem]] = None
    insights: Optional[List[Dict[str, str]]] = None

    # Maturity
    maturity_score: float

    @classmethod
    def from_model_with_details(cls, opp):
        """Create detailed response from SQLAlchemy model."""
        base = OpportunityResponse.from_model(opp)

        proof_points = [
            ProofPointResponse.from_attributes(pp)
            for pp in opp.proof_points
        ] if opp.proof_points else []

        tests = [TestItem(**t) for t in opp.tests] if opp.tests else None
        recommendations = [RecommendationItem(**r) for r in opp.recommendations] if opp.recommendations else None

        return cls(
            **base.model_dump(),
            proof_points=proof_points,
            tests=tests,
            recommendations=recommendations,
            insights=opp.insights,
            maturity_score=opp.maturity_score
        )


class OpportunityListResponse(BaseModel):
    """List of opportunities with summary."""
    opportunities: List[OpportunityResponse]
    total: int
    qualified_count: int
    potential_count: int
    savings_summary: Optional[Dict[str, float]] = None
    # {"total_low": 0, "total_high": 0}
