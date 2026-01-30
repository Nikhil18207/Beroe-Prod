"""
Re-specification Pack Micro-Agent
Evaluates 3 proof points for re-specification pack opportunities.

HYBRID ARCHITECTURE:
- Uses CacheService for pre-computed metrics when available (fast path)
- Falls back to real-time computation from spend_data (slow path)

Proof Points:
1. Price Variance for Identical Items/SKUs (SHARED with Volume Bundling, Target Pricing)
2. Export Data (UNIQUE to Re-spec Pack)
3. Cost Structure (SHARED with Target Pricing)
"""

from typing import Dict, Optional, Any
import pandas as pd
import numpy as np

from app.agents.base_agent import BaseMicroAgent, ProofPointResult, PROOF_POINT_METRIC_MAP
from app.agents.proof_points import (
    ProofPointDefinition,
    OpportunityType,
    ImpactFlag,
)


class RespecPackAgent(BaseMicroAgent):
    """
    Micro-agent for Re-specification Pack opportunity.
    Context: Standardize specifications across markets to reduce complexity and costs.
    
    HYBRID ARCHITECTURE:
    - Checks cache for pre-computed metrics first (instant)
    - Falls back to spend_data computation if no cache
    """

    def __init__(self):
        super().__init__(OpportunityType.RESPEC_PACK)

    @property
    def name(self) -> str:
        return "Re-specification Pack"

    @property
    def description(self) -> str:
        return "Optimize specifications by standardizing packaging across multiple markets and utilizing global standards to reduce complexity and achieve cost savings."

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
            "PP_PRICE_VARIANCE": self._cache_price_variance,
            "PP_EXPORT_DATA": self._cache_export_data,
            "PP_COST_STRUCTURE": self._cache_cost_structure,
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
    
    def _cache_price_variance(self, pp: ProofPointDefinition, metrics: Dict[str, float]) -> ProofPointResult:
        """Evaluate price variance from cached metrics (Re-spec context)."""
        variance = metrics.get("price_variance", 0)
        
        # Re-spec context: variance indicates specification inconsistencies
        if variance >= 15:
            score = 0.9
            insight = f"High price variance ({variance:.1f}%) - specification differences likely driving costs"
        elif variance >= 8:
            score = 0.6
            insight = f"Moderate price variance ({variance:.1f}%) - specification standardization opportunity exists"
        else:
            score = 0.3
            insight = f"Low price variance ({variance:.1f}%) - specifications appear optimized"
        
        return self._create_result(pp, score, insight, {"price_variance": variance})
    
    def _cache_export_data(self, pp: ProofPointDefinition, metrics: Dict[str, float]) -> ProofPointResult:
        """Evaluate export data from cached metrics."""
        coverage = metrics.get("export_market_coverage", 50)
        compliance = metrics.get("global_spec_compliance", 50)
        
        combined_score = (coverage + compliance) / 2
        
        if combined_score < 60:
            score = 0.85
            insight = f"Low global standards coverage ({coverage:.0f}%) - significant optimization opportunity"
        elif combined_score < 80:
            score = 0.55
            insight = f"Moderate global standards coverage ({coverage:.0f}%) - some optimization potential"
        else:
            score = 0.3
            insight = f"High global standards coverage ({coverage:.0f}%) - specifications well-aligned"
        
        return self._create_result(pp, score, insight, {
            "export_market_coverage": coverage,
            "global_spec_compliance": compliance
        })
    
    def _cache_cost_structure(self, pp: ProofPointDefinition, metrics: Dict[str, float]) -> ProofPointResult:
        """Evaluate cost structure from cached metrics (Re-spec context)."""
        commodity_pct = metrics.get("commodity_percentage", 50)
        raw_material = metrics.get("raw_material_exposure", commodity_pct)
        
        # Re-spec context: high raw material = opportunity to optimize specs
        if raw_material >= 50:
            score = 0.85
            insight = f"High raw material exposure ({raw_material:.0f}%) - specification optimization can yield significant savings"
        elif raw_material >= 30:
            score = 0.55
            insight = f"Moderate raw material exposure ({raw_material:.0f}%) - some re-specification potential"
        else:
            score = 0.3
            insight = f"Low raw material exposure ({raw_material:.0f}%) - limited re-specification opportunity"
        
        return self._create_result(pp, score, insight, {"raw_material_exposure": raw_material})

    def evaluate_proof_point(
        self,
        proof_point: ProofPointDefinition,
        spend_data: pd.DataFrame,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> ProofPointResult:
        """Evaluate a proof point in Re-specification Pack context."""

        evaluators = {
            "PP_PRICE_VARIANCE": self._evaluate_price_variance,
            "PP_EXPORT_DATA": self._evaluate_export_data,
            "PP_COST_STRUCTURE": self._evaluate_cost_structure,
        }

        evaluator = evaluators.get(proof_point.code)
        if evaluator:
            return evaluator(proof_point, spend_data, category_spend, context_data)

        return self._not_tested_result(proof_point, "Evaluation not implemented")

    def _evaluate_price_variance(
        self,
        proof_point: ProofPointDefinition,
        spend_data: pd.DataFrame,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> ProofPointResult:
        """
        Evaluate Price Variance for Identical Items/SKUs.
        Re-spec Context: High variance = specification inconsistencies across markets.

        NOTE: Same data as Volume Bundling & Target Pricing but DIFFERENT interpretation!
        - Volume Bundling: "Variance = consolidate and standardize suppliers"
        - Target Pricing: "Variance = use lowest price as target for all"
        - Re-spec Pack: "Variance = specification differences causing cost variation"
        """
        price_col = self._get_column(spend_data, "price")
        sku_col = self._get_column(spend_data, "sku") or self._get_column(spend_data, "item")

        if not price_col:
            return self._not_tested_result(proof_point, "Missing price column")

        prices = spend_data[price_col].dropna()
        if len(prices) < 2:
            return self._not_tested_result(proof_point, "Insufficient price data")

        mean_price = prices.mean()
        min_price = prices.min()
        max_price = prices.max()

        if mean_price == 0:
            return self._not_tested_result(proof_point, "Invalid price data")

        # Calculate coefficient of variation
        std_price = prices.std()
        cv_pct = (std_price / mean_price) * 100

        # For Re-spec Pack: HIGH variance = HIGH opportunity to standardize specs
        if cv_pct >= 15:
            impact = ImpactFlag.HIGH
            score = 0.9
            insight_action = "specification standardization highly recommended"
        elif cv_pct >= 8:
            impact = ImpactFlag.MEDIUM
            score = 0.6
            insight_action = "moderate specification standardization opportunity"
        else:
            impact = ImpactFlag.LOW
            score = 0.3
            insight_action = "specifications already well-standardized"

        # Count unique SKUs if available to understand spec complexity
        unique_skus = spend_data[sku_col].nunique() if sku_col else len(prices)

        insight = f"Price CV of {cv_pct:.1f}% across {unique_skus} variants - {insight_action}"

        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=impact,
            test_score=score,
            insight=insight,
            raw_data={
                "coefficient_of_variation_pct": cv_pct,
                "unique_variants": unique_skus,
                "mean_price": mean_price,
                "min_price": min_price,
                "max_price": max_price,
                "potential_savings_per_unit": mean_price - min_price
            }
        )

    def _evaluate_export_data(
        self,
        proof_point: ProofPointDefinition,
        spend_data: pd.DataFrame,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> ProofPointResult:
        """
        Evaluate Export Data.
        Context: Analyze global packaging standards compliance and optimization opportunities.
        
        This proof point assesses:
        1. Coverage of international packaging standards (ISO, ASTM, etc.)
        2. Export market compliance requirements
        3. Opportunities to harmonize specifications globally
        """
        country_col = self._get_column(spend_data, "country")
        region_col = self._get_column(spend_data, "region")
        spend_col = self._get_column(spend_data, "spend")
        category_col = self._get_column(spend_data, "category")

        # Get category name for context
        category_name = "Unknown"
        if category_col and len(spend_data) > 0:
            category_name = spend_data[category_col].iloc[0]
        elif context_data and "category_name" in context_data:
            category_name = context_data["category_name"]

        # Determine if this is a packaging-related category
        packaging_keywords = [
            "packaging", "corrugated", "box", "carton", "container",
            "bag", "pouch", "wrap", "film", "label", "bottle", "can",
            "jar", "tube", "blister", "clamshell", "tray"
        ]
        category_lower = str(category_name).lower()
        is_packaging = any(kw in category_lower for kw in packaging_keywords)

        # Analyze geographic diversity (proxy for export complexity)
        if country_col:
            countries = spend_data[country_col].dropna().unique()
            num_countries = len(countries)
        elif region_col:
            regions = spend_data[region_col].dropna().unique()
            num_countries = len(regions) * 3  # Estimate countries per region
        else:
            num_countries = 1

        # Define global standard regions and requirements
        high_standard_regions = {"EU", "Europe", "US", "USA", "Japan", "Australia", "Canada", "UK"}
        emerging_regions = {"China", "India", "Brazil", "Mexico", "Southeast Asia", "Africa", "Middle East"}

        # Count regions by standard requirements
        high_std_count = 0
        emerging_count = 0
        
        if country_col:
            for country in countries:
                country_str = str(country).upper()
                if any(reg in country_str for reg in high_standard_regions):
                    high_std_count += 1
                elif any(reg in country_str for reg in emerging_regions):
                    emerging_count += 1
        else:
            # Default split assumption
            high_std_count = max(1, num_countries // 2)
            emerging_count = num_countries - high_std_count

        # Calculate export complexity score
        total_regions = high_std_count + emerging_count
        if total_regions == 0:
            total_regions = 1
        
        # Higher diversity = more opportunity for standardization
        diversity_score = min(num_countries / 10, 1.0)  # Cap at 10 countries
        mixed_standard_score = min(high_std_count, emerging_count) / max(total_regions, 1)

        # Determine impact
        if is_packaging and num_countries >= 5:
            impact = ImpactFlag.HIGH
            score = 0.85
            coverage_pct = 100 - (diversity_score * 40)  # More diverse = lower coverage
            insight = f"Packaging across {num_countries} markets with varying standards - global spec harmonization recommended"
        elif num_countries >= 3 or (is_packaging and num_countries >= 2):
            impact = ImpactFlag.MEDIUM
            score = 0.6
            coverage_pct = 70
            insight = f"Multi-market presence ({num_countries} markets) - moderate specification optimization opportunity"
        else:
            impact = ImpactFlag.LOW
            score = 0.3
            coverage_pct = 90
            insight = f"Limited geographic spread ({num_countries} markets) - specifications may already be optimized"

        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=impact,
            test_score=score,
            insight=insight,
            raw_data={
                "category": category_name,
                "is_packaging_category": is_packaging,
                "num_markets": num_countries,
                "high_standard_markets": high_std_count,
                "emerging_markets": emerging_count,
                "global_coverage_estimate_pct": coverage_pct,
                "harmonization_opportunity": diversity_score
            }
        )

    def _evaluate_cost_structure(
        self,
        proof_point: ProofPointDefinition,
        spend_data: pd.DataFrame,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> ProofPointResult:
        """
        Evaluate Cost Structure.
        Re-spec Context: Material-driven costs = opportunity for specification optimization.
        
        NOTE: Same proof point as Target Pricing but DIFFERENT interpretation!
        - Target Pricing: "Commodity-driven = use index pricing"
        - Re-spec Pack: "Material-heavy = optimize specifications to reduce material usage"
        """
        category_col = self._get_column(spend_data, "category")

        # Get category name
        category_name = "Unknown"
        if category_col and len(spend_data) > 0:
            category_name = spend_data[category_col].iloc[0]
        elif context_data and "category_name" in context_data:
            category_name = context_data["category_name"]

        # Categories where re-specification has high impact
        respec_high_impact_categories = [
            "packaging", "corrugated", "paper", "plastics", "film",
            "carton", "box", "container", "bottle", "can"
        ]
        
        # Categories where material optimization matters
        material_driven_categories = [
            "steel", "aluminum", "copper", "packaging", "corrugated", "paper",
            "plastics", "chemicals", "rubber", "glass", "wood", "pulp"
        ]

        category_lower = str(category_name).lower()
        is_respec_high_impact = any(cat in category_lower for cat in respec_high_impact_categories)
        is_material_driven = any(mat in category_lower for mat in material_driven_categories)

        if is_respec_high_impact:
            impact = ImpactFlag.HIGH
            score = 0.9
            raw_material_pct = 70
            cost_type = "material-intensive"
            optimization_approach = "right-sizing and material substitution can yield significant savings"
        elif is_material_driven:
            impact = ImpactFlag.MEDIUM
            score = 0.6
            raw_material_pct = 55
            cost_type = "moderately material-driven"
            optimization_approach = "specification review may identify optimization opportunities"
        else:
            # Check for value-added categories
            value_add_indicators = ["services", "software", "consulting", "maintenance", "engineering", "labor"]
            is_value_add = any(va in category_lower for va in value_add_indicators)

            if is_value_add:
                impact = ImpactFlag.LOW
                score = 0.25
                raw_material_pct = 15
                cost_type = "labor/service-intensive"
                optimization_approach = "re-specification has limited applicability"
            else:
                impact = ImpactFlag.LOW
                score = 0.35
                raw_material_pct = 35
                cost_type = "mixed"
                optimization_approach = "limited re-specification opportunity identified"

        insight = f"Cost structure is {cost_type} with raw materials estimated at {raw_material_pct}% - {optimization_approach}"

        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=impact,
            test_score=score,
            insight=insight,
            raw_data={
                "category": category_name,
                "cost_type": cost_type,
                "raw_material_pct": raw_material_pct,
                "is_respec_high_impact": is_respec_high_impact,
                "is_material_driven": is_material_driven
            }
        )
