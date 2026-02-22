"""
Admin API Endpoints
Super Admin dashboard for platform-wide monitoring.
"""

from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_
from pydantic import BaseModel
import uuid

from app.database import get_db
from app.models.user import User
from app.models.organization import Organization
from app.models.department import Department
from app.models.role import Role
from app.models.activity_log import ActivityLog
from app.api.v1.auth import get_current_user
from app.config import settings

router = APIRouter()


# =====================
# Schemas for Admin API
# =====================

class OrganizationStats(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    plan: str
    industry: Optional[str]
    country: Optional[str]
    logo_url: Optional[str]
    user_count: int
    department_count: int
    is_active: bool
    created_at: datetime
    last_activity_at: Optional[datetime]
    last_activity_description: Optional[str]
    last_active_user: Optional[str]

    class Config:
        from_attributes = True


class ActivityLogResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_name: Optional[str]
    user_email: str
    organization_id: uuid.UUID
    organization_name: str
    activity_type: str
    description: str
    resource_type: Optional[str]
    resource_name: Optional[str]
    ip_address: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class UserSummary(BaseModel):
    id: uuid.UUID
    email: str
    name: Optional[str]
    role_name: str
    department_name: Optional[str]
    is_active: bool
    last_login: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class OrganizationDetail(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    plan: str
    industry: Optional[str]
    size: Optional[str]
    country: Optional[str]
    logo_url: Optional[str]
    max_users: int
    max_categories: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    user_count: int
    department_count: int
    users: List[UserSummary]
    recent_activities: List[ActivityLogResponse]

    class Config:
        from_attributes = True


class PlatformStats(BaseModel):
    total_organizations: int
    active_organizations: int
    total_users: int
    active_users_today: int
    active_users_week: int
    total_activities_today: int
    total_activities_week: int


class PromoteToSuperAdminRequest(BaseModel):
    email: str
    secret_key: str


# =====================
# Helper Functions
# =====================

async def require_super_admin(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Dependency to require SUPER_ADMIN role.
    Returns the user if authorized, raises 403 otherwise.
    """
    if not current_user.role_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Super Admin privileges required."
        )

    # Get the role
    result = await db.execute(
        select(Role).where(Role.id == current_user.role_id)
    )
    role = result.scalar_one_or_none()

    if not role or role.name != "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Super Admin privileges required."
        )

    return current_user


# =====================
# Admin Endpoints
# =====================

@router.get("/stats", response_model=PlatformStats)
async def get_platform_stats(
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get platform-wide statistics.
    """
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    # Total organizations
    result = await db.execute(select(func.count()).select_from(Organization))
    total_orgs = result.scalar() or 0

    # Active organizations
    result = await db.execute(
        select(func.count()).select_from(Organization).where(Organization.is_active == True)
    )
    active_orgs = result.scalar() or 0

    # Total users
    result = await db.execute(select(func.count()).select_from(User))
    total_users = result.scalar() or 0

    # Active users today (logged in today)
    result = await db.execute(
        select(func.count()).select_from(User).where(
            User.last_login >= today_start
        )
    )
    active_users_today = result.scalar() or 0

    # Active users this week
    result = await db.execute(
        select(func.count()).select_from(User).where(
            User.last_login >= week_start
        )
    )
    active_users_week = result.scalar() or 0

    # Activities today
    result = await db.execute(
        select(func.count()).select_from(ActivityLog).where(
            ActivityLog.created_at >= today_start
        )
    )
    activities_today = result.scalar() or 0

    # Activities this week
    result = await db.execute(
        select(func.count()).select_from(ActivityLog).where(
            ActivityLog.created_at >= week_start
        )
    )
    activities_week = result.scalar() or 0

    return PlatformStats(
        total_organizations=total_orgs,
        active_organizations=active_orgs,
        total_users=total_users,
        active_users_today=active_users_today,
        active_users_week=active_users_week,
        total_activities_today=activities_today,
        total_activities_week=activities_week
    )


@router.get("/organizations", response_model=List[OrganizationStats])
async def list_organizations(
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    active_only: bool = True
):
    """
    List all organizations with stats for the Super Admin dashboard.
    """
    # Build query
    query = select(Organization)

    if active_only:
        query = query.where(Organization.is_active == True)

    if search:
        query = query.where(Organization.name.ilike(f"%{search}%"))

    query = query.order_by(desc(Organization.created_at))
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    organizations = result.scalars().all()

    org_stats = []
    for org in organizations:
        # Get user count
        user_count_result = await db.execute(
            select(func.count()).select_from(User).where(User.organization_id == org.id)
        )
        user_count = user_count_result.scalar() or 0

        # Get department count
        dept_count_result = await db.execute(
            select(func.count()).select_from(Department).where(Department.organization_id == org.id)
        )
        dept_count = dept_count_result.scalar() or 0

        # Get last activity
        last_activity_result = await db.execute(
            select(ActivityLog, User.name, User.email)
            .join(User, User.id == ActivityLog.user_id)
            .where(ActivityLog.organization_id == org.id)
            .order_by(desc(ActivityLog.created_at))
            .limit(1)
        )
        last_activity_row = last_activity_result.first()

        last_activity_at = None
        last_activity_desc = None
        last_active_user = None

        if last_activity_row:
            activity, user_name, user_email = last_activity_row
            last_activity_at = activity.created_at
            last_activity_desc = activity.description
            last_active_user = user_name or user_email

        org_stats.append(OrganizationStats(
            id=org.id,
            name=org.name,
            slug=org.slug,
            plan=org.plan,
            industry=org.industry,
            country=org.country,
            logo_url=org.logo_url,
            user_count=user_count,
            department_count=dept_count,
            is_active=org.is_active,
            created_at=org.created_at,
            last_activity_at=last_activity_at,
            last_activity_description=last_activity_desc,
            last_active_user=last_active_user
        ))

    return org_stats


@router.get("/organizations/{org_id}", response_model=OrganizationDetail)
async def get_organization_detail(
    org_id: uuid.UUID,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed information about a specific organization.
    """
    # Get organization
    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    # Get user count
    user_count_result = await db.execute(
        select(func.count()).select_from(User).where(User.organization_id == org.id)
    )
    user_count = user_count_result.scalar() or 0

    # Get department count
    dept_count_result = await db.execute(
        select(func.count()).select_from(Department).where(Department.organization_id == org.id)
    )
    dept_count = dept_count_result.scalar() or 0

    # Get users with role and department info
    users_result = await db.execute(
        select(User, Role.display_name, Department.name)
        .outerjoin(Role, Role.id == User.role_id)
        .outerjoin(Department, Department.id == User.department_id)
        .where(User.organization_id == org.id)
        .order_by(desc(User.last_login))
    )
    users_rows = users_result.all()

    users = []
    for user, role_name, dept_name in users_rows:
        users.append(UserSummary(
            id=user.id,
            email=user.email,
            name=user.name,
            role_name=role_name or "Analyst",
            department_name=dept_name,
            is_active=user.is_active,
            last_login=user.last_login,
            created_at=user.created_at
        ))

    # Get recent activities (last 20)
    activities_result = await db.execute(
        select(ActivityLog, User.name, User.email)
        .join(User, User.id == ActivityLog.user_id)
        .where(ActivityLog.organization_id == org.id)
        .order_by(desc(ActivityLog.created_at))
        .limit(20)
    )
    activities_rows = activities_result.all()

    activities = []
    for activity, user_name, user_email in activities_rows:
        activities.append(ActivityLogResponse(
            id=activity.id,
            user_id=activity.user_id,
            user_name=user_name,
            user_email=user_email,
            organization_id=activity.organization_id,
            organization_name=org.name,
            activity_type=activity.activity_type,
            description=activity.description,
            resource_type=activity.resource_type,
            resource_name=activity.resource_name,
            ip_address=activity.ip_address,
            created_at=activity.created_at
        ))

    return OrganizationDetail(
        id=org.id,
        name=org.name,
        slug=org.slug,
        plan=org.plan,
        industry=org.industry,
        size=org.size,
        country=org.country,
        logo_url=org.logo_url,
        max_users=org.max_users,
        max_categories=org.max_categories,
        is_active=org.is_active,
        created_at=org.created_at,
        updated_at=org.updated_at,
        user_count=user_count,
        department_count=dept_count,
        users=users,
        recent_activities=activities
    )


@router.get("/activities", response_model=List[ActivityLogResponse])
async def list_activities(
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    org_id: Optional[uuid.UUID] = None,
    activity_type: Optional[str] = None,
    days: int = Query(7, ge=1, le=90)
):
    """
    List activities across the platform.
    Filterable by organization, activity type, and time range.
    """
    since = datetime.utcnow() - timedelta(days=days)

    # Build query
    query = (
        select(ActivityLog, User.name, User.email, Organization.name)
        .join(User, User.id == ActivityLog.user_id)
        .join(Organization, Organization.id == ActivityLog.organization_id)
        .where(ActivityLog.created_at >= since)
    )

    if org_id:
        query = query.where(ActivityLog.organization_id == org_id)

    if activity_type:
        query = query.where(ActivityLog.activity_type == activity_type)

    query = query.order_by(desc(ActivityLog.created_at))
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    rows = result.all()

    activities = []
    for activity, user_name, user_email, org_name in rows:
        activities.append(ActivityLogResponse(
            id=activity.id,
            user_id=activity.user_id,
            user_name=user_name,
            user_email=user_email,
            organization_id=activity.organization_id,
            organization_name=org_name,
            activity_type=activity.activity_type,
            description=activity.description,
            resource_type=activity.resource_type,
            resource_name=activity.resource_name,
            ip_address=activity.ip_address,
            created_at=activity.created_at
        ))

    return activities


@router.patch("/organizations/{org_id}/status")
async def update_organization_status(
    org_id: uuid.UUID,
    is_active: bool,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Activate or deactivate an organization.
    """
    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    org.is_active = is_active
    org.updated_at = datetime.utcnow()
    await db.commit()

    return {"message": f"Organization {'activated' if is_active else 'deactivated'} successfully"}


@router.post("/promote-super-admin")
async def promote_to_super_admin(
    request: PromoteToSuperAdminRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Promote a user to Super Admin role using a secret key.
    This endpoint does not require authentication - only the correct secret key.

    Use this to bootstrap the first Super Admin or promote yourself.
    """
    # Validate secret key
    if request.secret_key != settings.super_admin_secret:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid secret key"
        )

    # Find the user by email
    result = await db.execute(
        select(User).where(User.email == request.email)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email '{request.email}' not found"
        )

    # Find or create SUPER_ADMIN role
    result = await db.execute(
        select(Role).where(Role.name == "SUPER_ADMIN")
    )
    super_admin_role = result.scalar_one_or_none()

    if not super_admin_role:
        # Create the SUPER_ADMIN role using the canonical DEFAULT_ROLES definition
        from app.models.role import DEFAULT_ROLES
        super_admin_data = next(r for r in DEFAULT_ROLES if r["name"] == "SUPER_ADMIN")
        super_admin_role = Role(
            name=super_admin_data["name"],
            display_name=super_admin_data["display_name"],
            description=super_admin_data["description"],
            permissions=super_admin_data["permissions"],
            level=super_admin_data["level"],
            is_system_role=super_admin_data["is_system_role"],
        )
        db.add(super_admin_role)
        await db.flush()

    # Assign the role to the user
    user.role_id = super_admin_role.id
    await db.commit()

    return {
        "message": f"User '{request.email}' has been promoted to Super Admin",
        "user_id": str(user.id),
        "role": "SUPER_ADMIN"
    }
