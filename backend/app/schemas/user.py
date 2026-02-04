"""
User Schemas
Pydantic models for user authentication and profile.
"""

from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime
import uuid


class UserBase(BaseModel):
    """Base user fields."""
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=255)
    company: Optional[str] = Field(None, max_length=255)
    role: Optional[str] = Field(None, max_length=100)


class UserCreate(UserBase):
    """User registration schema."""
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=8, max_length=100)

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


class UserResponse(BaseModel):
    """User response schema."""
    id: uuid.UUID
    email: str
    username: Optional[str] = None
    name: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    avatar_url: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None
    goals: Optional[Dict[str, Any]] = None
    setup_step: int = 0
    setup_completed: bool = False
    is_active: bool = True
    created_at: datetime
    last_login: Optional[datetime] = None

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
