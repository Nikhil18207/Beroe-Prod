"""
Master Orchestrator

The Master Orchestrator is the top-level request handler in the Dual Orchestrator system.
It coordinates:
1. Spend data processing and validation
2. Opportunity Orchestrator for analysis
3. Brief generation (future: Brief Orchestrator with LLM)
4. Response formatting for API consumption

HYBRID ARCHITECTURE INTEGRATION:
- Accepts optional CacheService for pre-computed metrics (fast path)
- Falls back to real-time computation if no cache (slow path)
- Session ID enables cache lookups across all agents

Architecture:
                    Master Orchestrator
                    /                  \
        Opportunity Orchestrator    Brief Orchestrator (Phase 5)
        /       |        \                    |
    Volume   Target    Risk              LLM Summary
    Bundling Pricing   Mgmt              Generation
    
    (All agents use CacheService for instant metric access)
"""

from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID
import pandas as pd
import numpy as np
import io
import json

from app.agents.opportunity_orchestrator import (
    OpportunityOrchestrator,
    OrchestrationResult,
    RankedOpportunity,
    SavingsCalculation,
)
from app.agents.proof_points import OpportunityType, ImpactFlag

# Type alias to avoid circular import
CacheServiceType = Any


@dataclass
class AnalysisRequest:
    """Request for procurement analysis."""
    session_id: str
    portfolio_id: str
    category_name: str
    spend_data: pd.DataFrame
    total_spend: float
    context: Dict[str, Any] = field(default_factory=dict)
    requested_opportunities: Optional[List[OpportunityType]] = None


@dataclass
class CategoryAnalysis:
    """Analysis results for a single category."""
    category_name: str
    total_spend: float
    total_potential_savings: float
    savings_percentage: float
    risk_score: float
    opportunities: List[Dict[str, Any]]
    proof_points: Dict[str, Any]
    key_insights: List[str]
    recommendations: List[str]
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PortfolioAnalysis:
    """Analysis results for an entire portfolio."""
    portfolio_id: str
    session_id: str
    total_spend: float
    total_potential_savings: float
    savings_percentage: float
    overall_risk_score: float
    categories: List[CategoryAnalysis]
    summary: Dict[str, Any]
    generated_at: str
    metadata: Dict[str, Any] = field(default_factory=dict)


class MasterOrchestrator:
    """
    Top-level orchestrator for the Beroe AI Procurement Platform.

    Coordinates the entire analysis workflow:
    1. Data validation and preprocessing
    2. Category-level analysis via Opportunity Orchestrator
    3. Portfolio-level aggregation
    4. Response formatting
    
    HYBRID ARCHITECTURE:
    - Set cache_service via set_cache() for instant metric access
    - All child agents inherit cache settings
    """

    def __init__(self, cache_service: Optional[CacheServiceType] = None):
        """
        Initialize the Master Orchestrator.
        
        Args:
            cache_service: Optional CacheService for fast metric access.
                          Pass this if using the hybrid caching architecture.
        """
        self.opportunity_orchestrator = OpportunityOrchestrator(cache_service)
        self._cache_service = cache_service
        self._session_id: Optional[UUID] = None
    
    def set_cache(self, cache_service: CacheServiceType, session_id: UUID) -> None:
        """
        Set cache service for fast metric access (Hybrid Architecture).
        
        Call this before analyze_category() or analyze_portfolio() for
        instant metric lookups instead of real-time computation.
        
        Args:
            cache_service: CacheService instance
            session_id: Session ID for cache lookups
        """
        self._cache_service = cache_service
        self._session_id = session_id
        self.opportunity_orchestrator.set_cache(cache_service, session_id)

    async def analyze_category(
        self,
        spend_data: pd.DataFrame,
        category_name: str,
        category_spend: float,
        context_data: Optional[Dict[str, Any]] = None,
        session_id: Optional[UUID] = None
    ) -> CategoryAnalysis:
        """
        Analyze a single category.

        Args:
            spend_data: DataFrame with spend records for the category
            category_name: Name of the category
            category_spend: Total spend for the category
            context_data: Additional context (market data, user preferences, etc.)
            session_id: Session ID for cache lookups (Hybrid Architecture)

        Returns:
            CategoryAnalysis with opportunities, savings, and recommendations
        """
        # Use provided session_id or the one set via set_cache()
        effective_session_id = session_id or self._session_id
        
        # Run opportunity orchestrator
        result = await self.opportunity_orchestrator.analyze(
            spend_data=spend_data,
            category_name=category_name,
            category_spend=category_spend,
            context_data=context_data,
            session_id=effective_session_id
        )

        # Convert to CategoryAnalysis format
        opportunities = [
            self._ranked_opportunity_to_dict(opp)
            for opp in result.ranked_opportunities
        ]

        # Extract key insights across all opportunities
        key_insights = []
        for opp in result.ranked_opportunities:
            key_insights.extend(opp.key_insights[:2])  # Top 2 from each
        key_insights = key_insights[:10]  # Limit to 10

        # Extract recommendations across all opportunities
        recommendations = []
        for opp in result.ranked_opportunities:
            recommendations.extend(opp.recommended_actions[:2])  # Top 2 from each
        recommendations = recommendations[:8]  # Limit to 8

        return CategoryAnalysis(
            category_name=category_name,
            total_spend=category_spend,
            total_potential_savings=result.total_potential_savings,
            savings_percentage=result.savings_percentage,
            risk_score=result.risk_score,
            opportunities=opportunities,
            proof_points=result.proof_point_summary,
            key_insights=key_insights,
            recommendations=recommendations,
            metadata=result.metadata
        )

    async def analyze_portfolio(
        self,
        portfolio_data: Dict[str, pd.DataFrame],
        portfolio_id: str,
        session_id: Union[str, UUID],
        context_data: Optional[Dict[str, Any]] = None
    ) -> PortfolioAnalysis:
        """
        Analyze an entire portfolio (multiple categories).

        Args:
            portfolio_data: Dict mapping category names to their spend DataFrames
            portfolio_id: ID of the portfolio
            session_id: ID of the analysis session (for cache lookups)
            context_data: Additional context

        Returns:
            PortfolioAnalysis with all categories and aggregated results
        """
        # Convert session_id to UUID for cache lookups
        effective_session_id = UUID(session_id) if isinstance(session_id, str) else session_id
        
        categories: List[CategoryAnalysis] = []
        total_spend = 0
        total_savings = 0
        risk_scores = []

        for category_name, spend_df in portfolio_data.items():
            # Calculate category spend
            spend_col = self._find_spend_column(spend_df)
            if spend_col:
                category_spend = spend_df[spend_col].sum()
            else:
                category_spend = len(spend_df) * 1000  # Estimate if no spend column

            total_spend += category_spend

            # Analyze category with session_id for cache (Hybrid Architecture)
            category_analysis = await self.analyze_category(
                spend_data=spend_df,
                category_name=category_name,
                category_spend=category_spend,
                context_data=context_data,
                session_id=effective_session_id
            )

            categories.append(category_analysis)
            total_savings += category_analysis.total_potential_savings
            risk_scores.append(category_analysis.risk_score)

        # Calculate portfolio-level metrics
        savings_percentage = (total_savings / total_spend * 100) if total_spend > 0 else 0
        overall_risk_score = np.mean(risk_scores) if risk_scores else 50.0

        # Generate portfolio summary
        summary = self._generate_portfolio_summary(
            categories=categories,
            total_spend=total_spend,
            total_savings=total_savings
        )

        return PortfolioAnalysis(
            portfolio_id=portfolio_id,
            session_id=session_id,
            total_spend=total_spend,
            total_potential_savings=total_savings,
            savings_percentage=savings_percentage,
            overall_risk_score=overall_risk_score,
            categories=categories,
            summary=summary,
            generated_at=datetime.utcnow().isoformat(),
            metadata={
                "categories_analyzed": len(categories),
                "analysis_version": "1.0.0"
            }
        )

    async def analyze_from_file(
        self,
        file_content: bytes,
        file_name: str,
        session_id: str,
        portfolio_id: str,
        context_data: Optional[Dict[str, Any]] = None
    ) -> PortfolioAnalysis:
        """
        Analyze spend data from an uploaded file.

        Args:
            file_content: Raw file bytes
            file_name: Name of the uploaded file
            session_id: Session ID
            portfolio_id: Portfolio ID
            context_data: Additional context

        Returns:
            PortfolioAnalysis with results
        """
        # Parse file into DataFrame
        df = self._parse_file(file_content, file_name)

        # Detect and group by category
        portfolio_data = self._group_by_category(df)

        # Run analysis
        return await self.analyze_portfolio(
            portfolio_data=portfolio_data,
            portfolio_id=portfolio_id,
            session_id=session_id,
            context_data=context_data
        )

    def _parse_file(self, file_content: bytes, file_name: str) -> pd.DataFrame:
        """Parse uploaded file into DataFrame."""
        file_lower = file_name.lower()

        try:
            if file_lower.endswith('.csv'):
                return pd.read_csv(io.BytesIO(file_content))
            elif file_lower.endswith(('.xlsx', '.xls')):
                return pd.read_excel(io.BytesIO(file_content))
            elif file_lower.endswith('.json'):
                data = json.loads(file_content.decode('utf-8'))
                return pd.DataFrame(data)
            else:
                # Try CSV as default
                return pd.read_csv(io.BytesIO(file_content))
        except Exception as e:
            raise ValueError(f"Failed to parse file {file_name}: {str(e)}")

    def _group_by_category(self, df: pd.DataFrame) -> Dict[str, pd.DataFrame]:
        """Group spend data by category."""
        # Find category column
        category_col = None
        for col in df.columns:
            col_lower = col.lower()
            if any(term in col_lower for term in ['category', 'segment', 'commodity', 'type']):
                category_col = col
                break

        if category_col:
            # Group by category
            return {
                str(cat): group_df
                for cat, group_df in df.groupby(category_col)
            }
        else:
            # No category column - treat entire file as single category
            return {"All Spend": df}

    def _find_spend_column(self, df: pd.DataFrame) -> Optional[str]:
        """Find the spend/amount column in a DataFrame."""
        for col in df.columns:
            col_lower = col.lower()
            if any(term in col_lower for term in ['spend', 'amount', 'value', 'total', 'cost', 'price']):
                if df[col].dtype in ['int64', 'float64'] or pd.to_numeric(df[col], errors='coerce').notna().any():
                    return col
        return None

    def _ranked_opportunity_to_dict(self, opp: RankedOpportunity) -> Dict[str, Any]:
        """Convert RankedOpportunity to dictionary for API response."""
        return {
            "rank": opp.rank,
            "type": opp.opportunity_type.value,
            "name": opp.opportunity_name,
            "description": opp.description,
            "overall_score": round(opp.overall_score, 2),
            "impact_level": opp.impact_level,
            "savings": {
                "addressable_spend": round(opp.savings.addressable_spend, 2),
                "savings_percentage": round(opp.savings.savings_percentage, 2),
                "estimated_savings": round(opp.savings.estimated_savings, 2),
                "confidence_level": opp.savings.confidence_level,
                "calculation_basis": opp.savings.calculation_basis
            },
            "proof_points": [
                {
                    "code": pp.proof_point_code,
                    "name": pp.proof_point_name,
                    "impact": pp.impact_flag.value,
                    "score": round(pp.test_score, 2),
                    "insight": pp.insight,
                    "tested": pp.is_tested,
                    "data": pp.raw_data
                }
                for pp in opp.proof_point_results
            ],
            "key_insights": opp.key_insights,
            "recommended_actions": opp.recommended_actions
        }

    def _generate_portfolio_summary(
        self,
        categories: List[CategoryAnalysis],
        total_spend: float,
        total_savings: float
    ) -> Dict[str, Any]:
        """Generate portfolio-level summary."""

        # Find top opportunities across all categories
        all_opportunities = []
        for cat in categories:
            for opp in cat.opportunities:
                all_opportunities.append({
                    "category": cat.category_name,
                    **opp
                })

        # Sort by savings potential
        all_opportunities.sort(key=lambda x: x["savings"]["estimated_savings"], reverse=True)

        # Get top 5 opportunities
        top_opportunities = all_opportunities[:5]

        # Aggregate by opportunity type
        savings_by_type = {}
        for opp in all_opportunities:
            opp_type = opp["type"]
            if opp_type not in savings_by_type:
                savings_by_type[opp_type] = 0
            savings_by_type[opp_type] += opp["savings"]["estimated_savings"]

        # Find highest risk categories
        risk_categories = sorted(
            [(cat.category_name, cat.risk_score) for cat in categories],
            key=lambda x: x[1],
            reverse=True
        )[:3]

        return {
            "top_opportunities": top_opportunities,
            "savings_by_opportunity_type": savings_by_type,
            "high_risk_categories": [
                {"category": name, "risk_score": round(score, 1)}
                for name, score in risk_categories
            ],
            "categories_by_savings": [
                {
                    "category": cat.category_name,
                    "spend": round(cat.total_spend, 2),
                    "savings": round(cat.total_potential_savings, 2),
                    "savings_pct": round(cat.savings_percentage, 2)
                }
                for cat in sorted(categories, key=lambda x: x.total_potential_savings, reverse=True)
            ][:5],
            "executive_summary": self._generate_executive_summary(
                categories=categories,
                total_spend=total_spend,
                total_savings=total_savings
            )
        }

    def _generate_executive_summary(
        self,
        categories: List[CategoryAnalysis],
        total_spend: float,
        total_savings: float
    ) -> str:
        """Generate executive summary text."""
        savings_pct = (total_savings / total_spend * 100) if total_spend > 0 else 0

        # Find most impactful opportunity type
        type_savings = {}
        for cat in categories:
            for opp in cat.opportunities:
                opp_type = opp["name"]
                if opp_type not in type_savings:
                    type_savings[opp_type] = 0
                type_savings[opp_type] += opp["savings"]["estimated_savings"]

        top_opportunity = max(type_savings.items(), key=lambda x: x[1]) if type_savings else ("N/A", 0)

        # Find high risk categories
        high_risk_count = sum(1 for cat in categories if cat.risk_score >= 60)

        summary = f"Analysis of {len(categories)} categories with ${total_spend:,.0f} total spend "
        summary += f"identified ${total_savings:,.0f} ({savings_pct:.1f}%) in potential savings. "
        summary += f"{top_opportunity[0]} represents the largest opportunity at ${top_opportunity[1]:,.0f}. "

        if high_risk_count > 0:
            summary += f"{high_risk_count} categories flagged for elevated supply chain risk requiring attention."
        else:
            summary += "Overall supply chain risk profile is manageable."

        return summary


# Convenience function for direct use
async def analyze_spend_data(
    spend_data: Union[pd.DataFrame, bytes],
    category_name: Optional[str] = None,
    file_name: Optional[str] = None,
    session_id: str = "demo",
    portfolio_id: str = "demo",
    context_data: Optional[Dict[str, Any]] = None
) -> Union[CategoryAnalysis, PortfolioAnalysis]:
    """
    Convenience function to analyze spend data.

    Args:
        spend_data: Either a DataFrame or file bytes
        category_name: Category name (if DataFrame is single category)
        file_name: File name (if bytes provided)
        session_id: Session ID
        portfolio_id: Portfolio ID
        context_data: Additional context

    Returns:
        CategoryAnalysis for single category or PortfolioAnalysis for multiple
    """
    orchestrator = MasterOrchestrator()

    if isinstance(spend_data, bytes):
        if not file_name:
            file_name = "data.csv"
        return await orchestrator.analyze_from_file(
            file_content=spend_data,
            file_name=file_name,
            session_id=session_id,
            portfolio_id=portfolio_id,
            context_data=context_data
        )
    elif isinstance(spend_data, pd.DataFrame):
        if not category_name:
            category_name = "Analysis"
        spend_col = orchestrator._find_spend_column(spend_data)
        category_spend = spend_data[spend_col].sum() if spend_col else len(spend_data) * 1000

        return await orchestrator.analyze_category(
            spend_data=spend_data,
            category_name=category_name,
            category_spend=category_spend,
            context_data=context_data
        )
    else:
        raise ValueError("spend_data must be a DataFrame or bytes")
