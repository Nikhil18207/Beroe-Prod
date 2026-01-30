"""
Analysis Endpoints
Run procurement opportunity analysis using the Dual Orchestrator system.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
import uuid
from datetime import datetime
import pandas as pd
import io
import json

from app.database import get_db
from app.models.user import User
from app.models.session import AnalysisSession, SessionStatus
from app.models.portfolio import PortfolioCategory
from app.models.opportunity import Opportunity, OpportunityStatus, ImpactBucket, LeverTheme, OpportunityProofPoint
from app.models.spend_data import SpendData
from app.api.v1.auth import get_current_user
from app.agents.master_orchestrator import MasterOrchestrator, CategoryAnalysis, PortfolioAnalysis
from app.agents.proof_points import OpportunityType, ImpactFlag

router = APIRouter()

# Initialize master orchestrator
master_orchestrator = MasterOrchestrator()


# Request/Response Models
class AnalysisRequest(BaseModel):
    """Request to run analysis on a session."""
    session_id: uuid.UUID
    analyze_all_categories: bool = True
    category_names: Optional[List[str]] = None
    context: Optional[Dict[str, Any]] = None


class CategoryAnalysisResponse(BaseModel):
    """Response for a single category analysis."""
    category_name: str
    total_spend: float
    total_potential_savings: float
    savings_percentage: float
    risk_score: float
    opportunities: List[Dict[str, Any]]
    proof_points: Dict[str, Any]
    key_insights: List[str]
    recommendations: List[str]


class PortfolioAnalysisResponse(BaseModel):
    """Response for full portfolio analysis."""
    portfolio_id: str
    session_id: str
    total_spend: float
    total_potential_savings: float
    savings_percentage: float
    overall_risk_score: float
    categories: List[CategoryAnalysisResponse]
    summary: Dict[str, Any]
    generated_at: str


class QuickAnalysisRequest(BaseModel):
    """Request for quick analysis without session."""
    data: List[Dict[str, Any]] = Field(..., description="Spend data as list of records")
    category_name: Optional[str] = "Analysis"
    context: Optional[Dict[str, Any]] = None


@router.post("/run", response_model=PortfolioAnalysisResponse)
async def run_analysis(
    request: AnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Run full opportunity analysis on a session's spend data.

    This endpoint:
    1. Retrieves spend data from the session
    2. Groups by category
    3. Runs the Dual Orchestrator analysis
    4. Stores results as opportunities in the database
    5. Returns the full analysis
    """
    # Get session
    result = await db.execute(
        select(AnalysisSession)
        .where(
            AnalysisSession.id == request.session_id,
            AnalysisSession.user_id == current_user.id
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    # Get spend data for session
    spend_result = await db.execute(
        select(SpendData)
        .where(SpendData.session_id == request.session_id)
    )
    spend_records = spend_result.scalars().all()

    if not spend_records:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No spend data found for session. Please upload spend data first."
        )

    # Convert to DataFrame
    spend_df = pd.DataFrame([
        {
            "supplier": r.supplier_name,
            "category": r.category,
            "spend": float(r.spend_amount) if r.spend_amount else 0,
            "price": float(r.unit_price) if r.unit_price else None,
            "volume": float(r.quantity) if r.quantity else None,
            "region": r.region,
            "country": r.country,
            "currency": r.currency,
            "item": r.description,
        }
        for r in spend_records
    ])

    # Group by category
    portfolio_data = {}
    if request.analyze_all_categories:
        for category, group_df in spend_df.groupby("category"):
            portfolio_data[str(category)] = group_df
    else:
        # Only analyze specified categories
        for cat_name in (request.category_names or []):
            cat_df = spend_df[spend_df["category"] == cat_name]
            if len(cat_df) > 0:
                portfolio_data[cat_name] = cat_df

    if not portfolio_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No categories found to analyze"
        )

    # Update session status
    session.status = SessionStatus.ANALYZING
    session.add_log("System", "Starting opportunity analysis")
    await db.commit()

    try:
        # Run analysis
        analysis_result = await master_orchestrator.analyze_portfolio(
            portfolio_data=portfolio_data,
            portfolio_id=str(session.portfolio_id) if session.portfolio_id else "demo",
            session_id=str(session.id),
            context_data=request.context
        )

        # Store opportunities in database
        await _store_opportunities(db, session, analysis_result)

        # Update session status
        session.status = SessionStatus.COMPLETED
        session.add_log("System", f"Analysis complete. Found {len(analysis_result.categories)} categories with ${analysis_result.total_potential_savings:,.0f} potential savings")
        await db.commit()

        # Convert to response
        return _analysis_to_response(analysis_result)

    except Exception as e:
        session.status = SessionStatus.ERROR
        session.add_log("System", f"Analysis failed: {str(e)}")
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}"
        )


@router.post("/quick", response_model=CategoryAnalysisResponse)
async def quick_analysis(
    request: QuickAnalysisRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Run quick analysis on provided data without creating a session.
    Useful for testing and preview purposes.
    """
    try:
        # Convert to DataFrame
        df = pd.DataFrame(request.data)

        # Find spend column
        spend_col = None
        for col in df.columns:
            if any(term in col.lower() for term in ['spend', 'amount', 'value', 'total', 'cost']):
                spend_col = col
                break

        category_spend = df[spend_col].sum() if spend_col else len(df) * 1000

        # Run analysis
        result = await master_orchestrator.analyze_category(
            spend_data=df,
            category_name=request.category_name or "Analysis",
            category_spend=category_spend,
            context_data=request.context
        )

        return CategoryAnalysisResponse(
            category_name=result.category_name,
            total_spend=result.total_spend,
            total_potential_savings=result.total_potential_savings,
            savings_percentage=result.savings_percentage,
            risk_score=result.risk_score,
            opportunities=result.opportunities,
            proof_points=result.proof_points,
            key_insights=result.key_insights,
            recommendations=result.recommendations
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}"
        )


@router.post("/upload-and-analyze", response_model=PortfolioAnalysisResponse)
async def upload_and_analyze(
    file: UploadFile = File(...),
    session_id: uuid.UUID = Form(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload spend data file and immediately run analysis.
    Combines file upload and analysis in one step.
    """
    # Verify session
    result = await db.execute(
        select(AnalysisSession)
        .where(
            AnalysisSession.id == session_id,
            AnalysisSession.user_id == current_user.id
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    # Read file content
    file_content = await file.read()

    try:
        # Run analysis directly from file
        analysis_result = await master_orchestrator.analyze_from_file(
            file_content=file_content,
            file_name=file.filename,
            session_id=str(session_id),
            portfolio_id=str(session.portfolio_id) if session.portfolio_id else "demo"
        )

        # Store opportunities
        await _store_opportunities(db, session, analysis_result)

        # Update session
        session.status = SessionStatus.COMPLETED
        session.add_log("System", f"Analysis complete from uploaded file: {file.filename}")
        await db.commit()

        return _analysis_to_response(analysis_result)

    except Exception as e:
        session.status = SessionStatus.ERROR
        session.add_log("System", f"Upload and analysis failed: {str(e)}")
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}"
        )


@router.get("/results/{session_id}", response_model=PortfolioAnalysisResponse)
async def get_analysis_results(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get previously run analysis results for a session.
    Reconstructs the analysis response from stored opportunities.
    """
    # Verify session access
    result = await db.execute(
        select(AnalysisSession)
        .where(
            AnalysisSession.id == session_id,
            AnalysisSession.user_id == current_user.id
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    # Get opportunities for session
    opp_result = await db.execute(
        select(Opportunity)
        .where(Opportunity.session_id == session_id)
        .order_by(Opportunity.impact_score.desc())
    )
    opportunities = opp_result.scalars().all()

    if not opportunities:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No analysis results found for session"
        )

    # Reconstruct response from stored opportunities
    return await _reconstruct_analysis_response(session, opportunities, db)


@router.post("/demo")
async def run_demo_analysis():
    """
    Run analysis on demo/sample data.
    No authentication required - for testing purposes.
    """
    # Sample spend data for demo
    demo_data = [
        {"supplier": "Acme Corp", "category": "Packaging", "spend": 500000, "price": 2.50, "volume": 200000, "region": "North America", "country": "USA"},
        {"supplier": "Global Pack", "category": "Packaging", "spend": 350000, "price": 2.75, "volume": 127273, "region": "North America", "country": "USA"},
        {"supplier": "EuroPack Ltd", "category": "Packaging", "spend": 280000, "price": 2.80, "volume": 100000, "region": "Europe", "country": "Germany"},
        {"supplier": "Asia Materials", "category": "Packaging", "spend": 420000, "price": 2.10, "volume": 200000, "region": "Asia", "country": "China"},
        {"supplier": "Local Supplier", "category": "Packaging", "spend": 180000, "price": 3.00, "volume": 60000, "region": "North America", "country": "Mexico"},
        {"supplier": "Steel Inc", "category": "Raw Materials", "spend": 1200000, "price": 850, "volume": 1412, "region": "North America", "country": "USA"},
        {"supplier": "Metal Works", "category": "Raw Materials", "spend": 800000, "price": 920, "volume": 870, "region": "Europe", "country": "Germany"},
        {"supplier": "China Steel", "category": "Raw Materials", "spend": 650000, "price": 650, "volume": 1000, "region": "Asia", "country": "China"},
        {"supplier": "IT Solutions", "category": "Services", "spend": 250000, "price": None, "volume": None, "region": "North America", "country": "USA"},
        {"supplier": "Consulting Co", "category": "Services", "spend": 180000, "price": None, "volume": None, "region": "North America", "country": "USA"},
    ]

    df = pd.DataFrame(demo_data)

    # Group by category
    portfolio_data = {
        cat: group_df for cat, group_df in df.groupby("category")
    }

    # Run analysis
    result = await master_orchestrator.analyze_portfolio(
        portfolio_data=portfolio_data,
        portfolio_id="demo",
        session_id="demo"
    )

    return _analysis_to_response(result)


# Helper functions

async def _store_opportunities(
    db: AsyncSession,
    session: AnalysisSession,
    analysis: PortfolioAnalysis
):
    """Store analysis results as opportunities in database."""

    # Map opportunity types to lever themes
    type_to_theme = {
        "volume_bundling": LeverTheme.VOLUME_BUNDLING,
        "target_pricing": LeverTheme.TARGET_PRICING,
        "risk_management": LeverTheme.RISK_MANAGEMENT,
        "respec_pack": LeverTheme.RESPEC_PACK,
    }

    # Map impact levels to buckets
    impact_to_bucket = {
        "HIGH": ImpactBucket.HIGH,
        "MEDIUM": ImpactBucket.MEDIUM,
        "LOW": ImpactBucket.LOW,
    }

    for category in analysis.categories:
        for opp_data in category.opportunities:
            # Create opportunity
            opportunity = Opportunity(
                session_id=session.id,
                name=f"{opp_data['name']} - {category.category_name}",
                lever_theme=type_to_theme.get(opp_data["type"], LeverTheme.VOLUME_BUNDLING),
                description=opp_data["description"],
                maturity_score=int(opp_data["overall_score"] * 100),
                savings_benchmark_low=opp_data["savings"]["savings_percentage"] * 0.8,
                savings_benchmark_high=opp_data["savings"]["savings_percentage"] * 1.2,
                status=OpportunityStatus.POTENTIAL,
                impact_bucket=impact_to_bucket.get(opp_data["impact_level"], ImpactBucket.LOW),
                impact_score=opp_data["overall_score"],
                savings_low=opp_data["savings"]["estimated_savings"] * 0.8,
                savings_high=opp_data["savings"]["estimated_savings"] * 1.2,
                category_name=category.category_name,
                addressable_spend=opp_data["savings"]["addressable_spend"],
            )

            db.add(opportunity)
            await db.flush()  # Get opportunity ID

            # Add proof points
            for pp_data in opp_data.get("proof_points", []):
                # Map impact flag
                impact_map = {
                    "high": "green",
                    "medium": "yellow",
                    "low": "red",
                    "not_tested": "not_tested",
                }

                proof_point = OpportunityProofPoint(
                    opportunity_id=opportunity.id,
                    proof_point_code=pp_data["code"],
                    name=pp_data["name"],
                    description=pp_data["insight"],
                    flag_color=impact_map.get(pp_data["impact"], "not_tested"),
                    test_score=pp_data["score"],
                    is_tested=pp_data["tested"],
                    raw_data=pp_data.get("data", {})
                )
                db.add(proof_point)

    await db.commit()


def _analysis_to_response(analysis: PortfolioAnalysis) -> PortfolioAnalysisResponse:
    """Convert PortfolioAnalysis to API response."""
    categories = [
        CategoryAnalysisResponse(
            category_name=cat.category_name,
            total_spend=cat.total_spend,
            total_potential_savings=cat.total_potential_savings,
            savings_percentage=cat.savings_percentage,
            risk_score=cat.risk_score,
            opportunities=cat.opportunities,
            proof_points=cat.proof_points,
            key_insights=cat.key_insights,
            recommendations=cat.recommendations
        )
        for cat in analysis.categories
    ]

    return PortfolioAnalysisResponse(
        portfolio_id=analysis.portfolio_id,
        session_id=analysis.session_id,
        total_spend=analysis.total_spend,
        total_potential_savings=analysis.total_potential_savings,
        savings_percentage=analysis.savings_percentage,
        overall_risk_score=analysis.overall_risk_score,
        categories=categories,
        summary=analysis.summary,
        generated_at=analysis.generated_at
    )


async def _reconstruct_analysis_response(
    session: AnalysisSession,
    opportunities: List[Opportunity],
    db: AsyncSession
) -> PortfolioAnalysisResponse:
    """Reconstruct analysis response from stored opportunities."""

    # Group opportunities by category
    categories_dict: Dict[str, List[Opportunity]] = {}
    for opp in opportunities:
        cat_name = opp.category_name or "Unknown"
        if cat_name not in categories_dict:
            categories_dict[cat_name] = []
        categories_dict[cat_name].append(opp)

    # Build category responses
    categories = []
    total_spend = 0
    total_savings = 0
    risk_scores = []

    for cat_name, cat_opps in categories_dict.items():
        cat_spend = sum(opp.addressable_spend or 0 for opp in cat_opps) / 0.75  # Estimate total from addressable
        cat_savings = sum((opp.savings_low + opp.savings_high) / 2 for opp in cat_opps)

        # Find risk score from risk management opportunity
        risk_opp = next((o for o in cat_opps if o.lever_theme == LeverTheme.RISK_MANAGEMENT), None)
        risk_score = risk_opp.impact_score * 100 if risk_opp else 50

        total_spend += cat_spend
        total_savings += cat_savings
        risk_scores.append(risk_score)

        categories.append(CategoryAnalysisResponse(
            category_name=cat_name,
            total_spend=cat_spend,
            total_potential_savings=cat_savings,
            savings_percentage=(cat_savings / cat_spend * 100) if cat_spend > 0 else 0,
            risk_score=risk_score,
            opportunities=[
                {
                    "rank": i + 1,
                    "type": opp.lever_theme.value,
                    "name": opp.lever_theme.value.replace("_", " ").title(),
                    "description": opp.description,
                    "overall_score": opp.impact_score,
                    "impact_level": opp.impact_bucket.value.upper(),
                    "savings": {
                        "addressable_spend": opp.addressable_spend or 0,
                        "savings_percentage": opp.savings_benchmark_high,
                        "estimated_savings": (opp.savings_low + opp.savings_high) / 2,
                        "confidence_level": "medium",
                        "calculation_basis": "Reconstructed from stored data"
                    },
                    "key_insights": [],
                    "recommended_actions": []
                }
                for i, opp in enumerate(sorted(cat_opps, key=lambda x: x.impact_score, reverse=True))
            ],
            proof_points={},
            key_insights=[],
            recommendations=[]
        ))

    return PortfolioAnalysisResponse(
        portfolio_id=str(session.portfolio_id) if session.portfolio_id else "unknown",
        session_id=str(session.id),
        total_spend=total_spend,
        total_potential_savings=total_savings,
        savings_percentage=(total_savings / total_spend * 100) if total_spend > 0 else 0,
        overall_risk_score=sum(risk_scores) / len(risk_scores) if risk_scores else 50,
        categories=categories,
        summary={},
        generated_at=datetime.utcnow().isoformat()
    )
