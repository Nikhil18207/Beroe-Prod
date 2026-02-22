"""
SQLAlchemy Models
Database models for the Beroe AI Procurement Platform.
"""

# Multi-Tenant Models (must be imported first due to FK dependencies)
from app.models.organization import Organization
from app.models.department import Department
from app.models.role import Role, DEFAULT_ROLES

from app.models.user import User
from app.models.password_reset import PasswordResetToken
from app.models.session import AnalysisSession
from app.models.portfolio import PortfolioCategory, PortfolioLocation
from app.models.opportunity import Opportunity, OpportunityProofPoint
from app.models.proof_point import ProofPoint, ProofPointDefinition
from app.models.document import Document, DocumentChunk
from app.models.conversation import Conversation, Message
from app.models.spend_data import SpendData, SpendDataRow
from app.models.activity_log import ActivityLog, ActivityType
from app.models.computed_data import (
    ComputedMetric,
    SupplierProfile,
    ContractSummary,
    PlaybookRule,
    DataCrossReference
)

__all__ = [
    # Multi-Tenant Models
    "Organization",
    "Department",
    "Role",
    "DEFAULT_ROLES",
    # Core Models
    "User",
    "PasswordResetToken",
    "AnalysisSession",
    "PortfolioCategory",
    "PortfolioLocation",
    "Opportunity",
    "OpportunityProofPoint",
    "ProofPoint",
    "ProofPointDefinition",
    "Document",
    "DocumentChunk",
    "Conversation",
    "Message",
    "SpendData",
    "SpendDataRow",
    # Activity Logging
    "ActivityLog",
    "ActivityType",
    # Computed/Cached Data Models
    "ComputedMetric",
    "SupplierProfile",
    "ContractSummary",
    "PlaybookRule",
    "DataCrossReference",
]
