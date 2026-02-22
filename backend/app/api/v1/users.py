"""
User Management API Endpoints
For Org Admins to manage users within their organization.
"""

from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from pydantic import BaseModel, EmailStr
import uuid
import secrets
import string

from app.database import get_db
from app.models.user import User
from app.models.organization import Organization
from app.models.department import Department
from app.models.role import Role, DEFAULT_ROLES
from app.api.v1.auth import get_current_user, get_password_hash
from app.services.activity_service import log_user_management, get_client_ip

router = APIRouter()


# =====================
# Schemas
# =====================

class InviteUserRequest(BaseModel):
    email: EmailStr
    name: str
    role_name: str  # MANAGER, ANALYST, VIEWER
    department_id: Optional[uuid.UUID] = None
    job_title: Optional[str] = None


class UpdateUserRoleRequest(BaseModel):
    role_name: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: Optional[str]
    role_name: str
    role_level: int
    department_id: Optional[uuid.UUID]
    department_name: Optional[str]
    job_title: Optional[str]
    is_active: bool
    last_login: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    users: List[UserResponse]
    total: int
    page: int
    page_size: int


# =====================
# Helper Functions
# =====================

async def require_org_admin(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Require ORG_ADMIN or higher role.
    """
    if not current_user.role_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Organization Admin privileges required."
        )

    result = await db.execute(
        select(Role).where(Role.id == current_user.role_id)
    )
    role = result.scalar_one_or_none()

    if not role or role.level < 80:  # ORG_ADMIN level
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Organization Admin privileges required."
        )

    return current_user


def generate_temp_password(length: int = 12) -> str:
    """Generate a temporary password."""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


async def ensure_roles_exist(db: AsyncSession) -> dict:
    """Ensure all default roles exist and return a name->role mapping."""
    roles = {}

    for role_def in DEFAULT_ROLES:
        result = await db.execute(
            select(Role).where(Role.name == role_def["name"])
        )
        role = result.scalar_one_or_none()

        if not role:
            role = Role(
                name=role_def["name"],
                display_name=role_def["display_name"],
                description=role_def["description"],
                level=role_def["level"],
                is_system_role=role_def["is_system_role"],
                permissions=role_def["permissions"]
            )
            db.add(role)
            await db.flush()

        roles[role_def["name"]] = role

    return roles


# =====================
# Endpoints
# =====================

@router.get("/", response_model=UserListResponse)
async def list_users(
    current_user: User = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    role_name: Optional[str] = None,
    department_id: Optional[uuid.UUID] = None,
    active_only: bool = True
):
    """
    List users in the current user's organization.
    Only accessible to Org Admins.
    """
    if not current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with an organization"
        )

    # Build query
    query = select(User).where(User.organization_id == current_user.organization_id)

    if active_only:
        query = query.where(User.is_active == True)

    if search:
        query = query.where(
            (User.email.ilike(f"%{search}%")) |
            (User.name.ilike(f"%{search}%"))
        )

    if department_id:
        query = query.where(User.department_id == department_id)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    query = query.order_by(User.created_at.desc())

    result = await db.execute(query)
    users = result.scalars().all()

    # Build response with role and department info
    user_responses = []
    for user in users:
        role_name_str = "Analyst"
        role_level = 40
        dept_name = None

        if user.role_id:
            role_result = await db.execute(
                select(Role).where(Role.id == user.role_id)
            )
            role = role_result.scalar_one_or_none()
            if role:
                role_name_str = role.display_name
                role_level = role.level

        if user.department_id:
            dept_result = await db.execute(
                select(Department).where(Department.id == user.department_id)
            )
            dept = dept_result.scalar_one_or_none()
            if dept:
                dept_name = dept.name

        user_responses.append(UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            role_name=role_name_str,
            role_level=role_level,
            department_id=user.department_id,
            department_name=dept_name,
            job_title=user.job_title,
            is_active=user.is_active,
            last_login=user.last_login,
            created_at=user.created_at
        ))

    return UserListResponse(
        users=user_responses,
        total=total,
        page=page,
        page_size=page_size
    )


@router.post("/invite", response_model=UserResponse)
async def invite_user(
    request: Request,
    invite: InviteUserRequest,
    current_user: User = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Invite a new user to the organization.
    Creates the user with a temporary password.
    """
    if not current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with an organization"
        )

    # Check if email already exists
    existing = await db.execute(
        select(User).where(User.email == invite.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists"
        )

    # Ensure roles exist and get the requested role
    roles = await ensure_roles_exist(db)

    role_name_upper = invite.role_name.upper()
    if role_name_upper not in roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role: {invite.role_name}. Valid roles: MANAGER, ANALYST, VIEWER"
        )

    # Org Admins can't create Super Admins or other Org Admins
    if role_name_upper in ["SUPER_ADMIN", "ORG_ADMIN"]:
        # Check if current user is Super Admin
        current_role = roles.get("SUPER_ADMIN")
        if not current_role or current_user.role_id != current_role.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Super Admins can create Org Admin users"
            )

    role = roles[role_name_upper]

    # Validate department if provided
    if invite.department_id:
        dept_result = await db.execute(
            select(Department).where(
                and_(
                    Department.id == invite.department_id,
                    Department.organization_id == current_user.organization_id
                )
            )
        )
        if not dept_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Department not found in your organization"
            )

    # Generate temporary password
    temp_password = generate_temp_password()

    # Create the user
    new_user = User(
        email=invite.email,
        name=invite.name,
        hashed_password=get_password_hash(temp_password),
        organization_id=current_user.organization_id,
        department_id=invite.department_id,
        role_id=role.id,
        job_title=invite.job_title,
        is_active=True,
        setup_completed=False
    )

    db.add(new_user)

    # Log activity
    await log_user_management(
        db=db,
        admin_user=current_user,
        target_user_email=invite.email,
        action="create",
        ip_address=get_client_ip(request)
    )

    await db.commit()
    await db.refresh(new_user)

    # Get department name for response
    dept_name = None
    if new_user.department_id:
        dept_result = await db.execute(
            select(Department).where(Department.id == new_user.department_id)
        )
        dept = dept_result.scalar_one_or_none()
        if dept:
            dept_name = dept.name

    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        name=new_user.name,
        role_name=role.display_name,
        role_level=role.level,
        department_id=new_user.department_id,
        department_name=dept_name,
        job_title=new_user.job_title,
        is_active=new_user.is_active,
        last_login=new_user.last_login,
        created_at=new_user.created_at
    )


@router.patch("/{user_id}/role")
async def update_user_role(
    user_id: uuid.UUID,
    request: Request,
    role_update: UpdateUserRoleRequest,
    current_user: User = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a user's role.
    """
    if not current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with an organization"
        )

    # Get the target user
    result = await db.execute(
        select(User).where(
            and_(
                User.id == user_id,
                User.organization_id == current_user.organization_id
            )
        )
    )
    target_user = result.scalar_one_or_none()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in your organization"
        )

    # Can't modify your own role
    if target_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot modify your own role"
        )

    # Ensure roles exist and get the requested role
    roles = await ensure_roles_exist(db)

    role_name_upper = role_update.role_name.upper()
    if role_name_upper not in roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role: {role_update.role_name}"
        )

    # Org Admins can't assign Super Admin or Org Admin roles
    if role_name_upper in ["SUPER_ADMIN", "ORG_ADMIN"]:
        current_role_result = await db.execute(
            select(Role).where(Role.id == current_user.role_id)
        )
        current_role = current_role_result.scalar_one_or_none()
        if not current_role or current_role.name != "SUPER_ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Super Admins can assign admin roles"
            )

    role = roles[role_name_upper]
    target_user.role_id = role.id

    # Log activity
    await log_user_management(
        db=db,
        admin_user=current_user,
        target_user_email=target_user.email,
        action="update",
        ip_address=get_client_ip(request)
    )

    await db.commit()

    return {
        "message": f"User role updated to {role.display_name}",
        "user_id": str(user_id),
        "new_role": role.display_name
    }


@router.patch("/{user_id}/deactivate")
async def deactivate_user(
    user_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Deactivate a user (soft delete).
    """
    if not current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with an organization"
        )

    # Get the target user
    result = await db.execute(
        select(User).where(
            and_(
                User.id == user_id,
                User.organization_id == current_user.organization_id
            )
        )
    )
    target_user = result.scalar_one_or_none()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in your organization"
        )

    # Can't deactivate yourself
    if target_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account"
        )

    target_user.is_active = False

    await db.commit()

    return {"message": f"User {target_user.email} has been deactivated"}


@router.patch("/{user_id}/activate")
async def activate_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Reactivate a deactivated user.
    """
    if not current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with an organization"
        )

    # Get the target user
    result = await db.execute(
        select(User).where(
            and_(
                User.id == user_id,
                User.organization_id == current_user.organization_id
            )
        )
    )
    target_user = result.scalar_one_or_none()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in your organization"
        )

    target_user.is_active = True

    await db.commit()

    return {"message": f"User {target_user.email} has been activated"}


@router.get("/roles")
async def list_available_roles(
    current_user: User = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    List roles that can be assigned to users.
    """
    # Ensure roles exist
    await ensure_roles_exist(db)

    # Get current user's role level
    current_role_level = 0
    if current_user.role_id:
        result = await db.execute(
            select(Role).where(Role.id == current_user.role_id)
        )
        role = result.scalar_one_or_none()
        if role:
            current_role_level = role.level

    # Get all roles that are at or below the current user's level
    result = await db.execute(
        select(Role).where(
            and_(
                Role.is_active == True,
                Role.level < current_role_level  # Can only assign roles below your level
            )
        ).order_by(Role.level.desc())
    )
    roles = result.scalars().all()

    return [
        {
            "name": role.name,
            "display_name": role.display_name,
            "description": role.description,
            "level": role.level
        }
        for role in roles
    ]


@router.get("/departments")
async def list_departments(
    current_user: User = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    List departments in the organization.
    """
    if not current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with an organization"
        )

    result = await db.execute(
        select(Department).where(
            Department.organization_id == current_user.organization_id
        ).order_by(Department.name)
    )
    departments = result.scalars().all()

    return [
        {
            "id": str(dept.id),
            "name": dept.name,
            "description": dept.description
        }
        for dept in departments
    ]
