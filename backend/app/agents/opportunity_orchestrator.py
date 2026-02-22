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
    ProofPointDefinition,
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
class RecommendationItem:
    """A recommendation with action text and detailed reasoning."""
    text: str  # The action/recommendation statement
    reason: str  # 4 lines explaining WHY: current state, business impact, specific action, expected outcome


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
    recommended_actions: List[RecommendationItem]  # Changed from List[str] to include reasoning


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

    def _normalize_category(self, category: str) -> str:
        """
        Normalize category name for flexible matching.
        Handles: palm, palm oil, palm oils, Palm Oil, PALM OIL, etc.
        """
        if not category:
            return ""

        # Lowercase and strip whitespace
        normalized = category.lower().strip()

        # Remove common suffixes for base matching
        # "palm oils" -> "palm oil" -> "palm"
        if normalized.endswith('oils'):
            normalized = normalized[:-1]  # oils -> oil

        return normalized

    def _categories_match(self, user_category: str, data_category: str) -> bool:
        """
        Smart category matching that handles variations.

        Examples that should match:
        - "palm" matches "Palm Oil", "palm oils", "PALM OIL"
        - "palm oil" matches "palm oils", "Palm Oil", "PALM"
        - "edible oil" matches "Edible Oils", "edible-oil"
        """
        if not user_category or not data_category:
            return False

        # Normalize both
        user_norm = self._normalize_category(user_category)
        data_norm = self._normalize_category(data_category)

        # Exact match after normalization
        if user_norm == data_norm:
            return True

        # Check if one contains the other (handles "palm" matching "palm oil")
        if user_norm in data_norm or data_norm in user_norm:
            return True

        # Word-based matching: extract key words and check overlap
        # "palm oil" -> ["palm", "oil"], "palm oils" -> ["palm", "oil"]
        def get_words(s: str) -> set:
            # Split on spaces, hyphens, underscores
            import re
            words = set(re.split(r'[\s\-_]+', s))
            # Also add singular versions
            singular_words = set()
            for w in words:
                if w.endswith('s') and len(w) > 2:
                    singular_words.add(w[:-1])
            return words | singular_words

        user_words = get_words(user_norm)
        data_words = get_words(data_norm)

        # If the main keyword matches (first word or most significant word)
        # "palm" should match anything with "palm"
        if user_words & data_words:  # Any intersection
            return True

        return False

    def _filter_by_category(self, spend_data: pd.DataFrame, category_name: str) -> pd.DataFrame:
        """
        Filter spend_data to only include rows matching the selected category.

        This ensures ALL proof points (PP1-PP8) analyze only the selected category,
        not all data from a multi-category file.

        Smart matching handles:
        - "palm" matches "Palm Oil", "palm oils", "PALM OIL"
        - "palm oil" matches "palm oils", "Palm Oil"
        - Case insensitive
        - Plural/singular variations

        Args:
            spend_data: Full DataFrame from uploaded file
            category_name: Selected category to analyze

        Returns:
            Filtered DataFrame with only rows matching the category
        """
        import structlog
        logger = structlog.get_logger()

        if spend_data is None or spend_data.empty:
            return spend_data

        if not category_name:
            return spend_data

        # Find category column (case-insensitive)
        category_col = None
        for col in spend_data.columns:
            if col.lower() in ["category", "category_name", "product_category"]:
                category_col = col
                break

        if not category_col:
            # No category column found - assume single-category file
            logger.info(f"[CategoryFilter] No category column found, using all data")
            return spend_data

        # Use smart category matching
        mask = spend_data[category_col].apply(
            lambda x: self._categories_match(category_name, str(x) if pd.notna(x) else "")
        )
        filtered = spend_data[mask]

        # Log filtering result
        if not filtered.empty:
            matched_categories = filtered[category_col].unique()
            logger.info(f"[CategoryFilter] Matched '{category_name}' -> {list(matched_categories)[:3]} ({len(filtered)} rows)")
        else:
            # If still empty, check how many unique categories exist
            unique_cats = spend_data[category_col].unique()
            logger.warning(f"[CategoryFilter] No match for '{category_name}'. Data has: {list(unique_cats)[:5]}")
            # Return original data only if it appears to be single-category
            if len(unique_cats) == 1:
                logger.info(f"[CategoryFilter] Single-category file detected, using all data")
                return spend_data
            # For multi-category files with no match, return empty to prevent wrong totals
            logger.warning(f"[CategoryFilter] Multi-category file but no match - returning empty DataFrame")
            return spend_data.head(0)  # Return empty DataFrame with same structure

        return filtered
    
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

        # =============================================================================
        # CATEGORY FILTERING: Filter spend_data to only include selected category
        # =============================================================================
        # This ensures ALL proof points (PP1-PP8) analyze only the selected category
        filtered_spend_data = self._filter_by_category(spend_data, category_name)

        # Run all micro-agents in parallel conceptually
        # (In practice, they're CPU-bound so we run sequentially)
        opportunity_results: Dict[OpportunityType, OpportunityResult] = {}

        for opp_type, agent in self.agents.items():
            result = agent.evaluate_all_proof_points(
                spend_data=filtered_spend_data,
                category_spend=category_spend,
                context_data=context
            )
            opportunity_results[opp_type] = result

        # =============================================================================
        # PP8 ENHANCEMENT: Real-time OpenAI Supplier Intelligence
        # =============================================================================
        # PP8 (Supplier Risk Rating) is evaluated using OpenAI GPT-4o-mini
        # for real-time supplier analysis instead of formula-based assessment.
        # This enhances Volume Bundling and Risk Management opportunities.
        try:
            await self._enhance_pp8_with_supplier_intelligence(
                opportunity_results=opportunity_results,
                spend_data=filtered_spend_data,  # Use filtered data
                context_data=context
            )
        except Exception as e:
            # Log but don't fail - formula fallback already applied
            import structlog
            logger = structlog.get_logger()
            logger.warning(f"PP8 enhancement failed, using formula fallback: {e}")

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
            if result.impact_score >= 0.7:
                impact_level = "HIGH"
            elif result.impact_score >= 0.4:
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
                overall_score=result.impact_score,
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
    ) -> List[RecommendationItem]:
        """
        Generate actionable recommendations with comprehensive 4-line reasoning.

        Returns RecommendationItem objects with:
        - text: Clear, concise action statement
        - reason: 4 lines of in-depth reasoning covering:
          Line 1: Current state/problem with specific data
          Line 2: Why this matters (business impact)
          Line 3: What specifically to do
          Line 4: Expected outcome/benefit with quantification
        """

        recommendations: List[RecommendationItem] = []

        # Build lookup for proof point data
        pp_lookup = {r.proof_point_code: r for r in result.proof_point_results}

        # Get proof points by impact level
        high_impact = [r for r in result.proof_point_results if r.impact_flag == ImpactFlag.HIGH]
        medium_impact = [r for r in result.proof_point_results if r.impact_flag == ImpactFlag.MEDIUM]
        low_impact = [r for r in result.proof_point_results if r.impact_flag == ImpactFlag.LOW]

        # Combined list for checking (HIGH or MEDIUM = opportunity, LOW = maintenance)
        high_medium = high_impact + medium_impact
        all_tested = high_medium + low_impact

        if opportunity_type == OpportunityType.VOLUME_BUNDLING:
            # PP2: Tail Spend
            if any(r.proof_point_code == "PP_TAIL_SPEND" for r in high_medium):
                pp = pp_lookup.get("PP_TAIL_SPEND")
                tail_pct = pp.raw_data.get("tail_spend_pct", 30) if pp and pp.raw_data else 30
                tail_count = pp.raw_data.get("tail_supplier_count", 0) if pp and pp.raw_data else 0
                recommendations.append(RecommendationItem(
                    text="Consolidate tail spend with strategic anchor suppliers",
                    reason=(
                        f"Your tail spend represents {tail_pct:.0f}% of category spend scattered across {tail_count} small suppliers - "
                        f"each one requiring separate purchase orders, invoices, quality inspections, and relationship management with zero negotiating leverage. "
                        f"These suppliers aren't strategic to you, and you're not strategic to them, resulting in inflated prices and inconsistent service. "
                        f"Redirect this fragmented volume to 2-3 anchor suppliers who will compete for the business, reducing administrative burden by 40-60% "
                        f"while unlocking volume-based discounts of 5-8% and improving supply chain reliability through deeper partnerships."
                    )
                ))

            # PP3: Volume Leverage (Top 3 based)
            if any(r.proof_point_code == "PP_VOLUME_LEVERAGE" for r in high_medium):
                pp = pp_lookup.get("PP_VOLUME_LEVERAGE")
                top_3_pct = pp.raw_data.get("top_3_pct", 0) if pp and pp.raw_data else 0
                supplier_count = pp.raw_data.get("supplier_count", 0) if pp and pp.raw_data else 0
                recommendations.append(RecommendationItem(
                    text="Reduce supplier fragmentation through strategic sourcing",
                    reason=(
                        f"Your top 3 suppliers control only {top_3_pct:.0f}% of spend, with purchases spread across {supplier_count} different suppliers - "
                        f"that's {supplier_count} separate negotiations, {supplier_count} different price points, and fragmented volume that no single supplier values enough to discount. "
                        f"This fragmentation destroys your leverage: suppliers know you can't consolidate enough volume to hurt them if they don't compete on price. "
                        f"Launch a strategic sourcing initiative to consolidate 70%+ of spend with 5-7 core suppliers, creating partnerships where your volume matters. "
                        f"This typically yields 3-8% cost reduction plus improved service levels, innovation sharing, and supply security from relationships that matter to both sides."
                    )
                ))

            # PP4: Price Variance (check HIGH or MEDIUM)
            if any(r.proof_point_code == "PP_PRICE_VARIANCE" for r in high_medium):
                pp = pp_lookup.get("PP_PRICE_VARIANCE")
                if pp and pp.raw_data:
                    if pp.raw_data.get("analysis_type") == "market_comparison":
                        deviation = pp.raw_data.get("overall_deviation_pct", 0)
                        months = pp.raw_data.get("months_analyzed", 0)
                        avg_market = pp.raw_data.get("avg_market_price", 0)
                        recommendations.append(RecommendationItem(
                            text="Standardize pricing using market benchmarks as targets",
                            reason=(
                                f"Your supplier prices are {deviation:+.1f}% versus market rates of ${avg_market:,.2f} based on {months} months of verified market data - "
                                f"this gap represents pure margin capture by suppliers who know you lack pricing visibility. Without market benchmarks, you're negotiating blind. "
                                f"Present this data directly to suppliers: 'Your price is {abs(deviation):.0f}% above market for comparable quality - let's discuss how to close this gap.' "
                                f"Implement market-indexed pricing contracts that automatically adjust with commodity movements, protecting you from overcharges "
                                f"while giving suppliers predictable margins. This typically achieves 5-12% cost reduction while maintaining strong supplier relationships through transparency."
                            )
                        ))
                    else:
                        variance = pp.raw_data.get("variance_pct", 25)
                        min_price = pp.raw_data.get("min_price", 0)
                        max_price = pp.raw_data.get("max_price", 0)
                        recommendations.append(RecommendationItem(
                            text="Harmonize pricing across suppliers through volume commitments",
                            reason=(
                                f"Your price variance of {variance:.0f}% for identical items (ranging from ${min_price:.2f} to ${max_price:.2f}) exposes a systemic problem - "
                                f"inconsistent negotiations, unclear specifications, or suppliers taking advantage of decentralized purchasing. This isn't market dynamics; it's money leaking out of your P&L. "
                                f"Standardize specifications across all locations and launch a competitive rebid using ${min_price:.2f} (your best current price) as the target baseline. "
                                f"Offer volume consolidation commitments in exchange for matching best-in-class pricing across all suppliers. "
                                f"This approach typically reduces variance by 50-70% and captures immediate savings equal to half the current price spread."
                            )
                        ))
                else:
                    recommendations.append(RecommendationItem(
                        text="Standardize specifications to reduce price variance across items",
                        reason=(
                            "High price variance for identical items indicates you're paying different prices for the same thing - a clear sign of negotiation inconsistency or specification drift. "
                            "This happens when different sites or buyers negotiate independently without sharing best practices or pricing data, letting suppliers exploit information asymmetry. "
                            "Run a formal RFQ across all current suppliers, sharing the range of prices you currently pay and asking each to match your best rate or explain why they can't. "
                            "Even if you plan to stay with current suppliers, this exercise creates transparency that drives 4-7% price improvement and establishes a pricing baseline for future negotiations."
                        )
                    ))

            # PP1: Regional Spend (check HIGH or MEDIUM)
            if any(r.proof_point_code == "PP_REGIONAL_SPEND" for r in high_medium):
                pp = pp_lookup.get("PP_REGIONAL_SPEND")
                top_3_pct = pp.raw_data.get("top_3_regions_pct", 80) if pp and pp.raw_data else 80
                top_regions = pp.raw_data.get("top_regions", []) if pp and pp.raw_data else []
                regions_str = ", ".join(top_regions[:3]) if top_regions else "your key regions"
                recommendations.append(RecommendationItem(
                    text="Leverage regional concentration for bundled logistics and contracts",
                    reason=(
                        f"With {top_3_pct:.0f}% of spend concentrated in top 3 regions ({regions_str}), you can negotiate "
                        f"regional master agreements that combine volumes across sites. This typically reduces freight costs 5-15% "
                        f"and enables regional supplier partnerships with dedicated service levels and inventory optimization. "
                        f"A bundled contract gets you C-suite attention and strategic pricing that category-by-category negotiations cannot."
                    )
                ))

            # PP6: Market Consolidation (HHI) (check HIGH or MEDIUM)
            if any(r.proof_point_code == "PP_MARKET_CONSOLIDATION" for r in high_medium):
                pp = pp_lookup.get("PP_MARKET_CONSOLIDATION")
                hhi = pp.raw_data.get("hhi", 2000) if pp and pp.raw_data else 2000
                market_type = "fragmented" if hhi < 1500 else ("moderately concentrated" if hhi < 2500 else "concentrated")
                recommendations.append(RecommendationItem(
                    text="Leverage market structure for strategic supplier negotiations",
                    reason=(
                        f"Market HHI of {hhi:.0f} indicates a {market_type} market structure - "
                        f"{'giving you strong negotiating leverage as suppliers compete for your business' if hhi < 1500 else 'requiring strategic positioning to maintain competitive dynamics'}. "
                        f"{'In fragmented markets, run competitive bids to drive pricing pressure and use split-award strategies.' if hhi < 1500 else 'In concentrated markets, build deeper relationships with 2-3 key suppliers while maintaining qualified alternatives.'} "
                        f"Understanding market dynamics is essential for negotiation strategy - know whether you're dealing with commodity suppliers fighting for margin "
                        f"or specialized providers with pricing power. Adjust your approach accordingly."
                    )
                ))

            # PP5: Avg Spend per Supplier (check HIGH or MEDIUM)
            if any(r.proof_point_code == "PP_AVG_SPEND_SUPPLIER" for r in high_medium):
                pp = pp_lookup.get("PP_AVG_SPEND_SUPPLIER")
                avg_share_pct = pp.raw_data.get("avg_share_pct", 5) if pp and pp.raw_data else 5
                supplier_count = pp.raw_data.get("supplier_count", 15) if pp and pp.raw_data else 15
                avg_spend = pp.raw_data.get("avg_spend", 0) if pp and pp.raw_data else 0
                fragmentation = pp.raw_data.get("fragmentation_level", "fragmented") if pp and pp.raw_data else "fragmented"
                recommendations.append(RecommendationItem(
                    text="Consolidate fragmented supplier base to increase strategic leverage",
                    reason=(
                        f"Average share of {avg_share_pct:.1f}% per supplier across {supplier_count} suppliers indicates {fragmentation} spend - "
                        f"no single supplier gets enough business to offer you strategic pricing or prioritized service. "
                        f"You're a small customer to too many suppliers. Reduce supplier count by 40-60% and redirect volume to 5-8 strategic partners. "
                        f"When suppliers see meaningful share of your business, you move from 'transactional account' to 'strategic partner' "
                        f"with better pricing, priority allocation during shortages, and access to innovation programs typically reserved for top customers."
                    )
                ))

            # PP7: Supplier Location (check HIGH or MEDIUM)
            if any(r.proof_point_code == "PP_SUPPLIER_LOCATION" for r in high_medium):
                pp = pp_lookup.get("PP_SUPPLIER_LOCATION")
                top_region_pct = pp.raw_data.get("top_region_pct", 70) if pp and pp.raw_data else 70
                top_region = pp.raw_data.get("top_region", "primary region") if pp and pp.raw_data else "primary region"
                recommendations.append(RecommendationItem(
                    text=f"Leverage {top_region} supplier concentration for logistics optimization",
                    reason=(
                        f"{top_region_pct:.0f}% of your suppliers are located in {top_region}, creating natural logistics bundling opportunities - "
                        f"shared warehousing, consolidated freight, and regional distribution partnerships. "
                        f"Negotiate regional master logistics agreements that combine volumes across all {top_region} suppliers. "
                        f"This geographic concentration typically enables 8-15% freight cost reduction through lane optimization, "
                        f"plus improved service levels from dedicated regional carriers who prioritize your consolidated volume."
                    )
                ))

            # PP8: Supplier Risk Rating (check HIGH or MEDIUM) - Uses LLM for real-time analysis
            if any(r.proof_point_code == "PP_SUPPLIER_RISK_RATING" for r in high_medium):
                pp = pp_lookup.get("PP_SUPPLIER_RISK_RATING")
                if pp and pp.raw_data:
                    good_count = pp.raw_data.get("good_count", 0)
                    anchor_candidates = pp.raw_data.get("anchor_candidates", [])
                    anchors_str = ", ".join(anchor_candidates[:3]) if anchor_candidates else "top performers by risk profile"
                    recommendations.append(RecommendationItem(
                        text="Prioritize volume consolidation with low-risk anchor suppliers",
                        reason=(
                            f"{good_count} suppliers rated as low-risk and suitable for increased volume. "
                            f"Recommended anchors: {anchors_str}. Consolidating with financially stable suppliers reduces "
                            f"disruption risk while maximizing leverage. These suppliers want more business - use that as leverage: "
                            f"offer to consolidate additional 20-30% volume in exchange for tiered pricing. They get planning certainty; you get savings."
                        )
                    ))

            # =====================================================================
            # LOW IMPACT: Already optimized - suggest maintenance/monitoring actions
            # =====================================================================
            if len(recommendations) < 4:  # Only add LOW recommendations if we need more
                # PP3: Volume Leverage - LOW means already consolidated
                if any(r.proof_point_code == "PP_VOLUME_LEVERAGE" for r in low_impact):
                    pp = pp_lookup.get("PP_VOLUME_LEVERAGE")
                    top_3_pct = pp.raw_data.get("top_3_pct", 70) if pp and pp.raw_data else 70
                    recommendations.append(RecommendationItem(
                        text="Maintain strategic supplier relationships and monitor for drift",
                        reason=(
                            f"Your top 3 suppliers control {top_3_pct:.0f}% of spend - this is well-consolidated and provides good leverage. "
                            f"However, consolidation without monitoring leads to complacency. Implement quarterly business reviews with top suppliers, "
                            f"track service levels and pricing against benchmarks, and maintain 1-2 qualified alternatives to prevent lock-in. "
                            f"Protect your strong position by ensuring suppliers continue earning your business through competitive pricing and service."
                        )
                    ))

                # PP4: Price Variance - LOW means prices already standardized
                if any(r.proof_point_code == "PP_PRICE_VARIANCE" for r in low_impact) and len(recommendations) < 4:
                    pp = pp_lookup.get("PP_PRICE_VARIANCE")
                    variance = pp.raw_data.get("variance_pct", 8) if pp and pp.raw_data else 8
                    recommendations.append(RecommendationItem(
                        text="Monitor price standardization and prevent variance creep",
                        reason=(
                            f"Price variance of {variance:.0f}% indicates good pricing consistency - your negotiation and contracting processes are working. "
                            f"Protect this achievement by implementing automated price monitoring to catch variance before it grows. "
                            f"Set up alerts when any supplier's prices exceed the category average by more than 5%, and require justification for exceptions. "
                            f"Annual re-benchmarking ensures your 'standard' prices remain competitive versus market rates."
                        )
                    ))

                # PP2: Tail Spend - LOW means already consolidated
                if any(r.proof_point_code == "PP_TAIL_SPEND" for r in low_impact) and len(recommendations) < 4:
                    pp = pp_lookup.get("PP_TAIL_SPEND")
                    tail_pct = pp.raw_data.get("tail_spend_pct", 12) if pp and pp.raw_data else 12
                    recommendations.append(RecommendationItem(
                        text="Maintain tail spend discipline and prevent fragmentation",
                        reason=(
                            f"Tail spend at {tail_pct:.0f}% is well-controlled - your procurement discipline is strong. "
                            f"Prevent backsliding by enforcing preferred supplier lists and requiring approval for new supplier additions. "
                            f"Run quarterly tail spend reports to catch fragmentation early, and route maverick spend back to strategic suppliers. "
                            f"Consider P-card programs with category restrictions to capture small purchases without adding suppliers."
                        )
                    ))

                # PP5: Avg Spend per Supplier - LOW means already consolidated (share > 15%)
                if any(r.proof_point_code == "PP_AVG_SPEND_SUPPLIER" for r in low_impact) and len(recommendations) < 4:
                    pp = pp_lookup.get("PP_AVG_SPEND_SUPPLIER")
                    avg_share_pct = pp.raw_data.get("avg_share_pct", 20) if pp and pp.raw_data else 20
                    supplier_count = pp.raw_data.get("supplier_count", 5) if pp and pp.raw_data else 5
                    recommendations.append(RecommendationItem(
                        text="Optimize existing strategic supplier relationships",
                        reason=(
                            f"Average share of {avg_share_pct:.1f}% per supplier across {supplier_count} suppliers indicates a consolidated base - "
                            f"your suppliers have meaningful business with you and should be treating you as a strategic account. "
                            f"Focus on relationship depth: quarterly business reviews, joint innovation projects, and preferred customer programs. "
                            f"Monitor for complacency and ensure competitive tension remains through periodic benchmarking and qualified alternatives."
                        )
                    ))

            if not recommendations:
                recommendations.append(RecommendationItem(
                    text="Review supplier agreements for volume discount opportunities",
                    reason=(
                        "Even without strong individual signals, your current supplier agreements likely contain untapped volume discount potential - "
                        "most suppliers have unpublished tier-2 pricing that kicks in at 120-150% of current volumes but never share it proactively. "
                        "Combine volumes across categories, business units, or time periods (quarterly vs annual commitments) to reach higher tiers. "
                        "Approach your top 5 suppliers with a 3-year volume commitment proposal in exchange for tier-2 rates - "
                        "this typically yields 3-5% savings while giving suppliers the planning certainty they value."
                    )
                ))

        elif opportunity_type == OpportunityType.TARGET_PRICING:
            # PP4: Price Variance (Target Pricing context - check HIGH or MEDIUM)
            if any(r.proof_point_code == "PP_PRICE_VARIANCE" for r in high_medium):
                pp = pp_lookup.get("PP_PRICE_VARIANCE")
                if pp and pp.raw_data:
                    if pp.raw_data.get("analysis_type") == "market_comparison":
                        deviation = pp.raw_data.get("overall_deviation_pct", 0)
                        market_price = pp.raw_data.get("avg_market_price", 0)
                        recommendations.append(RecommendationItem(
                            text=f"Use market price of ${market_price:,.2f} as your negotiation target",
                            reason=(
                                f"Current supplier prices are {deviation:+.1f}% above market benchmark. "
                                f"Present market data to suppliers and negotiate toward market-indexed pricing. "
                                f"Math doesn't lie - any supplier charging above market is padding margins. "
                                f"This approach typically achieves 5-12% cost reduction while maintaining supplier relationships through transparency."
                            )
                        ))
                    else:
                        min_price = pp.raw_data.get("min_price", 0)
                        mean_price = pp.raw_data.get("mean_price", 0)
                        savings_pct = ((mean_price - min_price) / mean_price * 100) if mean_price > 0 else 0
                        recommendations.append(RecommendationItem(
                            text=f"Use best-in-class price of ${min_price:,.2f} as negotiation target",
                            reason=(
                                f"This is {savings_pct:.1f}% below your average price of ${mean_price:,.2f}. "
                                f"Present this benchmark to higher-priced suppliers with clear volume commitments. "
                                f"They want more business - offer them a path to larger share, but tie it to matching best-in-class pricing. "
                                f"If they can't match it, they're telling you something about their cost structure or margin expectations."
                            )
                        ))

            # PP12: Unit Price
            if any(r.proof_point_code == "PP_UNIT_PRICE" for r in high_medium):
                pp = pp_lookup.get("PP_UNIT_PRICE")
                variance = pp.raw_data.get("variance_pct", 15) if pp and pp.raw_data else 15
                recommendations.append(RecommendationItem(
                    text="Benchmark unit prices against industry rates and renegotiate",
                    reason=(
                        f"Your unit prices show {variance:.0f}% deviation from market benchmarks. "
                        f"Conduct a should-cost analysis breaking down raw materials (typically 50-60%), conversion (20-25%), "
                        f"logistics (10-15%), and margin (10-15%). Any supplier charging above this structure is padding margins. "
                        f"Use this analysis to establish fact-based negotiation targets that suppliers cannot dispute."
                    )
                ))

            # PP11: Cost Structure (check HIGH or MEDIUM)
            if any(r.proof_point_code == "PP_COST_STRUCTURE" for r in high_medium):
                pp = pp_lookup.get("PP_COST_STRUCTURE")
                raw_material_pct = pp.raw_data.get("raw_material_pct", 60) if pp and pp.raw_data else 60
                recommendations.append(RecommendationItem(
                    text="Implement commodity index-based pricing for raw material components",
                    reason=(
                        f"With {raw_material_pct:.0f}% of cost tied to raw materials, commodity price movements significantly impact your costs. "
                        f"Fixed pricing sounds safe until commodity prices drop 20% and your supplier keeps charging the old rate. "
                        f"Index-linked contracts pass through market changes fairly, protect against supplier margin padding, "
                        f"and typically reduce total cost by 2-5% versus fixed pricing in volatile markets."
                    )
                ))

            # PP10: Tariff Rate (check HIGH or MEDIUM)
            if any(r.proof_point_code == "PP_TARIFF_RATE" for r in high_medium):
                pp = pp_lookup.get("PP_TARIFF_RATE")
                tariff_diff = pp.raw_data.get("tariff_differential", 15) if pp and pp.raw_data else 15
                recommendations.append(RecommendationItem(
                    text="Optimize sourcing geography to minimize tariff exposure",
                    reason=(
                        f"Tariff differential of {tariff_diff:.0f}% between sourcing regions presents arbitrage opportunity. "
                        f"Evaluate shifting volume to lower-tariff origins while maintaining supply security. "
                        f"Consider bonded warehousing or free trade zone strategies for additional duty optimization. "
                        f"Even a partial shift can yield significant savings on high-volume categories."
                    )
                ))

            # =====================================================================
            # LOW IMPACT: Already optimized - suggest maintenance/monitoring actions
            # =====================================================================
            if len(recommendations) < 4:  # Only add LOW recommendations if we need more
                # PP4: Price Variance - LOW means pricing is already competitive
                if any(r.proof_point_code == "PP_PRICE_VARIANCE" for r in low_impact):
                    pp = pp_lookup.get("PP_PRICE_VARIANCE")
                    variance = pp.raw_data.get("variance_pct", 5) if pp and pp.raw_data else 5
                    recommendations.append(RecommendationItem(
                        text="Maintain competitive pricing through regular market benchmarking",
                        reason=(
                            f"Price variance of {variance:.0f}% indicates your pricing is well-aligned with market rates - your negotiations have been effective. "
                            f"Protect this position by establishing annual benchmarking cycles against industry pricing databases. "
                            f"Set up automated alerts when market prices shift more than 5% to trigger contract reviews. "
                            f"Regular re-validation ensures you don't drift from competitive rates over time."
                        )
                    ))

                # PP11: Cost Structure - LOW means cost breakdown is healthy
                if any(r.proof_point_code == "PP_COST_STRUCTURE" for r in low_impact) and len(recommendations) < 4:
                    pp = pp_lookup.get("PP_COST_STRUCTURE")
                    raw_material_pct = pp.raw_data.get("raw_material_pct", 45) if pp and pp.raw_data else 45
                    recommendations.append(RecommendationItem(
                        text="Monitor cost structure balance and track component shifts",
                        reason=(
                            f"Cost structure with {raw_material_pct:.0f}% in raw materials is balanced - your supplier margins are reasonable. "
                            f"Track commodity indices quarterly to ensure supplier pricing adjusts with market movements. "
                            f"Implement should-cost reviews during contract renewals to validate continued cost competitiveness. "
                            f"Watch for margin creep where suppliers quietly increase conversion costs while commodities decline."
                        )
                    ))

            if not recommendations:
                recommendations.append(RecommendationItem(
                    text="Conduct comprehensive should-cost analysis to establish negotiation targets",
                    reason=(
                        "Without clear pricing signals, you're negotiating blind - suppliers control the information and therefore the outcome. "
                        "Build should-cost models breaking down materials (typically 50-60%), conversion (20-25%), logistics (10-15%), and margin (10-15%). "
                        "This fact-based analysis reveals exactly where supplier margins exceed market norms and creates undeniable negotiation leverage. "
                        "Suppliers respect data-driven discussions - presenting a detailed cost breakdown shifts the conversation from 'give me a better price' "
                        "to 'explain why your margin is 18% when the market standard is 12%', typically achieving 4-8% cost reduction."
                    )
                ))

        elif opportunity_type == OpportunityType.RISK_MANAGEMENT:
            # PP13: Single Sourcing (check HIGH or MEDIUM)
            if any(r.proof_point_code == "PP_SINGLE_SOURCING" for r in high_medium):
                pp = pp_lookup.get("PP_SINGLE_SOURCING")
                top_supplier_pct = pp.raw_data.get("top_supplier_pct", 50) if pp and pp.raw_data else 50
                top_supplier = pp.raw_data.get("top_supplier", "primary supplier") if pp and pp.raw_data else "primary supplier"
                recommendations.append(RecommendationItem(
                    text=f"Qualify alternative suppliers to reduce {top_supplier} dependency",
                    reason=(
                        f"{top_supplier} controls {top_supplier_pct:.0f}% of category spend, creating critical supply risk. "
                        f"If they face a fire, labor strike, or capacity constraint, your operations halt. "
                        f"Identify and qualify 2-3 alternative suppliers, targeting a 70/20/10 split within 12 months. "
                        f"This diversification typically costs 1-2% premium but prevents catastrophic supply disruptions worth far more."
                    )
                ))

            # PP14: Supplier Concentration (check HIGH or MEDIUM)
            if any(r.proof_point_code == "PP_SUPPLIER_CONCENTRATION" for r in high_medium):
                pp = pp_lookup.get("PP_SUPPLIER_CONCENTRATION")
                top_3_pct = pp.raw_data.get("top_3_pct", 80) if pp and pp.raw_data else 80
                recommendations.append(RecommendationItem(
                    text="Diversify supplier base to reduce concentration risk",
                    reason=(
                        f"Top 3 suppliers control {top_3_pct:.0f}% of spend - any single disruption could halt operations. "
                        f"This is a structural vulnerability that competitors with diversified bases don't have. "
                        f"Develop a balanced supplier portfolio with no single supplier exceeding 40% and top 3 below 70%. "
                        f"Include suppliers from different regions and ownership structures for true diversification."
                    )
                ))

            # PP18: Geo Political Risk
            if any(r.proof_point_code == "PP_GEO_POLITICAL" for r in high_medium):
                pp = pp_lookup.get("PP_GEO_POLITICAL")
                high_risk_pct = pp.raw_data.get("high_risk_geo_pct", 40) if pp and pp.raw_data else 40
                high_risk_regions = pp.raw_data.get("high_risk_regions", []) if pp and pp.raw_data else []
                regions_str = ", ".join(high_risk_regions[:3]) if high_risk_regions else "high-risk regions"
                recommendations.append(RecommendationItem(
                    text="Develop contingency sourcing plans for geopolitically sensitive regions",
                    reason=(
                        f"{high_risk_pct:.0f}% of spend originates from {regions_str} with elevated geopolitical risk. "
                        f"Trade disputes, sanctions, or regional instability could disrupt supply with little warning. "
                        f"Establish qualified backup suppliers in stable regions with pre-negotiated terms and safety stock. "
                        f"This 'China+1' or regional redundancy strategy is now essential for supply chain resilience."
                    )
                ))

            # PP15: Inflation (check HIGH or MEDIUM)
            if any(r.proof_point_code == "PP_INFLATION" for r in high_medium):
                pp = pp_lookup.get("PP_INFLATION")
                inflation_rate = pp.raw_data.get("inflation_rate", 8) if pp and pp.raw_data else 8
                recommendations.append(RecommendationItem(
                    text="Implement price escalation clauses tied to transparent indices",
                    reason=(
                        f"With {inflation_rate:.0f}% inflation in key sourcing regions, fixed-price contracts erode supplier margins "
                        f"and risk quality cuts or supply disruptions. Suppliers squeezed by inflation find ways to recover costs - "
                        f"usually in ways that hurt you. Index-linked escalation (PPI, commodity indices) protects both parties "
                        f"and enables longer-term agreements with mutual benefit."
                    )
                ))

            # PP16: Exchange Rate (check HIGH or MEDIUM)
            if any(r.proof_point_code == "PP_EXCHANGE_RATE" for r in high_medium):
                pp = pp_lookup.get("PP_EXCHANGE_RATE")
                forex_pct = pp.raw_data.get("foreign_currency_pct", 50) if pp and pp.raw_data else 50
                recommendations.append(RecommendationItem(
                    text="Establish currency hedging strategy for foreign currency exposure",
                    reason=(
                        f"{forex_pct:.0f}% of spend is exposed to volatile currency movements. "
                        f"A 10% currency swing on this exposure equals significant unbudgeted cost variance. "
                        f"Implement a rolling hedge program covering 50-80% of forecasted spend 6-12 months forward. "
                        f"Consider natural hedges through supplier payment currency optimization or local sourcing."
                    )
                ))

            # =====================================================================
            # LOW IMPACT: Already optimized - suggest maintenance/monitoring actions
            # =====================================================================
            if len(recommendations) < 4:  # Only add LOW recommendations if we need more
                # PP13: Single Sourcing - LOW means well-diversified
                if any(r.proof_point_code == "PP_SINGLE_SOURCING" for r in low_impact):
                    pp = pp_lookup.get("PP_SINGLE_SOURCING")
                    top_supplier_pct = pp.raw_data.get("top_supplier_pct", 30) if pp and pp.raw_data else 30
                    recommendations.append(RecommendationItem(
                        text="Maintain supplier diversification and monitor concentration drift",
                        reason=(
                            f"Top supplier at {top_supplier_pct:.0f}% of spend indicates healthy diversification - your supply chain has built-in resilience. "
                            f"Monitor quarterly to catch concentration drift before it becomes a risk. Volume naturally gravitates to best performers, "
                            f"which is good for efficiency but can recreate single-source risk over time. "
                            f"Set alerts when any supplier exceeds 40% share and maintain active relationships with backup suppliers."
                        )
                    ))

                # PP14: Supplier Concentration - LOW means balanced portfolio
                if any(r.proof_point_code == "PP_SUPPLIER_CONCENTRATION" for r in low_impact) and len(recommendations) < 4:
                    pp = pp_lookup.get("PP_SUPPLIER_CONCENTRATION")
                    top_3_pct = pp.raw_data.get("top_3_pct", 55) if pp and pp.raw_data else 55
                    recommendations.append(RecommendationItem(
                        text="Preserve balanced supplier portfolio with ongoing qualification",
                        reason=(
                            f"Top 3 suppliers at {top_3_pct:.0f}% of spend represents a well-balanced portfolio with manageable concentration risk. "
                            f"Maintain this balance by keeping 2-3 qualified alternatives active with periodic test orders. "
                            f"Review concentration quarterly and resist the temptation to over-consolidate for marginal savings. "
                            f"The resilience value of your current diversification typically outweighs 1-2% consolidation savings."
                        )
                    ))

                # PP18: Geo Political - LOW means geographically stable
                if any(r.proof_point_code == "PP_GEO_POLITICAL" for r in low_impact) and len(recommendations) < 4:
                    pp = pp_lookup.get("PP_GEO_POLITICAL")
                    low_risk_pct = 100 - (pp.raw_data.get("high_risk_geo_pct", 20) if pp and pp.raw_data else 20)
                    recommendations.append(RecommendationItem(
                        text="Monitor geopolitical landscape and maintain regional flexibility",
                        reason=(
                            f"{low_risk_pct:.0f}% of spend originates from geopolitically stable regions - your supply chain has good geographic resilience. "
                            f"Continue monitoring regional stability indices and maintain qualified suppliers in alternative regions. "
                            f"Geopolitical situations can change rapidly; having pre-qualified alternatives enables quick pivots when needed. "
                            f"Review country risk ratings annually and adjust sourcing strategy proactively rather than reactively."
                        )
                    ))

            if not recommendations:
                recommendations.append(RecommendationItem(
                    text="Conduct comprehensive supplier risk assessment and develop mitigation roadmap",
                    reason=(
                        "Without strong individual risk signals, your supply chain may still harbor hidden vulnerabilities that only emerge during disruptions - "
                        "financial instability, capacity constraints, key-person dependencies, or geographic concentration you haven't mapped. "
                        "Map all critical suppliers across six dimensions: financial health (D&B scores), operational capacity, geographic risk, "
                        "regulatory compliance, cybersecurity posture, and business continuity planning maturity. "
                        "Prioritize mitigation actions by risk severity × business impact, establishing quarterly review cadence with supplier scorecards. "
                        "This proactive approach typically prevents 2-3 supply disruptions annually worth $100K-$1M+ each in expediting costs and lost sales."
                    )
                ))

        elif opportunity_type == OpportunityType.RESPEC_PACK:
            # PP4: Price Variance (Re-spec context - check HIGH or MEDIUM)
            if any(r.proof_point_code == "PP_PRICE_VARIANCE" for r in high_medium):
                pp = pp_lookup.get("PP_PRICE_VARIANCE")
                variance = pp.raw_data.get("variance_pct", 30) if pp and pp.raw_data else 30
                recommendations.append(RecommendationItem(
                    text="Standardize packaging specifications across SKUs",
                    reason=(
                        f"Price variance of {variance:.0f}% for similar packaging indicates over-specification or non-standard items. "
                        f"Many premium specifications exist for historical reasons rather than current needs - someone asked for it once, "
                        f"and it stuck. Audit current specs against functional requirements. "
                        f"Standardization typically reduces packaging costs 8-15% while improving supply chain flexibility."
                    )
                ))

            # PP19: Export Data
            if any(r.proof_point_code == "PP_EXPORT_DATA" for r in high_medium):
                pp = pp_lookup.get("PP_EXPORT_DATA")
                savings_pct = pp.raw_data.get("savings_pct", 20) if pp and pp.raw_data else 20
                recommendations.append(RecommendationItem(
                    text="Adopt global export-standard packaging specifications",
                    reason=(
                        f"Export-standard packaging is {savings_pct:.0f}% cheaper than your current specifications. "
                        f"Global standards are optimized for cost, sustainability, and logistics efficiency through years of refinement. "
                        f"Why pay for premium when standard meets functional requirements? "
                        f"Transitioning to these specs reduces material costs while improving recyclability metrics."
                    )
                ))

            # PP11: Cost Structure (Re-spec context)
            if any(r.proof_point_code == "PP_COST_STRUCTURE" for r in high_impact):
                pp = pp_lookup.get("PP_COST_STRUCTURE")
                raw_material_pct = pp.raw_data.get("raw_material_pct", 65) if pp and pp.raw_data else 65
                recommendations.append(RecommendationItem(
                    text="Right-size packaging materials through value engineering",
                    reason=(
                        f"With {raw_material_pct:.0f}% of packaging cost in materials, specification changes have high leverage. "
                        f"Conduct teardown analysis to identify material reduction opportunities - gauge optimization, "
                        f"material substitution, and design-for-manufacturing changes typically yield 5-12% savings. "
                        f"Every gram of unnecessary material is money leaving your P&L."
                    )
                ))

            # =====================================================================
            # LOW IMPACT: Already optimized - suggest maintenance/monitoring actions
            # =====================================================================
            if len(recommendations) < 4:  # Only add LOW recommendations if we need more
                # PP4: Price Variance - LOW means packaging pricing is standardized
                if any(r.proof_point_code == "PP_PRICE_VARIANCE" for r in low_impact):
                    pp = pp_lookup.get("PP_PRICE_VARIANCE")
                    variance = pp.raw_data.get("variance_pct", 8) if pp and pp.raw_data else 8
                    recommendations.append(RecommendationItem(
                        text="Maintain packaging specification standards and prevent drift",
                        reason=(
                            f"Price variance of {variance:.0f}% for packaging indicates good specification standardization - your specs are working. "
                            f"Protect this achievement by documenting approved specifications in a central repository. "
                            f"Require formal approval for any specification changes and conduct annual reviews to eliminate creep. "
                            f"When new packaging needs arise, first check if existing standards can meet requirements before creating custom specs."
                        )
                    ))

                # PP19: Export Data - LOW means already using efficient specs
                if any(r.proof_point_code == "PP_EXPORT_DATA" for r in low_impact) and len(recommendations) < 4:
                    pp = pp_lookup.get("PP_EXPORT_DATA")
                    recommendations.append(RecommendationItem(
                        text="Stay current with evolving packaging standards and sustainability requirements",
                        reason=(
                            "Your packaging specifications are already aligned with export standards - you're not overpaying for unnecessary features. "
                            "Monitor evolving standards for further optimization opportunities, particularly sustainability-driven changes. "
                            "New materials and designs constantly emerge that can reduce cost while improving environmental performance. "
                            "Partner with suppliers on innovation pilots to test next-generation packaging before competitors adopt them."
                        )
                    ))

                # PP11: Cost Structure - LOW means material costs are optimized
                if any(r.proof_point_code == "PP_COST_STRUCTURE" for r in low_impact) and len(recommendations) < 4:
                    pp = pp_lookup.get("PP_COST_STRUCTURE")
                    raw_material_pct = pp.raw_data.get("raw_material_pct", 50) if pp and pp.raw_data else 50
                    recommendations.append(RecommendationItem(
                        text="Track material cost indices and renegotiate during commodity downturns",
                        reason=(
                            f"Packaging material costs at {raw_material_pct:.0f}% are well-controlled - your value engineering has been effective. "
                            f"Monitor commodity indices (paper, resin, aluminum) for negotiation triggers when input costs decline. "
                            f"Implement index-linked pricing to automatically capture savings when commodities drop. "
                            f"Schedule quarterly cost reviews with suppliers to ensure you benefit from market movements, not just suffer from them."
                        )
                    ))

            if not recommendations:
                recommendations.append(RecommendationItem(
                    text="Conduct packaging specification audit against functional requirements",
                    reason=(
                        "Without clear specification signals, your packaging may still contain hidden over-engineering from historical requirements no longer relevant - "
                        "premium materials specified 'just in case', excessive gauge thickness 'to be safe', or custom dimensions from one-off requests that became standard. "
                        "Audit every specification against actual functional requirements: protection (drop tests, compression), branding (visual standards), "
                        "regulatory (food contact, hazmat), and logistics (pallet optimization, case cube efficiency). "
                        "Work with suppliers on value engineering workshops - they often know where specs can be relaxed but won't volunteer savings opportunities. "
                        "This systematic approach typically identifies 8-15% packaging cost reduction while often improving sustainability metrics through material reduction."
                    )
                ))

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

    async def _enhance_pp8_with_supplier_intelligence(
        self,
        opportunity_results: Dict[OpportunityType, OpportunityResult],
        spend_data: pd.DataFrame,
        context_data: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Enhance PP8 (Supplier Risk Rating) with real-time OpenAI intelligence.

        This replaces the formula-based PP8 result with a real-time assessment
        using GPT-4o-mini that evaluates suppliers on 6 weighted parameters.

        Updates opportunity_results in place for:
        - Volume Bundling (PP8 shared)
        - Risk Management (PP8 shared)
        """
        from app.agents.proof_points import PROOF_POINTS

        # Get PP8 definition
        pp8_def = PROOF_POINTS.get("PP_SUPPLIER_RISK_RATING")
        if not pp8_def:
            return

        # Get the Volume Bundling agent (has the async evaluation method)
        vb_agent = self.agents.get(OpportunityType.VOLUME_BUNDLING)
        if not vb_agent or not hasattr(vb_agent, 'evaluate_pp8_async'):
            return

        # Evaluate PP8 using OpenAI
        category_spend = context_data.get("category_spend", 0) if context_data else 0
        pp8_result = await vb_agent.evaluate_pp8_async(
            proof_point=pp8_def,
            spend_data=spend_data,
            category_spend=category_spend,
            context_data=context_data
        )

        # Update Volume Bundling PP8 result
        vb_result = opportunity_results.get(OpportunityType.VOLUME_BUNDLING)
        if vb_result:
            for i, pp in enumerate(vb_result.proof_point_results):
                if pp.proof_point_code == "PP_SUPPLIER_RISK_RATING":
                    vb_result.proof_point_results[i] = pp8_result
                    break

        # Update Risk Management PP8 result (shared proof point)
        rm_result = opportunity_results.get(OpportunityType.RISK_MANAGEMENT)
        if rm_result:
            for i, pp in enumerate(rm_result.proof_point_results):
                if pp.proof_point_code == "PP_SUPPLIER_RISK_RATING":
                    # Create a copy with Risk Management opportunity type
                    from app.agents.base_agent import ProofPointResult
                    rm_pp8_result = ProofPointResult(
                        proof_point_code=pp8_result.proof_point_code,
                        proof_point_name=pp8_result.proof_point_name,
                        opportunity=OpportunityType.RISK_MANAGEMENT,
                        impact_flag=pp8_result.impact_flag,
                        test_score=pp8_result.test_score,
                        insight=pp8_result.insight,
                        raw_data=pp8_result.raw_data,
                        is_tested=pp8_result.is_tested,
                        evaluated_at=pp8_result.evaluated_at
                    )
                    rm_result.proof_point_results[i] = rm_pp8_result
                    break

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
        if result.impact_score >= 0.7:
            impact_level = "HIGH"
        elif result.impact_score >= 0.4:
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
            overall_score=result.impact_score,
            impact_level=impact_level,
            proof_point_results=result.proof_point_results,
            savings=savings,
            key_insights=key_insights,
            recommended_actions=recommended_actions
        )
