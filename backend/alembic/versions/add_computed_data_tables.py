"""add_computed_data_tables

Revision ID: add_computed_data_tables
Revises: 
Create Date: 2025-01-08

This migration adds tables for the hybrid caching architecture:
- computed_metrics: Pre-computed metrics cache
- supplier_profiles: Enriched supplier data
- contract_summaries: Contract terms and expiry tracking
- playbook_rules: Extracted rules from playbooks
- data_cross_references: Links between data sources
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = 'add_computed_data_tables'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ========================
    # COMPUTED METRICS TABLE
    # ========================
    op.create_table(
        'computed_metrics',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', UUID(as_uuid=True), sa.ForeignKey('analysis_sessions.id'), nullable=False),
        
        # Category identification
        sa.Column('category', sa.String(255), nullable=False),
        sa.Column('subcategory', sa.String(255), nullable=True),
        
        # Metric data
        sa.Column('metric_name', sa.String(100), nullable=False),
        sa.Column('metric_value', sa.Float, nullable=False),
        sa.Column('metric_unit', sa.String(50), nullable=True),
        
        # Calculation metadata
        sa.Column('calculation_method', sa.String(255), nullable=True),
        sa.Column('data_sources', sa.String(255), nullable=True),
        sa.Column('confidence_level', sa.String(20), default='HIGH'),
        
        # Timestamps
        sa.Column('computed_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime, nullable=True),
    )
    
    # Create indexes for fast lookups
    op.create_index('ix_computed_metrics_session_id', 'computed_metrics', ['session_id'])
    op.create_index('ix_computed_metrics_category', 'computed_metrics', ['category'])
    op.create_index('ix_computed_metrics_metric_name', 'computed_metrics', ['metric_name'])
    op.create_index('ix_computed_metrics_session_metric', 'computed_metrics', ['session_id', 'metric_name'])
    
    # ========================
    # SUPPLIER PROFILES TABLE
    # ========================
    op.create_table(
        'supplier_profiles',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', UUID(as_uuid=True), sa.ForeignKey('analysis_sessions.id'), nullable=False),
        
        # Supplier identification
        sa.Column('supplier_id', sa.String(50), nullable=False),
        sa.Column('supplier_name', sa.String(255), nullable=False),
        
        # Location
        sa.Column('country', sa.String(100), nullable=True),
        sa.Column('region', sa.String(100), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        
        # Ratings
        sa.Column('quality_rating', sa.Float, nullable=True),
        sa.Column('delivery_rating', sa.Float, nullable=True),
        sa.Column('responsiveness_rating', sa.Float, nullable=True),
        
        # Risk scores
        sa.Column('overall_risk_score', sa.Float, nullable=True),
        sa.Column('financial_risk_score', sa.Float, nullable=True),
        sa.Column('geo_risk_score', sa.Float, nullable=True),
        sa.Column('concentration_risk_score', sa.Float, nullable=True),
        
        # Certifications
        sa.Column('certifications', sa.Text, nullable=True),
        sa.Column('sustainability_score', sa.Float, nullable=True),
        sa.Column('is_diverse_supplier', sa.Boolean, default=False),
        sa.Column('has_required_certs', sa.Boolean, default=True),
        
        # Spend summary
        sa.Column('total_spend', sa.Float, nullable=True),
        sa.Column('spend_percentage', sa.Float, nullable=True),
        sa.Column('transaction_count', sa.Integer, nullable=True),
        
        # Contract link
        sa.Column('linked_contract_id', UUID(as_uuid=True), nullable=True),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    op.create_index('ix_supplier_profiles_session_id', 'supplier_profiles', ['session_id'])
    op.create_index('ix_supplier_profiles_supplier_id', 'supplier_profiles', ['supplier_id'])
    op.create_index('ix_supplier_profiles_supplier_name', 'supplier_profiles', ['supplier_name'])
    op.create_index('ix_supplier_profiles_risk_score', 'supplier_profiles', ['overall_risk_score'])
    
    # ========================
    # CONTRACT SUMMARIES TABLE
    # ========================
    op.create_table(
        'contract_summaries',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', UUID(as_uuid=True), sa.ForeignKey('analysis_sessions.id'), nullable=False),
        
        # Contract identification
        sa.Column('contract_id', sa.String(50), nullable=True),
        sa.Column('supplier_id', sa.String(50), nullable=False),
        sa.Column('supplier_name', sa.String(255), nullable=True),
        
        # Contract details
        sa.Column('contract_type', sa.String(100), nullable=True),
        sa.Column('payment_terms', sa.String(50), nullable=True),
        
        # Dates
        sa.Column('start_date', sa.Date, nullable=True),
        sa.Column('expiry_date', sa.Date, nullable=True),
        sa.Column('days_to_expiry', sa.Integer, nullable=True),
        
        # Financial
        sa.Column('annual_value', sa.Float, nullable=True),
        sa.Column('total_contract_value', sa.Float, nullable=True),
        
        # Terms
        sa.Column('has_price_escalation', sa.Boolean, default=False),
        sa.Column('price_escalation_cap', sa.Float, nullable=True),
        sa.Column('has_volume_discount', sa.Boolean, default=False),
        sa.Column('volume_discount_tiers', sa.Text, nullable=True),
        
        # Status
        sa.Column('status', sa.String(50), default='active'),
        sa.Column('renewal_status', sa.String(50), nullable=True),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    op.create_index('ix_contract_summaries_session_id', 'contract_summaries', ['session_id'])
    op.create_index('ix_contract_summaries_supplier_id', 'contract_summaries', ['supplier_id'])
    op.create_index('ix_contract_summaries_expiry', 'contract_summaries', ['expiry_date'])
    op.create_index('ix_contract_summaries_days_to_expiry', 'contract_summaries', ['days_to_expiry'])
    
    # ========================
    # PLAYBOOK RULES TABLE
    # ========================
    op.create_table(
        'playbook_rules',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', UUID(as_uuid=True), sa.ForeignKey('analysis_sessions.id'), nullable=False),
        
        # Rule identification
        sa.Column('rule_id', sa.String(50), nullable=True),
        sa.Column('rule_name', sa.String(255), nullable=False),
        sa.Column('rule_description', sa.Text, nullable=True),
        
        # Category scope
        sa.Column('category', sa.String(255), nullable=True),
        sa.Column('subcategory', sa.String(255), nullable=True),
        
        # Threshold definition
        sa.Column('metric_name', sa.String(100), nullable=True),
        sa.Column('threshold_value', sa.String(50), nullable=True),
        sa.Column('threshold_operator', sa.String(20), nullable=True),
        
        # Classification
        sa.Column('rule_type', sa.String(50), nullable=True),
        sa.Column('priority', sa.String(20), default='MEDIUM'),
        sa.Column('risk_level', sa.String(20), nullable=True),
        
        # Action
        sa.Column('action_recommendation', sa.Text, nullable=True),
        
        # Source
        sa.Column('source_file', sa.String(255), nullable=True),
        sa.Column('source_type', sa.String(50), nullable=True),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    
    op.create_index('ix_playbook_rules_session_id', 'playbook_rules', ['session_id'])
    op.create_index('ix_playbook_rules_category', 'playbook_rules', ['category'])
    op.create_index('ix_playbook_rules_type', 'playbook_rules', ['rule_type'])
    
    # ========================
    # DATA CROSS REFERENCES TABLE
    # ========================
    op.create_table(
        'data_cross_references',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', UUID(as_uuid=True), sa.ForeignKey('analysis_sessions.id'), nullable=False),
        
        # Source entity
        sa.Column('source_type', sa.String(50), nullable=False),
        sa.Column('source_id', sa.String(100), nullable=False),
        sa.Column('source_field', sa.String(100), nullable=True),
        
        # Target entity
        sa.Column('target_type', sa.String(50), nullable=False),
        sa.Column('target_id', sa.String(100), nullable=False),
        sa.Column('target_field', sa.String(100), nullable=True),
        
        # Link quality
        sa.Column('match_type', sa.String(50), default='exact'),
        sa.Column('confidence', sa.Float, default=1.0),
        
        # Timestamps
        sa.Column('linked_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('verified_at', sa.DateTime, nullable=True),
        sa.Column('verified_by', sa.String(100), nullable=True),
    )
    
    op.create_index('ix_data_cross_references_session_id', 'data_cross_references', ['session_id'])
    op.create_index('ix_data_cross_references_source', 'data_cross_references', ['source_type', 'source_id'])
    op.create_index('ix_data_cross_references_target', 'data_cross_references', ['target_type', 'target_id'])


def downgrade() -> None:
    # Drop indexes first
    op.drop_index('ix_data_cross_references_target', 'data_cross_references')
    op.drop_index('ix_data_cross_references_source', 'data_cross_references')
    op.drop_index('ix_data_cross_references_session_id', 'data_cross_references')
    
    op.drop_index('ix_playbook_rules_type', 'playbook_rules')
    op.drop_index('ix_playbook_rules_category', 'playbook_rules')
    op.drop_index('ix_playbook_rules_session_id', 'playbook_rules')
    
    op.drop_index('ix_contract_summaries_days_to_expiry', 'contract_summaries')
    op.drop_index('ix_contract_summaries_expiry', 'contract_summaries')
    op.drop_index('ix_contract_summaries_supplier_id', 'contract_summaries')
    op.drop_index('ix_contract_summaries_session_id', 'contract_summaries')
    
    op.drop_index('ix_supplier_profiles_risk_score', 'supplier_profiles')
    op.drop_index('ix_supplier_profiles_supplier_name', 'supplier_profiles')
    op.drop_index('ix_supplier_profiles_supplier_id', 'supplier_profiles')
    op.drop_index('ix_supplier_profiles_session_id', 'supplier_profiles')
    
    op.drop_index('ix_computed_metrics_session_metric', 'computed_metrics')
    op.drop_index('ix_computed_metrics_metric_name', 'computed_metrics')
    op.drop_index('ix_computed_metrics_category', 'computed_metrics')
    op.drop_index('ix_computed_metrics_session_id', 'computed_metrics')
    
    # Drop tables
    op.drop_table('data_cross_references')
    op.drop_table('playbook_rules')
    op.drop_table('contract_summaries')
    op.drop_table('supplier_profiles')
    op.drop_table('computed_metrics')
