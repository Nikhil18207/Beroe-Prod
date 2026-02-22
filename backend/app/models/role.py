"""
Role Model
Defines user roles and permissions.
"""

import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Boolean, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class Role(Base):
    """
    Role model.
    Defines permissions for users.

    Default roles:
    - SUPER_ADMIN: Platform-level admin (Beroe staff)
    - ORG_ADMIN: Organization admin (can manage users, departments)
    - MANAGER: Department manager (can view all dept data, manage team)
    - ANALYST: Regular user (can view own data, create analyses)
    - VIEWER: Read-only access
    """

    __tablename__ = "roles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Permission flags
    permissions: Mapped[dict] = mapped_column(JSON, default=dict)
    """
    Permissions structure:
    {
        "users": {"create": bool, "read": bool, "update": bool, "delete": bool},
        "departments": {"create": bool, "read": bool, "update": bool, "delete": bool},
        "categories": {"create": bool, "read": bool, "update": bool, "delete": bool},
        "analyses": {"create": bool, "read": bool, "update": bool, "delete": bool},
        "reports": {"create": bool, "read": bool, "export": bool},
        "settings": {"read": bool, "update": bool}
    }
    """

    # Role level (higher = more permissions)
    level: Mapped[int] = mapped_column(default=0)

    # Is this a system role (cannot be deleted)
    is_system_role: Mapped[bool] = mapped_column(Boolean, default=False)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users: Mapped[List["User"]] = relationship(
        "User",
        back_populates="role_ref"
    )

    def __repr__(self) -> str:
        return f"<Role {self.name}>"


# Default role definitions
DEFAULT_ROLES = [
    {
        "name": "SUPER_ADMIN",
        "display_name": "Super Administrator",
        "description": "Platform-level administrator with full access",
        "level": 100,
        "is_system_role": True,
        "permissions": {
            "users": {"create": True, "read": True, "update": True, "delete": True},
            "departments": {"create": True, "read": True, "update": True, "delete": True},
            "categories": {"create": True, "read": True, "update": True, "delete": True},
            "analyses": {"create": True, "read": True, "update": True, "delete": True},
            "reports": {"create": True, "read": True, "export": True},
            "settings": {"read": True, "update": True},
            "organizations": {"create": True, "read": True, "update": True, "delete": True}
        }
    },
    {
        "name": "ORG_ADMIN",
        "display_name": "Organization Admin",
        "description": "Organization administrator - can manage users and departments",
        "level": 80,
        "is_system_role": True,
        "permissions": {
            "users": {"create": True, "read": True, "update": True, "delete": True},
            "departments": {"create": True, "read": True, "update": True, "delete": True},
            "categories": {"create": True, "read": True, "update": True, "delete": True},
            "analyses": {"create": True, "read": True, "update": True, "delete": True},
            "reports": {"create": True, "read": True, "export": True},
            "settings": {"read": True, "update": True}
        }
    },
    {
        "name": "MANAGER",
        "display_name": "Manager",
        "description": "Department manager - can view all department data",
        "level": 60,
        "is_system_role": True,
        "permissions": {
            "users": {"create": False, "read": True, "update": False, "delete": False},
            "departments": {"create": False, "read": True, "update": False, "delete": False},
            "categories": {"create": True, "read": True, "update": True, "delete": False},
            "analyses": {"create": True, "read": True, "update": True, "delete": True},
            "reports": {"create": True, "read": True, "export": True},
            "settings": {"read": True, "update": False}
        }
    },
    {
        "name": "ANALYST",
        "display_name": "Analyst",
        "description": "Regular user - can create and manage own analyses",
        "level": 40,
        "is_system_role": True,
        "permissions": {
            "users": {"create": False, "read": False, "update": False, "delete": False},
            "departments": {"create": False, "read": True, "update": False, "delete": False},
            "categories": {"create": True, "read": True, "update": True, "delete": False},
            "analyses": {"create": True, "read": True, "update": True, "delete": False},
            "reports": {"create": True, "read": True, "export": True},
            "settings": {"read": True, "update": False}
        }
    },
    {
        "name": "VIEWER",
        "display_name": "Viewer",
        "description": "Read-only access to reports and analyses",
        "level": 20,
        "is_system_role": True,
        "permissions": {
            "users": {"create": False, "read": False, "update": False, "delete": False},
            "departments": {"create": False, "read": True, "update": False, "delete": False},
            "categories": {"create": False, "read": True, "update": False, "delete": False},
            "analyses": {"create": False, "read": True, "update": False, "delete": False},
            "reports": {"create": False, "read": True, "export": False},
            "settings": {"read": False, "update": False}
        }
    }
]
