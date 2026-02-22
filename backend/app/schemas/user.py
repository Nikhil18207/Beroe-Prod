"""
User Schemas
Pydantic models for user authentication and profile.
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime
import uuid


# ============== Organization Schemas ==============

class OrganizationBase(BaseModel):
    """Base organization fields."""
    name: str = Field(..., min_length=1, max_length=255)
    industry: Optional[str] = Field(None, max_length=100)
    size: Optional[str] = Field(None, max_length=50)  # SMB, Mid-Market, Enterprise
    country: Optional[str] = Field(None, max_length=100)


class OrganizationCreate(OrganizationBase):
    """Organization creation schema."""
    slug: Optional[str] = Field(None, max_length=100)  # Auto-generated if not provided


class OrganizationResponse(OrganizationBase):
    """Organization response schema."""
    id: uuid.UUID
    slug: str
    plan: str = "free"
    max_users: int = 5
    max_categories: int = 10
    is_active: bool = True
    created_at: datetime

    model_config = {"from_attributes": True}


# ============== Department Schemas ==============

class DepartmentBase(BaseModel):
    """Base department fields."""
    name: str = Field(..., min_length=1, max_length=255)
    code: Optional[str] = Field(None, max_length=50)  # Short code like "FIN", "PROC"
    description: Optional[str] = Field(None, max_length=500)


class DepartmentCreate(DepartmentBase):
    """Department creation schema."""
    organization_id: uuid.UUID


class DepartmentResponse(DepartmentBase):
    """Department response schema."""
    id: uuid.UUID
    organization_id: uuid.UUID
    is_active: bool = True
    created_at: datetime

    model_config = {"from_attributes": True}


# ============== Role Schemas ==============

class RoleBase(BaseModel):
    """Base role fields."""
    name: str = Field(..., min_length=1, max_length=50)
    display_name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class RoleResponse(RoleBase):
    """Role response schema."""
    id: uuid.UUID
    permissions: Dict[str, Any] = {}
    level: int = 0
    is_system_role: bool = False
    is_active: bool = True

    model_config = {"from_attributes": True}


# ============== User Schemas ==============

class UserBase(BaseModel):
    """Base user fields."""
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=255)
    company: Optional[str] = Field(None, max_length=255)  # Legacy, use organization
    role: Optional[str] = Field(None, max_length=100)  # Legacy, use role_id


class UserCreate(UserBase):
    """User registration schema."""
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=8, max_length=100)
    # Multi-tenant fields
    organization_id: Optional[uuid.UUID] = None  # Join existing org
    organization_name: Optional[str] = None  # Create new org
    department_id: Optional[uuid.UUID] = None
    role_id: Optional[uuid.UUID] = None
    job_title: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username must be alphanumeric (underscore and hyphen allowed)")
        return v.lower()


class UserLogin(BaseModel):
    """User login schema."""
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    password: str

    @field_validator("password")
    @classmethod
    def check_credentials(cls, v: str, info) -> str:
        # At least one of email or username must be provided
        return v


class UserUpdate(BaseModel):
    """User profile update schema."""
    name: Optional[str] = Field(None, max_length=255)
    company: Optional[str] = Field(None, max_length=255)
    role: Optional[str] = Field(None, max_length=100)
    avatar_url: Optional[str] = Field(None, max_length=500)
    preferences: Optional[Dict[str, Any]] = None


class UserGoalsUpdate(BaseModel):
    """User optimization goals update."""
    cost: int = Field(..., ge=0, le=100)
    risk: int = Field(..., ge=0, le=100)
    esg: int = Field(..., ge=0, le=100)

    @field_validator("esg")
    @classmethod
    def validate_total(cls, v: int, info) -> int:
        cost = info.data.get("cost", 0)
        risk = info.data.get("risk", 0)
        total = cost + risk + v
        if total > 200:
            raise ValueError(f"Total of cost + risk + esg cannot exceed 200 (got {total})")
        return v


class SetupUpdate(BaseModel):
    """Update setup wizard progress."""
    setup_step: Optional[int] = Field(None, ge=0, le=4)
    setup_completed: Optional[bool] = None
    # Optional: save portfolio/categories as preferences
    preferences: Optional[Dict[str, Any]] = None
    goals: Optional[Dict[str, Any]] = None


class UserResponse(BaseModel):
    """User response schema."""
    id: uuid.UUID
    email: str
    username: Optional[str] = None
    name: Optional[str] = None
    company: Optional[str] = None  # Legacy
    role: Optional[str] = None  # Legacy
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None
    goals: Optional[Dict[str, Any]] = None
    setup_step: int = 0
    setup_completed: bool = False
    is_active: bool = True
    created_at: datetime
    last_login: Optional[datetime] = None
    # Multi-tenant fields
    organization_id: Optional[uuid.UUID] = None
    department_id: Optional[uuid.UUID] = None
    role_id: Optional[uuid.UUID] = None
    # Computed properties (from relationships)
    org_name: Optional[str] = None
    dept_name: Optional[str] = None
    role_name: Optional[str] = None

    model_config = {"from_attributes": True}


class Token(BaseModel):
    """JWT token response."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user: UserResponse


class TokenPayload(BaseModel):
    """JWT token payload."""
    sub: str  # user_id
    email: str
    exp: datetime
    iat: datetime


# ============== Password Reset Schemas ==============

class ForgotPasswordRequest(BaseModel):
    """Request to initiate password reset."""
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    """Response for forgot password request."""
    message: str
    # In development mode, include the reset token/link
    reset_token: Optional[str] = None
    reset_link: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    """Request to reset password with token."""
    token: str
    new_password: str = Field(..., min_length=8, max_length=100)
    confirm_password: str = Field(..., min_length=8, max_length=100)

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Passwords do not match")
        return v


class ResetPasswordResponse(BaseModel):
    """Response for password reset."""
    message: str
    success: bool
