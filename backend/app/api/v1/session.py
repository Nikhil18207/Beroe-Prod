"""
Session Endpoints
Manage analysis sessions.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import uuid
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.session import AnalysisSession, SessionStatus
from app.models.opportunity import Opportunity
from app.api.v1.dependencies import get_tenant_context, TenantContext
from app.schemas.session import (
    SessionCreate,
    SessionUpdate,
    SessionResponse,
)

router = APIRouter()


@router.get("", response_model=List[SessionResponse])
async def list_sessions(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
    status_filter: Optional[SessionStatus] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """
    List user's analysis sessions.
    """
    tenant.require_permission("analyses", "read")
    query = (
        select(AnalysisSession)
        .where(AnalysisSession.user_id == tenant.user_id)
        .order_by(AnalysisSession.created_at.desc())
        .offset(offset)
        .limit(limit)
    )

    if status_filter:
        query = query.where(AnalysisSession.status == status_filter)

    result = await db.execute(query)
    sessions = result.scalars().all()

    return [SessionResponse.from_model(s) for s in sessions]


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    session_data: SessionCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new analysis session.
    """
    tenant.require_permission("analyses", "create")
    # Calculate addressable spend
    addressable_spend = session_data.category_spend * session_data.addressable_spend_pct

    # Use user's goals if not provided
    goals = session_data.goals or tenant.user.goals or {"cost": 40, "risk": 35, "esg": 25}

    session = AnalysisSession(
        user_id=tenant.user_id,
        name=f"{session_data.category_name} Analysis",
        category_name=session_data.category_name,
        category_spend=session_data.category_spend,
        addressable_spend_pct=session_data.addressable_spend_pct,
        addressable_spend=addressable_spend,
        savings_benchmark_low=session_data.savings_benchmark_low,
        savings_benchmark_high=session_data.savings_benchmark_high,
        maturity_score=session_data.maturity_score,
        goals=goals,
        status=SessionStatus.CREATED,
    )

    db.add(session)
    await db.commit()
    await db.refresh(session)

    return SessionResponse.from_model(session)


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: uuid.UUID,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific session by ID.
    """
    tenant.require_permission("analyses", "read")
    result = await db.execute(
        select(AnalysisSession)
        .where(
            AnalysisSession.id == session_id,
            AnalysisSession.user_id == tenant.user_id
        )
        .options(selectinload(AnalysisSession.opportunities))
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    return SessionResponse.from_model(session)


@router.put("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: uuid.UUID,
    session_data: SessionUpdate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Update session parameters.
    """
    tenant.require_permission("analyses", "update")
    result = await db.execute(
        select(AnalysisSession)
        .where(
            AnalysisSession.id == session_id,
            AnalysisSession.user_id == tenant.user_id
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    # Update fields
    update_data = session_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(session, field, value)

    # Recalculate addressable spend if needed
    if session_data.category_spend or session_data.addressable_spend_pct:
        session.addressable_spend = session.category_spend * session.addressable_spend_pct

    session.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(session)

    return SessionResponse.from_model(session)


@router.delete("/{session_id}")
async def delete_session(
    session_id: uuid.UUID,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete an analysis session.
    """
    tenant.require_permission("analyses", "delete")
    result = await db.execute(
        select(AnalysisSession)
        .where(
            AnalysisSession.id == session_id,
            AnalysisSession.user_id == tenant.user_id
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    await db.delete(session)
    await db.commit()

    return {"status": "success", "deleted": True, "session_id": str(session_id)}


@router.post("/{session_id}/recalculate", response_model=SessionResponse)
async def recalculate_session(
    session_id: uuid.UUID,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Trigger recalculation of savings for a session.
    This will be implemented with the Dual Orchestrator.
    """
    tenant.require_permission("analyses", "update")
    result = await db.execute(
        select(AnalysisSession)
        .where(
            AnalysisSession.id == session_id,
            AnalysisSession.user_id == tenant.user_id
        )
        .options(selectinload(AnalysisSession.opportunities))
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    # TODO: Call Dual Orchestrator to recalculate
    # For now, just return the current session
    # This will be implemented in Phase 4

    session.add_log("System", "Recalculation triggered")
    await db.commit()
    await db.refresh(session)

    return SessionResponse.from_model(session)
