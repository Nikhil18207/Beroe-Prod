"""
Base Micro-Agent Class
Abstract base class for opportunity micro-agents.
Each micro-agent evaluates proof points in its own context.

HYBRID ARCHITECTURE INTEGRATION:
- Agents can use CacheService for pre-computed metrics (fast path)
- Falls back to real-time computation if cache miss (slow path)
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID
import pandas as pd

from app.agents.proof_points import (
    ProofPointDefinition,
    ProofPointContext,
    OpportunityType,
    ImpactFlag,
    PROOF_POINTS,
    OPPORTUNITY_PROOF_POINTS,
    OPPORTUNITY_BENCHMARKS,
)


# Type alias for cache service (avoid circular import)
CacheServiceType = Any


@dataclass
class ProofPointResult:
    """Result of evaluating a single proof point."""
    proof_point_code: str
    proof_point_name: str
    opportunity: OpportunityType
    impact_flag: ImpactFlag
    test_score: float  # 0.0 to 1.0
    insight: str
    raw_data: Dict[str, Any] = field(default_factory=dict)
    is_tested: bool = True
    evaluated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class OpportunityResult:
    """Complete result for an opportunity."""
    opportunity_type: OpportunityType
    name: str
    description: str
    proof_point_results: List[ProofPointResult]

    # Calculated metrics
    impact_score: float = 0.0  # Weighted score from proof points
    impact_bucket: str = "Low"  # "Low", "Medium", "High"

    # Flag counts
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    not_tested_count: int = 0

    # Savings
    savings_low: float = 0.0
    savings_high: float = 0.0
    weightage: float = 0.0

    # Metadata
    confidence_score: float = 0.0
    effort_estimate: str = "3-6 months"

    def calculate_metrics(self, addressable_spend: float) -> None:
        """Calculate impact score and savings from proof point results."""
        # Count flags
        self.high_count = sum(1 for pp in self.proof_point_results if pp.impact_flag == ImpactFlag.HIGH)
        self.medium_count = sum(1 for pp in self.proof_point_results if pp.impact_flag == ImpactFlag.MEDIUM)
        self.low_count = sum(1 for pp in self.proof_point_results if pp.impact_flag == ImpactFlag.LOW)
        self.not_tested_count = sum(1 for pp in self.proof_point_results if pp.impact_flag == ImpactFlag.NOT_TESTED)

        total_tested = self.high_count + self.medium_count + self.low_count

        if total_tested == 0:
            self.impact_score = 0.0
            self.impact_bucket = "Low"
            return

        # Calculate weighted impact score (HIGH=3, MEDIUM=2, LOW=1)
        weighted_sum = (self.high_count * 3) + (self.medium_count * 2) + (self.low_count * 1)
        max_possible = total_tested * 3
        self.impact_score = (weighted_sum / max_possible) * 10  # Scale to 0-10

        # Determine bucket
        if self.impact_score >= 7:
            self.impact_bucket = "High"
        elif self.impact_score >= 4:
            self.impact_bucket = "Medium"
        else:
            self.impact_bucket = "Low"

        # Calculate confidence based on tested percentage
        total_pp = len(self.proof_point_results)
        self.confidence_score = total_tested / total_pp if total_pp > 0 else 0.0

        # Get benchmarks
        benchmarks = OPPORTUNITY_BENCHMARKS.get(self.opportunity_type, {})
        benchmark_low = benchmarks.get("savings_benchmark_low", 0.02)
        benchmark_high = benchmarks.get("savings_benchmark_high", 0.05)
        self.effort_estimate = benchmarks.get("effort_months", "3-6 months")

        # Adjust savings by impact score (higher impact = closer to high benchmark)
        impact_multiplier = self.impact_score / 10
        effective_benchmark_low = benchmark_low * (0.5 + 0.5 * impact_multiplier)
        effective_benchmark_high = benchmark_high * (0.5 + 0.5 * impact_multiplier)

        # Calculate savings
        self.savings_low = addressable_spend * effective_benchmark_low
        self.savings_high = addressable_spend * effective_benchmark_high


class BaseMicroAgent(ABC):
    """
    Abstract base class for micro-agents.
    Each micro-agent represents one opportunity and evaluates proof points in its context.
    
    HYBRID ARCHITECTURE:
    - If cache_service is provided, uses pre-computed metrics (instant)
    - Falls back to spend_data computation if no cache (slower)
    """

    def __init__(self, opportunity_type: OpportunityType):
        self.opportunity_type = opportunity_type
        self.proof_point_codes = OPPORTUNITY_PROOF_POINTS.get(opportunity_type, [])
        self.benchmarks = OPPORTUNITY_BENCHMARKS.get(opportunity_type, {})
        self._cache_service: Optional[CacheServiceType] = None
        self._session_id: Optional[UUID] = None
        self._cached_metrics: Optional[Dict[str, float]] = None
    
    def set_cache(
        self,
        cache_service: CacheServiceType,
        session_id: UUID
    ) -> None:
        """
        Set cache service for fast metric access.
        Call this before evaluate_all_proof_points for best performance.
        """
        self._cache_service = cache_service
        self._session_id = session_id
        self._cached_metrics = None  # Will be loaded on first access
    
    async def _get_cached_metric(self, metric_name: str) -> Optional[float]:
        """Get a metric from cache if available."""
        if not self._cache_service or not self._session_id:
            return None
        
        # Load all metrics on first access
        if self._cached_metrics is None:
            self._cached_metrics = await self._cache_service.get_all_metrics(self._session_id)
            # Handle nested dict format
            if self._cached_metrics:
                flat = {}
                for name, val in self._cached_metrics.items():
                    if isinstance(val, dict):
                        flat[name] = val.get("value", 0)
                    else:
                        flat[name] = val
                self._cached_metrics = flat
        
        return self._cached_metrics.get(metric_name) if self._cached_metrics else None

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable name of the opportunity."""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Description of what this opportunity analyzes."""
        pass

    @abstractmethod
    def evaluate_proof_point(
        self,
        proof_point: ProofPointDefinition,
        spend_data: pd.DataFrame,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> ProofPointResult:
        """
        Evaluate a single proof point in this opportunity's context.

        Args:
            proof_point: The proof point definition
            spend_data: Parsed spend DataFrame
            category_spend: Total category spend
            context_data: Additional context (market data, etc.)

        Returns:
            ProofPointResult with impact flag and insight
        """
        pass

    def evaluate_all_proof_points(
        self,
        spend_data: pd.DataFrame,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> OpportunityResult:
        """
        Evaluate all proof points for this opportunity.

        Args:
            spend_data: Parsed spend DataFrame
            category_spend: Total category spend
            context_data: Additional context

        Returns:
            OpportunityResult with all evaluations and calculated metrics
        """
        results = []

        for pp_code in self.proof_point_codes:
            proof_point = PROOF_POINTS.get(pp_code)
            if not proof_point:
                continue

            # Check if we have the required data
            if not self._has_required_data(proof_point, spend_data):
                results.append(ProofPointResult(
                    proof_point_code=pp_code,
                    proof_point_name=proof_point.name,
                    opportunity=self.opportunity_type,
                    impact_flag=ImpactFlag.NOT_TESTED,
                    test_score=0.0,
                    insight=f"Required data fields not available: {proof_point.required_data_fields}",
                    is_tested=False
                ))
                continue

            # Evaluate the proof point
            result = self.evaluate_proof_point(
                proof_point,
                spend_data,
                category_spend,
                context_data
            )
            results.append(result)

        # Create opportunity result
        addressable_spend = category_spend * 0.8  # Default 80% addressable
        if context_data and "addressable_spend" in context_data:
            addressable_spend = context_data["addressable_spend"]

        opp_result = OpportunityResult(
            opportunity_type=self.opportunity_type,
            name=self.name,
            description=self.description,
            proof_point_results=results
        )
        opp_result.calculate_metrics(addressable_spend)

        return opp_result

    def _has_required_data(
        self,
        proof_point: ProofPointDefinition,
        spend_data: pd.DataFrame
    ) -> bool:
        """Check if spend data has required columns for this proof point."""
        if spend_data is None or spend_data.empty:
            return False

        columns_lower = [c.lower() for c in spend_data.columns]

        # Map required fields to potential column names
        field_mappings = {
            "supplier": ["supplier", "supplier_name", "vendor", "vendor_name"],
            "spend": ["spend", "spend_amount", "amount", "spend_usd", "value"],
            "country": ["country", "region", "location", "geography"],
            "category": ["category", "category_name", "product_category"],
            "price": ["price", "unit_price", "price_per_unit", "rate"],
            "volume": ["volume", "quantity", "qty", "units"],
        }

        for required_field in proof_point.required_data_fields:
            possible_columns = field_mappings.get(required_field, [required_field])
            found = any(col in columns_lower for col in possible_columns)
            if not found:
                return False

        return True

    def _get_column(self, spend_data: pd.DataFrame, field: str) -> Optional[str]:
        """Get the actual column name for a field type."""
        field_mappings = {
            "supplier": ["supplier", "supplier_name", "vendor", "vendor_name"],
            "spend": ["spend", "spend_amount", "amount", "spend_usd", "value"],
            "country": ["country", "region", "location", "geography"],
            "category": ["category", "category_name", "product_category"],
            "price": ["price", "unit_price", "price_per_unit", "rate"],
            "volume": ["volume", "quantity", "qty", "units"],
        }

        possible_columns = field_mappings.get(field, [field])

        for col in spend_data.columns:
            if col.lower() in possible_columns:
                return col

        return None

    def _determine_impact(self, score: float) -> ImpactFlag:
        """Determine impact flag from a 0-1 score."""
        if score >= 0.7:
            return ImpactFlag.HIGH
        elif score >= 0.4:
            return ImpactFlag.MEDIUM
        else:
            return ImpactFlag.LOW

    def _not_tested_result(
        self,
        proof_point: ProofPointDefinition,
        reason: str
    ) -> ProofPointResult:
        """Create a NOT_TESTED result for a proof point."""
        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=ImpactFlag.NOT_TESTED,
            test_score=0.0,
            insight=reason,
            is_tested=False
        )
    
    def _create_result(
        self,
        proof_point: ProofPointDefinition,
        score: float,
        insight: str,
        raw_data: Optional[Dict[str, Any]] = None
    ) -> ProofPointResult:
        """Create a proof point result with automatic impact flag."""
        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=self._determine_impact(score),
            test_score=score,
            insight=insight,
            raw_data=raw_data or {},
            is_tested=True
        )


# =============================================================================
# PROOF POINT TO CACHED METRIC MAPPING
# =============================================================================
# Maps proof point codes to the cached metrics they need.
# Used by agents for fast lookups instead of re-computing from spend_data.

PROOF_POINT_METRIC_MAP: Dict[str, List[str]] = {
    # Volume Bundling Proof Points
    "PP_REGIONAL_SPEND": ["regional_concentration", "geo_concentration_risk"],
    "PP_TAIL_SPEND": ["tail_spend_percentage", "supplier_count"],
    "PP_VOLUME_LEVERAGE": ["hhi_index", "top_3_concentration", "top_5_concentration"],
    "PP_PRICE_VARIANCE": ["price_variance"],
    "PP_AVG_SPEND_SUPPLIER": ["total_spend", "supplier_count"],
    "PP_MARKET_CONSOLIDATION": ["hhi_index", "top_3_concentration"],
    "PP_SUPPLIER_LOCATION": ["geo_concentration_risk", "regional_concentration"],
    "PP_SUPPLIER_RISK_RATING": ["avg_supplier_quality", "high_risk_supplier_spend"],
    
    # Target Pricing Proof Points
    "PP_CONTRACT_PRICING": ["contract_coverage", "price_variance"],
    "PP_PAYMENT_TERMS": ["payment_term_optimization"],
    "PP_PRICE_ESCALATION": ["price_escalation_exposure"],
    "PP_BENCHMARK_PRICING": ["price_variance"],
    
    # Risk Management Proof Points
    "PP_SINGLE_SOURCE": ["single_source_spend", "top_3_concentration"],
    "PP_GEO_RISK": ["geo_concentration_risk", "regional_concentration"],
    "PP_SUPPLIER_HEALTH": ["avg_supplier_quality", "high_risk_supplier_spend"],
    "PP_CONTRACT_EXPIRY": ["contracts_expiring_90_days"],
    "PP_COMPLIANCE": ["non_certified_spend"],
    "PP_SUSTAINABILITY": ["diverse_supplier_spend", "sustainability_score"],
    
    # Re-specification Pack Proof Points
    "PP_COST_STRUCTURE": ["commodity_percentage", "raw_material_exposure"],
    "PP_EXPORT_DATA": ["export_market_coverage", "global_spec_compliance"],
}
