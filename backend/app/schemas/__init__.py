"""
Pydantic Schemas
API request/response models for the Beroe AI Procurement Platform.
"""

from app.schemas.user import (
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdate,
    Token,
    TokenPayload,
)
from app.schemas.session import (
    SessionCreate,
    SessionResponse,
    SessionUpdate,
    SessionStatus,
    SavingsSummary,
)
from app.schemas.portfolio import (
    PortfolioCategoryCreate,
    PortfolioCategoryUpdate,
    PortfolioCategoryResponse,
    PortfolioLocationCreate,
    PortfolioResponse,
)
from app.schemas.opportunity import (
    OpportunityCreate,
    OpportunityResponse,
    OpportunityUpdate,
    OpportunityDetailResponse,
    ProofPointResponse,
)
from app.schemas.common import (
    HealthResponse,
    ErrorResponse,
    PaginatedResponse,
)

__all__ = [
    # User
    "UserCreate",
    "UserLogin",
    "UserResponse",
    "UserUpdate",
    "Token",
    "TokenPayload",
    # Session
    "SessionCreate",
    "SessionResponse",
    "SessionUpdate",
    "SessionStatus",
    "SavingsSummary",
    # Portfolio
    "PortfolioCategoryCreate",
    "PortfolioCategoryUpdate",
    "PortfolioCategoryResponse",
    "PortfolioLocationCreate",
    "PortfolioResponse",
    # Opportunity
    "OpportunityCreate",
    "OpportunityResponse",
    "OpportunityUpdate",
    "OpportunityDetailResponse",
    "ProofPointResponse",
    # Common
    "HealthResponse",
    "ErrorResponse",
    "PaginatedResponse",
]
