"""
Volume Bundling Micro-Agent
Evaluates 8 proof points for volume bundling opportunities.

HYBRID ARCHITECTURE:
- Uses CacheService for pre-computed metrics when available (fast path)
- Falls back to real-time computation from spend_data (slow path)

Proof Points:
1. Regional Spend Addressability
2. Tail Spend Consolidation Opportunity
3. Volume Leverage from Fragmented Category Spend
4. Price Variance for Identical Items/SKUs (SHARED with Target Pricing)
5. Average Spend per Supplier vs. Industry Benchmarks
6. Market Consolidation
7. Supplier Location
8. Supplier Risk Rating (SHARED with Risk Management)
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
        Context: Fragmented = HIGH impact (opportunity to leverage).
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

        top_supplier_pct = (supplier_spend.iloc[0] / total_spend) * 100 if len(supplier_spend) > 0 else 0

        # Determine impact (MORE fragmented = HIGHER opportunity)
        if supplier_count > 10 and top_supplier_pct < 20:
            impact = ImpactFlag.HIGH
            score = 0.9
        elif supplier_count > 5 and top_supplier_pct < 40:
            impact = ImpactFlag.MEDIUM
            score = 0.6
        else:
            impact = ImpactFlag.LOW
            score = 0.3

        insight = f"Spend fragmented across {supplier_count} suppliers - top supplier has only {top_supplier_pct:.1f}%, indicating volume leverage opportunity"

        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=impact,
            test_score=score,
            insight=insight,
            raw_data={
                "supplier_count": supplier_count,
                "top_supplier_pct": top_supplier_pct
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
        Evaluate Price Variance for Identical Items/SKUs.
        Volume Bundling Context: High variance = opportunity to negotiate standardized volume pricing.
        """
        price_col = self._get_column(spend_data, "price")
        supplier_col = self._get_column(spend_data, "supplier")

        if not price_col:
            return self._not_tested_result(proof_point, "Missing price column")

        # Calculate price statistics
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

        insight = f"Price variance of {variance_pct:.1f}% across suppliers enables volume-based price harmonization through bundling"

        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=impact,
            test_score=score,
            insight=insight,
            raw_data={
                "variance_pct": variance_pct,
                "price_range_pct": price_range_pct,
                "mean_price": mean_price,
                "min_price": min_price,
                "max_price": max_price
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
        Evaluate Average Spend per Supplier vs. Industry Benchmarks.
        Context: Low average = too many suppliers = consolidation opportunity.
        """
        supplier_col = self._get_column(spend_data, "supplier")
        spend_col = self._get_column(spend_data, "spend")

        if not supplier_col or not spend_col:
            return self._not_tested_result(proof_point, "Missing required columns")

        supplier_spend = spend_data.groupby(supplier_col)[spend_col].sum()
        avg_spend = supplier_spend.mean()

        # Benchmarks (industry average is around $500K per supplier)
        if avg_spend < 100000:
            impact = ImpactFlag.HIGH
            score = 0.9
            insight = f"Average spend of ${avg_spend:,.0f} per supplier is significantly below benchmark - high consolidation potential"
        elif avg_spend < 500000:
            impact = ImpactFlag.MEDIUM
            score = 0.6
            insight = f"Average spend of ${avg_spend:,.0f} per supplier indicates moderate consolidation opportunity"
        else:
            impact = ImpactFlag.LOW
            score = 0.3
            insight = f"Average spend of ${avg_spend:,.0f} per supplier is at or above benchmark - already consolidated"

        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=impact,
            test_score=score,
            insight=insight,
            raw_data={"avg_spend": avg_spend, "supplier_count": len(supplier_spend)}
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
        Evaluate Supplier Risk Rating.
        Volume Bundling Context: Low risk suppliers = safe to consolidate with.
        """
        supplier_col = self._get_column(spend_data, "supplier")
        spend_col = self._get_column(spend_data, "spend")

        if not supplier_col or not spend_col:
            return self._not_tested_result(proof_point, "Missing required columns")

        # In real implementation, this would cross-reference with supplier risk database
        # For now, we simulate based on spend concentration
        supplier_spend = spend_data.groupby(supplier_col)[spend_col].sum().sort_values(ascending=False)
        total_spend = supplier_spend.sum()
        top_5_suppliers = supplier_spend.head(5)
        top_5_pct = (top_5_suppliers.sum() / total_spend) * 100 if total_spend > 0 else 0

        # Simulate risk assessment (in reality, would use external risk data)
        # Assume diversified supplier base indicates lower risk
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
            insight=insight,
            raw_data={
                "risk_profile": risk_profile,
                "top_5_pct": top_5_pct,
                "supplier_count": len(supplier_spend)
            }
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
