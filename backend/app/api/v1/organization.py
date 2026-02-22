"""
Organization, Department, and Role Management Endpoints
Multi-tenant hierarchy management for enterprise access control.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import uuid
import re

from app.database import get_db
from app.models.organization import Organization
from app.models.department import Department
from app.models.role import Role, DEFAULT_ROLES
from app.models.user import User
from app.api.v1.dependencies import get_tenant_context, TenantContext
from app.schemas.user import (
    OrganizationCreate,
    OrganizationResponse,
    DepartmentCreate,
    DepartmentResponse,
    RoleResponse,
)

router = APIRouter()


def generate_slug(name: str) -> str:
    """Generate a URL-safe slug from organization name."""
    slug = name.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[-\s]+', '-', slug)
    return slug[:100]


# ============== Organization Endpoints ==============

@router.get("/organizations", response_model=List[OrganizationResponse])
async def list_organizations(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """
    List all organizations (for super admins or during signup).
    """
    result = await db.execute(
        select(Organization)
        .where(Organization.is_active == True)
        .offset(skip)
        .limit(limit)
        .order_by(Organization.name)
    )
    organizations = result.scalars().all()
    return [OrganizationResponse.model_validate(org) for org in organizations]


@router.get("/organizations/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific organization by ID.
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

    return OrganizationResponse.model_validate(org)


@router.post("/organizations", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    org_data: OrganizationCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new organization.
    """
    # Generate slug if not provided
    slug = org_data.slug or generate_slug(org_data.name)

    # Check if slug is unique
    result = await db.execute(
        select(Organization).where(Organization.slug == slug)
    )
    existing = result.scalar_one_or_none()

    if existing:
        # Append a unique suffix
        result = await db.execute(
            select(func.count()).select_from(Organization).where(Organization.slug.like(f"{slug}%"))
        )
        count = result.scalar()
        slug = f"{slug}-{count + 1}"

    # Create organization
    org = Organization(
        name=org_data.name,
        slug=slug,
        industry=org_data.industry,
        size=org_data.size,
        country=org_data.country,
    )

    db.add(org)
    await db.commit()
    await db.refresh(org)

    # Create default departments
    default_depts = ["Procurement", "Finance", "Operations"]
    for dept_name in default_depts:
        dept = Department(
            name=dept_name,
            code=dept_name[:4].upper(),
            organization_id=org.id
        )
        db.add(dept)

    await db.commit()

    return OrganizationResponse.model_validate(org)


@router.get("/organizations/by-slug/{slug}", response_model=OrganizationResponse)
async def get_organization_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get organization by slug (for login/signup).
    """
    result = await db.execute(
        select(Organization).where(Organization.slug == slug)
    )
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    return OrganizationResponse.model_validate(org)


# ============== Department Endpoints ==============

@router.get("/organizations/{org_id}/departments", response_model=List[DepartmentResponse])
async def list_departments(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    List all departments in an organization.
    """
    result = await db.execute(
        select(Department)
        .where(
            Department.organization_id == org_id,
            Department.is_active == True
        )
        .order_by(Department.name)
    )
    departments = result.scalars().all()
    return [DepartmentResponse.model_validate(dept) for dept in departments]


@router.post("/departments", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_department(
    dept_data: DepartmentCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new department (org admin only).
    """
    tenant.require_permission("departments", "create")

    # Verify organization exists
    result = await db.execute(
        select(Organization).where(Organization.id == dept_data.organization_id)
    )
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    # Non-super-admins can only create departments in their own organization
    if not tenant.is_super_admin and tenant.organization_id != dept_data.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to create departments in this organization"
        )

    # Create department
    dept = Department(
        name=dept_data.name,
        code=dept_data.code,
        description=dept_data.description,
        organization_id=dept_data.organization_id
    )

    db.add(dept)
    await db.commit()
    await db.refresh(dept)

    return DepartmentResponse.model_validate(dept)


# ============== Role Endpoints ==============

@router.get("/roles", response_model=List[RoleResponse])
async def list_roles(
    db: AsyncSession = Depends(get_db)
):
    """
    List all available roles.
    """
    result = await db.execute(
        select(Role)
        .where(Role.is_active == True)
        .order_by(Role.level.desc())
    )
    roles = result.scalars().all()
    return [RoleResponse.model_validate(role) for role in roles]


@router.get("/roles/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific role by ID.
    """
    result = await db.execute(
        select(Role).where(Role.id == role_id)
    )
    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )

    return RoleResponse.model_validate(role)


@router.get("/roles/by-name/{name}", response_model=RoleResponse)
async def get_role_by_name(
    name: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get role by name (e.g., 'ANALYST', 'MANAGER').
    """
    result = await db.execute(
        select(Role).where(Role.name == name.upper())
    )
    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )

    return RoleResponse.model_validate(role)


# ============== Initialization Endpoint ==============

@router.post("/init-roles", response_model=List[RoleResponse])
async def initialize_default_roles(
    db: AsyncSession = Depends(get_db)
):
    """
    Initialize default roles in the database.
    This is allowed unauthenticated ONLY if no roles exist yet (first-time setup).
    Otherwise, it requires super admin access.
    """
    # Check if roles already exist
    result = await db.execute(select(func.count()).select_from(Role))
    role_count = result.scalar()

    if role_count > 0:
        # Roles exist — this is a re-initialization, require super admin
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Roles already initialized. Contact a super admin to re-initialize."
        )
    created_roles = []

    for role_data in DEFAULT_ROLES:
        # Check if role already exists
        result = await db.execute(
            select(Role).where(Role.name == role_data["name"])
        )
        existing = result.scalar_one_or_none()

        if existing:
            created_roles.append(existing)
            continue

        # Create role
        role = Role(
            name=role_data["name"],
            display_name=role_data["display_name"],
            description=role_data["description"],
            level=role_data["level"],
            is_system_role=role_data["is_system_role"],
            permissions=role_data["permissions"]
        )

        db.add(role)
        created_roles.append(role)

    await db.commit()

    return [RoleResponse.model_validate(role) for role in created_roles]
