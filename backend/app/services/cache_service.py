"""
Cache Service
Provides fast access to pre-computed metrics for agents.
This is the primary interface agents use to get data.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.computed_data import (
    ComputedMetric,
    SupplierProfile,
    ContractSummary,
    PlaybookRule,
    DataCrossReference
)

logger = logging.getLogger(__name__)


class CacheService:
    """
    High-performance cache service for agent access.
    All reads go through this service - no direct DB queries in agents.
    """
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    # ========================
    # METRIC ACCESS
    # ========================
    
    async def get_metric(
        self,
        session_id: UUID,
        metric_name: str,
        category: str = "ALL"
    ) -> Optional[float]:
        """
        Get a single metric value.
        Returns None if not found.
        """
        result = await self.session.execute(
            select(ComputedMetric.metric_value).where(
                ComputedMetric.session_id == session_id,
                ComputedMetric.metric_name == metric_name,
                ComputedMetric.category == category
            )
        )
        return result.scalar()
    
    async def get_metrics(
        self,
        session_id: UUID,
        metric_names: List[str],
        category: str = "ALL"
    ) -> Dict[str, float]:
        """
        Get multiple metrics at once.
        Returns dictionary of metric_name -> value.
        """
        result = await self.session.execute(
            select(ComputedMetric).where(
                ComputedMetric.session_id == session_id,
                ComputedMetric.metric_name.in_(metric_names),
                ComputedMetric.category == category
            )
        )
        return {m.metric_name: m.metric_value for m in result.scalars().all()}
    
    async def get_all_metrics(
        self,
        session_id: UUID,
        category: str = "ALL"
    ) -> Dict[str, Any]:
        """
        Get all metrics for a session with metadata.
        Returns full metric objects.
        """
        result = await self.session.execute(
            select(ComputedMetric).where(
                ComputedMetric.session_id == session_id,
                ComputedMetric.category == category
            )
        )
        
        metrics = {}
        for m in result.scalars().all():
            metrics[m.metric_name] = {
                "value": m.metric_value,
                "unit": m.metric_unit,
                "confidence": m.confidence_level,
                "computed_at": m.computed_at.isoformat() if m.computed_at else None,
                "data_sources": m.data_sources.split(",") if m.data_sources else []
            }
        
        return metrics
    
    # ========================
    # SUPPLIER ACCESS
    # ========================
    
    async def get_supplier_profile(
        self,
        session_id: UUID,
        supplier_id: str = None,
        supplier_name: str = None
    ) -> Optional[Dict]:
        """Get a single supplier profile."""
        
        query = select(SupplierProfile).where(
            SupplierProfile.session_id == session_id
        )
        
        if supplier_id:
            query = query.where(SupplierProfile.supplier_id == supplier_id)
        elif supplier_name:
            query = query.where(SupplierProfile.supplier_name.ilike(f"%{supplier_name}%"))
        else:
            return None
        
        result = await self.session.execute(query)
        profile = result.scalar()
        
        if not profile:
            return None
        
        return self._profile_to_dict(profile)
    
    async def get_top_suppliers(
        self,
        session_id: UUID,
        limit: int = 10,
        sort_by: str = "spend_percentage"
    ) -> List[Dict]:
        """Get top suppliers by spend or risk."""
        
        query = select(SupplierProfile).where(
            SupplierProfile.session_id == session_id
        )
        
        if sort_by == "risk":
            query = query.order_by(SupplierProfile.overall_risk_score.desc())
        else:
            query = query.order_by(SupplierProfile.spend_percentage.desc())
        
        query = query.limit(limit)
        
        result = await self.session.execute(query)
        return [self._profile_to_dict(p) for p in result.scalars().all()]
    
    async def get_high_risk_suppliers(
        self,
        session_id: UUID,
        threshold: float = 70.0
    ) -> List[Dict]:
        """Get suppliers with risk score above threshold."""
        
        result = await self.session.execute(
            select(SupplierProfile).where(
                SupplierProfile.session_id == session_id,
                SupplierProfile.overall_risk_score > threshold
            ).order_by(SupplierProfile.overall_risk_score.desc())
        )
        
        return [self._profile_to_dict(p) for p in result.scalars().all()]
    
    async def get_diverse_suppliers(
        self,
        session_id: UUID
    ) -> List[Dict]:
        """Get all diverse suppliers."""
        
        result = await self.session.execute(
            select(SupplierProfile).where(
                SupplierProfile.session_id == session_id,
                SupplierProfile.is_diverse_supplier == True
            )
        )
        
        return [self._profile_to_dict(p) for p in result.scalars().all()]
    
    def _profile_to_dict(self, profile: SupplierProfile) -> Dict:
        """Convert supplier profile to dictionary."""
        return {
            "supplier_id": profile.supplier_id,
            "supplier_name": profile.supplier_name,
            "country": profile.country,
            "region": profile.region,
            "city": profile.city,
            "quality_rating": profile.quality_rating,
            "delivery_rating": profile.delivery_rating,
            "responsiveness_rating": profile.responsiveness_rating,
            "overall_risk_score": profile.overall_risk_score,
            "financial_risk_score": profile.financial_risk_score,
            "geo_risk_score": profile.geo_risk_score,
            "concentration_risk_score": profile.concentration_risk_score,
            "certifications": profile.certifications,
            "sustainability_score": profile.sustainability_score,
            "is_diverse_supplier": profile.is_diverse_supplier,
            "has_required_certs": profile.has_required_certs,
            "total_spend": profile.total_spend,
            "spend_percentage": profile.spend_percentage,
            "transaction_count": profile.transaction_count
        }
    
    # ========================
    # CONTRACT ACCESS
    # ========================
    
    async def get_contract(
        self,
        session_id: UUID,
        contract_id: str = None,
        supplier_id: str = None
    ) -> Optional[Dict]:
        """Get a single contract."""
        
        query = select(ContractSummary).where(
            ContractSummary.session_id == session_id
        )
        
        if contract_id:
            query = query.where(ContractSummary.contract_id == contract_id)
        elif supplier_id:
            query = query.where(ContractSummary.supplier_id == supplier_id)
        else:
            return None
        
        result = await self.session.execute(query)
        contract = result.scalar()
        
        if not contract:
            return None
        
        return self._contract_to_dict(contract)
    
    async def get_expiring_contracts(
        self,
        session_id: UUID,
        days: int = 90
    ) -> List[Dict]:
        """Get contracts expiring within N days."""
        
        result = await self.session.execute(
            select(ContractSummary).where(
                ContractSummary.session_id == session_id,
                ContractSummary.days_to_expiry.isnot(None),
                ContractSummary.days_to_expiry > 0,
                ContractSummary.days_to_expiry <= days
            ).order_by(ContractSummary.days_to_expiry)
        )
        
        return [self._contract_to_dict(c) for c in result.scalars().all()]
    
    async def get_contracts_by_value(
        self,
        session_id: UUID,
        limit: int = 10
    ) -> List[Dict]:
        """Get top contracts by value."""
        
        result = await self.session.execute(
            select(ContractSummary).where(
                ContractSummary.session_id == session_id
            ).order_by(ContractSummary.annual_value.desc()).limit(limit)
        )
        
        return [self._contract_to_dict(c) for c in result.scalars().all()]
    
    def _contract_to_dict(self, contract: ContractSummary) -> Dict:
        """Convert contract summary to dictionary."""
        return {
            "contract_id": contract.contract_id,
            "supplier_id": contract.supplier_id,
            "supplier_name": contract.supplier_name,
            "contract_type": contract.contract_type,
            "payment_terms": contract.payment_terms,
            "start_date": contract.start_date.isoformat() if contract.start_date else None,
            "expiry_date": contract.expiry_date.isoformat() if contract.expiry_date else None,
            "days_to_expiry": contract.days_to_expiry,
            "annual_value": contract.annual_value,
            "total_contract_value": contract.total_contract_value,
            "has_price_escalation": contract.has_price_escalation,
            "price_escalation_cap": contract.price_escalation_cap,
            "has_volume_discount": contract.has_volume_discount,
            "status": contract.status,
            "renewal_status": contract.renewal_status
        }
    
    # ========================
    # PLAYBOOK/RULES ACCESS
    # ========================
    
    async def get_rules(
        self,
        session_id: UUID,
        rule_type: str = None,
        category: str = None
    ) -> List[Dict]:
        """Get playbook rules, optionally filtered."""
        
        query = select(PlaybookRule).where(
            PlaybookRule.session_id == session_id
        )
        
        if rule_type:
            query = query.where(PlaybookRule.rule_type == rule_type)
        
        if category:
            query = query.where(
                (PlaybookRule.category == category) | (PlaybookRule.category.is_(None))
            )
        
        result = await self.session.execute(query)
        
        return [self._rule_to_dict(r) for r in result.scalars().all()]
    
    async def get_threshold(
        self,
        session_id: UUID,
        metric_name: str
    ) -> Optional[Dict]:
        """Get threshold rule for a specific metric."""
        
        result = await self.session.execute(
            select(PlaybookRule).where(
                PlaybookRule.session_id == session_id,
                PlaybookRule.metric_name == metric_name
            )
        )
        
        rule = result.scalar()
        if not rule:
            return None
        
        return {
            "metric": rule.metric_name,
            "threshold": rule.threshold_value,
            "operator": rule.threshold_operator,
            "action": rule.action_recommendation
        }
    
    def _rule_to_dict(self, rule: PlaybookRule) -> Dict:
        """Convert playbook rule to dictionary."""
        return {
            "rule_id": rule.rule_id,
            "rule_name": rule.rule_name,
            "description": rule.rule_description,
            "category": rule.category,
            "metric_name": rule.metric_name,
            "threshold_value": rule.threshold_value,
            "threshold_operator": rule.threshold_operator,
            "rule_type": rule.rule_type,
            "priority": rule.priority,
            "risk_level": rule.risk_level,
            "action": rule.action_recommendation
        }
    
    # ========================
    # AGGREGATED VIEWS
    # ========================
    
    async def get_summary(
        self,
        session_id: UUID
    ) -> Dict:
        """
        Get complete summary for a session.
        Used for dashboard and overview pages.
        """
        
        # Get all metrics
        metrics = await self.get_all_metrics(session_id)
        
        # Get key counts
        from sqlalchemy import func
        
        supplier_count = await self.session.execute(
            select(func.count(SupplierProfile.id)).where(
                SupplierProfile.session_id == session_id
            )
        )
        
        contract_count = await self.session.execute(
            select(func.count(ContractSummary.id)).where(
                ContractSummary.session_id == session_id
            )
        )
        
        rule_count = await self.session.execute(
            select(func.count(PlaybookRule.id)).where(
                PlaybookRule.session_id == session_id
            )
        )
        
        # Get top suppliers
        top_suppliers = await self.get_top_suppliers(session_id, limit=5)
        
        # Get expiring contracts
        expiring = await self.get_expiring_contracts(session_id, days=90)
        
        # Get high risk suppliers
        high_risk = await self.get_high_risk_suppliers(session_id)
        
        return {
            "metrics": metrics,
            "counts": {
                "suppliers": supplier_count.scalar() or 0,
                "contracts": contract_count.scalar() or 0,
                "rules": rule_count.scalar() or 0
            },
            "top_suppliers": top_suppliers,
            "expiring_contracts": expiring,
            "high_risk_suppliers": high_risk,
            "alerts": self._generate_alerts(metrics, expiring, high_risk)
        }
    
    def _generate_alerts(
        self,
        metrics: Dict,
        expiring_contracts: List[Dict],
        high_risk_suppliers: List[Dict]
    ) -> List[Dict]:
        """Generate alerts based on cached data."""
        
        alerts = []
        
        # Contract expiry alerts
        if len(expiring_contracts) > 0:
            alerts.append({
                "type": "warning",
                "category": "contracts",
                "message": f"{len(expiring_contracts)} contracts expiring in 90 days",
                "count": len(expiring_contracts),
                "priority": "high"
            })
        
        # High risk supplier alerts
        if len(high_risk_suppliers) > 0:
            alerts.append({
                "type": "danger",
                "category": "suppliers",
                "message": f"{len(high_risk_suppliers)} high-risk suppliers identified",
                "count": len(high_risk_suppliers),
                "priority": "high"
            })
        
        # Concentration risk alerts
        hhi = metrics.get("hhi_index", {}).get("value", 0) if isinstance(metrics.get("hhi_index"), dict) else 0
        if hhi > 2500:
            alerts.append({
                "type": "warning",
                "category": "concentration",
                "message": f"High supplier concentration (HHI: {hhi})",
                "priority": "medium"
            })
        
        # Regional concentration
        regional = metrics.get("regional_concentration", {})
        regional_val = regional.get("value", 0) if isinstance(regional, dict) else 0
        if regional_val > 40:
            alerts.append({
                "type": "warning",
                "category": "geographic",
                "message": f"High regional concentration ({regional_val}%)",
                "priority": "medium"
            })
        
        return alerts
    
    # ========================
    # PROOF POINT SUPPORT
    # ========================
    
    async def get_proof_point_data(
        self,
        session_id: UUID,
        proof_point_id: str
    ) -> Dict:
        """
        Get all data needed for a specific proof point evaluation.
        Maps proof point IDs to required metrics.
        """
        
        # Proof point to metrics mapping
        PP_METRICS_MAP = {
            # Volume Bundling
            "PP-VB-01": ["hhi_index", "supplier_count"],
            "PP-VB-02": ["top_3_concentration", "top_5_concentration"],
            "PP-VB-03": ["tail_spend_percentage"],
            "PP-VB-04": ["regional_concentration"],
            "PP-VB-05": ["spot_buy_percentage"],
            "PP-VB-06": ["contract_coverage"],
            "PP-VB-07": ["diverse_supplier_spend"],
            "PP-VB-08": ["hhi_index", "top_3_concentration"],
            
            # Target Pricing
            "PP-TP-01": ["price_variance"],
            "PP-TP-02": ["contract_coverage"],
            "PP-TP-03": ["payment_term_optimization"],
            "PP-TP-04": ["price_escalation_exposure"],
            
            # Risk Management
            "PP-RM-01": ["single_source_spend", "supplier_count"],
            "PP-RM-02": ["geo_concentration_risk"],
            "PP-RM-03": ["avg_supplier_quality"],
            "PP-RM-04": ["contracts_expiring_90_days"],
            "PP-RM-05": ["high_risk_supplier_spend"],
            "PP-RM-06": ["non_certified_spend"],
            "PP-RM-07": ["diverse_supplier_spend"],
        }
        
        metric_names = PP_METRICS_MAP.get(proof_point_id, [])
        metrics = await self.get_metrics(session_id, metric_names)
        
        # Get threshold if exists
        threshold = await self.get_threshold(session_id, metric_names[0]) if metric_names else None
        
        return {
            "proof_point_id": proof_point_id,
            "metrics": metrics,
            "threshold": threshold,
            "timestamp": datetime.utcnow().isoformat()
        }
