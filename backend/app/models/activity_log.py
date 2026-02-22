"""
Activity Log Model
Tracks user activities across the platform for Super Admin monitoring.
"""

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.organization import Organization


class ActivityLog(Base):
    """
    Activity Log model.
    Tracks all significant user actions for audit and monitoring.

    Activity Types:
    - LOGIN: User logged in
    - LOGOUT: User logged out
    - FILE_UPLOAD: User uploaded a file
    - FILE_DELETE: User deleted a file
    - ANALYSIS_START: User started an analysis
    - ANALYSIS_COMPLETE: Analysis completed
    - CATEGORY_SELECT: User selected categories
    - GOALS_UPDATE: User updated goals
    - OPPORTUNITY_ACCEPT: User accepted an opportunity
    - OPPORTUNITY_REJECT: User rejected an opportunity
    - USER_CREATE: Admin created a user
    - USER_UPDATE: Admin updated a user
    - SETTINGS_UPDATE: User updated settings
    """

    __tablename__ = "activity_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # Who performed the action
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Which organization (denormalized for faster queries)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Activity details
    activity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(500), nullable=False)

    # Additional context (JSON-serializable data)
    extra_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Resource reference (e.g., file name, category name)
    resource_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    resource_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    resource_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Client info
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        index=True
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="activity_logs"
    )
    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="activity_logs"
    )

    # Composite indexes for common queries
    __table_args__ = (
        Index('ix_activity_logs_org_created', 'organization_id', 'created_at'),
        Index('ix_activity_logs_user_created', 'user_id', 'created_at'),
        Index('ix_activity_logs_type_created', 'activity_type', 'created_at'),
    )

    def __repr__(self) -> str:
        return f"<ActivityLog {self.activity_type} by {self.user_id}>"


# Activity type constants
class ActivityType:
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    FILE_UPLOAD = "FILE_UPLOAD"
    FILE_DELETE = "FILE_DELETE"
    ANALYSIS_START = "ANALYSIS_START"
    ANALYSIS_COMPLETE = "ANALYSIS_COMPLETE"
    CATEGORY_SELECT = "CATEGORY_SELECT"
    GOALS_UPDATE = "GOALS_UPDATE"
    OPPORTUNITY_ACCEPT = "OPPORTUNITY_ACCEPT"
    OPPORTUNITY_REJECT = "OPPORTUNITY_REJECT"
    USER_CREATE = "USER_CREATE"
    USER_UPDATE = "USER_UPDATE"
    SETTINGS_UPDATE = "SETTINGS_UPDATE"
