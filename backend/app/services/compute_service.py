"""
Compute Service
Pre-computes all metrics for proof points after data ingestion.
Runs ONCE on upload, stores results in cache for instant agent access.
"""

import logging
from datetime import datetime, date
from typing import Dict, List, Optional, Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func

from app.models.computed_data import (
    ComputedMetric,
    SupplierProfile,
    ContractSummary,
    PlaybookRule,
    DataCrossReference
)

logger = logging.getLogger(__name__)


class MetricDefinition:
    """Definition of a metric to compute."""
    
    def __init__(
        self,
        name: str,
        calculation: str,
        unit: str,
        data_sources: List[str],
        proof_points: List[str]
    ):
        self.name = name
        self.calculation = calculation
        self.unit = unit
        self.data_sources = data_sources
        self.proof_points = proof_points


# ========================
# METRIC DEFINITIONS
# ========================

METRICS_REGISTRY = {
    # Volume Bundling Metrics
    "hhi_index": MetricDefinition(
        name="hhi_index",
        calculation="sum(spend_percentage^2) for all suppliers",
        unit="index",
        data_sources=["spend_data"],
        proof_points=["PP-VB-01", "PP-VB-02"]
    ),
    "top_3_concentration": MetricDefinition(
        name="top_3_concentration",
        calculation="sum of top 3 supplier percentages",
        unit="percentage",
        data_sources=["spend_data"],
        proof_points=["PP-VB-02"]
    ),
    "tail_spend_percentage": MetricDefinition(
        name="tail_spend_percentage",
        calculation="percentage of spend with suppliers <$50K",
        unit="percentage",
        data_sources=["spend_data"],
        proof_points=["PP-VB-03"]
    ),
    "regional_concentration": MetricDefinition(
        name="regional_concentration",
        calculation="max regional spend percentage",
        unit="percentage",
        data_sources=["spend_data", "supplier_master"],
        proof_points=["PP-VB-04"]
    ),
    "spot_buy_percentage": MetricDefinition(
        name="spot_buy_percentage",
        calculation="uncontracted spend / total spend",
        unit="percentage",
        data_sources=["spend_data", "contracts"],
        proof_points=["PP-VB-05"]
    ),
    
    # Target Pricing Metrics
    "price_variance": MetricDefinition(
        name="price_variance",
        calculation="(max_price - min_price) / avg_price for same items",
        unit="percentage",
        data_sources=["spend_data"],
        proof_points=["PP-TP-01"]
    ),
    "contract_coverage": MetricDefinition(
        name="contract_coverage",
        calculation="contracted spend / total spend",
        unit="percentage",
        data_sources=["spend_data", "contracts"],
        proof_points=["PP-TP-02"]
    ),
    "payment_term_optimization": MetricDefinition(
        name="payment_term_optimization",
        calculation="avg payment terms in days",
        unit="days",
        data_sources=["contracts"],
        proof_points=["PP-TP-03"]
    ),
    "price_escalation_exposure": MetricDefinition(
        name="price_escalation_exposure",
        calculation="spend under contracts with >5% escalation",
        unit="percentage",
        data_sources=["contracts"],
        proof_points=["PP-TP-04"]
    ),
    
    # Risk Management Metrics
    "supplier_count": MetricDefinition(
        name="supplier_count",
        calculation="count of unique suppliers",
        unit="count",
        data_sources=["spend_data"],
        proof_points=["PP-RM-01"]
    ),
    "single_source_spend": MetricDefinition(
        name="single_source_spend",
        calculation="spend with only one supplier per category",
        unit="percentage",
        data_sources=["spend_data"],
        proof_points=["PP-RM-01"]
    ),
    "geo_concentration_risk": MetricDefinition(
        name="geo_concentration_risk",
        calculation="spend in single country / total",
        unit="percentage",
        data_sources=["spend_data", "supplier_master"],
        proof_points=["PP-RM-02"]
    ),
    "avg_supplier_quality": MetricDefinition(
        name="avg_supplier_quality",
        calculation="weighted avg quality rating",
        unit="rating",
        data_sources=["supplier_master", "spend_data"],
        proof_points=["PP-RM-03"]
    ),
    "contracts_expiring_90_days": MetricDefinition(
        name="contracts_expiring_90_days",
        calculation="count of contracts expiring in 90 days",
        unit="count",
        data_sources=["contracts"],
        proof_points=["PP-RM-04"]
    ),
    "high_risk_supplier_spend": MetricDefinition(
        name="high_risk_supplier_spend",
        calculation="spend with suppliers risk > 70",
        unit="percentage",
        data_sources=["supplier_master", "spend_data"],
        proof_points=["PP-RM-05"]
    ),
    "non_certified_spend": MetricDefinition(
        name="non_certified_spend",
        calculation="spend with suppliers without required certs",
        unit="percentage",
        data_sources=["supplier_master", "spend_data"],
        proof_points=["PP-RM-06"]
    ),
    "diverse_supplier_spend": MetricDefinition(
        name="diverse_supplier_spend",
        calculation="spend with diverse suppliers / total",
        unit="percentage",
        data_sources=["supplier_master", "spend_data"],
        proof_points=["PP-RM-07"]
    ),
}


class ComputeService:
    """
    Service for computing all procurement metrics.
    Runs once after data ingestion, caches results.
    """
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def compute_all_metrics(
        self,
        session_id: UUID,
        category: str = "ALL"
    ) -> Dict[str, float]:
        """
        Compute all metrics for a session.
        Returns dictionary of metric_name -> value.
        """
        logger.info(f"Computing all metrics for session {session_id}, category {category}")
        
        results = {}
        
        # Volume Bundling Metrics
        vb_metrics = await self._compute_volume_bundling_metrics(session_id, category)
        results.update(vb_metrics)
        
        # Target Pricing Metrics
        tp_metrics = await self._compute_target_pricing_metrics(session_id, category)
        results.update(tp_metrics)
        
        # Risk Management Metrics
        rm_metrics = await self._compute_risk_management_metrics(session_id, category)
        results.update(rm_metrics)
        
        # Re-specification Pack Metrics
        rp_metrics = await self._compute_respec_pack_metrics(session_id, category)
        results.update(rp_metrics)
        
        # Store all computed metrics
        await self._store_metrics(session_id, category, results)
        
        logger.info(f"Computed {len(results)} metrics for session {session_id}")
        return results
    
    # ========================
    # VOLUME BUNDLING METRICS
    # ========================
    
    async def _compute_volume_bundling_metrics(
        self,
        session_id: UUID,
        category: str
    ) -> Dict[str, float]:
        """Compute all volume bundling metrics."""
        
        # Get existing spend-derived metrics
        metrics_result = await self.session.execute(
            select(ComputedMetric).where(
                ComputedMetric.session_id == session_id,
                ComputedMetric.data_sources == "spend_data"
            )
        )
        existing = {m.metric_name: m.metric_value for m in metrics_result.scalars().all()}
        
        results = {}
        
        # HHI Index (already computed in ingestion)
        if "hhi_index" in existing:
            results["hhi_index"] = existing["hhi_index"]
        
        # Top 3 concentration (already computed)
        if "top_3_concentration" in existing:
            results["top_3_concentration"] = existing["top_3_concentration"]
        
        # Regional concentration (already computed)
        if "regional_concentration" in existing:
            results["regional_concentration"] = existing["regional_concentration"]
        
        # Tail spend - estimate if not computed
        if "tail_spend_percentage" not in existing:
            # Default estimate: 15-25% is typical
            results["tail_spend_percentage"] = 20.0
        else:
            results["tail_spend_percentage"] = existing["tail_spend_percentage"]
        
        # Spot buy percentage - requires contract cross-reference
        spot_pct = await self._compute_spot_buy_percentage(session_id)
        results["spot_buy_percentage"] = spot_pct
        
        return results
    
    async def _compute_spot_buy_percentage(self, session_id: UUID) -> float:
        """Compute percentage of spend not under contract."""
        
        # Get contract count
        contract_count = await self.session.execute(
            select(func.count(ContractSummary.id)).where(
                ContractSummary.session_id == session_id,
                ContractSummary.status == "active"
            )
        )
        contracts = contract_count.scalar() or 0
        
        # Get supplier count
        supplier_count = await self.session.execute(
            select(func.count(SupplierProfile.id)).where(
                SupplierProfile.session_id == session_id
            )
        )
        suppliers = supplier_count.scalar() or 0
        
        if suppliers == 0:
            return 25.0  # Default estimate
        
        # Spot buy = suppliers without contracts
        contracted_ratio = min(contracts / suppliers, 1.0) if suppliers > 0 else 0
        return round((1 - contracted_ratio) * 100, 2)
    
    # ========================
    # TARGET PRICING METRICS
    # ========================
    
    async def _compute_target_pricing_metrics(
        self,
        session_id: UUID,
        category: str
    ) -> Dict[str, float]:
        """Compute all target pricing metrics."""
        
        results = {}
        
        # Price variance - estimate (requires line-item data)
        results["price_variance"] = 15.0  # Default: 15% variance is typical
        
        # Contract coverage - inverse of spot buy
        spot_buy = await self._compute_spot_buy_percentage(session_id)
        results["contract_coverage"] = 100 - spot_buy
        
        # Payment terms - from contracts
        payment_days = await self._compute_avg_payment_terms(session_id)
        results["payment_term_optimization"] = payment_days
        
        # Price escalation exposure
        escalation_pct = await self._compute_escalation_exposure(session_id)
        results["price_escalation_exposure"] = escalation_pct
        
        return results
    
    async def _compute_avg_payment_terms(self, session_id: UUID) -> float:
        """Compute average payment terms in days."""
        
        contracts_result = await self.session.execute(
            select(ContractSummary.payment_terms).where(
                ContractSummary.session_id == session_id
            )
        )
        
        total_days = 0
        count = 0
        
        for (payment_terms,) in contracts_result:
            if payment_terms:
                # Parse "Net 30", "Net 60", etc.
                import re
                match = re.search(r'(\d+)', str(payment_terms))
                if match:
                    total_days += int(match.group(1))
                    count += 1
        
        return round(total_days / count, 1) if count > 0 else 30.0
    
    async def _compute_escalation_exposure(self, session_id: UUID) -> float:
        """Compute percentage of contracts with high escalation."""
        
        # Contracts with escalation > 5%
        high_escalation = await self.session.execute(
            select(func.count(ContractSummary.id)).where(
                ContractSummary.session_id == session_id,
                ContractSummary.has_price_escalation == True,
                ContractSummary.price_escalation_cap > 5.0
            )
        )
        high_count = high_escalation.scalar() or 0
        
        total_contracts = await self.session.execute(
            select(func.count(ContractSummary.id)).where(
                ContractSummary.session_id == session_id
            )
        )
        total = total_contracts.scalar() or 0
        
        if total == 0:
            return 0.0
        
        return round(high_count / total * 100, 2)
    
    # ========================
    # RISK MANAGEMENT METRICS
    # ========================
    
    async def _compute_risk_management_metrics(
        self,
        session_id: UUID,
        category: str
    ) -> Dict[str, float]:
        """Compute all risk management metrics."""
        
        results = {}
        
        # Get existing metrics
        metrics_result = await self.session.execute(
            select(ComputedMetric).where(
                ComputedMetric.session_id == session_id
            )
        )
        existing = {m.metric_name: m.metric_value for m in metrics_result.scalars().all()}
        
        # Supplier count (already computed)
        if "unique_suppliers" in existing:
            results["supplier_count"] = existing["unique_suppliers"]
        else:
            supplier_count = await self.session.execute(
                select(func.count(SupplierProfile.id)).where(
                    SupplierProfile.session_id == session_id
                )
            )
            results["supplier_count"] = float(supplier_count.scalar() or 0)
        
        # Single source percentage - if top supplier > 90%
        if "top_3_concentration" in existing:
            # Estimate: if top 3 is >80%, likely single source
            results["single_source_spend"] = min(existing["top_3_concentration"] - 50, 50)
        else:
            results["single_source_spend"] = 0.0
        
        # Geo concentration risk
        geo_risk = await self._compute_geo_concentration(session_id)
        results["geo_concentration_risk"] = geo_risk
        
        # Average supplier quality
        avg_quality = await self._compute_avg_quality(session_id)
        results["avg_supplier_quality"] = avg_quality
        
        # Contracts expiring (from existing metrics)
        if "contracts_expiring_90_days" in existing:
            results["contracts_expiring_90_days"] = existing["contracts_expiring_90_days"]
        else:
            expiring = await self._compute_expiring_contracts(session_id)
            results["contracts_expiring_90_days"] = expiring
        
        # High risk supplier spend
        high_risk_pct = await self._compute_high_risk_spend(session_id)
        results["high_risk_supplier_spend"] = high_risk_pct
        
        # Non-certified spend
        non_cert_pct = await self._compute_non_certified_spend(session_id)
        results["non_certified_spend"] = non_cert_pct
        
        # Diverse supplier spend
        diverse_pct = await self._compute_diverse_spend(session_id)
        results["diverse_supplier_spend"] = diverse_pct
        
        return results
    
    async def _compute_geo_concentration(self, session_id: UUID) -> float:
        """Compute geographic concentration risk."""
        
        result = await self.session.execute(
            select(
                SupplierProfile.country,
                func.count(SupplierProfile.id).label("count")
            ).where(
                SupplierProfile.session_id == session_id,
                SupplierProfile.country.isnot(None)
            ).group_by(SupplierProfile.country).order_by(
                func.count(SupplierProfile.id).desc()
            ).limit(1)
        )
        
        top_country = result.first()
        
        # Get total count
        total = await self.session.execute(
            select(func.count(SupplierProfile.id)).where(
                SupplierProfile.session_id == session_id
            )
        )
        total_count = total.scalar() or 0
        
        if total_count == 0 or not top_country:
            return 0.0
        
        return round(top_country.count / total_count * 100, 2)
    
    async def _compute_avg_quality(self, session_id: UUID) -> float:
        """Compute average supplier quality rating."""
        
        result = await self.session.execute(
            select(func.avg(SupplierProfile.quality_rating)).where(
                SupplierProfile.session_id == session_id,
                SupplierProfile.quality_rating.isnot(None)
            )
        )
        
        avg = result.scalar()
        return round(avg, 2) if avg else 3.0  # Default to 3.0 (average)
    
    async def _compute_expiring_contracts(self, session_id: UUID) -> float:
        """Count contracts expiring in 90 days."""
        
        result = await self.session.execute(
            select(func.count(ContractSummary.id)).where(
                ContractSummary.session_id == session_id,
                ContractSummary.days_to_expiry.isnot(None),
                ContractSummary.days_to_expiry > 0,
                ContractSummary.days_to_expiry <= 90
            )
        )
        
        return float(result.scalar() or 0)
    
    async def _compute_high_risk_spend(self, session_id: UUID) -> float:
        """Compute percentage of spend with high-risk suppliers."""
        
        high_risk = await self.session.execute(
            select(func.count(SupplierProfile.id)).where(
                SupplierProfile.session_id == session_id,
                SupplierProfile.overall_risk_score > 70
            )
        )
        high_count = high_risk.scalar() or 0
        
        total = await self.session.execute(
            select(func.count(SupplierProfile.id)).where(
                SupplierProfile.session_id == session_id
            )
        )
        total_count = total.scalar() or 0
        
        if total_count == 0:
            return 0.0
        
        return round(high_count / total_count * 100, 2)
    
    async def _compute_non_certified_spend(self, session_id: UUID) -> float:
        """Compute percentage with non-certified suppliers."""
        
        non_cert = await self.session.execute(
            select(func.count(SupplierProfile.id)).where(
                SupplierProfile.session_id == session_id,
                SupplierProfile.has_required_certs == False
            )
        )
        non_count = non_cert.scalar() or 0
        
        total = await self.session.execute(
            select(func.count(SupplierProfile.id)).where(
                SupplierProfile.session_id == session_id
            )
        )
        total_count = total.scalar() or 0
        
        if total_count == 0:
            return 0.0
        
        return round(non_count / total_count * 100, 2)
    
    async def _compute_diverse_spend(self, session_id: UUID) -> float:
        """Compute percentage with diverse suppliers."""
        
        diverse = await self.session.execute(
            select(func.count(SupplierProfile.id)).where(
                SupplierProfile.session_id == session_id,
                SupplierProfile.is_diverse_supplier == True
            )
        )
        diverse_count = diverse.scalar() or 0
        
        total = await self.session.execute(
            select(func.count(SupplierProfile.id)).where(
                SupplierProfile.session_id == session_id
            )
        )
        total_count = total.scalar() or 0
        
        if total_count == 0:
            return 0.0
        
        return round(diverse_count / total_count * 100, 2)
    
    # ========================
    # RE-SPECIFICATION PACK METRICS
    # ========================
    
    async def _compute_respec_pack_metrics(
        self,
        session_id: UUID,
        category: str
    ) -> Dict[str, float]:
        """Compute all re-specification pack metrics."""
        
        results = {}
        
        # Get existing metrics
        metrics_result = await self.session.execute(
            select(ComputedMetric).where(
                ComputedMetric.session_id == session_id
            )
        )
        existing = {m.metric_name: m.metric_value for m in metrics_result.scalars().all()}
        
        # Reuse price_variance from existing calculations
        if "price_variance" in existing:
            results["price_variance"] = existing["price_variance"]
        
        # Commodity percentage (from cost structure)
        # Estimate based on category type - in production, this would use detailed cost breakdowns
        commodity_pct = await self._estimate_commodity_percentage(session_id, category)
        results["commodity_percentage"] = commodity_pct
        
        # Raw material exposure (similar to commodity percentage for re-spec)
        results["raw_material_exposure"] = commodity_pct * 1.1  # Slightly higher due to packaging materials
        
        # Export market coverage - how many markets are we shipping to?
        export_coverage = await self._compute_export_market_coverage(session_id)
        results["export_market_coverage"] = export_coverage
        
        # Global spec compliance estimate
        # Higher coverage = higher compliance (inverse relationship with opportunity)
        results["global_spec_compliance"] = min(export_coverage + 10, 100)
        
        return results
    
    async def _estimate_commodity_percentage(self, session_id: UUID, category: str) -> float:
        """Estimate commodity/raw material percentage for a category."""
        
        # Check category name for commodity indicators
        category_lower = category.lower() if category else ""
        
        # High commodity categories (packaging, materials)
        high_commodity_keywords = [
            "packaging", "corrugated", "paper", "plastics", "film",
            "carton", "box", "container", "bottle", "can", "steel",
            "aluminum", "copper", "chemicals"
        ]
        
        # Medium commodity categories
        medium_commodity_keywords = [
            "components", "parts", "materials", "supplies", "raw"
        ]
        
        # Low commodity categories
        low_commodity_keywords = [
            "services", "software", "consulting", "maintenance", "labor"
        ]
        
        if any(kw in category_lower for kw in high_commodity_keywords):
            return 70.0
        elif any(kw in category_lower for kw in medium_commodity_keywords):
            return 45.0
        elif any(kw in category_lower for kw in low_commodity_keywords):
            return 15.0
        else:
            return 50.0  # Default estimate
    
    async def _compute_export_market_coverage(self, session_id: UUID) -> float:
        """Compute export market coverage based on supplier geographic diversity."""
        
        # Count unique countries from suppliers
        result = await self.session.execute(
            select(func.count(func.distinct(SupplierProfile.country))).where(
                SupplierProfile.session_id == session_id
            )
        )
        unique_countries = result.scalar() or 1
        
        # More countries = lower coverage (more complexity = more opportunity)
        # Scale: 1 country = 95%, 5+ countries = 60%, 10+ = 40%
        if unique_countries <= 1:
            return 95.0
        elif unique_countries <= 3:
            return 80.0
        elif unique_countries <= 5:
            return 70.0
        elif unique_countries <= 10:
            return 55.0
        else:
            return 40.0
    
    # ========================
    # STORAGE
    # ========================
    
    async def _store_metrics(
        self,
        session_id: UUID,
        category: str,
        metrics: Dict[str, float]
    ) -> None:
        """Store computed metrics in database."""
        
        # Clear existing computed metrics (except those from ingestion)
        await self.session.execute(
            delete(ComputedMetric).where(
                ComputedMetric.session_id == session_id,
                ComputedMetric.calculation_method == "compute_service"
            )
        )
        
        for name, value in metrics.items():
            definition = METRICS_REGISTRY.get(name)
            
            metric = ComputedMetric(
                session_id=session_id,
                category=category,
                metric_name=name,
                metric_value=value,
                metric_unit=definition.unit if definition else "unknown",
                calculation_method="compute_service",
                data_sources=",".join(definition.data_sources) if definition else "unknown",
                confidence_level="HIGH"
            )
            self.session.add(metric)
        
        await self.session.commit()
    
    # ========================
    # CACHE ACCESS
    # ========================
    
    async def get_metric(
        self,
        session_id: UUID,
        metric_name: str,
        category: str = "ALL"
    ) -> Optional[float]:
        """Get a single cached metric value."""
        
        result = await self.session.execute(
            select(ComputedMetric.metric_value).where(
                ComputedMetric.session_id == session_id,
                ComputedMetric.metric_name == metric_name,
                ComputedMetric.category == category
            )
        )
        
        value = result.scalar()
        return value
    
    async def get_all_metrics(
        self,
        session_id: UUID,
        category: str = "ALL"
    ) -> Dict[str, float]:
        """Get all cached metrics for a session."""
        
        result = await self.session.execute(
            select(ComputedMetric).where(
                ComputedMetric.session_id == session_id,
                ComputedMetric.category == category
            )
        )
        
        return {m.metric_name: m.metric_value for m in result.scalars().all()}
    
    async def get_metrics_for_proof_point(
        self,
        session_id: UUID,
        proof_point_id: str
    ) -> Dict[str, float]:
        """Get metrics relevant to a specific proof point."""
        
        # Find metrics that map to this proof point
        relevant_metrics = [
            name for name, definition in METRICS_REGISTRY.items()
            if proof_point_id in definition.proof_points
        ]
        
        all_metrics = await self.get_all_metrics(session_id)
        
        return {
            name: value for name, value in all_metrics.items()
            if name in relevant_metrics
        }
