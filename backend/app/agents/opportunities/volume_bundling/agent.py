"""
Volume Bundling Micro-Agent
Evaluates 8 proof points for volume bundling opportunities.

HYBRID ARCHITECTURE:
- Uses CacheService for pre-computed metrics when available (fast path)
- Falls back to real-time computation from spend_data (slow path)
- PP8 (Supplier Risk Rating) uses REAL-TIME OpenAI intelligence

Proof Points:
1. Regional Spend Addressability
2. Tail Spend Consolidation Opportunity
3. Volume Leverage from Fragmented Category Spend
4. Price Variance for Identical Items/SKUs (SHARED with Target Pricing)
5. Average Spend per Supplier vs. Industry Benchmarks
6. Market Consolidation
7. Supplier Location
8. Supplier Risk Rating (SHARED with Risk Management) - OPENAI POWERED
"""

from typing import Dict, Optional, Any, List
import pandas as pd
import numpy as np
import asyncio

from app.agents.base_agent import BaseMicroAgent, ProofPointResult, PROOF_POINT_METRIC_MAP
from app.agents.proof_points import (
    ProofPointDefinition,
    OpportunityType,
    ImpactFlag,
)
from app.services.supplier_intelligence import get_supplier_intelligence_service
from app.services.market_price_service import get_market_price_service, PricePosition


class VolumeBundlingAgent(BaseMicroAgent):
    """
    Micro-agent for Volume Bundling opportunity.
    Context: Concentration and fragmentation patterns = bundling leverage.
    
    HYBRID ARCHITECTURE:
    - Checks cache for pre-computed metrics first (instant)
    - Falls back to spend_data computation if no cache
    """

    def __init__(self):
        super().__init__(OpportunityType.VOLUME_BUNDLING)

    @property
    def name(self) -> str:
        return "Volume Bundling"

    @property
    def description(self) -> str:
        return "Consolidate spend across suppliers and regions to achieve volume discounts and negotiate better pricing through increased leverage."

    async def evaluate_proof_point_cached(
        self,
        proof_point: ProofPointDefinition,
        context_data: Optional[Dict[str, Any]] = None
    ) -> Optional[ProofPointResult]:
        """
        Evaluate proof point using cached metrics (FAST PATH).
        Returns None if cache miss, caller should fall back to spend_data.
        """
        metric_names = PROOF_POINT_METRIC_MAP.get(proof_point.code, [])
        if not metric_names:
            return None
        
        # Get all required metrics from cache
        metrics = {}
        for name in metric_names:
            value = await self._get_cached_metric(name)
            if value is not None:
                metrics[name] = value
        
        if not metrics:
            return None  # Cache miss, fall back to slow path
        
        # Evaluate based on cached metrics
        return self._evaluate_from_cache(proof_point, metrics)
    
    def _evaluate_from_cache(
        self,
        proof_point: ProofPointDefinition,
        metrics: Dict[str, float]
    ) -> ProofPointResult:
        """Evaluate proof point from cached metrics."""
        
        evaluators = {
            "PP_REGIONAL_SPEND": self._cache_regional_spend,
            "PP_TAIL_SPEND": self._cache_tail_spend,
            "PP_VOLUME_LEVERAGE": self._cache_volume_leverage,
            "PP_MARKET_CONSOLIDATION": self._cache_market_consolidation,
            "PP_SUPPLIER_LOCATION": self._cache_supplier_location,
        }
        
        evaluator = evaluators.get(proof_point.code)
        if evaluator:
            return evaluator(proof_point, metrics)
        
        # Default: use first metric to determine impact
        first_metric = list(metrics.values())[0] if metrics else 0
        score = min(first_metric / 100, 1.0)
        return self._create_result(
            proof_point, 
            score, 
            f"Metric value: {first_metric:.1f}%",
            metrics
        )
    
    def _cache_regional_spend(self, pp: ProofPointDefinition, metrics: Dict[str, float]) -> ProofPointResult:
        """Evaluate regional spend from cached metrics."""
        concentration = metrics.get("regional_concentration", metrics.get("geo_concentration_risk", 0))
        
        if concentration >= 80:
            score = 0.9
            insight = f"High regional concentration ({concentration:.1f}%) enables cross-site volume consolidation"
        elif concentration >= 50:
            score = 0.6
            insight = f"Moderate regional concentration ({concentration:.1f}%) - some bundling potential"
        else:
            score = 0.3
            insight = f"Low regional concentration ({concentration:.1f}%) - limited bundling opportunity"
        
        return self._create_result(pp, score, insight, {"regional_concentration": concentration})
    
    def _cache_tail_spend(self, pp: ProofPointDefinition, metrics: Dict[str, float]) -> ProofPointResult:
        """Evaluate tail spend from cached metrics."""
        tail_pct = metrics.get("tail_spend_percentage", 20)  # Default 20%
        supplier_count = metrics.get("supplier_count", 0)
        
        if tail_pct >= 30:
            score = 0.85
            insight = f"High tail spend ({tail_pct:.1f}%) presents significant consolidation opportunity"
        elif tail_pct >= 15:
            score = 0.55
            insight = f"Moderate tail spend ({tail_pct:.1f}%) - consolidation potential exists"
        else:
            score = 0.25
            insight = f"Low tail spend ({tail_pct:.1f}%) - already consolidated"
        
        return self._create_result(pp, score, insight, {"tail_spend_pct": tail_pct, "supplier_count": supplier_count})
    
    def _cache_volume_leverage(self, pp: ProofPointDefinition, metrics: Dict[str, float]) -> ProofPointResult:
        """Evaluate volume leverage from HHI and concentration."""
        hhi = metrics.get("hhi_index", 0)
        top_3 = metrics.get("top_3_concentration", 0)
        
        # Low HHI = fragmented = HIGH opportunity
        if hhi < 1500:
            score = 0.85
            insight = f"Fragmented supply base (HHI: {hhi:.0f}) - significant leverage opportunity"
        elif hhi < 2500:
            score = 0.55
            insight = f"Moderately concentrated (HHI: {hhi:.0f}) - some leverage potential"
        else:
            score = 0.25
            insight = f"Concentrated supply base (HHI: {hhi:.0f}) - limited additional leverage"
        
        return self._create_result(pp, score, insight, {"hhi_index": hhi, "top_3_concentration": top_3})
    
    def _cache_market_consolidation(self, pp: ProofPointDefinition, metrics: Dict[str, float]) -> ProofPointResult:
        """Evaluate market consolidation opportunity."""
        hhi = metrics.get("hhi_index", 0)
        top_3 = metrics.get("top_3_concentration", 0)
        
        if top_3 < 50:
            score = 0.8
            insight = f"Top 3 suppliers control only {top_3:.1f}% - market ripe for consolidation"
        elif top_3 < 70:
            score = 0.5
            insight = f"Moderate concentration ({top_3:.1f}% in top 3) - selective consolidation possible"
        else:
            score = 0.3
            insight = f"High concentration ({top_3:.1f}% in top 3) - market already consolidated"
        
        return self._create_result(pp, score, insight, {"hhi_index": hhi, "top_3_concentration": top_3})
    
    def _cache_supplier_location(self, pp: ProofPointDefinition, metrics: Dict[str, float]) -> ProofPointResult:
        """Evaluate supplier location risk/opportunity."""
        geo_risk = metrics.get("geo_concentration_risk", metrics.get("regional_concentration", 50))
        
        # In bundling context, some geo concentration is good for logistics
        if 40 <= geo_risk <= 70:
            score = 0.7
            insight = f"Balanced geographic distribution ({geo_risk:.1f}%) enables regional bundling"
        elif geo_risk > 70:
            score = 0.5
            insight = f"High geographic concentration ({geo_risk:.1f}%) - logistics advantage but supply risk"
        else:
            score = 0.4
            insight = f"Dispersed supplier locations ({geo_risk:.1f}%) - complex bundling logistics"
        
        return self._create_result(pp, score, insight, {"geo_concentration": geo_risk})

    def evaluate_proof_point(
        self,
        proof_point: ProofPointDefinition,
        spend_data: pd.DataFrame,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> ProofPointResult:
        """Evaluate a proof point in Volume Bundling context (SLOW PATH from spend_data)."""

        evaluators = {
            "PP_REGIONAL_SPEND": self._evaluate_regional_spend,
            "PP_TAIL_SPEND": self._evaluate_tail_spend,
            "PP_VOLUME_LEVERAGE": self._evaluate_volume_leverage,
            "PP_PRICE_VARIANCE": self._evaluate_price_variance,
            "PP_AVG_SPEND_SUPPLIER": self._evaluate_avg_spend_supplier,
            "PP_MARKET_CONSOLIDATION": self._evaluate_market_consolidation,
            "PP_SUPPLIER_LOCATION": self._evaluate_supplier_location,
            "PP_SUPPLIER_RISK_RATING": self._evaluate_supplier_risk_rating,
        }

        evaluator = evaluators.get(proof_point.code)
        if evaluator:
            return evaluator(proof_point, spend_data, category_spend, context_data)

        # Default: Not tested
        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=ImpactFlag.NOT_TESTED,
            test_score=0.0,
            insight="Evaluation not implemented for this proof point",
            is_tested=False
        )

    def _evaluate_regional_spend(
        self,
        proof_point: ProofPointDefinition,
        spend_data: pd.DataFrame,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> ProofPointResult:
        """
        Evaluate Regional Spend Addressability.
        Context: High concentration = GOOD for bundling (can consolidate across sites).
        """
        country_col = self._get_column(spend_data, "country")
        spend_col = self._get_column(spend_data, "spend")

        if not country_col or not spend_col:
            return self._not_tested_result(proof_point, "Missing country or spend column")

        # Calculate spend by region
        regional_spend = spend_data.groupby(country_col)[spend_col].sum().sort_values(ascending=False)
        total_spend = regional_spend.sum()

        if total_spend == 0:
            return self._not_tested_result(proof_point, "No spend data available")

        # Top 3 regions percentage
        top_3_pct = (regional_spend.head(3).sum() / total_spend) * 100
        top_regions = regional_spend.head(3).index.tolist()

        # Determine impact (HIGH concentration = HIGH impact for bundling)
        if top_3_pct >= 80:
            impact = ImpactFlag.HIGH
            score = 0.9
        elif top_3_pct >= 50:
            impact = ImpactFlag.MEDIUM
            score = 0.6
        else:
            impact = ImpactFlag.LOW
            score = 0.3

        insight = f"Regional concentration at {top_3_pct:.1f}% in top 3 regions ({', '.join(top_regions[:3])}) enables cross-site volume consolidation"

        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=impact,
            test_score=score,
            insight=insight,
            raw_data={
                "top_3_pct": top_3_pct,
                "top_regions": top_regions,
                "region_count": len(regional_spend)
            }
        )

    def _evaluate_tail_spend(
        self,
        proof_point: ProofPointDefinition,
        spend_data: pd.DataFrame,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> ProofPointResult:
        """
        Evaluate Tail Spend Consolidation Opportunity.
        Context: High tail spend = HIGH impact (opportunity to consolidate).
        """
        supplier_col = self._get_column(spend_data, "supplier")
        spend_col = self._get_column(spend_data, "spend")

        if not supplier_col or not spend_col:
            return self._not_tested_result(proof_point, "Missing supplier or spend column")

        # Calculate spend by supplier
        supplier_spend = spend_data.groupby(supplier_col)[spend_col].sum().sort_values(ascending=False)
        total_spend = supplier_spend.sum()

        if total_spend == 0:
            return self._not_tested_result(proof_point, "No spend data available")

        # Calculate tail spend (bottom 80% of suppliers by spend ranking)
        cumsum = supplier_spend.cumsum() / total_spend
        top_20_pct_suppliers = (cumsum <= 0.8).sum()  # Suppliers making up 80% of spend
        tail_suppliers = len(supplier_spend) - top_20_pct_suppliers
        tail_spend = supplier_spend.iloc[top_20_pct_suppliers:].sum()
        tail_pct = (tail_spend / total_spend) * 100

        # Determine impact (HIGH tail spend = HIGH opportunity)
        if tail_pct >= 30:
            impact = ImpactFlag.HIGH
            score = 0.85
        elif tail_pct >= 15:
            impact = ImpactFlag.MEDIUM
            score = 0.55
        else:
            impact = ImpactFlag.LOW
            score = 0.25

        insight = f"Tail spend of {tail_pct:.1f}% across {tail_suppliers} suppliers presents significant consolidation opportunity"

        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=impact,
            test_score=score,
            insight=insight,
            raw_data={
                "tail_pct": tail_pct,
                "tail_supplier_count": tail_suppliers,
                "total_suppliers": len(supplier_spend)
            }
        )

    def _evaluate_volume_leverage(
        self,
        proof_point: ProofPointDefinition,
        spend_data: pd.DataFrame,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> ProofPointResult:
        """
        Evaluate Volume Leverage from Fragmented Category Spend.

        NEW LOGIC (Top 3 Based):
        Uses combined spend % of Top 3 suppliers instead of Top 1 alone.
        This captures concentration clustering, structural dependency, and real bundling headroom.

        Thresholds (evaluated in this order):
        1. LOW:    Top 3 > 65% OR supplier count < 5 (already consolidated - checked FIRST)
        2. HIGH:   Top 3 < 45% AND supplier count > 10 (fragmented, bundling headroom exists)
        3. MEDIUM: Top 3 between 45-65% (moderate concentration, bundling possible)

        Why LOW is checked first:
        - The OR condition (supplier_count < 5) must override other classifications
        - Example: Top 3 = 50%, suppliers = 3 → LOW (not MEDIUM) because <5 suppliers

        Why Top 3 is better than Top 1:
        - Top 1 alone misses cluster dominance
        - Example: Top 1 = 15%, Top 3 = 62% → Old logic says HIGH, new logic correctly says MEDIUM
        """
        supplier_col = self._get_column(spend_data, "supplier")
        spend_col = self._get_column(spend_data, "spend")

        if not supplier_col or not spend_col:
            return self._not_tested_result(proof_point, "Missing required columns")

        supplier_spend = spend_data.groupby(supplier_col)[spend_col].sum().sort_values(ascending=False)
        total_spend = supplier_spend.sum()
        supplier_count = len(supplier_spend)

        if total_spend == 0:
            return self._not_tested_result(proof_point, "No spend data")

        # Calculate Top 3 combined spend percentage
        top_3_spend = supplier_spend.head(3).sum()
        top_3_pct = (top_3_spend / total_spend) * 100

        # Also track individual top suppliers for insight
        top_1_pct = (supplier_spend.iloc[0] / total_spend) * 100 if len(supplier_spend) > 0 else 0
        top_3_names = list(supplier_spend.head(3).index) if len(supplier_spend) >= 3 else list(supplier_spend.index)

        # NEW LOGIC: Top 3 based thresholds
        # Check LOW first (has OR conditions that override others)
        # Low: Already consolidated (Top 3 > 65%) OR too few suppliers (<5)
        # High: Fragmented (Top 3 < 45%) AND many suppliers (>10)
        # Medium: Moderate concentration (Top 3 = 45-65%) - catches the rest

        if top_3_pct > 65 or supplier_count < 5:
            # LOW: Already consolidated OR too few suppliers
            impact = ImpactFlag.LOW
            score = 0.25
            leverage_status = "already consolidated"
            recommendation = "further bundling may reduce competition and increase risk"
        elif top_3_pct < 45 and supplier_count > 10:
            # HIGH: Fragmented AND many suppliers
            impact = ImpactFlag.HIGH
            score = 0.90
            leverage_status = "highly fragmented"
            recommendation = "significant bundling headroom exists"
        else:
            # MEDIUM: 45-65% (implicitly supplier_count >= 5)
            impact = ImpactFlag.MEDIUM
            score = 0.55
            leverage_status = "moderately concentrated"
            recommendation = "bundling possible but watch consolidation risk"

        insight = (
            f"Top 3 suppliers control {top_3_pct:.1f}% of spend across {supplier_count} suppliers. "
            f"Category is {leverage_status} - {recommendation}"
        )

        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=impact,
            test_score=score,
            insight=insight,
            raw_data={
                "supplier_count": supplier_count,
                "top_1_pct": top_1_pct,
                "top_3_pct": top_3_pct,
                "top_3_suppliers": top_3_names,
                "total_spend": total_spend,
                "leverage_status": leverage_status
            }
        )

    def _evaluate_price_variance(
        self,
        proof_point: ProofPointDefinition,
        spend_data: pd.DataFrame,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> ProofPointResult:
        """
        Evaluate Price Variance comparing Supplier Price vs Market Price.

        FORMULA (Market-Based):
        Step 1: For each month: deviation = (supplier_price - market_price) / market_price × 100
                - Negative = Good (below market)
                - Positive = Risk (above market)

        Step 2: Count months by deviation thresholds:
                - months_above_5pct: deviation > +5%
                - months_above_10pct: deviation > +10%
                - months_above_20pct: deviation > +20%
                - months_at_or_below_market: deviation <= 0%

        Step 3: Classification (Buyer Lens):

        🔴 HIGH Impact (Sustained Overpricing):
            - ≥3 months > +10% above market
            - OR ≥5 months > +5% above market
            - OR Any single month > +20% above market
            → Bundling increases cost risk

        🟠 MEDIUM Impact (Pricing Gaps):
            - 1-2 months > +10% above market
            - OR 3-4 months between +5% to +10%
            - OR inconsistent pattern
            → Bundle with monitoring

        🟢 LOW Impact (Bundling Friendly):
            - At or below market (≤ 0%) for majority of months
            - No more than 1 month > +5% above market
            - No month > +10%
            → Safe for volume consolidation

        FALLBACK: If no market data, uses coefficient of variation (CoV ≥25% = HIGH)
        """
        price_col = self._get_column(spend_data, "price")

        if not price_col:
            return self._not_tested_result(proof_point, "Missing price column")

        # Get category from context
        category = context_data.get("category_name", "") if context_data else ""

        # Get market data from context (if uploaded separately)
        market_data = context_data.get("market_data") if context_data else None

        # Try new market-based price variance
        try:
            market_service = get_market_price_service()
            result = market_service.analyze_price_variance(
                spend_data=spend_data,
                category=category,
                market_data=market_data,
                context_data=context_data
            )

            # If we got valid market-based analysis
            if result.overall_position != PricePosition.UNKNOWN and result.months_analyzed > 0:
                # Calculate threshold counts for insight and raw_data
                months_above_5pct = sum(1 for m in result.monthly_breakdown if m.deviation_pct > 5)
                months_above_10pct = sum(1 for m in result.monthly_breakdown if m.deviation_pct > 10)
                months_above_20pct = sum(1 for m in result.monthly_breakdown if m.deviation_pct > 20)
                months_at_or_below = sum(1 for m in result.monthly_breakdown if m.deviation_pct <= 0)

                # Determine impact based on price position
                # Position already classified by MarketPriceService using count-based thresholds
                if result.overall_position == PricePosition.ABOVE_MARKET:
                    impact = ImpactFlag.HIGH
                    score = 0.85
                    position_text = "sustained overpricing"
                    # Build specific reason
                    reasons = []
                    if months_above_20pct >= 1:
                        reasons.append(f"{months_above_20pct} month(s) >20% above market")
                    if months_above_10pct >= 3:
                        reasons.append(f"{months_above_10pct} months >10% above market")
                    if months_above_5pct >= 5:
                        reasons.append(f"{months_above_5pct} months >5% above market")
                    reason_text = " | ".join(reasons) if reasons else "sustained above-market pricing"
                    action_text = f"bundling increases cost risk - {reason_text}"

                elif result.overall_position == PricePosition.AT_MARKET:
                    impact = ImpactFlag.MEDIUM
                    score = 0.55
                    position_text = "some pricing gaps"
                    action_text = f"{months_above_10pct} month(s) >10%, {months_above_5pct} month(s) >5% - bundle with monitoring"

                else:  # BELOW_MARKET = LOW Impact = Bundling Friendly
                    impact = ImpactFlag.LOW
                    score = 0.30
                    position_text = "competitive pricing"
                    action_text = f"{months_at_or_below}/{result.months_analyzed} months at/below market - safe for consolidation"

                insight = (
                    f"Supplier prices avg {result.overall_deviation_pct:+.1f}% vs market "
                    f"({result.months_analyzed} months, {result.confidence} confidence). "
                    f"{position_text.capitalize()}: {action_text}"
                )

                return ProofPointResult(
                    proof_point_code=proof_point.code,
                    proof_point_name=proof_point.name,
                    opportunity=self.opportunity_type,
                    impact_flag=impact,
                    test_score=score,
                    insight=insight,
                    raw_data={
                        "analysis_type": "market_comparison",
                        "overall_position": result.overall_position.value,
                        "overall_deviation_pct": result.overall_deviation_pct,
                        "months_analyzed": result.months_analyzed,
                        # New threshold counts
                        "months_at_or_below_market": months_at_or_below,
                        "months_above_5pct": months_above_5pct,
                        "months_above_10pct": months_above_10pct,
                        "months_above_20pct": months_above_20pct,
                        # Legacy counts (backward compatibility)
                        "below_market_months": result.below_market_months,
                        "at_market_months": result.at_market_months,
                        "above_market_months": result.above_market_months,
                        "avg_supplier_price": result.avg_supplier_price,
                        "avg_market_price": result.avg_market_price,
                        "market_data_source": result.market_data_source,
                        "confidence": result.confidence,
                        "monthly_breakdown": [
                            {
                                "month": m.month,
                                "supplier_price": m.supplier_price,
                                "market_price": m.market_price,
                                "deviation_pct": m.deviation_pct,
                                "position": m.position.value
                            }
                            for m in result.monthly_breakdown
                        ]
                    }
                )

        except Exception as e:
            # Log but continue to fallback
            import structlog
            logger = structlog.get_logger()
            logger.warning(f"[PP4] Market-based analysis failed, using fallback: {e}")

        # FALLBACK: Original coefficient of variation formula
        # Used when no market price data available
        prices = spend_data[price_col].dropna()
        if len(prices) < 2:
            return self._not_tested_result(proof_point, "Insufficient price data")

        mean_price = prices.mean()
        std_price = prices.std()
        min_price = prices.min()
        max_price = prices.max()

        if mean_price == 0:
            return self._not_tested_result(proof_point, "Invalid price data")

        # Coefficient of variation as variance measure
        variance_pct = (std_price / mean_price) * 100
        price_range_pct = ((max_price - min_price) / mean_price) * 100

        # Determine impact (HIGH variance = HIGH opportunity for Volume Bundling)
        if variance_pct >= 25:
            impact = ImpactFlag.HIGH
            score = 0.85
        elif variance_pct >= 10:
            impact = ImpactFlag.MEDIUM
            score = 0.55
        else:
            impact = ImpactFlag.LOW
            score = 0.25

        insight = (
            f"Price variance of {variance_pct:.1f}% across suppliers "
            f"(range: ${min_price:.2f} - ${max_price:.2f}). "
            f"Volume bundling can standardize pricing through consolidation"
        )

        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=impact,
            test_score=score,
            insight=insight,
            raw_data={
                "analysis_type": "coefficient_of_variation",
                "variance_pct": variance_pct,
                "price_range_pct": price_range_pct,
                "mean_price": mean_price,
                "min_price": min_price,
                "max_price": max_price,
                "market_data_available": False
            }
        )

    def _evaluate_avg_spend_supplier(
        self,
        proof_point: ProofPointDefinition,
        spend_data: pd.DataFrame,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> ProofPointResult:
        """
        Evaluate Average Spend per Supplier using Share-Based Logic.

        SCALABLE FORMULA (percentage-based, not absolute dollars):

        Step 1: Calculate Average Share per Supplier
                avg_share_pct = (1 / number_of_suppliers) × 100 = 100% / N

        Step 2: Classification based on average share:

        🔴 HIGH Impact (High Fragmentation):
            - Average share < 5% (i.e., > 20 suppliers)
            - Too many suppliers, none has meaningful share
            - High consolidation opportunity

        🟠 MEDIUM Impact (Moderate Fragmentation):
            - Average share 5% - 15% (i.e., 7-20 suppliers)
            - Moderate supplier base
            - Some consolidation possible

        🟢 LOW Impact (Low Fragmentation):
            - Average share > 15% (i.e., < 7 suppliers)
            - Already consolidated
            - Limited consolidation opportunity

        Example:
        - 15 suppliers → avg share = 6.67% → MEDIUM
        - 25 suppliers → avg share = 4% → HIGH
        - 5 suppliers → avg share = 20% → LOW
        """
        supplier_col = self._get_column(spend_data, "supplier")
        spend_col = self._get_column(spend_data, "spend")

        if not supplier_col or not spend_col:
            return self._not_tested_result(proof_point, "Missing required columns")

        supplier_spend = spend_data.groupby(supplier_col)[spend_col].sum()
        supplier_count = len(supplier_spend)
        total_spend = supplier_spend.sum()
        avg_spend = supplier_spend.mean()

        if supplier_count == 0:
            return self._not_tested_result(proof_point, "No suppliers found")

        # Calculate average share per supplier (percentage-based formula)
        avg_share_pct = (1 / supplier_count) * 100  # = 100% / N

        # Classification based on average share thresholds
        if avg_share_pct < 5:  # > 20 suppliers
            impact = ImpactFlag.HIGH
            score = 0.90
            fragmentation_level = "highly fragmented"
            action = "significant consolidation opportunity - reduce supplier count by 40-60%"
        elif avg_share_pct <= 15:  # 7-20 suppliers
            impact = ImpactFlag.MEDIUM
            score = 0.55
            fragmentation_level = "moderately fragmented"
            action = "selective consolidation possible - target 5-8 strategic suppliers"
        else:  # < 7 suppliers
            impact = ImpactFlag.LOW
            score = 0.25
            fragmentation_level = "already consolidated"
            action = "limited consolidation opportunity - focus on relationship optimization"

        insight = (
            f"Average share of {avg_share_pct:.1f}% per supplier across {supplier_count} suppliers "
            f"(avg ${avg_spend:,.0f} each). Category is {fragmentation_level} - {action}"
        )

        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=impact,
            test_score=score,
            insight=insight,
            raw_data={
                "avg_share_pct": avg_share_pct,
                "supplier_count": supplier_count,
                "avg_spend": avg_spend,
                "total_spend": total_spend,
                "fragmentation_level": fragmentation_level
            }
        )

    def _evaluate_market_consolidation(
        self,
        proof_point: ProofPointDefinition,
        spend_data: pd.DataFrame,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> ProofPointResult:
        """
        Evaluate Market Consolidation (HHI Index).
        Context: Low HHI = competitive market = buyer has leverage to bundle.
        """
        supplier_col = self._get_column(spend_data, "supplier")
        spend_col = self._get_column(spend_data, "spend")

        if not supplier_col or not spend_col:
            return self._not_tested_result(proof_point, "Missing required columns")

        supplier_spend = spend_data.groupby(supplier_col)[spend_col].sum()
        total_spend = supplier_spend.sum()

        if total_spend == 0:
            return self._not_tested_result(proof_point, "No spend data")

        # Calculate HHI (Herfindahl-Hirschman Index)
        market_shares = (supplier_spend / total_spend) * 100
        hhi = (market_shares ** 2).sum()

        # Determine impact (LOW HHI = HIGH bundling leverage)
        if hhi < 1500:
            impact = ImpactFlag.HIGH
            score = 0.85
            market_type = "competitive"
            bundling_potential = "excellent bundling leverage available"
        elif hhi < 2500:
            impact = ImpactFlag.MEDIUM
            score = 0.55
            market_type = "moderately concentrated"
            bundling_potential = "moderate bundling leverage"
        else:
            impact = ImpactFlag.LOW
            score = 0.25
            market_type = "highly concentrated"
            bundling_potential = "limited bundling leverage"

        insight = f"Market HHI of {hhi:.0f} indicates {market_type} market - {bundling_potential}"

        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=impact,
            test_score=score,
            insight=insight,
            raw_data={"hhi": hhi, "market_type": market_type}
        )

    def _evaluate_supplier_location(
        self,
        proof_point: ProofPointDefinition,
        spend_data: pd.DataFrame,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> ProofPointResult:
        """
        Evaluate Supplier Location.
        Context: Suppliers in same region = logistics bundling opportunity.
        """
        supplier_col = self._get_column(spend_data, "supplier")
        country_col = self._get_column(spend_data, "country")

        if not supplier_col or not country_col:
            return self._not_tested_result(proof_point, "Missing required columns")

        # Get unique supplier-region combinations
        supplier_regions = spend_data.groupby(supplier_col)[country_col].first()
        region_counts = supplier_regions.value_counts()
        total_suppliers = len(supplier_regions)

        if total_suppliers == 0:
            return self._not_tested_result(proof_point, "No supplier data")

        top_region = region_counts.index[0]
        top_region_pct = (region_counts.iloc[0] / total_suppliers) * 100

        # Determine impact (HIGH concentration in same region = HIGH logistics bundling)
        if top_region_pct >= 70:
            impact = ImpactFlag.HIGH
            score = 0.85
        elif top_region_pct >= 50:
            impact = ImpactFlag.MEDIUM
            score = 0.55
        else:
            impact = ImpactFlag.LOW
            score = 0.3

        insight = f"{top_region_pct:.1f}% of suppliers in {top_region} enables logistics and delivery bundling"

        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=impact,
            test_score=score,
            insight=insight,
            raw_data={
                "top_region": top_region,
                "pct_same_region": top_region_pct,
                "total_suppliers": total_suppliers
            }
        )

    def _evaluate_supplier_risk_rating(
        self,
        proof_point: ProofPointDefinition,
        spend_data: pd.DataFrame,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> ProofPointResult:
        """
        Evaluate Supplier Risk Rating - SYNCHRONOUS FALLBACK VERSION.
        This is called when async evaluation is not available.
        Uses basic formula-based assessment.

        For REAL-TIME OpenAI intelligence, use evaluate_pp8_async() instead.
        """
        supplier_col = self._get_column(spend_data, "supplier")
        spend_col = self._get_column(spend_data, "spend")

        if not supplier_col or not spend_col:
            return self._not_tested_result(proof_point, "Missing required columns")

        # Basic formula-based fallback (real intelligence comes from async version)
        supplier_spend = spend_data.groupby(supplier_col)[spend_col].sum().sort_values(ascending=False)
        total_spend = supplier_spend.sum()
        top_5_suppliers = supplier_spend.head(5)
        top_5_pct = (top_5_suppliers.sum() / total_spend) * 100 if total_spend > 0 else 0

        if len(supplier_spend) > 10 and top_5_pct < 70:
            impact = ImpactFlag.HIGH
            score = 0.8
            risk_profile = "low"
            insight = f"Top 5 suppliers have {risk_profile} risk profile - safe for volume consolidation"
        elif len(supplier_spend) > 5:
            impact = ImpactFlag.MEDIUM
            score = 0.5
            risk_profile = "moderate"
            insight = f"Mixed risk profile among top suppliers - selective bundling recommended"
        else:
            impact = ImpactFlag.LOW
            score = 0.3
            risk_profile = "elevated"
            insight = f"Concentrated supplier base with {risk_profile} risk - bundling may increase exposure"

        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=impact,
            test_score=score,
            insight=insight + " [Basic Assessment - OpenAI not invoked]",
            raw_data={
                "risk_profile": risk_profile,
                "top_5_pct": top_5_pct,
                "supplier_count": len(supplier_spend),
                "assessment_type": "formula_fallback"
            }
        )

    async def evaluate_pp8_async(
        self,
        proof_point: ProofPointDefinition,
        spend_data: pd.DataFrame,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> ProofPointResult:
        """
        Evaluate PP8 Supplier Risk Rating using REAL-TIME OpenAI Intelligence.

        This async method calls the SupplierIntelligenceService to evaluate
        each supplier using GPT-4o-mini with 6 weighted parameters:
        - Financial Strength (25%)
        - Supply Reliability (25%)
        - Pricing Competitiveness (20%)
        - Compliance/Governance (15%)
        - Volume Scalability (10%)
        - Geographic Diversification (5%)

        Returns PP8 impact based on supplier risk distribution:
        - HIGH: 50%+ suppliers rated GOOD, safe to consolidate
        - MEDIUM: Mixed supplier base
        - LOW: 40%+ suppliers rated HIGH_RISK, risky to consolidate
        """
        supplier_col = self._get_column(spend_data, "supplier")
        spend_col = self._get_column(spend_data, "spend")
        country_col = self._get_column(spend_data, "country")
        category_col = self._get_column(spend_data, "category")

        if not supplier_col or not spend_col:
            return self._not_tested_result(proof_point, "Missing required columns")

        # Get category from context
        category = context_data.get("category_name", "") if context_data else ""

        # Smart category matching function
        def categories_match(user_cat: str, data_cat: str) -> bool:
            """Smart matching: 'palm' matches 'Palm Oil', 'palm oils', etc."""
            if not user_cat or not data_cat:
                return False
            user_norm = user_cat.lower().strip()
            data_norm = data_cat.lower().strip()
            # Remove trailing 's' from 'oils' -> 'oil'
            if user_norm.endswith('oils'):
                user_norm = user_norm[:-1]
            if data_norm.endswith('oils'):
                data_norm = data_norm[:-1]
            # Exact match
            if user_norm == data_norm:
                return True
            # Contains match (palm matches palm oil)
            if user_norm in data_norm or data_norm in user_norm:
                return True
            # Word intersection (palm oil -> palm, oil)
            import re
            user_words = set(re.split(r'[\s\-_]+', user_norm))
            data_words = set(re.split(r'[\s\-_]+', data_norm))
            if user_words & data_words:
                return True
            return False

        # Filter spend_data by selected category if category column exists
        filtered_data = spend_data
        if category_col and category:
            # Use smart category matching
            mask = spend_data[category_col].apply(
                lambda x: categories_match(category, str(x) if pd.notna(x) else "")
            )
            filtered_data = spend_data[mask]

            # If still empty, use all data (user uploaded single-category file)
            if filtered_data.empty:
                filtered_data = spend_data

        # Build supplier list with spend from FILTERED data
        supplier_spend = filtered_data.groupby(supplier_col)[spend_col].sum().sort_values(ascending=False)

        # Get country for each supplier (most common) from FILTERED data
        supplier_countries = {}
        if country_col:
            for supplier in supplier_spend.index:
                supplier_data = filtered_data[filtered_data[supplier_col] == supplier]
                if not supplier_data.empty and country_col in supplier_data.columns:
                    countries = supplier_data[country_col].value_counts()
                    if len(countries) > 0:
                        supplier_countries[supplier] = countries.index[0]

        # Build supplier list for evaluation
        suppliers: List[Dict[str, Any]] = []
        for supplier_name, spend in supplier_spend.items():
            suppliers.append({
                "name": str(supplier_name),
                "spend": float(spend),
                "country": supplier_countries.get(supplier_name, "Unknown")
            })

        if not suppliers:
            return self._not_tested_result(proof_point, "No suppliers found in data")

        # Get category spend from context (authoritative source)
        # This ensures we use the user-selected category spend, not sum of all data
        context_category_spend = context_data.get("category_spend", 0) if context_data else 0

        try:
            # Call OpenAI-powered supplier intelligence service
            service = get_supplier_intelligence_service()
            result = await service.evaluate_multiple_suppliers(
                suppliers=suppliers,
                category=category,
                country=suppliers[0].get("country", ""),  # Default to first supplier's country
                category_spend=context_category_spend  # Pass authoritative category spend
            )

            # Extract PP8 impact from result
            impact_str = result.get("impact", "Medium")
            if impact_str == "High":
                impact = ImpactFlag.HIGH
                score = 0.85
            elif impact_str == "Low":
                impact = ImpactFlag.LOW
                score = 0.3
            else:
                impact = ImpactFlag.MEDIUM
                score = 0.55

            # Build detailed insight
            summary = result.get("summary", {})
            recs = result.get("recommendations", {})
            anchor_candidates = recs.get("anchor_candidates", [])
            strategy = recs.get("strategy", "")

            insight = result.get("reasoning", "Supplier risk assessment complete")
            if anchor_candidates:
                insight += f". ANCHOR candidates: {', '.join(anchor_candidates[:3])}"

            return ProofPointResult(
                proof_point_code=proof_point.code,
                proof_point_name=proof_point.name,
                opportunity=self.opportunity_type,
                impact_flag=impact,
                test_score=score,
                insight=insight,
                raw_data={
                    "assessment_type": "openai_realtime",
                    "model_used": result.get("model_used", "gpt-4o-mini"),
                    "category_filtered": category,
                    "suppliers_in_category": len(suppliers),
                    "total_evaluated": summary.get("total_evaluated", 0),
                    "good_count": summary.get("good_count", 0),
                    "medium_count": summary.get("medium_count", 0),
                    "high_risk_count": summary.get("high_risk_count", 0),
                    "anchor_candidates": anchor_candidates,
                    "challenger_candidates": recs.get("challenger_candidates", []),
                    "tail_only": recs.get("tail_only", []),
                    "strategy": strategy,
                    "supplier_evaluations": result.get("supplier_evaluations", [])
                }
            )

        except Exception as e:
            # Fall back to formula-based assessment on error
            return ProofPointResult(
                proof_point_code=proof_point.code,
                proof_point_name=proof_point.name,
                opportunity=self.opportunity_type,
                impact_flag=ImpactFlag.MEDIUM,
                test_score=0.5,
                insight=f"Supplier intelligence service unavailable: {str(e)[:50]}. Using basic assessment.",
                raw_data={
                    "assessment_type": "fallback_error",
                    "error": str(e)
                },
                is_tested=True
            )

    def _not_tested_result(self, proof_point: ProofPointDefinition, reason: str) -> ProofPointResult:
        """Create a NOT_TESTED result."""
        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=ImpactFlag.NOT_TESTED,
            test_score=0.0,
            insight=reason,
            is_tested=False
        )
