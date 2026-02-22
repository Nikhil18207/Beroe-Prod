"""
Document Analysis Endpoints
Handle document upload and LLM-based analysis.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import uuid
from datetime import datetime

from pathlib import Path

from app.database import get_db
from app.models.user import User
from app.models.session import AnalysisSession
from app.models.document import Document, DocumentType, ProcessingStatus
from app.api.v1.dependencies import get_tenant_context, TenantContext
from app.services.document_service import DocumentService, DocumentAnalysisResult

router = APIRouter()

# Initialize document service
document_service = DocumentService()

# Configuration for document uploads
MAX_DOCUMENTS_PER_REQUEST = 10
MAX_FILE_SIZE_MB = 25
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".md"}


# Response Models
class DocumentAnalysisResponse(BaseModel):
    """Response for document analysis."""
    document_id: str
    document_name: str
    document_type: str
    summary: str
    key_terms: List[Dict[str, Any]]
    pricing_info: Dict[str, Any]
    risks: List[Dict[str, Any]]
    opportunities: List[Dict[str, Any]]
    compliance: Dict[str, Any]
    recommendations: List[Dict[str, Any]]
    processed_at: str


class DocumentListResponse(BaseModel):
    """Response for document list."""
    documents: List[Dict[str, Any]]
    total: int


class CategoryInsightsResponse(BaseModel):
    """Response for category insights from documents."""
    has_documents: bool
    document_count: int = 0
    top_risks: List[Dict[str, Any]] = []
    top_opportunities: List[Dict[str, Any]] = []
    key_terms: List[Dict[str, Any]] = []
    priority_recommendations: List[Dict[str, Any]] = []
    documents_analyzed: List[Dict[str, Any]] = []


@router.post("/analyze", response_model=DocumentAnalysisResponse)
async def analyze_document(
    file: UploadFile = File(...),
    document_type: str = Form("contract"),
    category: Optional[str] = Form(None),
    session_id: Optional[uuid.UUID] = Form(None),
    extraction_focus: Optional[str] = Form(None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload and analyze a document using LLM.

    Supported document types:
    - contract: Supplier contracts, agreements
    - playbook: Procurement playbooks, guidelines
    - supplier_agreement: Supplier-specific agreements
    - policy: Internal procurement policies
    - other: Other procurement documents

    The analysis extracts:
    - Key terms and conditions
    - Pricing structures
    - Risk factors
    - Optimization opportunities
    - Compliance requirements
    """
    tenant.require_permission("analyses", "create")
    # Validate session if provided
    if session_id:
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

    # Validate file extension
    ext = Path(file.filename).suffix.lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Read and validate file size
    file_content = await file.read()
    file_size_mb = len(file_content) / (1024 * 1024)
    if file_size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum size of {MAX_FILE_SIZE_MB}MB"
        )

    # Parse extraction focus
    focus_list = None
    if extraction_focus:
        focus_list = [f.strip() for f in extraction_focus.split(",")]

    try:
        # Analyze document
        analysis = await document_service.analyze_document(
            file_content=file_content,
            file_name=file.filename,
            document_type=document_type,
            category=category,
            extraction_focus=focus_list,
            session_id=str(session_id) if session_id else None,
            db=db if session_id else None
        )

        return DocumentAnalysisResponse(
            document_id=analysis.document_id,
            document_name=analysis.document_name,
            document_type=analysis.document_type,
            summary=analysis.summary,
            key_terms=analysis.key_terms,
            pricing_info=analysis.pricing_info,
            risks=analysis.risks,
            opportunities=analysis.opportunities,
            compliance=analysis.compliance,
            recommendations=analysis.recommendations,
            processed_at=analysis.processed_at
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document analysis failed: {str(e)}"
        )


@router.post("/analyze-multiple", response_model=List[DocumentAnalysisResponse])
async def analyze_multiple_documents(
    files: List[UploadFile] = File(...),
    document_types: Optional[str] = Form(None),  # comma-separated
    category: Optional[str] = Form(None),
    session_id: Optional[uuid.UUID] = Form(None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload and analyze multiple documents.
    Useful for analyzing contracts alongside playbooks.

    Limits:
    - Maximum 10 documents per request
    - Maximum 25MB per file
    - Supported formats: PDF, DOCX, DOC, TXT, MD
    """
    tenant.require_permission("analyses", "create")
    if len(files) > MAX_DOCUMENTS_PER_REQUEST:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {MAX_DOCUMENTS_PER_REQUEST} documents per request"
        )

    if len(files) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one document is required"
        )

    # Parse document types
    types_list = []
    if document_types:
        types_list = [t.strip() for t in document_types.split(",")]

    # Build documents list with validation
    documents = []
    for i, file in enumerate(files):
        # Validate file extension
        ext = Path(file.filename).suffix.lower() if file.filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type: {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        # Read and validate file size
        file_content = await file.read()
        file_size_mb = len(file_content) / (1024 * 1024)
        if file_size_mb > MAX_FILE_SIZE_MB:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File '{file.filename}' exceeds maximum size of {MAX_FILE_SIZE_MB}MB"
            )

        doc_type = types_list[i] if i < len(types_list) else "other"
        documents.append({
            "file_content": file_content,
            "file_name": file.filename,
            "document_type": doc_type
        })

    try:
        # Analyze all documents
        results = await document_service.analyze_multiple_documents(
            documents=documents,
            category=category,
            session_id=str(session_id) if session_id else None,
            db=db if session_id else None
        )

        return [
            DocumentAnalysisResponse(
                document_id=r.document_id,
                document_name=r.document_name,
                document_type=r.document_type,
                summary=r.summary,
                key_terms=r.key_terms,
                pricing_info=r.pricing_info,
                risks=r.risks,
                opportunities=r.opportunities,
                compliance=r.compliance,
                recommendations=r.recommendations,
                processed_at=r.processed_at
            )
            for r in results
        ]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document analysis failed: {str(e)}"
        )


@router.get("/session/{session_id}", response_model=DocumentListResponse)
async def list_session_documents(
    session_id: uuid.UUID,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    List all analyzed documents for a session.
    """
    tenant.require_permission("analyses", "read")
    # Verify session access
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

    # Get documents
    doc_result = await db.execute(
        select(Document)
        .where(Document.session_id == session_id)
        .order_by(Document.created_at.desc())
    )
    documents = doc_result.scalars().all()

    return DocumentListResponse(
        documents=[
            {
                "id": str(doc.id),
                "file_name": doc.file_name,
                "document_type": doc.document_type.value if doc.document_type else "unknown",
                "status": doc.processing_status.value if doc.processing_status else "unknown",
                "word_count": doc.word_count,
                "page_count": doc.page_count,
                "has_analysis": doc.analysis_result is not None,
                "created_at": doc.created_at.isoformat() if doc.created_at else None,
                "processed_at": doc.processed_at.isoformat() if doc.processed_at else None
            }
            for doc in documents
        ],
        total=len(documents)
    )


@router.get("/{document_id}", response_model=DocumentAnalysisResponse)
async def get_document_analysis(
    document_id: uuid.UUID,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Get analysis results for a specific document.
    """
    tenant.require_permission("analyses", "read")
    # Get document with session verification
    result = await db.execute(
        select(Document)
        .join(AnalysisSession)
        .where(
            Document.id == document_id,
            AnalysisSession.user_id == tenant.user_id
        )
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    if not document.analysis_result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document has not been analyzed yet"
        )

    analysis = document.analysis_result

    return DocumentAnalysisResponse(
        document_id=str(document.id),
        document_name=document.file_name,
        document_type=document.document_type.value if document.document_type else "unknown",
        summary=analysis.get("summary", ""),
        key_terms=analysis.get("key_terms", []),
        pricing_info=analysis.get("pricing", {}),
        risks=analysis.get("risks", []),
        opportunities=analysis.get("opportunities", []),
        compliance=analysis.get("compliance", {}),
        recommendations=analysis.get("recommendations", []),
        processed_at=document.processed_at.isoformat() if document.processed_at else ""
    )


@router.get("/insights/{session_id}/{category}", response_model=CategoryInsightsResponse)
async def get_category_document_insights(
    session_id: uuid.UUID,
    category: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Get aggregated document insights for a specific category.
    Combines findings from all documents analyzed for the category.
    """
    tenant.require_permission("analyses", "read")
    # Verify session access
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

    # Get aggregated insights
    insights = await document_service.get_document_insights_for_category(
        session_id=str(session_id),
        category=category,
        db=db
    )

    return CategoryInsightsResponse(**insights)


@router.delete("/{document_id}")
async def delete_document(
    document_id: uuid.UUID,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a document and its analysis.
    """
    tenant.require_permission("analyses", "delete")
    # Get document with session verification
    result = await db.execute(
        select(Document)
        .join(AnalysisSession)
        .where(
            Document.id == document_id,
            AnalysisSession.user_id == tenant.user_id
        )
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    await db.delete(document)
    await db.commit()

    return {"status": "success", "message": "Document deleted"}


@router.post("/demo-analyze")
async def demo_analyze_document(
    file: UploadFile = File(...),
    document_type: str = Form("contract")
):
    """
    Demo document analysis endpoint.
    No authentication required - for testing purposes.
    """
    file_content = await file.read()

    try:
        analysis = await document_service.analyze_document(
            file_content=file_content,
            file_name=file.filename,
            document_type=document_type
        )

        return {
            "document_name": analysis.document_name,
            "document_type": analysis.document_type,
            "summary": analysis.summary,
            "key_terms": analysis.key_terms[:5],  # Limit for demo
            "risks": analysis.risks[:3],
            "opportunities": analysis.opportunities[:3],
            "recommendations": analysis.recommendations[:3],
            "processed_at": analysis.processed_at
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}"
        )
