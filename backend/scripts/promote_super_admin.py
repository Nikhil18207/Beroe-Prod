#!/usr/bin/env python
"""
Script to promote a user to Super Admin role.

Usage:
    python scripts/promote_super_admin.py <email>

Example:
    python scripts/promote_super_admin.py nikhil@beroe.com
"""

import asyncio
import sys
import os

# Add parent directory to path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models.user import User
from app.models.role import Role


async def promote_user(email: str):
    """Promote a user to Super Admin role."""

    # Create async engine and session
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Find the user
        result = await db.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()

        if not user:
            print(f"Error: User with email '{email}' not found.")
            return False

        # Find or create SUPER_ADMIN role
        result = await db.execute(
            select(Role).where(Role.name == "SUPER_ADMIN")
        )
        super_admin_role = result.scalar_one_or_none()

        if not super_admin_role:
            print("Creating SUPER_ADMIN role...")
            super_admin_role = Role(
                name="SUPER_ADMIN",
                display_name="Super Administrator",
                description="Platform-wide administrator with access to all organizations",
                permissions={
                    "admin": True,
                    "all_organizations": True,
                    "manage_users": True,
                    "manage_roles": True,
                    "view_analytics": True
                },
                level=100,
                is_system=True
            )
            db.add(super_admin_role)
            await db.flush()

        # Assign role to user
        user.role_id = super_admin_role.id
        await db.commit()

        print(f"Success! User '{email}' has been promoted to Super Admin.")
        print(f"User ID: {user.id}")
        return True

    await engine.dispose()


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/promote_super_admin.py <email>")
        print("Example: python scripts/promote_super_admin.py nikhil@beroe.com")
        sys.exit(1)

    email = sys.argv[1]
    print(f"Promoting user '{email}' to Super Admin...")

    success = asyncio.run(promote_user(email))
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
