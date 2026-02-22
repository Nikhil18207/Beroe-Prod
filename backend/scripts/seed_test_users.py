#!/usr/bin/env python
"""
Seed Test Users Script
Creates test users with different roles for testing purposes.

Usage:
    python scripts/seed_test_users.py

This will create:
- 1 Super Admin (superadmin@beroe.com)
- 1 Org Admin (orgadmin@testcorp.com)
- 1 Manager (manager@testcorp.com)
- 1 Analyst (analyst@testcorp.com)
- 1 Viewer (viewer@testcorp.com)

All test users have password: Test@123
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models.user import User
from app.models.organization import Organization
from app.models.department import Department
from app.models.role import Role, DEFAULT_ROLES
from app.api.v1.auth import get_password_hash

TEST_PASSWORD = "Test@123"
TEST_ORG_NAME = "TestCorp Industries"
TEST_ORG_SLUG = "testcorp"

TEST_USERS = [
    {
        "email": "superadmin@beroe.com",
        "name": "Sarah Super",
        "role": "SUPER_ADMIN",
        "job_title": "Platform Administrator",
        "org_required": False  # Super Admin doesn't need an org
    },
    {
        "email": "orgadmin@testcorp.com",
        "name": "Oliver Admin",
        "role": "ORG_ADMIN",
        "job_title": "Procurement Director",
        "org_required": True
    },
    {
        "email": "manager@testcorp.com",
        "name": "Maria Manager",
        "role": "MANAGER",
        "job_title": "Category Manager",
        "org_required": True
    },
    {
        "email": "analyst@testcorp.com",
        "name": "Alex Analyst",
        "role": "ANALYST",
        "job_title": "Procurement Analyst",
        "org_required": True
    },
    {
        "email": "viewer@testcorp.com",
        "name": "Victor Viewer",
        "role": "VIEWER",
        "job_title": "Finance Associate",
        "org_required": True
    }
]


async def seed_test_users():
    """Create test users with different roles."""

    engine = create_async_engine(settings.database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        print("\n" + "=" * 60)
        print("SEEDING TEST USERS")
        print("=" * 60)

        # Step 1: Create all roles
        print("\n[1/4] Creating roles...")
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
                print(f"   Created role: {role_def['display_name']}")
            else:
                print(f"   Role exists: {role_def['display_name']}")

            roles[role_def["name"]] = role

        # Step 2: Create test organization
        print("\n[2/4] Creating test organization...")
        result = await db.execute(
            select(Organization).where(Organization.slug == TEST_ORG_SLUG)
        )
        org = result.scalar_one_or_none()

        if not org:
            org = Organization(
                name=TEST_ORG_NAME,
                slug=TEST_ORG_SLUG,
                plan="enterprise",
                industry="Manufacturing",
                size="1000-5000",
                country="United States",
                max_users=100,
                max_categories=50,
                is_active=True
            )
            db.add(org)
            await db.flush()
            print(f"   Created organization: {TEST_ORG_NAME}")
        else:
            print(f"   Organization exists: {TEST_ORG_NAME}")

        # Step 3: Create a test department
        print("\n[3/4] Creating test department...")
        result = await db.execute(
            select(Department).where(Department.organization_id == org.id)
        )
        dept = result.scalar_one_or_none()

        if not dept:
            dept = Department(
                name="Procurement",
                description="Strategic Procurement Department",
                organization_id=org.id
            )
            db.add(dept)
            await db.flush()
            print(f"   Created department: Procurement")
        else:
            print(f"   Department exists: {dept.name}")

        # Step 4: Create test users
        print("\n[4/4] Creating test users...")
        hashed_password = get_password_hash(TEST_PASSWORD)

        created_count = 0
        for user_data in TEST_USERS:
            result = await db.execute(
                select(User).where(User.email == user_data["email"])
            )
            existing_user = result.scalar_one_or_none()

            if existing_user:
                # Update role if needed
                role = roles[user_data["role"]]
                if existing_user.role_id != role.id:
                    existing_user.role_id = role.id
                    print(f"   Updated: {user_data['email']} -> {role.display_name}")
                else:
                    print(f"   Exists:  {user_data['email']} ({role.display_name})")
            else:
                role = roles[user_data["role"]]
                new_user = User(
                    email=user_data["email"],
                    name=user_data["name"],
                    hashed_password=hashed_password,
                    organization_id=org.id if user_data["org_required"] else None,
                    department_id=dept.id if user_data["org_required"] else None,
                    role_id=role.id,
                    job_title=user_data["job_title"],
                    is_active=True,
                    setup_completed=True
                )
                db.add(new_user)
                created_count += 1
                print(f"   Created: {user_data['email']} ({role.display_name})")

        await db.commit()

        # Print summary
        print("\n" + "=" * 60)
        print("TEST USERS READY")
        print("=" * 60)
        print(f"\nPassword for all test users: {TEST_PASSWORD}")
        print("\nLogin credentials:")
        print("-" * 60)
        for user_data in TEST_USERS:
            role = user_data["role"].replace("_", " ").title()
            print(f"  {role:20} | {user_data['email']}")
        print("-" * 60)
        print(f"\nOrganization: {TEST_ORG_NAME}")
        print("=" * 60 + "\n")

    await engine.dispose()


def main():
    print("Starting seed process...")
    asyncio.run(seed_test_users())
    print("Done!")


if __name__ == "__main__":
    main()
