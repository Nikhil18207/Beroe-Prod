"""
Activity Logging Service
Centralized service for logging user activities.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
import uuid
import json

from app.models.activity_log import ActivityLog, ActivityType
from app.models.user import User


async def log_activity(
    db: AsyncSession,
    user: User,
    activity_type: str,
    description: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    resource_name: Optional[str] = None,
    metadata: Optional[dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> ActivityLog:
    """
    Log a user activity.

    Args:
        db: Database session
        user: The user performing the action
        activity_type: Type of activity (from ActivityType constants)
        description: Human-readable description of the activity
        resource_type: Type of resource affected (file, category, etc.)
        resource_id: ID of the resource affected
        resource_name: Name/title of the resource affected
        metadata: Additional JSON-serializable data
        ip_address: Client IP address
        user_agent: Client user agent string

    Returns:
        The created ActivityLog record
    """
    # Ensure user has organization_id
    organization_id = user.organization_id
    if not organization_id:
        # Skip logging for users without organization (demo users, etc.)
        return None

    activity = ActivityLog(
        user_id=user.id,
        organization_id=organization_id,
        activity_type=activity_type,
        description=description,
        resource_type=resource_type,
        resource_id=resource_id,
        resource_name=resource_name,
        extra_data=json.dumps(metadata) if metadata else None,
        ip_address=ip_address,
        user_agent=user_agent,
        created_at=datetime.utcnow()
    )

    db.add(activity)
    # Don't commit here - let the calling function handle transaction
    return activity


# Convenience functions for common activities

async def log_login(
    db: AsyncSession,
    user: User,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> Optional[ActivityLog]:
    """Log a user login event."""
    return await log_activity(
        db=db,
        user=user,
        activity_type=ActivityType.LOGIN,
        description=f"{user.name or user.email} logged in",
        ip_address=ip_address,
        user_agent=user_agent
    )


async def log_logout(
    db: AsyncSession,
    user: User,
    ip_address: Optional[str] = None
) -> Optional[ActivityLog]:
    """Log a user logout event."""
    return await log_activity(
        db=db,
        user=user,
        activity_type=ActivityType.LOGOUT,
        description=f"{user.name or user.email} logged out",
        ip_address=ip_address
    )


async def log_file_upload(
    db: AsyncSession,
    user: User,
    file_name: str,
    file_type: str,
    file_size: Optional[int] = None,
    ip_address: Optional[str] = None
) -> Optional[ActivityLog]:
    """Log a file upload event."""
    size_str = ""
    if file_size:
        if file_size > 1024 * 1024:
            size_str = f" ({file_size / (1024 * 1024):.1f} MB)"
        elif file_size > 1024:
            size_str = f" ({file_size / 1024:.1f} KB)"
        else:
            size_str = f" ({file_size} bytes)"

    return await log_activity(
        db=db,
        user=user,
        activity_type=ActivityType.FILE_UPLOAD,
        description=f"{user.name or user.email} uploaded {file_name}{size_str}",
        resource_type="file",
        resource_name=file_name,
        metadata={"file_type": file_type, "file_size": file_size},
        ip_address=ip_address
    )


async def log_file_delete(
    db: AsyncSession,
    user: User,
    file_name: str,
    ip_address: Optional[str] = None
) -> Optional[ActivityLog]:
    """Log a file deletion event."""
    return await log_activity(
        db=db,
        user=user,
        activity_type=ActivityType.FILE_DELETE,
        description=f"{user.name or user.email} deleted {file_name}",
        resource_type="file",
        resource_name=file_name,
        ip_address=ip_address
    )


async def log_analysis_start(
    db: AsyncSession,
    user: User,
    category_name: str,
    ip_address: Optional[str] = None
) -> Optional[ActivityLog]:
    """Log an analysis start event."""
    return await log_activity(
        db=db,
        user=user,
        activity_type=ActivityType.ANALYSIS_START,
        description=f"{user.name or user.email} started analysis for {category_name}",
        resource_type="category",
        resource_name=category_name,
        ip_address=ip_address
    )


async def log_analysis_complete(
    db: AsyncSession,
    user: User,
    category_name: str,
    savings_amount: Optional[float] = None,
    ip_address: Optional[str] = None
) -> Optional[ActivityLog]:
    """Log an analysis completion event."""
    desc = f"{user.name or user.email} completed analysis for {category_name}"
    if savings_amount:
        desc += f" (${savings_amount:,.0f} potential savings)"

    return await log_activity(
        db=db,
        user=user,
        activity_type=ActivityType.ANALYSIS_COMPLETE,
        description=desc,
        resource_type="category",
        resource_name=category_name,
        metadata={"savings_amount": savings_amount} if savings_amount else None,
        ip_address=ip_address
    )


async def log_category_select(
    db: AsyncSession,
    user: User,
    categories: list[str],
    ip_address: Optional[str] = None
) -> Optional[ActivityLog]:
    """Log category selection event."""
    count = len(categories)
    cat_preview = ", ".join(categories[:3])
    if count > 3:
        cat_preview += f" (+{count - 3} more)"

    return await log_activity(
        db=db,
        user=user,
        activity_type=ActivityType.CATEGORY_SELECT,
        description=f"{user.name or user.email} selected {count} categories: {cat_preview}",
        resource_type="categories",
        metadata={"categories": categories, "count": count},
        ip_address=ip_address
    )


async def log_goals_update(
    db: AsyncSession,
    user: User,
    cost: int,
    risk: int,
    esg: int,
    ip_address: Optional[str] = None
) -> Optional[ActivityLog]:
    """Log goals update event."""
    return await log_activity(
        db=db,
        user=user,
        activity_type=ActivityType.GOALS_UPDATE,
        description=f"{user.name or user.email} updated goals (Cost: {cost}%, Risk: {risk}%, ESG: {esg}%)",
        resource_type="goals",
        metadata={"cost": cost, "risk": risk, "esg": esg},
        ip_address=ip_address
    )


async def log_opportunity_action(
    db: AsyncSession,
    user: User,
    opportunity_name: str,
    action: str,  # "accept" or "reject"
    savings_amount: Optional[float] = None,
    ip_address: Optional[str] = None
) -> Optional[ActivityLog]:
    """Log opportunity accept/reject event."""
    activity_type = ActivityType.OPPORTUNITY_ACCEPT if action == "accept" else ActivityType.OPPORTUNITY_REJECT
    verb = "accepted" if action == "accept" else "rejected"

    desc = f"{user.name or user.email} {verb} {opportunity_name}"
    if savings_amount and action == "accept":
        desc += f" (${savings_amount:,.0f} potential savings)"

    return await log_activity(
        db=db,
        user=user,
        activity_type=activity_type,
        description=desc,
        resource_type="opportunity",
        resource_name=opportunity_name,
        metadata={"action": action, "savings_amount": savings_amount},
        ip_address=ip_address
    )


async def log_user_management(
    db: AsyncSession,
    admin_user: User,
    target_user_email: str,
    action: str,  # "create" or "update"
    ip_address: Optional[str] = None
) -> Optional[ActivityLog]:
    """Log user management event."""
    activity_type = ActivityType.USER_CREATE if action == "create" else ActivityType.USER_UPDATE
    verb = "created" if action == "create" else "updated"

    return await log_activity(
        db=db,
        user=admin_user,
        activity_type=activity_type,
        description=f"{admin_user.name or admin_user.email} {verb} user {target_user_email}",
        resource_type="user",
        resource_name=target_user_email,
        metadata={"action": action},
        ip_address=ip_address
    )


def get_client_ip(request) -> Optional[str]:
    """Extract client IP from request, handling proxies."""
    # Check X-Forwarded-For header (common for proxies/load balancers)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take first IP in the chain
        return forwarded_for.split(",")[0].strip()

    # Check X-Real-IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    # Fall back to direct client
    if request.client:
        return request.client.host

    return None


def get_user_agent(request) -> Optional[str]:
    """Extract user agent from request."""
    ua = request.headers.get("User-Agent")
    if ua and len(ua) > 500:
        ua = ua[:500]  # Truncate to fit in database
    return ua
