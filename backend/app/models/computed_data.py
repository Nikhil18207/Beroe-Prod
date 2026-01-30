"""
Computed Data Models
Database models for cached/computed data from the hybrid architecture.

Tables:
- ComputedMetric: Pre-computed metrics per category
- SupplierProfile: Enriched supplier data with risk scores
- ContractSummary: Contract terms and expiry tracking
- PlaybookRule: Extracted rules from playbooks
- DataCrossReference: Links between data sources
"""

from datetime import datetime, date
from typing import Optional
from sqlalchemy import Column, String, Float, Boolean, DateTime, Date, Integer, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.database import Base


class ComputedMetric(Base):
    """
    Pre-computed metrics cache.
    Stores calculated values from spend data analysis.
    """
    __tablename__ = "computed_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("analysis_sessions.id"), nullable=False)
    
    # Category identification
    category = Column(String(255), nullable=False)
    subcategory = Column(String(255), nullable=True)
    
    # Metric data
    metric_name = Column(String(100), nullable=False)
    metric_value = Column(Float, nullable=False)
    metric_unit = Column(String(50), nullable=True)  # e.g., "percentage", "USD", "count"
    
    # Calculation metadata
    calculation_method = Column(String(255), nullable=True)
    data_sources = Column(String(255), nullable=True)  # e.g., "spend_data,supplier_master"
    confidence_level = Column(String(20), default="HIGH")  # HIGH, MEDIUM, LOW
    
    # Timestamps
    computed_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)  # For cache invalidation

    def __repr__(self):
        return f"<ComputedMetric {self.category}/{self.metric_name}={self.metric_value}>"


class SupplierProfile(Base):
    """
    Enriched supplier profiles with computed risk scores.
    Links supplier data with spend and contract information.
    """
    __tablename__ = "supplier_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("analysis_sessions.id"), nullable=False)
    
    # Supplier identification
    supplier_id = Column(String(50), nullable=False)
    supplier_name = Column(String(255), nullable=False)
    
    # Location
    country = Column(String(100), nullable=True)
    region = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    
    # Ratings (from supply master)
    quality_rating = Column(Float, nullable=True)
    delivery_rating = Column(Float, nullable=True)
    responsiveness_rating = Column(Float, nullable=True)
    
    # Computed risk scores
    overall_risk_score = Column(Float, nullable=True)  # 0-100
    financial_risk_score = Column(Float, nullable=True)
    geo_risk_score = Column(Float, nullable=True)
    concentration_risk_score = Column(Float, nullable=True)
    
    # Certifications and compliance
    certifications = Column(Text, nullable=True)  # JSON array as string
    sustainability_score = Column(Float, nullable=True)
    is_diverse_supplier = Column(Boolean, default=False)
    has_required_certs = Column(Boolean, default=True)
    
    # Spend summary (computed)
    total_spend = Column(Float, nullable=True)
    spend_percentage = Column(Float, nullable=True)  # % of category spend
    transaction_count = Column(Integer, nullable=True)
    
    # Contract link
    linked_contract_id = Column(UUID(as_uuid=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<SupplierProfile {self.supplier_name} (Risk: {self.overall_risk_score})>"


class ContractSummary(Base):
    """
    Contract summaries with computed fields.
    Tracks expiry dates and payment terms.
    """
    __tablename__ = "contract_summaries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("analysis_sessions.id"), nullable=False)
    
    # Contract identification
    contract_id = Column(String(50), nullable=True)
    supplier_id = Column(String(50), nullable=False)
    supplier_name = Column(String(255), nullable=True)
    
    # Contract details
    contract_type = Column(String(100), nullable=True)  # Annual, Multi-Year, Spot, etc.
    payment_terms = Column(String(50), nullable=True)  # Net 30, Net 60, etc.
    
    # Dates
    start_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    days_to_expiry = Column(Integer, nullable=True)  # Computed
    
    # Financial
    annual_value = Column(Float, nullable=True)
    total_contract_value = Column(Float, nullable=True)
    
    # Terms
    has_price_escalation = Column(Boolean, default=False)
    price_escalation_cap = Column(Float, nullable=True)  # e.g., 5% annual max
    has_volume_discount = Column(Boolean, default=False)
    volume_discount_tiers = Column(Text, nullable=True)  # JSON
    
    # Status
    status = Column(String(50), default="active")  # active, expiring, expired, renewed
    renewal_status = Column(String(50), nullable=True)  # pending, in_progress, completed
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<ContractSummary {self.supplier_name} expires {self.expiry_date}>"


class PlaybookRule(Base):
    """
    Extracted rules from category playbooks.
    Used for benchmark comparisons and recommendations.
    """
    __tablename__ = "playbook_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("analysis_sessions.id"), nullable=False)
    
    # Rule identification
    rule_id = Column(String(50), nullable=True)
    rule_name = Column(String(255), nullable=False)
    rule_description = Column(Text, nullable=True)
    
    # Category scope
    category = Column(String(255), nullable=True)  # NULL = applies to all
    subcategory = Column(String(255), nullable=True)
    
    # Threshold definition
    metric_name = Column(String(100), nullable=True)  # e.g., "regional_concentration"
    threshold_value = Column(String(50), nullable=True)  # e.g., "40%"
    threshold_operator = Column(String(20), nullable=True)  # >, <, >=, <=, ==
    
    # Classification
    rule_type = Column(String(50), nullable=True)  # risk, cost, quality, compliance
    priority = Column(String(20), default="MEDIUM")  # CRITICAL, HIGH, MEDIUM, LOW
    risk_level = Column(String(20), nullable=True)
    
    # Action
    action_recommendation = Column(Text, nullable=True)
    
    # Source
    source_file = Column(String(255), nullable=True)
    source_type = Column(String(50), nullable=True)  # csv, markdown, pdf
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<PlaybookRule {self.rule_name}>"


class DataCrossReference(Base):
    """
    Cross-references between data sources.
    Links spend records to suppliers to contracts.
    """
    __tablename__ = "data_cross_references"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("analysis_sessions.id"), nullable=False)
    
    # Source entity
    source_type = Column(String(50), nullable=False)  # spend, supplier, contract
    source_id = Column(String(100), nullable=False)
    source_field = Column(String(100), nullable=True)  # e.g., "supplier_name"
    
    # Target entity
    target_type = Column(String(50), nullable=False)
    target_id = Column(String(100), nullable=False)
    target_field = Column(String(100), nullable=True)
    
    # Link quality
    match_type = Column(String(50), default="exact")  # exact, fuzzy, manual
    confidence = Column(Float, default=1.0)  # 0.0 to 1.0
    
    # Timestamps
    linked_at = Column(DateTime, default=datetime.utcnow)
    verified_at = Column(DateTime, nullable=True)
    verified_by = Column(String(100), nullable=True)

    def __repr__(self):
        return f"<CrossRef {self.source_type}:{self.source_id} -> {self.target_type}:{self.target_id}>"
