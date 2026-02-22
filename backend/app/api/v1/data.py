"""
Data Ingestion API Endpoints
Handles upload and processing of all 4 data sources:
- Overall Spend Data
- Supply Master
- Contracts
- Category Playbook
"""

import logging
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.data_ingestion_service import (
    DataIngestionService,
    DataIngestionResult,
    DataSourceType,
    ingest_all_data_sources
)
from app.services.compute_service import ComputeService
from app.services.cache_service import CacheService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/data", tags=["Data Ingestion"])


# ========================
# REQUEST/RESPONSE MODELS
# ========================

class IngestionResponse(BaseModel):
    """Response model for data ingestion."""
    success: bool
    source_type: str
    records_processed: int
    errors: List[str]
    warnings: List[str]
    metadata: dict


class ComputeResponse(BaseModel):
    """Response for metric computation."""
    success: bool
    metrics_computed: int
    metrics: dict


class CacheSummaryResponse(BaseModel):
    """Response for cache summary."""
    metrics: dict
    counts: dict
    top_suppliers: List[dict]
    expiring_contracts: List[dict]
    high_risk_suppliers: List[dict]
    alerts: List[dict]


class MetricResponse(BaseModel):
    """Response for single metric."""
    metric_name: str
    value: Optional[float]
    unit: Optional[str]
    confidence: Optional[str]


# ========================
# INGESTION ENDPOINTS
# ========================

@router.post("/ingest/spend", response_model=IngestionResponse)
async def ingest_spend_data(
    session_id: UUID = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Ingest overall spend data from CSV/XLSX file.
    
    Expected columns:
    - supplier_name (required)
    - amount (required)
    - category, subcategory, region, date (optional)
    """
    try:
        # Determine file type - accept all common formats
        file_type = file.filename.split(".")[-1].lower()
        supported_types = ["csv", "xlsx", "xls", "docx", "doc", "pdf", "txt", "json"]

        # Read file content
        content = await file.read()

        # For tabular formats, pass directly
        if file_type in ["csv", "xlsx", "xls"]:
            content_str = content.decode("utf-8") if file_type == "csv" else None
        else:
            # For document formats, we'll extract text and try to parse tabular data
            content_str = None
            # Convert file_type to xlsx for processing (will be handled in service)
            file_type = "xlsx" if file_type not in supported_types else file_type

        # Process
        service = DataIngestionService(db)
        result = await service.ingest_spend_data(
            session_id=session_id,
            file_content=content_str if content_str else content,
            file_type=file_type
        )
        
        return IngestionResponse(
            success=result.success,
            source_type=result.source_type,
            records_processed=result.records_processed,
            errors=result.errors,
            warnings=result.warnings,
            metadata=result.metadata
        )
        
    except Exception as e:
        logger.error(f"Error ingesting spend data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/ingest/suppliers", response_model=IngestionResponse)
async def ingest_supplier_data(
    session_id: UUID = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Ingest supply master data from CSV/XLSX file.
    
    Expected columns:
    - supplier_id (required)
    - supplier_name (required)
    - country, region, quality_rating, certifications (optional)
    """
    try:
        file_type = file.filename.split(".")[-1].lower()
        supported_types = ["csv", "xlsx", "xls", "docx", "doc", "pdf", "txt", "json"]

        content = await file.read()

        if file_type in ["csv", "xlsx", "xls"]:
            content_str = content.decode("utf-8") if file_type == "csv" else None
        else:
            content_str = None
            file_type = "xlsx" if file_type not in supported_types else file_type

        service = DataIngestionService(db)
        result = await service.ingest_supplier_data(
            session_id=session_id,
            file_content=content_str if content_str else content,
            file_type=file_type
        )
        
        return IngestionResponse(
            success=result.success,
            source_type=result.source_type,
            records_processed=result.records_processed,
            errors=result.errors,
            warnings=result.warnings,
            metadata=result.metadata
        )
        
    except Exception as e:
        logger.error(f"Error ingesting supplier data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/ingest/contracts", response_model=IngestionResponse)
async def ingest_contract_data(
    session_id: UUID = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Ingest contract data from CSV/XLSX file.
    
    Expected columns:
    - supplier_id (required)
    - supplier_name (required)
    - contract_id, contract_type, expiry_date, payment_terms (optional)
    """
    try:
        file_type = file.filename.split(".")[-1].lower()
        supported_types = ["csv", "xlsx", "xls", "docx", "doc", "pdf", "txt", "json"]

        content = await file.read()

        if file_type in ["csv", "xlsx", "xls"]:
            content_str = content.decode("utf-8") if file_type == "csv" else None
        else:
            content_str = None
            file_type = "xlsx" if file_type not in supported_types else file_type

        service = DataIngestionService(db)
        result = await service.ingest_contract_data(
            session_id=session_id,
            file_content=content_str if content_str else content,
            file_type=file_type
        )
        
        return IngestionResponse(
            success=result.success,
            source_type=result.source_type,
            records_processed=result.records_processed,
            errors=result.errors,
            warnings=result.warnings,
            metadata=result.metadata
        )
        
    except Exception as e:
        logger.error(f"Error ingesting contract data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/ingest/playbook", response_model=IngestionResponse)
async def ingest_playbook_data(
    session_id: UUID = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Ingest category playbook from CSV or Markdown file.
    
    For CSV, expected columns:
    - rule_name or name (required)
    - description, metric, threshold, type, priority (optional)
    
    For Markdown, rules are extracted from ## sections.
    """
    try:
        file_type = file.filename.split(".")[-1].lower()
        supported_types = ["csv", "md", "markdown", "docx", "doc", "pdf", "txt", "xlsx", "xls", "json"]

        content = await file.read()

        # Try to decode as text for supported text formats
        if file_type in ["csv", "md", "markdown", "txt", "json"]:
            content_str = content.decode("utf-8")
        else:
            # For binary formats (docx, pdf, xlsx), pass the bytes
            content_str = content

        service = DataIngestionService(db)
        result = await service.ingest_playbook_data(
            session_id=session_id,
            file_content=content_str,
            file_type=file_type
        )
        
        return IngestionResponse(
            success=result.success,
            source_type=result.source_type,
            records_processed=result.records_processed,
            errors=result.errors,
            warnings=result.warnings,
            metadata=result.metadata
        )
        
    except Exception as e:
        logger.error(f"Error ingesting playbook data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ========================
# COMPUTE ENDPOINTS
# ========================

@router.post("/compute/{session_id}", response_model=ComputeResponse)
async def compute_metrics(
    session_id: UUID,
    category: str = "ALL",
    db: AsyncSession = Depends(get_db)
):
    """
    Trigger metric computation for a session.
    Should be called after all data sources are ingested.
    """
    try:
        service = ComputeService(db)
        metrics = await service.compute_all_metrics(session_id, category)
        
        return ComputeResponse(
            success=True,
            metrics_computed=len(metrics),
            metrics=metrics
        )
        
    except Exception as e:
        logger.error(f"Error computing metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/cross-reference/{session_id}")
async def build_cross_references(
    session_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Build cross-references between data sources.
    Links suppliers across spend, master, and contracts.
    """
    try:
        service = DataIngestionService(db)
        links = await service.build_cross_references(session_id)
        
        return {
            "success": True,
            "links_created": links
        }
        
    except Exception as e:
        logger.error(f"Error building cross-references: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ========================
# CACHE ACCESS ENDPOINTS
# ========================

@router.get("/metrics/{session_id}", response_model=dict)
async def get_all_metrics(
    session_id: UUID,
    category: str = "ALL",
    db: AsyncSession = Depends(get_db)
):
    """Get all cached metrics for a session."""
    try:
        cache = CacheService(db)
        metrics = await cache.get_all_metrics(session_id, category)
        
        return {
            "session_id": str(session_id),
            "category": category,
            "metrics": metrics
        }
        
    except Exception as e:
        logger.error(f"Error getting metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/metrics/{session_id}/{metric_name}")
async def get_single_metric(
    session_id: UUID,
    metric_name: str,
    category: str = "ALL",
    db: AsyncSession = Depends(get_db)
):
    """Get a single cached metric value."""
    try:
        cache = CacheService(db)
        value = await cache.get_metric(session_id, metric_name, category)
        
        return {
            "metric_name": metric_name,
            "value": value,
            "found": value is not None
        }
        
    except Exception as e:
        logger.error(f"Error getting metric: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/summary/{session_id}", response_model=CacheSummaryResponse)
async def get_session_summary(
    session_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get complete cached summary for a session (dashboard view)."""
    try:
        cache = CacheService(db)
        summary = await cache.get_summary(session_id)
        
        return CacheSummaryResponse(**summary)
        
    except Exception as e:
        logger.error(f"Error getting summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/suppliers/{session_id}")
async def get_suppliers(
    session_id: UUID,
    limit: int = 10,
    sort_by: str = "spend",
    db: AsyncSession = Depends(get_db)
):
    """Get top suppliers from cache."""
    try:
        cache = CacheService(db)
        suppliers = await cache.get_top_suppliers(
            session_id, 
            limit=limit, 
            sort_by="risk" if sort_by == "risk" else "spend_percentage"
        )
        
        return {
            "session_id": str(session_id),
            "count": len(suppliers),
            "suppliers": suppliers
        }
        
    except Exception as e:
        logger.error(f"Error getting suppliers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/suppliers/{session_id}/high-risk")
async def get_high_risk_suppliers(
    session_id: UUID,
    threshold: float = 70.0,
    db: AsyncSession = Depends(get_db)
):
    """Get high-risk suppliers from cache."""
    try:
        cache = CacheService(db)
        suppliers = await cache.get_high_risk_suppliers(session_id, threshold)
        
        return {
            "session_id": str(session_id),
            "threshold": threshold,
            "count": len(suppliers),
            "suppliers": suppliers
        }
        
    except Exception as e:
        logger.error(f"Error getting high-risk suppliers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/contracts/{session_id}/expiring")
async def get_expiring_contracts(
    session_id: UUID,
    days: int = 90,
    db: AsyncSession = Depends(get_db)
):
    """Get contracts expiring within N days."""
    try:
        cache = CacheService(db)
        contracts = await cache.get_expiring_contracts(session_id, days)
        
        return {
            "session_id": str(session_id),
            "expiring_within_days": days,
            "count": len(contracts),
            "contracts": contracts
        }
        
    except Exception as e:
        logger.error(f"Error getting expiring contracts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/proof-point/{session_id}/{proof_point_id}")
async def get_proof_point_data(
    session_id: UUID,
    proof_point_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get all cached data needed for a specific proof point."""
    try:
        cache = CacheService(db)
        data = await cache.get_proof_point_data(session_id, proof_point_id)
        
        return data
        
    except Exception as e:
        logger.error(f"Error getting proof point data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
