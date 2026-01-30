"""
API v1 Routes
Version 1 of the API endpoints.
"""

from fastapi import APIRouter
from app.api.v1 import auth, health, portfolio, session, opportunities, upload, chat, analysis, documents, analyze, data

# Create main v1 router
api_router = APIRouter()

# Include all route modules
api_router.include_router(
    health.router,
    tags=["Health"]
)
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Authentication"]
)
api_router.include_router(
    portfolio.router,
    prefix="/portfolio",
    tags=["Portfolio"]
)
api_router.include_router(
    session.router,
    prefix="/session",
    tags=["Session"]
)
api_router.include_router(
    opportunities.router,
    prefix="/opportunities",
    tags=["Opportunities"]
)
api_router.include_router(
    upload.router,
    prefix="/upload",
    tags=["Upload"]
)
api_router.include_router(
    chat.router,
    prefix="/chat",
    tags=["Chat"]
)
api_router.include_router(
    analysis.router,
    prefix="/analysis",
    tags=["Analysis"]
)
api_router.include_router(
    documents.router,
    prefix="/documents",
    tags=["Documents"]
)
# Frontend-compatible analyze endpoints (POST /analyze, POST /analyze/quick)
api_router.include_router(
    analyze.router,
    prefix="/analyze",
    tags=["Analyze (Frontend Compatible)"]
)
# Data ingestion and cache access endpoints
api_router.include_router(
    data.router,
    tags=["Data Pipeline"]
)
