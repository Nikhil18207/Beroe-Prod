"""
Opportunity Orchestrator

The Opportunity Orchestrator is responsible for:
1. Routing proof points to the appropriate micro-agents
2. Collecting and aggregating results from all micro-agents
3. Calculating potential savings based on impact scores
4. Ranking opportunities by savings potential

This is the middle layer of the Dual Orchestrator system:
Master Orchestrator → Opportunity Orchestrator → Micro-Agents
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
import pandas as pd
import numpy as np

from app.agents.base_agent import BaseMicroAgent, ProofPointResult, OpportunityResult
from app.agents.proof_points import (
    OpportunityType,
    ImpactFlag,
    PROOF_POINTS,
    get_opportunity_proof_points,
)

# Import agents from new opportunities subfolder structure
from app.agents.opportunities import (
    VolumeBundlingAgent,
    TargetPricingAgent,
    RiskManagementAgent,
    RespecPackAgent,
)


@dataclass
class SavingsCalculation:
    """Savings calculation for an opportunity."""
    opportunity_type: OpportunityType
    addressable_spend: float
    savings_percentage: float
    estimated_savings: float
    confidence_level: str  # high, medium, low
    calculation_basis: str  # explanation of how savings were calculated


@dataclass
class RankedOpportunity:
    """An opportunity ranked by its potential impact."""
    rank: int
    opportunity_type: OpportunityType
    opportunity_name: str
    description: str
    overall_score: float
    impact_level: str  # HIGH, MEDIUM, LOW
    proof_point_results: List[ProofPointResult]
    savings: SavingsCalculation
    key_insights: List[str]
    recommended_actions: List[str]


@dataclass
class OrchestrationResult:
    """Complete result from the Opportunity Orchestrator."""
    category_name: str
    total_spend: float
    total_potential_savings: float
    savings_percentage: float
    ranked_opportunities: List[RankedOpportunity]
    proof_point_summary: Dict[str, Any]
    risk_score: float  # 0-100, from Risk Management analysis
    metadata: Dict[str, Any] = field(default_factory=dict)


class OpportunityOrchestrator:
    """
    Orchestrates the analysis of procurement opportunities.

    Routes proof points to micro-agents, collects results, calculates savings,
    and ranks opportunities by potential impact.
    """

    # =============================================================================
    # CATEGORY LEVEL BENCHMARKS (from Excel screenshot)
    # =============================================================================
    # Category savings benchmark: 4% (low) to 10% (high)
    # Addressable spend: 80%
    # With maturity adjustment (score 2.5): 6.25% to 7.75%
    # With confidence adjustment (56.7% = Medium): 5.38% to 8.62%
    CATEGORY_BENCHMARK = {
        "savings_low": 0.04,       # 4% base low
        "savings_high": 0.10,      # 10% base high
        "addressable_pct": 0.80,   # 80% addressable spend
    }

    # =============================================================================
    # INITIATIVE LEVEL BENCHMARKS (from Excel screenshot)
    # =============================================================================
    # Each initiative has its own savings benchmark range
    SAVINGS_BENCHMARKS = {
        OpportunityType.VOLUME_BUNDLING: {
            # Initiative 1: 0-1% savings benchmark (lower range)
            # Initiative 2: 2-5% savings benchmark (higher range)
            # Combined: using weighted average based on proof points
            ImpactFlag.HIGH: 0.05,    # 5% for high impact
            ImpactFlag.MEDIUM: 0.025,  # 2.5% for medium impact
            ImpactFlag.LOW: 0.01,     # 1% for low impact
        },
        OpportunityType.TARGET_PRICING: {
            # Initiative 3: 1-2% savings benchmark
            ImpactFlag.HIGH: 0.02,    # 2% for high impact
            ImpactFlag.MEDIUM: 0.015,  # 1.5% for medium impact
            ImpactFlag.LOW: 0.01,     # 1% for low impact
        },
        OpportunityType.RISK_MANAGEMENT: {
            # Risk management: cost avoidance model
            ImpactFlag.HIGH: 0.03,    # 3% cost avoidance
            ImpactFlag.MEDIUM: 0.02,  # 2% cost avoidance
            ImpactFlag.LOW: 0.01,     # 1% cost avoidance
        },
        OpportunityType.RESPEC_PACK: {
            # Re-specification Pack: 2-3% savings benchmark
            ImpactFlag.HIGH: 0.03,    # 3% for high impact
            ImpactFlag.MEDIUM: 0.025,  # 2.5% for medium impact
            ImpactFlag.LOW: 0.02,     # 2% for low impact
        },
    }

    # Addressable spend percentages by opportunity
    ADDRESSABLE_SPEND_PCT = {
        OpportunityType.VOLUME_BUNDLING: 0.80,   # 80% addressable (from screenshot)
        OpportunityType.TARGET_PRICING: 0.80,    # 80% addressable
        OpportunityType.RISK_MANAGEMENT: 0.80,   # 80% addressable
        OpportunityType.RESPEC_PACK: 0.75,       # 75% addressable (packaging-focused)
    }

    # =============================================================================
    # IMPACT FLAG SCORING (for Initiative Impact Score calculation)
    # =============================================================================
    # From screenshot: Impact score = weighted sum of proof point flags
    # Low flag = 1 point, Medium flag = 2 points, High flag = 3 points
    # Then divided by total proof points to get score out of 10
    IMPACT_FLAG_SCORES = {
        ImpactFlag.HIGH: 3,
        ImpactFlag.MEDIUM: 2,
        ImpactFlag.LOW: 1,
        ImpactFlag.NOT_TESTED: 0,
    }

    # Impact bucket thresholds (score out of 10)
    IMPACT_BUCKETS = {
        "High": {"min": 7.0, "max": 10.0},    # 7-10 = High impact
        "Medium": {"min": 4.0, "max": 7.0},   # 4-7 = Medium impact
        "Low": {"min": 0.0, "max": 4.0},      # 0-4 = Low impact
    }

    # =============================================================================
    # MATURITY ADJUSTMENT (from Excel screenshot)
    # =============================================================================
    # Maturity score is out of 4
    # Lower maturity = higher savings potential
    # Formula: base_savings * (1 + (4 - maturity_score) / 4 * adjustment_factor)
    MATURITY_ADJUSTMENT = {
        1: 1.75,   # Score 1: highest potential (example: 4% * 1.75 = 7%)
        2: 1.50,   # Score 2: high potential (example from screenshot: maturity 2.5 → ~1.5x)
        2.5: 1.375,  # Score 2.5: from screenshot (6.25% = 4% * 1.5625 ≈ 1.375 adjusted)
        3: 1.25,   # Score 3: medium potential
        4: 1.0,    # Score 4: baseline (mature, less opportunity)
    }

    # =============================================================================
    # CONFIDENCE ADJUSTMENT (from Excel screenshot)
    # =============================================================================
    # Confidence score: percentage of proof points showing meaningful impact
    # Confidence bucket determines range narrowing
    # From screenshot: 56.7% confidence = Medium bucket
    # Medium bucket: 5.38% to 8.62% (narrowed from 6.25% to 7.75%)
    CONFIDENCE_BUCKETS = {
        "High": {"min_score": 0.70, "range_factor": 0.90},    # 70%+ confidence
        "Medium": {"min_score": 0.40, "range_factor": 0.75},  # 40-70% confidence
        "Low": {"min_score": 0.0, "range_factor": 0.60},      # <40% confidence
    }

    # =============================================================================
    # INITIATIVE WEIGHTAGE (from Excel screenshot)
    # =============================================================================
    # Used to distribute total savings across initiatives
    # From screenshot: Init 1 = 0.05, Init 2 = 0.64, Init 3 = 0.31 (sum = 1.0)
    # Weightage based on intermediate calc / sum of all intermediate calcs

    def __init__(self, cache_service: Optional[Any] = None):
        """
        Initialize the orchestrator with micro-agents.
        
        Args:
            cache_service: Optional CacheService for fast metric access.
                          If provided, agents will use cached metrics instead
                          of computing from raw spend_data.
        """
        self.agents: Dict[OpportunityType, BaseMicroAgent] = {
            OpportunityType.VOLUME_BUNDLING: VolumeBundlingAgent(),
            OpportunityType.TARGET_PRICING: TargetPricingAgent(),
            OpportunityType.RISK_MANAGEMENT: RiskManagementAgent(),
            OpportunityType.RESPEC_PACK: RespecPackAgent(),
        }
        self._cache_service = cache_service
    
    def set_cache(self, cache_service: Any, session_id: Any) -> None:
        """
        Set cache service for all agents (Hybrid Architecture).
        Call this before analyze() for instant metric access.
        """
        self._cache_service = cache_service
        for agent in self.agents.values():
            agent.set_cache(cache_service, session_id)

    async def analyze(
        self,
        spend_data: pd.DataFrame,
        category_name: str,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None,
        session_id: Optional[Any] = None
    ) -> OrchestrationResult:
        """
        Run full opportunity analysis on the spend data.

        Args:
            spend_data: DataFrame with spend records (can be None if using cache)
            category_name: Name of the category being analyzed
            category_spend: Total spend for the category
            context_data: Additional context (market data, benchmarks, etc.)
            session_id: Session ID for cache lookups (Hybrid Architecture)

        Returns:
            OrchestrationResult with ranked opportunities and savings calculations
        """
        context = context_data or {}
        context["category_name"] = category_name
        context["category_spend"] = category_spend
        
        # If cache service and session_id provided, set cache on all agents
        if self._cache_service and session_id:
            self.set_cache(self._cache_service, session_id)

        # Run all micro-agents in parallel conceptually
        # (In practice, they're CPU-bound so we run sequentially)
        opportunity_results: Dict[OpportunityType, OpportunityResult] = {}

        for opp_type, agent in self.agents.items():
            result = agent.evaluate_all_proof_points(
                spend_data=spend_data,
                category_spend=category_spend,
                context_data=context
            )
            opportunity_results[opp_type] = result

        # Calculate savings for each opportunity
        savings_by_opportunity: Dict[OpportunityType, SavingsCalculation] = {}
        for opp_type, result in opportunity_results.items():
            savings = self._calculate_savings(
                opportunity_type=opp_type,
                opportunity_result=result,
                category_spend=category_spend
            )
            savings_by_opportunity[opp_type] = savings

        # Create ranked opportunities
        ranked_opportunities = self._rank_opportunities(
            opportunity_results=opportunity_results,
            savings_by_opportunity=savings_by_opportunity
        )

        # Calculate totals
        total_potential_savings = sum(s.estimated_savings for s in savings_by_opportunity.values())
        savings_percentage = (total_potential_savings / category_spend * 100) if category_spend > 0 else 0

        # Extract risk score from Risk Management results
        risk_result = opportunity_results.get(OpportunityType.RISK_MANAGEMENT)
        risk_score = self._calculate_risk_score(risk_result) if risk_result else 50.0

        # Build proof point summary
        proof_point_summary = self._build_proof_point_summary(opportunity_results)

        return OrchestrationResult(
            category_name=category_name,
            total_spend=category_spend,
            total_potential_savings=total_potential_savings,
            savings_percentage=savings_percentage,
            ranked_opportunities=ranked_opportunities,
            proof_point_summary=proof_point_summary,
            risk_score=risk_score,
            metadata={
                "opportunities_analyzed": len(opportunity_results),
                "total_proof_points_tested": sum(
                    len(r.proof_point_results) for r in opportunity_results.values()
                ),
            }
        )

    def _calculate_savings(
        self,
        opportunity_type: OpportunityType,
        opportunity_result: OpportunityResult,
        category_spend: float,
        maturity_score: float = 2.5
    ) -> SavingsCalculation:
        """
        Calculate potential savings for an opportunity.

        Based on Beroe Excel Methodology (from screenshot):

        STEP 1: Count proof points by impact flag (Low, Medium, High)
        STEP 2: Calculate Initiative Impact Score (out of 10)
                Score = (low_count * 1 + medium_count * 2 + high_count * 3) / total_pp * 10/3
        STEP 3: Determine Impact Bucket (Low/Medium/High)
        STEP 4: Calculate Intermediate calc = (savings_high - savings_low) * bucket_factor + savings_low
        STEP 5: Calculate Initiative Weightage = intermediate / sum(all_intermediates)
        STEP 6: Apply to category-level savings

        Example from screenshot:
        - Category spend: $50M, Addressable: 80%, Maturity: 2.5
        - Initiative 2: 2-5% benchmark, 6 PPs (2 Low, 1 Med, 1 High)
        - Impact score: 3.3 → Low bucket
        - Intermediate: 3.13%, Weightage: 0.64
        - Savings: $1.38M - $2.21M
        """

        # Step 1: Get addressable spend
        addressable_pct = self.ADDRESSABLE_SPEND_PCT.get(opportunity_type, 0.80)
        addressable_spend = category_spend * addressable_pct

        # Step 2: Count proof points by impact flag
        low_count = sum(1 for r in opportunity_result.proof_point_results
                       if r.impact_flag == ImpactFlag.LOW and r.is_tested)
        medium_count = sum(1 for r in opportunity_result.proof_point_results
                         if r.impact_flag == ImpactFlag.MEDIUM and r.is_tested)
        high_count = sum(1 for r in opportunity_result.proof_point_results
                        if r.impact_flag == ImpactFlag.HIGH and r.is_tested)
        total_tested = low_count + medium_count + high_count

        # Step 3: Calculate Initiative Impact Score (out of 10)
        # Formula: (low*1 + medium*2 + high*3) / total * (10/3) to normalize to 0-10
        if total_tested > 0:
            raw_score = (low_count * 1 + medium_count * 2 + high_count * 3)
            # Normalize: max possible = total * 3, so score = raw / (total * 3) * 10
            impact_score = (raw_score / (total_tested * 3)) * 10
        else:
            impact_score = 5.0  # Default to medium if no tested points

        # Step 4: Determine Impact Bucket
        if impact_score >= self.IMPACT_BUCKETS["High"]["min"]:
            impact_bucket = "High"
            bucket_factor = 0.80  # Use more of the range
        elif impact_score >= self.IMPACT_BUCKETS["Medium"]["min"]:
            impact_bucket = "Medium"
            bucket_factor = 0.50  # Use middle of range
        else:
            impact_bucket = "Low"
            bucket_factor = 0.25  # Use lower end of range

        # Step 5: Get benchmark range for this opportunity
        benchmarks = self.SAVINGS_BENCHMARKS.get(opportunity_type, {})
        savings_low = benchmarks.get(ImpactFlag.LOW, 0.01)
        savings_high = benchmarks.get(ImpactFlag.HIGH, 0.05)

        # Step 6: Calculate intermediate savings percentage
        # intermediate = savings_low + (savings_high - savings_low) * bucket_factor
        intermediate_pct = savings_low + (savings_high - savings_low) * bucket_factor

        # Step 7: Apply maturity adjustment
        # From screenshot: maturity 2.5 with 4-10% benchmark → 6.25-7.75%
        # This suggests maturity factor is applied after intermediate calc
        maturity_multiplier = self._get_maturity_multiplier(maturity_score)
        maturity_adj_pct = intermediate_pct * maturity_multiplier

        # Step 8: Calculate confidence score and bucket
        tested_count = sum(1 for r in opportunity_result.proof_point_results if r.is_tested)
        total_count = len(opportunity_result.proof_point_results)
        confidence_score = tested_count / total_count if total_count > 0 else 0

        # Determine confidence bucket
        if confidence_score >= self.CONFIDENCE_BUCKETS["High"]["min_score"]:
            confidence_bucket = "High"
            range_factor = self.CONFIDENCE_BUCKETS["High"]["range_factor"]
        elif confidence_score >= self.CONFIDENCE_BUCKETS["Medium"]["min_score"]:
            confidence_bucket = "Medium"
            range_factor = self.CONFIDENCE_BUCKETS["Medium"]["range_factor"]
        else:
            confidence_bucket = "Low"
            range_factor = self.CONFIDENCE_BUCKETS["Low"]["range_factor"]

        # Step 9: Apply confidence adjustment to narrow the range
        # Final savings = maturity_adj * range_factor
        final_savings_pct_low = maturity_adj_pct * range_factor
        final_savings_pct_high = maturity_adj_pct * (2 - range_factor)  # Inverse for high

        # Use midpoint as the estimated savings percentage
        final_savings_pct = (final_savings_pct_low + final_savings_pct_high) / 2

        # Ensure reasonable bounds (0.5% - 12%)
        final_savings_pct = max(0.005, min(0.12, final_savings_pct))

        # Step 10: Calculate estimated savings
        estimated_savings_low = addressable_spend * final_savings_pct_low
        estimated_savings_high = addressable_spend * final_savings_pct_high
        estimated_savings = addressable_spend * final_savings_pct

        return SavingsCalculation(
            opportunity_type=opportunity_type,
            addressable_spend=addressable_spend,
            savings_percentage=final_savings_pct * 100,
            estimated_savings=estimated_savings,
            confidence_level=confidence_bucket.lower(),
            calculation_basis=(
                f"Impact score: {impact_score:.1f}/10 ({impact_bucket}), "
                f"Proof points: {low_count}L/{medium_count}M/{high_count}H, "
                f"Maturity: {maturity_score}, "
                f"Range: ${estimated_savings_low:,.0f} - ${estimated_savings_high:,.0f}"
            )
        )

    def _get_maturity_multiplier(self, maturity_score: float) -> float:
        """Get maturity multiplier based on score (1-4 scale)."""
        # Interpolate for non-integer scores
        if maturity_score <= 1:
            return self.MATURITY_ADJUSTMENT[1]
        elif maturity_score >= 4:
            return self.MATURITY_ADJUSTMENT[4]

        # Linear interpolation between defined points
        lower = int(maturity_score)
        upper = lower + 1
        fraction = maturity_score - lower

        lower_mult = self.MATURITY_ADJUSTMENT.get(lower, 1.25)
        upper_mult = self.MATURITY_ADJUSTMENT.get(upper, 1.0)

        return lower_mult + (upper_mult - lower_mult) * fraction

    def _rank_opportunities(
        self,
        opportunity_results: Dict[OpportunityType, OpportunityResult],
        savings_by_opportunity: Dict[OpportunityType, SavingsCalculation]
    ) -> List[RankedOpportunity]:
        """Rank opportunities by their potential impact and savings."""

        ranked_list = []

        for opp_type, result in opportunity_results.items():
            savings = savings_by_opportunity[opp_type]
            agent = self.agents[opp_type]

            # Determine overall impact level
            if result.overall_score >= 0.7:
                impact_level = "HIGH"
            elif result.overall_score >= 0.4:
                impact_level = "MEDIUM"
            else:
                impact_level = "LOW"

            # Extract key insights from proof point results
            key_insights = [
                r.insight for r in result.proof_point_results
                if r.is_tested and r.impact_flag in [ImpactFlag.HIGH, ImpactFlag.MEDIUM]
            ][:5]  # Top 5 insights

            # Generate recommended actions based on opportunity type
            recommended_actions = self._generate_recommendations(opp_type, result)

            ranked_list.append(RankedOpportunity(
                rank=0,  # Will be set after sorting
                opportunity_type=opp_type,
                opportunity_name=agent.name,
                description=agent.description,
                overall_score=result.overall_score,
                impact_level=impact_level,
                proof_point_results=result.proof_point_results,
                savings=savings,
                key_insights=key_insights,
                recommended_actions=recommended_actions
            ))

        # Sort by estimated savings (descending)
        ranked_list.sort(key=lambda x: x.savings.estimated_savings, reverse=True)

        # Assign ranks
        for i, opp in enumerate(ranked_list):
            opp.rank = i + 1

        return ranked_list

    def _generate_recommendations(
        self,
        opportunity_type: OpportunityType,
        result: OpportunityResult
    ) -> List[str]:
        """Generate actionable recommendations based on analysis results."""

        recommendations = []

        # Get high impact proof points
        high_impact = [r for r in result.proof_point_results if r.impact_flag == ImpactFlag.HIGH]
        medium_impact = [r for r in result.proof_point_results if r.impact_flag == ImpactFlag.MEDIUM]

        if opportunity_type == OpportunityType.VOLUME_BUNDLING:
            if any(r.proof_point_code == "PP_TAIL_SPEND" for r in high_impact):
                recommendations.append("Consolidate tail spend with strategic suppliers to reduce transaction costs")
            if any(r.proof_point_code == "PP_SUPPLIER_COUNT" for r in high_impact + medium_impact):
                recommendations.append("Reduce supplier base through strategic sourcing initiatives")
            if any(r.proof_point_code == "PP_PRICE_VARIANCE" for r in high_impact):
                recommendations.append("Standardize specifications to reduce price variance across items")
            if any(r.proof_point_code == "PP_REGIONAL_SPEND" for r in high_impact):
                recommendations.append("Explore regional bundling opportunities to leverage volume")
            if not recommendations:
                recommendations.append("Review supplier agreements for volume discount opportunities")

        elif opportunity_type == OpportunityType.TARGET_PRICING:
            if any(r.proof_point_code == "PP_PRICE_VARIANCE" for r in high_impact):
                recommendations.append("Use best-in-class prices as negotiation targets across all suppliers")
            if any(r.proof_point_code == "PP_UNIT_PRICE" for r in high_impact + medium_impact):
                recommendations.append("Benchmark unit prices against market rates and renegotiate")
            if any(r.proof_point_code == "PP_COST_STRUCTURE" for r in high_impact):
                recommendations.append("Implement commodity index-based pricing for raw material components")
            if any(r.proof_point_code == "PP_TARIFF_RATE" for r in high_impact):
                recommendations.append("Optimize sourcing mix to minimize tariff exposure")
            if not recommendations:
                recommendations.append("Conduct should-cost analysis to establish negotiation targets")

        elif opportunity_type == OpportunityType.RISK_MANAGEMENT:
            if any(r.proof_point_code == "PP_SINGLE_SOURCING" for r in high_impact):
                recommendations.append("Qualify alternative suppliers for single-sourced items")
            if any(r.proof_point_code == "PP_SUPPLIER_CONCENTRATION" for r in high_impact):
                recommendations.append("Diversify supplier base to reduce concentration risk")
            if any(r.proof_point_code == "PP_GEO_POLITICAL" for r in high_impact + medium_impact):
                recommendations.append("Develop contingency sourcing plans for high-risk regions")
            if any(r.proof_point_code == "PP_INFLATION" for r in high_impact):
                recommendations.append("Implement price escalation clauses in contracts")
            if any(r.proof_point_code == "PP_EXCHANGE_RATE" for r in high_impact):
                recommendations.append("Establish currency hedging strategy for foreign currency exposure")
            if not recommendations:
                recommendations.append("Conduct supplier risk assessment and develop mitigation plans")

        return recommendations[:4]  # Return top 4 recommendations

    def _calculate_risk_score(self, risk_result: OpportunityResult) -> float:
        """Calculate overall risk score (0-100) from Risk Management results."""

        if not risk_result.proof_point_results:
            return 50.0  # Default moderate risk

        # Weight risk proof points
        risk_weights = {
            "PP_SINGLE_SOURCING": 0.20,
            "PP_SUPPLIER_CONCENTRATION": 0.15,
            "PP_CATEGORY_RISK": 0.15,
            "PP_INFLATION": 0.15,
            "PP_EXCHANGE_RATE": 0.10,
            "PP_GEO_POLITICAL": 0.15,
            "PP_SUPPLIER_RISK_RATING": 0.10,
        }

        impact_to_risk = {
            ImpactFlag.HIGH: 80,
            ImpactFlag.MEDIUM: 50,
            ImpactFlag.LOW: 20,
            ImpactFlag.NOT_TESTED: 50,  # Assume moderate if not tested
        }

        weighted_risk = 0
        total_weight = 0

        for pp_result in risk_result.proof_point_results:
            weight = risk_weights.get(pp_result.proof_point_code, 0.1)
            risk_value = impact_to_risk.get(pp_result.impact_flag, 50)
            weighted_risk += risk_value * weight
            total_weight += weight

        return weighted_risk / total_weight if total_weight > 0 else 50.0

    def _build_proof_point_summary(
        self,
        opportunity_results: Dict[OpportunityType, OpportunityResult]
    ) -> Dict[str, Any]:
        """Build a summary of all proof point results."""

        all_results = []
        for opp_type, result in opportunity_results.items():
            for pp_result in result.proof_point_results:
                all_results.append({
                    "opportunity": opp_type.value,
                    "code": pp_result.proof_point_code,
                    "name": pp_result.proof_point_name,
                    "impact": pp_result.impact_flag.value,
                    "score": pp_result.test_score,
                    "insight": pp_result.insight,
                    "tested": pp_result.is_tested,
                })

        # Count by impact
        impact_counts = {
            "high": sum(1 for r in all_results if r["impact"] == "high" and r["tested"]),
            "medium": sum(1 for r in all_results if r["impact"] == "medium" and r["tested"]),
            "low": sum(1 for r in all_results if r["impact"] == "low" and r["tested"]),
            "not_tested": sum(1 for r in all_results if not r["tested"]),
        }

        return {
            "total_proof_points": len(all_results),
            "tested_count": sum(1 for r in all_results if r["tested"]),
            "impact_distribution": impact_counts,
            "details": all_results,
        }

    async def analyze_single_opportunity(
        self,
        opportunity_type: OpportunityType,
        spend_data: pd.DataFrame,
        category_name: str,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> RankedOpportunity:
        """Analyze a single opportunity type (for focused analysis)."""

        if opportunity_type not in self.agents:
            raise ValueError(f"Unknown opportunity type: {opportunity_type}")

        agent = self.agents[opportunity_type]
        context = context_data or {}
        context["category_name"] = category_name

        result = agent.evaluate_all_proof_points(
            spend_data=spend_data,
            category_spend=category_spend,
            context_data=context
        )

        savings = self._calculate_savings(
            opportunity_type=opportunity_type,
            opportunity_result=result,
            category_spend=category_spend
        )

        # Determine impact level
        if result.overall_score >= 0.7:
            impact_level = "HIGH"
        elif result.overall_score >= 0.4:
            impact_level = "MEDIUM"
        else:
            impact_level = "LOW"

        key_insights = [
            r.insight for r in result.proof_point_results
            if r.is_tested and r.impact_flag in [ImpactFlag.HIGH, ImpactFlag.MEDIUM]
        ][:5]

        recommended_actions = self._generate_recommendations(opportunity_type, result)

        return RankedOpportunity(
            rank=1,
            opportunity_type=opportunity_type,
            opportunity_name=agent.name,
            description=agent.description,
            overall_score=result.overall_score,
            impact_level=impact_level,
            proof_point_results=result.proof_point_results,
            savings=savings,
            key_insights=key_insights,
            recommended_actions=recommended_actions
        )
