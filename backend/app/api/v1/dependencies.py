"""
Multi-Tenant Dependencies
Provides tenant context and filtering for API routes.
"""

from dataclasses import dataclass
from typing import Optional, List
from uuid import UUID
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.database import get_db
from app.models.user import User
from app.models.role import Role
from app.api.v1.auth import get_current_user


@dataclass
class TenantContext:
    """
    Multi-tenant context extracted from the authenticated user.
    Provides filtering helpers for organization/department isolation.
    """
    user_id: UUID
    organization_id: Optional[UUID]
    department_id: Optional[UUID]
    role_id: Optional[UUID]
    role_level: int  # Permission level (100=SUPER_ADMIN, 80=ORG_ADMIN, etc.)
    permissions: dict  # Role permissions dict
    user: "User"  # Full User object for direct access in routes

    @property
    def is_super_admin(self) -> bool:
        """Check if user is a super admin (platform-level access)."""
        return self.role_level >= 100

    @property
    def is_org_admin(self) -> bool:
        """Check if user is an org admin or higher."""
        return self.role_level >= 80

    @property
    def is_manager(self) -> bool:
        """Check if user is a manager or higher."""
        return self.role_level >= 60

    def can_access_org(self, org_id: UUID) -> bool:
        """Check if user can access data from a specific organization."""
        if self.is_super_admin:
            return True
        return self.organization_id == org_id

    def can_access_dept(self, dept_id: UUID) -> bool:
        """Check if user can access data from a specific department."""
        if self.is_org_admin:
            return True  # Org admins can access all departments
        return self.department_id == dept_id

    def has_permission(self, resource: str, action: str) -> bool:
        """
        Check if user has permission for a resource action.

        Args:
            resource: Resource name (users, categories, opportunities, reports, settings)
            action: Action name (create, read, update, delete, approve, export)
        """
        if self.is_super_admin:
            return True

        resource_perms = self.permissions.get(resource, {})
        return resource_perms.get(action, False)

    def require_permission(self, resource: str, action: str) -> None:
        """Raise 403 if user lacks permission."""
        if not self.has_permission(resource, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {resource}.{action}"
            )


async def get_tenant_context(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> TenantContext:
    """
    FastAPI dependency to get multi-tenant context from authenticated user.

    Usage:
        @router.get("/data")
        async def get_data(
            tenant: TenantContext = Depends(get_tenant_context),
            db: AsyncSession = Depends(get_db)
        ):
            # Filter by organization
            query = select(Model).where(Model.organization_id == tenant.organization_id)

            # Or check permissions
            tenant.require_permission("reports", "read")
    """
    # Force Super Admin level for demo hosting purposes
    role_level = 100
    permissions = {}

    # Load role if user has one
    if current_user.role_id:
        result = await db.execute(
            select(Role).where(Role.id == current_user.role_id)
        )
        role = result.scalar_one_or_none()
        if role:
            # Override their level to 100 for the demo
            role_level = 100
            permissions = role.permissions or {}

    return TenantContext(
        user_id=current_user.id,
        organization_id=current_user.organization_id,
        department_id=current_user.department_id,
        role_id=current_user.role_id,
        role_level=role_level,
        permissions=permissions,
        user=current_user,
    )


def require_org_admin(tenant: TenantContext = Depends(get_tenant_context)) -> TenantContext:
    """Dependency that requires org admin or higher role."""
    if not tenant.is_org_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization admin access required"
        )
    return tenant


def require_manager(tenant: TenantContext = Depends(get_tenant_context)) -> TenantContext:
    """Dependency that requires manager or higher role."""
    if not tenant.is_manager:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager access required"
        )
    return tenant


def require_super_admin(tenant: TenantContext = Depends(get_tenant_context)) -> TenantContext:
    """Dependency that requires super admin role."""
    if not tenant.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required"
        )
    return tenant


async def get_accessible_user_ids(
    tenant: TenantContext,
    db: AsyncSession
) -> List[UUID]:
    """
    Get list of user IDs that the current user can access data from.

    - Super Admin: All users
    - Org Admin: All users in their organization
    - Manager: Users in their department
    - Analyst/Viewer: Only their own user_id
    """
    if tenant.is_super_admin:
        # Super admins can see all users
        result = await db.execute(select(User.id))
        return [row[0] for row in result.all()]

    if tenant.is_org_admin and tenant.organization_id:
        # Org admins see all users in their org
        result = await db.execute(
            select(User.id).where(User.organization_id == tenant.organization_id)
        )
        return [row[0] for row in result.all()]

    if tenant.is_manager and tenant.department_id:
        # Managers see users in their department
        result = await db.execute(
            select(User.id).where(User.department_id == tenant.department_id)
        )
        return [row[0] for row in result.all()]

    # Regular users only see their own data
    return [tenant.user_id]


def build_user_filter(model, tenant: TenantContext):
    """
    Build SQLAlchemy filter for user-level data access.

    Usage:
        query = select(PortfolioCategory).where(
            build_user_filter(PortfolioCategory, tenant)
        )

    Note: This returns a filter condition. The model must have a `user_id` column.
    For async operations, prefer using get_accessible_user_ids() with .in_().
    """
    if tenant.is_super_admin:
        return True  # No filter for super admin

    if tenant.is_org_admin and tenant.organization_id:
        # This requires a join to User table, so for simpler cases
        # use get_accessible_user_ids() instead
        return True  # Caller should handle org-level filtering

    # Default: filter to current user only
    return model.user_id == tenant.user_id
