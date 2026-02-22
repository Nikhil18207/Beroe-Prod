"""
User Model
Stores user authentication and profile information.
Now with multi-tenant support (Organization, Department, Role).
"""

import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.department import Department
    from app.models.role import Role
    from app.models.activity_log import ActivityLog


class User(Base):
    """User account model with multi-tenant support."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[Optional[str]] = mapped_column(String(100), unique=True, index=True, nullable=True)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Profile
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    job_title: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Multi-Tenant: Organization (Company) - Required for data isolation
    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,  # Nullable for backward compatibility
        index=True
    )

    # Multi-Tenant: Department - For within-org isolation
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Role - For permissions
    role_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Legacy fields (kept for backward compatibility)
    company: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Deprecated: use organization
    role: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Deprecated: use role_id

    # Settings & Preferences
    preferences: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)
    goals: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)
    # Goals structure: {"cost": 40, "risk": 35, "esg": 25}

    # Setup Progress
    setup_step: Mapped[int] = mapped_column(default=0)
    setup_completed: Mapped[bool] = mapped_column(Boolean, default=False)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    organization: Mapped[Optional["Organization"]] = relationship(
        "Organization",
        back_populates="users"
    )
    department: Mapped[Optional["Department"]] = relationship(
        "Department",
        back_populates="users"
    )
    role_ref: Mapped[Optional["Role"]] = relationship(
        "Role",
        back_populates="users"
    )
    sessions: Mapped[List["AnalysisSession"]] = relationship(
        "AnalysisSession",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    portfolio_categories: Mapped[List["PortfolioCategory"]] = relationship(
        "PortfolioCategory",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    conversations: Mapped[List["Conversation"]] = relationship(
        "Conversation",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    activity_logs: Mapped[List["ActivityLog"]] = relationship(
        "ActivityLog",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    @property
    def org_name(self) -> str:
        """Get organization name."""
        return self.organization.name if self.organization else self.company or "Unknown"

    @property
    def dept_name(self) -> str:
        """Get department name."""
        return self.department.name if self.department else "General"

    @property
    def role_name(self) -> str:
        """Get role name."""
        return self.role_ref.display_name if self.role_ref else self.role or "Analyst"

    def has_permission(self, resource: str, action: str) -> bool:
        """Check if user has permission for resource/action."""
        if not self.role_ref or not self.role_ref.permissions:
            return False
        resource_perms = self.role_ref.permissions.get(resource, {})
        return resource_perms.get(action, False)

    def __repr__(self) -> str:
        return f"<User {self.email}>"
