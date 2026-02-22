"""
Opportunities Endpoints
Manage procurement opportunities.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
import uuid
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.session import AnalysisSession
from app.models.opportunity import Opportunity, OpportunityStatus, ImpactBucket, LeverTheme, OpportunityProofPoint
from app.api.v1.dependencies import get_tenant_context, TenantContext
from app.schemas.opportunity import (
    OpportunityCreate,
    OpportunityUpdate,
    OpportunityResponse,
    OpportunityDetailResponse,
    OpportunityListResponse,
    LeverTheme as LeverThemeSchema,
)

router = APIRouter()


@router.get("/themes")
async def get_opportunity_themes():
    """
    Get available opportunity lever themes.
    Returns the 3 implemented themes for the demo.
    """
    themes = [
        {
            "value": "Volume Bundling",
            "name": "Volume Bundling",
            "description": "Consolidate spend across suppliers/regions to achieve volume discounts",
            "proof_points": 8,
            "benchmark_range": "2-5%"
        },
        {
            "value": "Target Pricing",
            "name": "Target Pricing",
            "description": "Use market data and cost models to negotiate better pricing",
            "proof_points": 4,
            "benchmark_range": "2-5%"
        },
        {
            "value": "Risk Management",
            "name": "Risk Management",
            "description": "Reduce supplier and supply chain risks",
            "proof_points": 7,
            "benchmark_range": "2-5%"
        }
    ]
    return {"themes": themes}


@router.get("", response_model=OpportunityListResponse)
async def list_opportunities(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
    session_id: Optional[uuid.UUID] = None,
    status_filter: Optional[OpportunityStatus] = None,
    impact_bucket: Optional[ImpactBucket] = None,
):
    """
    List opportunities for the user.
    Can filter by session, status, or impact bucket.
    """
    tenant.require_permission("analyses", "read")
    # Build query
    query = (
        select(Opportunity)
        .join(AnalysisSession)
        .where(AnalysisSession.user_id == tenant.user_id)
        .order_by(Opportunity.impact_score.desc())
    )

    if session_id:
        query = query.where(Opportunity.session_id == session_id)

    if status_filter:
        query = query.where(Opportunity.status == status_filter)

    if impact_bucket:
        query = query.where(Opportunity.impact_bucket == impact_bucket)

    result = await db.execute(query)
    opportunities = result.scalars().all()

    # Calculate counts
    qualified_count = sum(
        1 for o in opportunities
        if o.status in [OpportunityStatus.QUALIFIED, OpportunityStatus.ACCEPTED]
    )
    potential_count = sum(
        1 for o in opportunities
        if o.status == OpportunityStatus.POTENTIAL
    )

    # Calculate savings summary
    total_low = sum(o.savings_low for o in opportunities)
    total_high = sum(o.savings_high for o in opportunities)

    return OpportunityListResponse(
        opportunities=[OpportunityResponse.from_model(o) for o in opportunities],
        total=len(opportunities),
        qualified_count=qualified_count,
        potential_count=potential_count,
        savings_summary={"total_low": total_low, "total_high": total_high}
    )


@router.get("/{opportunity_id}", response_model=OpportunityDetailResponse)
async def get_opportunity(
    opportunity_id: uuid.UUID,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed opportunity information including proof points.
    """
    tenant.require_permission("analyses", "read")
    result = await db.execute(
        select(Opportunity)
        .join(AnalysisSession)
        .where(
            Opportunity.id == opportunity_id,
            AnalysisSession.user_id == tenant.user_id
        )
        .options(selectinload(Opportunity.proof_points))
    )
    opportunity = result.scalar_one_or_none()

    if not opportunity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found"
        )

    return OpportunityDetailResponse.from_model_with_details(opportunity)


@router.post("/{session_id}/add", response_model=OpportunityResponse, status_code=status.HTTP_201_CREATED)
async def add_opportunity(
    session_id: uuid.UUID,
    opportunity_data: OpportunityCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Manually add an opportunity to a session.
    """
    tenant.require_permission("analyses", "create")
    # Verify session belongs to user
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

    # Map schema enum to model enum
    lever_theme_map = {
        LeverThemeSchema.VOLUME_BUNDLING: LeverTheme.VOLUME_BUNDLING,
        LeverThemeSchema.TARGET_PRICING: LeverTheme.TARGET_PRICING,
        LeverThemeSchema.RISK_MANAGEMENT: LeverTheme.RISK_MANAGEMENT,
        LeverThemeSchema.RESPEC_PACK: LeverTheme.RESPEC_PACK,
    }

    opportunity = Opportunity(
        session_id=session_id,
        name=opportunity_data.name,
        lever_theme=lever_theme_map.get(opportunity_data.lever_theme, LeverTheme.VOLUME_BUNDLING),
        description=opportunity_data.description,
        maturity_score=opportunity_data.maturity_score,
        savings_benchmark_low=opportunity_data.savings_benchmark_low,
        savings_benchmark_high=opportunity_data.savings_benchmark_high,
        status=OpportunityStatus.POTENTIAL,
        impact_bucket=ImpactBucket.LOW,
    )

    db.add(opportunity)
    await db.commit()
    await db.refresh(opportunity)

    # Log to session
    session.add_log("User", f"Added opportunity: {opportunity.name}")
    await db.commit()

    return OpportunityResponse.from_model(opportunity)


@router.put("/{opportunity_id}", response_model=OpportunityResponse)
async def update_opportunity(
    opportunity_id: uuid.UUID,
    opportunity_data: OpportunityUpdate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Update an opportunity.
    """
    tenant.require_permission("analyses", "update")
    result = await db.execute(
        select(Opportunity)
        .join(AnalysisSession)
        .where(
            Opportunity.id == opportunity_id,
            AnalysisSession.user_id == tenant.user_id
        )
    )
    opportunity = result.scalar_one_or_none()

    if not opportunity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found"
        )

    # Update fields
    update_data = opportunity_data.model_dump(exclude_unset=True)

    # Handle status enum conversion
    if "status" in update_data and update_data["status"]:
        update_data["status"] = OpportunityStatus(update_data["status"])

    for field, value in update_data.items():
        setattr(opportunity, field, value)

    opportunity.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(opportunity)

    return OpportunityResponse.from_model(opportunity)


@router.post("/{opportunity_id}/accept", response_model=OpportunityResponse)
async def accept_opportunity(
    opportunity_id: uuid.UUID,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Accept an opportunity (move to accepted status).
    """
    tenant.require_permission("analyses", "update")
    result = await db.execute(
        select(Opportunity)
        .join(AnalysisSession)
        .where(
            Opportunity.id == opportunity_id,
            AnalysisSession.user_id == tenant.user_id
        )
    )
    opportunity = result.scalar_one_or_none()

    if not opportunity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found"
        )

    opportunity.status = OpportunityStatus.ACCEPTED
    opportunity.accepted_at = datetime.utcnow()
    opportunity.is_new = False
    opportunity.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(opportunity)

    return OpportunityResponse.from_model(opportunity)


@router.post("/{opportunity_id}/reject", response_model=OpportunityResponse)
async def reject_opportunity(
    opportunity_id: uuid.UUID,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Reject an opportunity.
    """
    tenant.require_permission("analyses", "update")
    result = await db.execute(
        select(Opportunity)
        .join(AnalysisSession)
        .where(
            Opportunity.id == opportunity_id,
            AnalysisSession.user_id == tenant.user_id
        )
    )
    opportunity = result.scalar_one_or_none()

    if not opportunity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found"
        )

    opportunity.status = OpportunityStatus.REJECTED
    opportunity.is_new = False
    opportunity.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(opportunity)

    return OpportunityResponse.from_model(opportunity)


@router.post("/{opportunity_id}/validate-proof-point")
async def validate_proof_point(
    opportunity_id: uuid.UUID,
    proof_point_id: uuid.UUID,
    is_validated: bool = True,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Validate or invalidate a proof point for an opportunity.
    """
    tenant.require_permission("analyses", "update")
    # Verify opportunity belongs to user
    result = await db.execute(
        select(Opportunity)
        .join(AnalysisSession)
        .where(
            Opportunity.id == opportunity_id,
            AnalysisSession.user_id == tenant.user_id
        )
        .options(selectinload(Opportunity.proof_points))
    )
    opportunity = result.scalar_one_or_none()

    if not opportunity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found"
        )

    # Find the proof point
    proof_point = None
    for pp in opportunity.proof_points:
        if pp.id == proof_point_id:
            proof_point = pp
            break

    if not proof_point:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proof point not found"
        )

    # Update validation
    proof_point.is_validated = is_validated
    proof_point.validated_at = datetime.utcnow() if is_validated else None

    # Update opportunity flag counts
    opportunity.update_flag_counts()

    # Check if opportunity should be qualified (>2 validated proof points)
    if opportunity.num_validated_proof_points > 2:
        opportunity.status = OpportunityStatus.QUALIFIED

    await db.commit()

    return {
        "status": "success",
        "proof_point_id": str(proof_point_id),
        "is_validated": is_validated,
        "opportunity_status": opportunity.status.value,
        "validated_count": opportunity.num_validated_proof_points
    }
