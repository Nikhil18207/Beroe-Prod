"""
Authentication Endpoints
User registration, login, and session management.
"""

from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from jose import JWTError, jwt
import bcrypt
import hashlib
import base64
import uuid

from app.database import get_db
from app.config import settings
from app.models.user import User
from app.models.organization import Organization
from app.models.department import Department
from app.models.role import Role
from app.models.password_reset import PasswordResetToken
from app.schemas.user import (
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdate,
    UserGoalsUpdate,
    SetupUpdate,
    Token,
    TokenPayload,
    OrganizationCreate,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
)
from app.services.activity_service import log_login, log_goals_update, get_client_ip, get_user_agent
import re

router = APIRouter()

# OAuth2 scheme - auto_error=False allows optional auth
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

# Demo user ID for unauthenticated requests
DEMO_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def _prehash_password(password: str) -> bytes:
    """
    Pre-hash password with SHA-256 before bcrypt.
    This handles bcrypt's 72-byte limit while maintaining security.
    Returns base64-encoded SHA-256 hash as bytes (44 chars, well under 72).
    """
    sha256_hash = hashlib.sha256(password.encode('utf-8')).digest()
    return base64.b64encode(sha256_hash)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a bcrypt hash."""
    # Pre-hash with SHA-256 to handle any length password
    prehashed = _prehash_password(plain_password)
    hash_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(prehashed, hash_bytes)


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt with SHA-256 pre-hashing."""
    # Pre-hash with SHA-256 to handle any length password (bcrypt limit is 72 bytes)
    prehashed = _prehash_password(password)
    hashed = bcrypt.hashpw(prehashed, bcrypt.gensalt())
    return hashed.decode('utf-8')


async def build_user_response(user: User, db: AsyncSession) -> UserResponse:
    """
    Build UserResponse manually to avoid lazy-loading issues with SQLAlchemy async.
    Fetches org/dept/role names explicitly.
    """
    org_name = None
    dept_name = "General"
    role_display_name = "Analyst"

    if user.organization_id:
        org_result = await db.execute(
            select(Organization).where(Organization.id == user.organization_id)
        )
        org = org_result.scalar_one_or_none()
        if org:
            org_name = org.name

    if user.department_id:
        dept_result = await db.execute(
            select(Department).where(Department.id == user.department_id)
        )
        dept = dept_result.scalar_one_or_none()
        if dept:
            dept_name = dept.name

    if user.role_id:
        role_result = await db.execute(
            select(Role).where(Role.id == user.role_id)
        )
        role_obj = role_result.scalar_one_or_none()
        if role_obj:
            role_display_name = role_obj.display_name

    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        name=user.name,
        company=user.company,
        role=user.role,
        avatar_url=user.avatar_url,
        phone=user.phone,
        job_title=user.job_title,
        preferences=user.preferences,
        goals=user.goals,
        setup_step=user.setup_step,
        setup_completed=user.setup_completed,
        is_active=user.is_active,
        created_at=user.created_at,
        last_login=user.last_login,
        organization_id=user.organization_id,
        department_id=user.department_id,
        role_id=user.role_id,
        org_name=org_name,
        dept_name=dept_name,
        role_name=role_display_name,
    )


def create_access_token(user: User) -> tuple[str, int]:
    """Create a JWT access token with multi-tenant context."""
    expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    expire = datetime.utcnow() + expires_delta

    to_encode = {
        "sub": str(user.id),
        "email": user.email,
        # Multi-tenant context for data filtering
        "org_id": str(user.organization_id) if user.organization_id else None,
        "dept_id": str(user.department_id) if user.department_id else None,
        "role_id": str(user.role_id) if user.role_id else None,
        "exp": expire,
        "iat": datetime.utcnow(),
    }

    encoded_jwt = jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm
    )

    return encoded_jwt, int(expires_delta.total_seconds())


async def get_user_from_token(
    token: str,
    db: AsyncSession
) -> Optional[User]:
    """
    Get user from a JWT token string.
    Used for WebSocket authentication where we can't use Depends.
    Returns None if token is invalid or user not found.
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None

    # Get user from database
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id))
    )
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        return None

    return user


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Get the current authenticated user from JWT token.
    In demo mode (no token), returns or creates a demo user.
    """
    # If no token provided, use demo user
    if not token:
        # Get or create demo user
        result = await db.execute(
            select(User).where(User.id == DEMO_USER_ID)
        )
        user = result.scalar_one_or_none()

        if not user:
            # Create demo user
            user = User(
                id=DEMO_USER_ID,
                email="demo@beroe.com",
                username="demo",
                name="Demo User",
                company="Demo Company",
                hashed_password="",
                goals={"cost": 40, "risk": 35, "esg": 25},
                setup_step=0,
                setup_completed=False,
                is_active=True,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

        return user

    # Validate token
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Get user from database
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id))
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )

    return user


def generate_slug(name: str) -> str:
    """Generate a URL-safe slug from organization name."""
    slug = name.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[-\s]+', '-', slug)
    return slug[:100]


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new user with multi-tenant support.
    Can join existing org or create new one.
    """
    # Check if email or username already exists
    result = await db.execute(
        select(User).where(
            or_(User.email == user_data.email, User.username == user_data.username)
        )
    )
    existing_user = result.scalar_one_or_none()

    if existing_user:
        if existing_user.email == user_data.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )

    # Handle organization
    organization_id = user_data.organization_id
    is_org_admin = False

    if user_data.organization_name and not organization_id:
        # Create new organization
        slug = generate_slug(user_data.organization_name)

        # Check if slug exists and make unique if needed
        result = await db.execute(
            select(Organization).where(Organization.slug == slug)
        )
        if result.scalar_one_or_none():
            from sqlalchemy import func
            result = await db.execute(
                select(func.count()).select_from(Organization).where(Organization.slug.like(f"{slug}%"))
            )
            count = result.scalar()
            slug = f"{slug}-{count + 1}"

        org = Organization(
            name=user_data.organization_name,
            slug=slug,
        )
        db.add(org)
        await db.flush()  # Get the org.id
        organization_id = org.id
        is_org_admin = True  # First user in org becomes admin

        # Create default departments
        default_depts = [
            ("Procurement", "PROC"),
            ("Finance", "FIN"),
            ("Operations", "OPS")
        ]
        first_dept_id = None
        for dept_name, code in default_depts:
            dept = Department(
                name=dept_name,
                code=code,
                organization_id=org.id
            )
            db.add(dept)
            await db.flush()
            if not first_dept_id:
                first_dept_id = dept.id

        # Assign to first department if not specified
        if not user_data.department_id and first_dept_id:
            user_data.department_id = first_dept_id

    # Get role (default to SUPER_ADMIN for demo purposes)
    role_id = user_data.role_id
    if not role_id:
        role_name = "SUPER_ADMIN"
        result = await db.execute(
            select(Role).where(Role.name == role_name)
        )
        role = result.scalar_one_or_none()
        if role:
            role_id = role.id

    # Create new user
    user = User(
        email=user_data.email,
        username=user_data.username,
        name=user_data.name,
        company=user_data.company,  # Legacy
        role=user_data.role,  # Legacy
        hashed_password=get_password_hash(user_data.password),
        goals={"cost": 40, "risk": 35, "esg": 25},  # Default goals
        # Multi-tenant fields
        organization_id=organization_id,
        department_id=user_data.department_id,
        role_id=role_id,
        job_title=user_data.job_title,
        phone=user_data.phone,
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Build response using helper function
    response_data = await build_user_response(user, db)

    # Create access token
    access_token, expires_in = create_access_token(user)

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in,
        user=response_data
    )


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """
    Login with email/username and password.
    Uses OAuth2 password flow for compatibility.
    """
    # Find user by email or username
    result = await db.execute(
        select(User).where(
            or_(User.email == form_data.username, User.username == form_data.username)
        )
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )

    # Update last login
    user.last_login = datetime.utcnow()

    # Log login activity
    await log_login(
        db=db,
        user=user,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request)
    )

    await db.commit()

    # Build response and create token
    response_data = await build_user_response(user, db)
    access_token, expires_in = create_access_token(user)

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in,
        user=response_data
    )


@router.post("/login/json", response_model=Token)
async def login_json(
    request: Request,
    login_data: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    """
    Login with JSON body (alternative to form data).
    Accepts email or username.
    """
    identifier = login_data.email or login_data.username

    if not identifier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or username is required"
        )

    # Find user - try email first, then username if provided
    result = await db.execute(
        select(User).where(User.email == identifier)
    )
    user = result.scalar_one_or_none()

    # If not found by email, try username
    if not user and login_data.username:
        result = await db.execute(
            select(User).where(User.username == identifier)
        )
        user = result.scalar_one_or_none()

    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect credentials"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )

    # Update last login
    user.last_login = datetime.utcnow()

    # Log login activity
    await log_login(
        db=db,
        user=user,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request)
    )

    await db.commit()

    # Build response and create token
    response_data = await build_user_response(user, db)
    access_token, expires_in = create_access_token(user)

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in,
        user=response_data
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current user profile with org/dept/role names.
    """
    return await build_user_response(current_user, db)


@router.put("/me", response_model=UserResponse)
async def update_me(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update current user profile.
    """
    update_data = user_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(current_user, field, value)

    current_user.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(current_user)

    return await build_user_response(current_user, db)


@router.put("/me/setup", response_model=UserResponse)
async def update_setup(
    setup_data: SetupUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update setup wizard progress.
    Called after each setup step to persist progress.
    """
    if setup_data.setup_step is not None:
        current_user.setup_step = setup_data.setup_step

    if setup_data.setup_completed is not None:
        current_user.setup_completed = setup_data.setup_completed

    if setup_data.preferences is not None:
        # Merge with existing preferences
        current_prefs = current_user.preferences or {}
        current_prefs.update(setup_data.preferences)
        current_user.preferences = current_prefs

    if setup_data.goals is not None:
        current_user.goals = setup_data.goals

    current_user.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(current_user)

    return await build_user_response(current_user, db)


@router.put("/me/goals", response_model=UserResponse)
async def update_goals(
    goals: UserGoalsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update user's optimization goals (cost/risk/esg).
    """
    current_user.goals = {
        "cost": goals.cost,
        "risk": goals.risk,
        "esg": goals.esg
    }
    current_user.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(current_user)

    return await build_user_response(current_user, db)


@router.put("/me/setup-step", response_model=UserResponse)
async def update_setup_step(
    step: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update user's setup progress step.
    """
    if step < 0 or step > 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Setup step must be between 0 and 4"
        )

    current_user.setup_step = step
    if step >= 4:
        current_user.setup_completed = True
    current_user.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(current_user)

    return await build_user_response(current_user, db)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    request: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Request a password reset link.
    In production, this would send an email. For development, returns the token.
    """
    # Find user by email
    result = await db.execute(
        select(User).where(User.email == request.email)
    )
    user = result.scalar_one_or_none()

    # Always return success message to prevent email enumeration
    success_message = "If an account with that email exists, you will receive a password reset link."

    if not user:
        # Don't reveal that the email doesn't exist
        return ForgotPasswordResponse(message=success_message)

    if not user.is_active:
        return ForgotPasswordResponse(message=success_message)

    # Invalidate any existing reset tokens for this user
    existing_tokens = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.is_used == False
        )
    )
    for token in existing_tokens.scalars().all():
        token.is_used = True

    # Create new reset token
    reset_token = PasswordResetToken.create_for_user(user.id)
    db.add(reset_token)
    await db.commit()

    # In production, send email here
    # For development/demo, return the token directly
    frontend_url = "http://localhost:3000"  # Configure this from settings
    reset_link = f"{frontend_url}/reset-password?token={reset_token.token}"

    # TODO: Send email with reset link
    # await send_password_reset_email(user.email, reset_link)

    return ForgotPasswordResponse(
        message=success_message,
        reset_token=reset_token.token,  # Remove in production
        reset_link=reset_link  # Remove in production
    )


@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(
    request: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Reset password using a valid reset token.
    """
    # Find the token
    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token == request.token)
    )
    reset_token = result.scalar_one_or_none()

    if not reset_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    if not reset_token.is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired or already been used"
        )

    # Get the user
    result = await db.execute(
        select(User).where(User.id == reset_token.user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )

    # Update password
    user.hashed_password = get_password_hash(request.new_password)
    user.updated_at = datetime.utcnow()

    # Mark token as used
    reset_token.mark_used()

    await db.commit()

    return ResetPasswordResponse(
        message="Password has been reset successfully. You can now login with your new password.",
        success=True
    )


@router.get("/verify-reset-token/{token}")
async def verify_reset_token(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Verify if a reset token is valid (not expired, not used).
    Used by frontend to show/hide reset form.
    """
    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token == token)
    )
    reset_token = result.scalar_one_or_none()

    if not reset_token or not reset_token.is_valid:
        return {"valid": False, "message": "Invalid or expired reset token"}

    # Get user email (masked) for display
    result = await db.execute(
        select(User).where(User.id == reset_token.user_id)
    )
    user = result.scalar_one_or_none()

    # Mask email for privacy
    email = user.email if user else ""
    masked_email = ""
    if "@" in email:
        local, domain = email.split("@", 1)
        masked_local = local[0] + "*" * (len(local) - 2) + local[-1] if len(local) > 2 else local
        masked_email = f"{masked_local}@{domain}"

    return {
        "valid": True,
        "email": masked_email,
        "expires_at": reset_token.expires_at.isoformat()
    }
