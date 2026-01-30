"""
API Routes for Recommendation System
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from loguru import logger

from backend.engines.data_loader import DataLoader

recommendation_router = APIRouter()

# Initialize data loader for API access
data_loader = DataLoader()


class RecommendationRequest(BaseModel):
    """Request model for procurement recommendation"""
    query: str
    client_id: Optional[str] = None
    product_category: Optional[str] = None
    quantity_kg: Optional[float] = None
    additional_context: Optional[Dict[str, Any]] = None


class ChatRequest(BaseModel):
    """Request model for AI chat"""
    message: str


class ChatResponse(BaseModel):
    """Response model for AI chat"""
    answer: str


class RecommendationResponse(BaseModel):
    """Response model for procurement recommendation"""
    recommendation: Dict[str, Any]
    confidence_score: float
    confidence_explanation: Dict[str, Any]
    pricing_analysis: Dict[str, Any]
    quality_assessment: Dict[str, Any]
    risk_assessment: Dict[str, Any]
    sustainability_assessment: Dict[str, Any]
    rule_compliance: Dict[str, Any]
    data_sources: Dict[str, List[str]]
    reasoning: str
    next_steps: List[str]
    alternative_suppliers: Optional[List[Dict[str, Any]]] = None


@recommendation_router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(request: ChatRequest):
    """
    Endpoint for conversational AI chat
    Note: Full conversational AI requires the Streamlit UI.
    This endpoint provides basic data queries.
    """
    try:
        # Simple response - full chat is handled in Streamlit UI
        return ChatResponse(
            answer="For full conversational AI, please use the Streamlit UI (streamlit run app.py). "
                   "This API provides data access endpoints."
        )
    except Exception as e:
        logger.error(f"Error in chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@recommendation_router.post("/query-knowledge", response_model=ChatResponse)
async def query_knowledge_base(request: ChatRequest):
    """
    Specifically query the RAG knowledge base (policies, contracts, etc.)
    Note: RAG queries are best handled through the Streamlit UI.
    """
    try:
        return ChatResponse(
            answer="For RAG-powered knowledge base queries, please use the Streamlit UI. "
                   "Run: streamlit run app.py"
        )
    except Exception as e:
        logger.error(f"Error querying knowledge base: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@recommendation_router.post("/recommend", response_model=RecommendationResponse)
async def get_recommendation(request: RecommendationRequest):
    """
    Generate procurement recommendation based on query
    """
    # This remains linked to the recommendation system
    # (Existing placeholder implementation)
    try:
        logger.info(f"Received recommendation request: {request.query}")
        
        return RecommendationResponse(
            recommendation={
                "supplier_id": "S001",
                "supplier_name": "Golden Sun Oils Ltd",
                "product": "Sunflower Oil",
                "quantity_kg": 50000,
                "unit_price_usd": 2.45,
                "total_cost_usd": 122500
            },
            confidence_score=0.78,
            confidence_explanation={
                "current_confidence": "78%",
                "reasoning": "Based on available data",
                "data_completeness": "85%",
                "missing_data_impact": [],
                "maximum_achievable_confidence": "92%"
            },
            pricing_analysis={
                "quoted_price": 2.45,
                "benchmark_price": 2.55,
                "price_deviation_pct": -3.9,
                "savings_vs_benchmark": 5000,
                "savings_pct": 3.9
            },
            quality_assessment={
                "quality_rating": 4.5,
                "certifications": ["ISO 22000", "RSPO", "Halal"],
                "delivery_reliability": "95%"
            },
            risk_assessment={
                "overall_risk_level": "LOW",
                "risks_identified": []
            },
            sustainability_assessment={
                "sustainability_score": 8.5,
                "certifications": ["RSPO"]
            },
            rule_compliance={
                "hard_constraints_satisfied": True,
                "soft_preferences_score": 85
            },
            data_sources={
                "structured_data": ["supplier_master.csv", "pricing_benchmarks.csv"],
                "unstructured_data": ["procurement_policy.md"],
                "calculated_data": ["savings_calculation"]
            },
            reasoning="RAG integrated. You can now use /chat for conversational queries.",
            next_steps=[
                "1. Data loading modules active",
                "2. RAG pipeline active (use /chat for policies)",
                "3. Intelligent search active (use /chat for market info)",
                "4. Rule engine loaded with 35 rules"
            ]
        )
        
    except Exception as e:
        logger.error(f"Error generating recommendation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@recommendation_router.get("/suppliers")
async def list_suppliers():
    """List all available suppliers"""
    return {"message": "Supplier listing - implementation pending"}


@recommendation_router.get("/clients")
async def list_clients():
    """List all clients"""
    return {"message": "Client listing - implementation pending"}


@recommendation_router.get("/benchmarks/{product_category}")
async def get_benchmarks(product_category: str):
    """Get pricing benchmarks for a product category"""
    return {"message": f"Benchmarks for {product_category} - implementation pending"}


# ============================================================================
# PROOF POINTS API ENDPOINTS
# ============================================================================

@recommendation_router.get("/proof-points")
async def list_all_proof_points():
    """
    Get all proof points (verified supplier evidence)

    Returns:
        List of all proof points with verification status
    """
    try:
        proof_points = data_loader.load_proof_points()

        if proof_points.empty:
            return {"success": True, "data": [], "message": "No proof points data available"}

        # Convert to list of dicts
        records = proof_points.to_dict('records')

        # Convert datetime to string
        for record in records:
            if 'Date_Recorded' in record and record['Date_Recorded'] is not None:
                record['Date_Recorded'] = str(record['Date_Recorded'])[:10]

        return {
            "success": True,
            "total_count": len(records),
            "verified_count": len([r for r in records if r.get('Verification_Status') == 'Verified']),
            "pending_count": len([r for r in records if r.get('Verification_Status') == 'Pending']),
            "data": records
        }
    except Exception as e:
        logger.error(f"Error fetching proof points: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@recommendation_router.get("/proof-points/supplier/{supplier_id}")
async def get_supplier_proof_points(supplier_id: str):
    """
    Get proof points for a specific supplier

    Args:
        supplier_id: Supplier ID (e.g., 'S001')

    Returns:
        Proof points organized by metric type
    """
    try:
        result = data_loader.get_supplier_proof_points(supplier_id=supplier_id)

        if 'error' in result:
            raise HTTPException(status_code=404, detail=result['error'])

        return {"success": True, "data": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching supplier proof points: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@recommendation_router.get("/proof-points/category/{category}")
async def get_category_proof_points(category: str, subcategory: Optional[str] = None):
    """
    Get proof points for all suppliers in a category

    Args:
        category: Category name (e.g., 'Edible Oils')
        subcategory: Optional subcategory filter (e.g., 'Rice Bran Oil')

    Returns:
        List of suppliers with their proof points
    """
    try:
        result = data_loader.get_proof_points_by_category(
            category=category,
            subcategory=subcategory
        )

        return {
            "success": True,
            "category": category,
            "subcategory": subcategory,
            "supplier_count": len(result),
            "data": result
        }
    except Exception as e:
        logger.error(f"Error fetching category proof points: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
