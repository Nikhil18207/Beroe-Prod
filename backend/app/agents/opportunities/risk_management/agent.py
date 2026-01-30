"""
Risk Management Micro-Agent
Evaluates 7 proof points for risk management opportunities.

HYBRID ARCHITECTURE:
- Uses CacheService for pre-computed metrics when available (fast path)
- Falls back to real-time computation from spend_data (slow path)

Proof Points:
1. Single Sourcing / Supplier Dependency Risk
2. Supplier Concentration Risk
3. Category Risk
4. Inflation
5. Exchange Rate
6. Geo Political Risk
7. Supplier Risk Rating (SHARED with Volume Bundling)
"""

from typing import Dict, Optional, Any, List
import pandas as pd
import numpy as np

from app.agents.base_agent import BaseMicroAgent, ProofPointResult, PROOF_POINT_METRIC_MAP
from app.agents.proof_points import (
    ProofPointDefinition,
    OpportunityType,
    ImpactFlag,
)


class RiskManagementAgent(BaseMicroAgent):
    """
    Micro-agent for Risk Management opportunity.
    Context: Identify and mitigate supply chain risks through diversification and monitoring.
    
    HYBRID ARCHITECTURE:
    - Checks cache for pre-computed metrics first (instant)
    - Falls back to spend_data computation if no cache
    """

    def __init__(self):
        super().__init__(OpportunityType.RISK_MANAGEMENT)

    @property
    def name(self) -> str:
        return "Risk Management"

    @property
    def description(self) -> str:
        return "Identify supply chain vulnerabilities and develop mitigation strategies for supplier, geographic, financial, and market risks."

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
            "PP_SINGLE_SOURCING": self._cache_single_sourcing,
            "PP_SUPPLIER_CONCENTRATION": self._cache_supplier_concentration,
            "PP_CATEGORY_RISK": self._cache_category_risk,
            "PP_INFLATION": self._cache_inflation,
            "PP_EXCHANGE_RATE": self._cache_exchange_rate,
            "PP_GEO_POLITICAL": self._cache_geo_political,
            "PP_SUPPLIER_RISK_RATING": self._cache_supplier_risk_rating,
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
            f"Risk metric: {first_metric:.1f}",
            metrics
        )
    
    def _cache_single_sourcing(self, pp: ProofPointDefinition, metrics: Dict[str, float]) -> ProofPointResult:
        """Evaluate single sourcing risk from cached metrics."""
        single_source = metrics.get("single_source_spend", 0)
        top_3 = metrics.get("top_3_concentration", 0)
        
        if single_source >= 50 or top_3 >= 80:
            score = 0.9
            insight = f"CRITICAL: {single_source:.1f}% single-source spend - diversification urgently needed"
        elif single_source >= 25 or top_3 >= 60:
            score = 0.6
            insight = f"ELEVATED: {single_source:.1f}% single-source - backup supplier recommended"
        else:
            score = 0.3
            insight = f"Manageable: {single_source:.1f}% single-source - risk within tolerance"
        
        return self._create_result(pp, score, insight, {"single_source_spend": single_source, "top_3_concentration": top_3})
    
    def _cache_supplier_concentration(self, pp: ProofPointDefinition, metrics: Dict[str, float]) -> ProofPointResult:
        """Evaluate supplier concentration risk from cached metrics."""
        hhi = metrics.get("hhi_index", 0)
        top_3 = metrics.get("top_3_concentration", 0)
        
        if hhi >= 2500 or top_3 >= 80:
            score = 0.9
            insight = f"High concentration risk (HHI: {hhi:.0f}, Top 3: {top_3:.1f}%) - supply chain vulnerable"
        elif hhi >= 1500 or top_3 >= 60:
            score = 0.6
            insight = f"Moderate concentration (HHI: {hhi:.0f}) - monitor supplier health"
        else:
            score = 0.3
            insight = f"Healthy diversification (HHI: {hhi:.0f}) - concentration risk low"
        
        return self._create_result(pp, score, insight, {"hhi_index": hhi, "top_3_concentration": top_3})
    
    def _cache_category_risk(self, pp: ProofPointDefinition, metrics: Dict[str, float]) -> ProofPointResult:
        """Evaluate category risk from cached metrics."""
        risk_score = metrics.get("category_risk_score", 50)
        volatility = metrics.get("price_volatility", 0)
        
        if risk_score >= 70 or volatility >= 20:
            score = 0.85
            insight = f"High category risk (score: {risk_score:.0f}, volatility: {volatility:.1f}%)"
        elif risk_score >= 40 or volatility >= 10:
            score = 0.55
            insight = f"Moderate category risk - monitor market conditions"
        else:
            score = 0.3
            insight = f"Low category risk - stable supply market"
        
        return self._create_result(pp, score, insight, {"category_risk_score": risk_score, "price_volatility": volatility})
    
    def _cache_inflation(self, pp: ProofPointDefinition, metrics: Dict[str, float]) -> ProofPointResult:
        """Evaluate inflation risk from cached metrics."""
        inflation_exposure = metrics.get("inflation_exposure", 0)
        commodity_pct = metrics.get("commodity_percentage", 50)
        
        if inflation_exposure >= 8 or commodity_pct >= 70:
            score = 0.85
            insight = f"High inflation exposure ({inflation_exposure:.1f}%) - hedging recommended"
        elif inflation_exposure >= 4 or commodity_pct >= 50:
            score = 0.55
            insight = f"Moderate inflation risk - review pricing mechanisms"
        else:
            score = 0.3
            insight = f"Low inflation exposure - current contracts provide protection"
        
        return self._create_result(pp, score, insight, {"inflation_exposure": inflation_exposure})
    
    def _cache_exchange_rate(self, pp: ProofPointDefinition, metrics: Dict[str, float]) -> ProofPointResult:
        """Evaluate exchange rate risk from cached metrics."""
        forex_exposure = metrics.get("forex_exposure", 0)
        geo_risk = metrics.get("geo_concentration_risk", 0)
        
        if forex_exposure >= 30 or geo_risk >= 70:
            score = 0.85
            insight = f"High FX exposure ({forex_exposure:.1f}%) - currency hedging needed"
        elif forex_exposure >= 15 or geo_risk >= 40:
            score = 0.55
            insight = f"Moderate FX exposure - monitor currency trends"
        else:
            score = 0.3
            insight = f"Low FX exposure - predominantly domestic sourcing"
        
        return self._create_result(pp, score, insight, {"forex_exposure": forex_exposure, "geo_risk": geo_risk})
    
    def _cache_geo_political(self, pp: ProofPointDefinition, metrics: Dict[str, float]) -> ProofPointResult:
        """Evaluate geo-political risk from cached metrics."""
        geo_risk = metrics.get("geo_concentration_risk", 0)
        high_risk_pct = metrics.get("high_risk_country_spend", 0)
        
        if geo_risk >= 70 or high_risk_pct >= 30:
            score = 0.9
            insight = f"HIGH geo-political risk ({high_risk_pct:.1f}% in high-risk regions) - diversify geography"
        elif geo_risk >= 40 or high_risk_pct >= 15:
            score = 0.6
            insight = f"Elevated geo-political risk - develop contingency plans"
        else:
            score = 0.3
            insight = f"Low geo-political risk - stable sourcing regions"
        
        return self._create_result(pp, score, insight, {"geo_risk": geo_risk, "high_risk_country_spend": high_risk_pct})
    
    def _cache_supplier_risk_rating(self, pp: ProofPointDefinition, metrics: Dict[str, float]) -> ProofPointResult:
        """Evaluate supplier risk rating from cached metrics."""
        avg_quality = metrics.get("avg_supplier_quality", 0)
        high_risk_spend = metrics.get("high_risk_supplier_spend", 0)
        
        # Invert quality for risk score (lower quality = higher risk)
        risk_score = 100 - avg_quality if avg_quality > 0 else 50
        
        if risk_score >= 60 or high_risk_spend >= 20:
            score = 0.85
            insight = f"High supplier risk ({high_risk_spend:.1f}% spend with high-risk suppliers)"
        elif risk_score >= 40 or high_risk_spend >= 10:
            score = 0.55
            insight = f"Moderate supplier risk - enhanced monitoring recommended"
        else:
            score = 0.3
            insight = f"Low supplier risk - supplier base is financially stable"
        
        return self._create_result(pp, score, insight, {"avg_quality": avg_quality, "high_risk_spend": high_risk_spend})

    def evaluate_proof_point(
        self,
        proof_point: ProofPointDefinition,
        spend_data: pd.DataFrame,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> ProofPointResult:
        """Evaluate a proof point in Risk Management context."""

        evaluators = {
            "PP_SINGLE_SOURCING": self._evaluate_single_sourcing,
            "PP_SUPPLIER_CONCENTRATION": self._evaluate_supplier_concentration,
            "PP_CATEGORY_RISK": self._evaluate_category_risk,
            "PP_INFLATION": self._evaluate_inflation,
            "PP_EXCHANGE_RATE": self._evaluate_exchange_rate,
            "PP_GEO_POLITICAL": self._evaluate_geo_political,
            "PP_SUPPLIER_RISK_RATING": self._evaluate_supplier_risk_rating,
        }

        evaluator = evaluators.get(proof_point.code)
        if evaluator:
            return evaluator(proof_point, spend_data, category_spend, context_data)

        return self._not_tested_result(proof_point, "Evaluation not implemented")

    def _evaluate_single_sourcing(
        self,
        proof_point: ProofPointDefinition,
        spend_data: pd.DataFrame,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> ProofPointResult:
        """
        Evaluate Single Sourcing / Supplier Dependency Risk.
        Risk Context: Single source = HIGH risk, need backup suppliers.
        """
        supplier_col = self._get_column(spend_data, "supplier")
        spend_col = self._get_column(spend_data, "spend")
        item_col = self._get_column(spend_data, "item")

        if not supplier_col:
            return self._not_tested_result(proof_point, "Missing supplier column")

        unique_suppliers = spend_data[supplier_col].dropna().nunique()

        # Check for single-sourced items
        single_sourced_items = []
        if item_col:
            item_supplier_counts = spend_data.groupby(item_col)[supplier_col].nunique()
            single_sourced_items = item_supplier_counts[item_supplier_counts == 1].index.tolist()
            single_source_pct = (len(single_sourced_items) / len(item_supplier_counts)) * 100 if len(item_supplier_counts) > 0 else 0
        else:
            single_source_pct = 100 if unique_suppliers == 1 else 0

        # Calculate spend concentration in single-sourced items
        single_source_spend_pct = 0
        if spend_col and item_col and len(single_sourced_items) > 0:
            single_source_spend = spend_data[spend_data[item_col].isin(single_sourced_items)][spend_col].sum()
            total_spend = spend_data[spend_col].sum()
            single_source_spend_pct = (single_source_spend / total_spend) * 100 if total_spend > 0 else 0

        # Risk Management Context: Single sourcing = HIGH RISK
        if single_source_pct >= 50 or unique_suppliers == 1:
            impact = ImpactFlag.HIGH
            score = 0.9
            risk_level = "critical"
        elif single_source_pct >= 25 or unique_suppliers <= 2:
            impact = ImpactFlag.MEDIUM
            score = 0.6
            risk_level = "elevated"
        else:
            impact = ImpactFlag.LOW
            score = 0.3
            risk_level = "manageable"

        insight = f"Single-source dependency is {risk_level}: {single_source_pct:.1f}% of items have only 1 supplier - diversification recommended"

        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=impact,
            test_score=score,
            insight=insight,
            raw_data={
                "unique_suppliers": unique_suppliers,
                "single_sourced_items_count": len(single_sourced_items),
                "single_source_pct": single_source_pct,
                "single_source_spend_pct": single_source_spend_pct,
                "risk_level": risk_level
            }
        )

    def _evaluate_supplier_concentration(
        self,
        proof_point: ProofPointDefinition,
        spend_data: pd.DataFrame,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> ProofPointResult:
        """
        Evaluate Supplier Concentration Risk.
        Risk Context: High concentration with few suppliers = supply chain vulnerability.
        """
        supplier_col = self._get_column(spend_data, "supplier")
        spend_col = self._get_column(spend_data, "spend")

        if not supplier_col:
            return self._not_tested_result(proof_point, "Missing supplier column")

        unique_suppliers = spend_data[supplier_col].dropna().nunique()

        # Calculate HHI (Herfindahl-Hirschman Index) if spend data available
        hhi = 0
        top_supplier_share = 0
        top_3_share = 0

        if spend_col:
            supplier_spend = spend_data.groupby(supplier_col)[spend_col].sum()
            total_spend = supplier_spend.sum()

            if total_spend > 0:
                market_shares = (supplier_spend / total_spend) * 100
                hhi = (market_shares ** 2).sum()
                top_supplier_share = market_shares.max()
                top_3_share = market_shares.nlargest(3).sum()

        # Risk Management Context: High concentration = HIGH RISK
        # HHI > 2500 = highly concentrated, 1500-2500 = moderately concentrated
        if hhi > 2500 or top_supplier_share > 60:
            impact = ImpactFlag.HIGH
            score = 0.85
            concentration_level = "highly concentrated"
        elif hhi > 1500 or top_supplier_share > 40:
            impact = ImpactFlag.MEDIUM
            score = 0.55
            concentration_level = "moderately concentrated"
        else:
            impact = ImpactFlag.LOW
            score = 0.25
            concentration_level = "diversified"

        insight = f"Supply base is {concentration_level} (HHI: {hhi:.0f}) - top supplier holds {top_supplier_share:.1f}% of spend"

        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=impact,
            test_score=score,
            insight=insight,
            raw_data={
                "unique_suppliers": unique_suppliers,
                "hhi_index": hhi,
                "top_supplier_share_pct": top_supplier_share,
                "top_3_share_pct": top_3_share,
                "concentration_level": concentration_level
            }
        )

    def _evaluate_category_risk(
        self,
        proof_point: ProofPointDefinition,
        spend_data: pd.DataFrame,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> ProofPointResult:
        """
        Evaluate Category Risk.
        Context: Inherent risk characteristics of the category (volatility, supply constraints).
        """
        category_col = self._get_column(spend_data, "category")

        # Get category name
        category_name = "Unknown"
        if category_col and len(spend_data) > 0:
            category_name = spend_data[category_col].iloc[0] if category_col else "Unknown"
        elif context_data and "category_name" in context_data:
            category_name = context_data["category_name"]

        # Category risk classification (simulated - would use market intelligence in production)
        high_risk_categories = [
            "semiconductors", "chips", "electronics", "rare earth", "lithium",
            "cobalt", "pharmaceutical", "api", "chemicals", "specialty"
        ]
        medium_risk_categories = [
            "steel", "aluminum", "copper", "plastics", "packaging",
            "logistics", "freight", "energy", "fuel"
        ]
        low_risk_categories = [
            "office supplies", "mro", "facilities", "services", "consulting",
            "software", "travel", "marketing"
        ]

        category_lower = str(category_name).lower()

        risk_factors = []
        if any(cat in category_lower for cat in high_risk_categories):
            impact = ImpactFlag.HIGH
            score = 0.9
            risk_level = "high"
            risk_factors = ["supply constraints", "geopolitical sensitivity", "long lead times"]
        elif any(cat in category_lower for cat in medium_risk_categories):
            impact = ImpactFlag.MEDIUM
            score = 0.55
            risk_level = "medium"
            risk_factors = ["price volatility", "commodity exposure", "transportation dependency"]
        else:
            impact = ImpactFlag.LOW
            score = 0.25
            risk_level = "low"
            risk_factors = ["stable supply", "multiple alternatives available"]

        insight = f"Category inherent risk is {risk_level} - key factors: {', '.join(risk_factors)}"

        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=impact,
            test_score=score,
            insight=insight,
            raw_data={
                "category": category_name,
                "risk_level": risk_level,
                "risk_factors": risk_factors
            }
        )

    def _evaluate_inflation(
        self,
        proof_point: ProofPointDefinition,
        spend_data: pd.DataFrame,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> ProofPointResult:
        """
        Evaluate Inflation Risk.
        Context: High inflation exposure = need for price escalation clauses or hedging.
        """
        country_col = self._get_column(spend_data, "country")
        spend_col = self._get_column(spend_data, "spend")

        # Simulated inflation data by region (would use economic data API in production)
        inflation_rates = {
            "argentina": 140.0, "turkey": 65.0, "egypt": 35.0,
            "brazil": 4.5, "india": 5.5, "mexico": 4.8,
            "china": 0.5, "usa": 3.2, "germany": 2.5, "japan": 2.8,
            "uk": 4.0, "france": 2.8, "canada": 3.0
        }

        weighted_inflation = 5.0  # Default moderate inflation
        high_inflation_exposure = 0

        if country_col:
            countries = spend_data[country_col].dropna()

            if spend_col:
                country_spend = spend_data.groupby(country_col)[spend_col].sum()
                total_spend = country_spend.sum()

                weighted_inflation = 0
                for country, spend in country_spend.items():
                    country_lower = str(country).lower()
                    country_rate = next(
                        (rate for key, rate in inflation_rates.items() if key in country_lower),
                        3.5  # Default rate
                    )
                    weight = spend / total_spend if total_spend > 0 else 0
                    weighted_inflation += country_rate * weight

                    if country_rate > 10:
                        high_inflation_exposure += weight * 100
            else:
                # Simple average
                rates = []
                for country in countries.unique():
                    country_lower = str(country).lower()
                    rate = next(
                        (r for key, r in inflation_rates.items() if key in country_lower),
                        3.5
                    )
                    rates.append(rate)
                    if rate > 10:
                        high_inflation_exposure += 100 / len(countries.unique())
                weighted_inflation = np.mean(rates) if rates else 3.5

        # Risk assessment based on weighted inflation
        if weighted_inflation > 10 or high_inflation_exposure > 30:
            impact = ImpactFlag.HIGH
            score = 0.85
            risk_level = "high"
            recommendation = "implement price escalation clauses and consider alternative sourcing"
        elif weighted_inflation > 5 or high_inflation_exposure > 15:
            impact = ImpactFlag.MEDIUM
            score = 0.55
            risk_level = "moderate"
            recommendation = "monitor inflation trends and review contract terms"
        else:
            impact = ImpactFlag.LOW
            score = 0.25
            risk_level = "low"
            recommendation = "standard inflation protection adequate"

        insight = f"Inflation exposure is {risk_level} at {weighted_inflation:.1f}% weighted average - {recommendation}"

        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=impact,
            test_score=score,
            insight=insight,
            raw_data={
                "weighted_inflation_pct": weighted_inflation,
                "high_inflation_exposure_pct": high_inflation_exposure,
                "risk_level": risk_level
            }
        )

    def _evaluate_exchange_rate(
        self,
        proof_point: ProofPointDefinition,
        spend_data: pd.DataFrame,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> ProofPointResult:
        """
        Evaluate Exchange Rate Risk.
        Context: Multi-currency exposure = need for hedging or local currency contracts.
        """
        currency_col = self._get_column(spend_data, "currency")
        country_col = self._get_column(spend_data, "country")
        spend_col = self._get_column(spend_data, "spend")

        # Map countries to currencies (simplified)
        country_currency_map = {
            "usa": "USD", "united states": "USD",
            "uk": "GBP", "united kingdom": "GBP", "britain": "GBP",
            "germany": "EUR", "france": "EUR", "italy": "EUR", "spain": "EUR",
            "japan": "JPY",
            "china": "CNY",
            "india": "INR",
            "brazil": "BRL",
            "mexico": "MXN",
            "canada": "CAD",
            "australia": "AUD"
        }

        # Currency volatility ratings (simulated)
        currency_volatility = {
            "USD": 1.0, "EUR": 1.2, "GBP": 1.5, "JPY": 1.3,
            "CNY": 1.4, "INR": 2.0, "BRL": 2.5, "MXN": 1.8,
            "CAD": 1.2, "AUD": 1.4, "TRY": 3.5, "ARS": 4.0
        }

        currencies = set()
        foreign_currency_exposure = 0
        base_currency = context_data.get("base_currency", "USD") if context_data else "USD"

        if currency_col:
            currencies = set(spend_data[currency_col].dropna().unique())
        elif country_col:
            for country in spend_data[country_col].dropna().unique():
                country_lower = str(country).lower()
                for key, curr in country_currency_map.items():
                    if key in country_lower:
                        currencies.add(curr)
                        break

        # Calculate foreign currency exposure
        non_base_currencies = [c for c in currencies if c != base_currency]
        currency_count = len(currencies)

        if currency_count > 1:
            foreign_currency_exposure = ((currency_count - 1) / currency_count) * 100

        # Calculate weighted volatility
        avg_volatility = np.mean([currency_volatility.get(c, 2.0) for c in currencies]) if currencies else 1.0

        # Risk assessment
        if currency_count >= 5 or (foreign_currency_exposure > 50 and avg_volatility > 2.0):
            impact = ImpactFlag.HIGH
            score = 0.85
            risk_level = "high"
            recommendation = "implement currency hedging strategy"
        elif currency_count >= 3 or foreign_currency_exposure > 30:
            impact = ImpactFlag.MEDIUM
            score = 0.55
            risk_level = "moderate"
            recommendation = "consider natural hedging or forward contracts"
        else:
            impact = ImpactFlag.LOW
            score = 0.25
            risk_level = "low"
            recommendation = "currency risk is manageable"

        insight = f"FX exposure is {risk_level} with {currency_count} currencies and {foreign_currency_exposure:.0f}% non-base exposure - {recommendation}"

        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=impact,
            test_score=score,
            insight=insight,
            raw_data={
                "currencies": list(currencies),
                "currency_count": currency_count,
                "foreign_exposure_pct": foreign_currency_exposure,
                "avg_volatility": avg_volatility,
                "risk_level": risk_level
            }
        )

    def _evaluate_geo_political(
        self,
        proof_point: ProofPointDefinition,
        spend_data: pd.DataFrame,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None
    ) -> ProofPointResult:
        """
        Evaluate Geopolitical Risk.
        Context: Sourcing from politically unstable regions = supply disruption risk.
        """
        country_col = self._get_column(spend_data, "country")
        spend_col = self._get_column(spend_data, "spend")

        if not country_col:
            return self._not_tested_result(proof_point, "Missing country column")

        # Geopolitical risk scores by country (simulated - would use risk intelligence API)
        # Scale: 1-10 where 10 is highest risk
        geo_risk_scores = {
            "russia": 9, "ukraine": 8, "iran": 9, "syria": 9, "yemen": 9,
            "china": 6, "taiwan": 7, "north korea": 10,
            "turkey": 5, "brazil": 4, "india": 4, "mexico": 4,
            "egypt": 5, "pakistan": 6, "myanmar": 8,
            "usa": 2, "canada": 1, "germany": 1, "france": 2, "uk": 2,
            "japan": 2, "australia": 1, "south korea": 3
        }

        high_risk_countries = []
        weighted_risk = 0
        high_risk_spend_pct = 0

        countries = spend_data[country_col].dropna()

        if spend_col:
            country_spend = spend_data.groupby(country_col)[spend_col].sum()
            total_spend = country_spend.sum()

            for country, spend in country_spend.items():
                country_lower = str(country).lower()
                risk_score = next(
                    (score for key, score in geo_risk_scores.items() if key in country_lower),
                    3  # Default moderate risk
                )
                weight = spend / total_spend if total_spend > 0 else 0
                weighted_risk += risk_score * weight

                if risk_score >= 6:
                    high_risk_countries.append(country)
                    high_risk_spend_pct += weight * 100
        else:
            for country in countries.unique():
                country_lower = str(country).lower()
                risk_score = next(
                    (score for key, score in geo_risk_scores.items() if key in country_lower),
                    3
                )
                if risk_score >= 6:
                    high_risk_countries.append(country)

            weighted_risk = np.mean([
                next((s for k, s in geo_risk_scores.items() if k in str(c).lower()), 3)
                for c in countries.unique()
            ]) if len(countries) > 0 else 3

            high_risk_spend_pct = (len(high_risk_countries) / len(countries.unique())) * 100 if len(countries.unique()) > 0 else 0

        # Risk assessment
        if weighted_risk >= 6 or high_risk_spend_pct >= 30:
            impact = ImpactFlag.HIGH
            score = 0.9
            risk_level = "high"
            recommendation = "develop contingency sourcing plans for high-risk regions"
        elif weighted_risk >= 4 or high_risk_spend_pct >= 15:
            impact = ImpactFlag.MEDIUM
            score = 0.55
            risk_level = "moderate"
            recommendation = "monitor geopolitical developments and identify backup suppliers"
        else:
            impact = ImpactFlag.LOW
            score = 0.25
            risk_level = "low"
            recommendation = "geopolitical risk is well-managed"

        insight = f"Geopolitical risk is {risk_level} (score: {weighted_risk:.1f}/10) - {recommendation}"

        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=impact,
            test_score=score,
            insight=insight,
            raw_data={
                "weighted_risk_score": weighted_risk,
                "high_risk_countries": high_risk_countries,
                "high_risk_spend_pct": high_risk_spend_pct,
                "risk_level": risk_level
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
        Risk Management Context: Poor ratings = need for supplier development or replacement.

        NOTE: Same data as Volume Bundling but DIFFERENT interpretation!
        - Volume Bundling: "Good ratings = consolidate with trusted suppliers"
        - Risk Management: "Poor ratings = identify and mitigate supplier risks"
        """
        supplier_col = self._get_column(spend_data, "supplier")
        spend_col = self._get_column(spend_data, "spend")
        rating_col = self._get_column(spend_data, "rating")

        if not supplier_col:
            return self._not_tested_result(proof_point, "Missing supplier column")

        # Simulated risk ratings if not in data (would use D&B, Ecovadis, etc.)
        import random
        random.seed(42)  # Consistent results

        supplier_risks = {}
        unique_suppliers = spend_data[supplier_col].dropna().unique()

        for supplier in unique_suppliers:
            if rating_col:
                # Use actual rating if available
                supplier_data = spend_data[spend_data[supplier_col] == supplier]
                rating = supplier_data[rating_col].iloc[0] if len(supplier_data) > 0 else None
                if pd.notna(rating):
                    supplier_risks[supplier] = float(rating)
                    continue

            # Simulated risk score (1-10, higher = riskier)
            supplier_risks[supplier] = random.uniform(2, 8)

        # Calculate weighted average risk
        high_risk_suppliers = []
        high_risk_spend_pct = 0
        weighted_risk = 0

        if spend_col:
            supplier_spend = spend_data.groupby(supplier_col)[spend_col].sum()
            total_spend = supplier_spend.sum()

            for supplier, spend in supplier_spend.items():
                risk = supplier_risks.get(supplier, 5)
                weight = spend / total_spend if total_spend > 0 else 0
                weighted_risk += risk * weight

                if risk >= 6:
                    high_risk_suppliers.append(supplier)
                    high_risk_spend_pct += weight * 100
        else:
            weighted_risk = np.mean(list(supplier_risks.values())) if supplier_risks else 5
            high_risk_suppliers = [s for s, r in supplier_risks.items() if r >= 6]
            high_risk_spend_pct = (len(high_risk_suppliers) / len(supplier_risks)) * 100 if supplier_risks else 0

        # Risk Management Context: High risk = need mitigation
        if weighted_risk >= 6 or high_risk_spend_pct >= 30:
            impact = ImpactFlag.HIGH
            score = 0.85
            risk_level = "elevated"
            recommendation = "implement supplier development programs or identify alternatives"
        elif weighted_risk >= 4 or high_risk_spend_pct >= 15:
            impact = ImpactFlag.MEDIUM
            score = 0.55
            risk_level = "moderate"
            recommendation = "increase monitoring frequency for at-risk suppliers"
        else:
            impact = ImpactFlag.LOW
            score = 0.25
            risk_level = "acceptable"
            recommendation = "maintain current supplier monitoring practices"

        insight = f"Supplier risk profile is {risk_level} with {len(high_risk_suppliers)} high-risk suppliers ({high_risk_spend_pct:.0f}% of spend) - {recommendation}"

        return ProofPointResult(
            proof_point_code=proof_point.code,
            proof_point_name=proof_point.name,
            opportunity=self.opportunity_type,
            impact_flag=impact,
            test_score=score,
            insight=insight,
            raw_data={
                "weighted_risk_score": weighted_risk,
                "high_risk_suppliers": high_risk_suppliers,
                "high_risk_spend_pct": high_risk_spend_pct,
                "total_suppliers": len(unique_suppliers),
                "risk_level": risk_level
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
