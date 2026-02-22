"""
Upload Endpoints
Handle file uploads for spend data and documents.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid
import os
import aiofiles
from datetime import datetime
import pandas as pd
from io import BytesIO

from app.database import get_db
from app.config import settings
from app.models.user import User
from app.models.session import AnalysisSession, SessionStatus
from app.models.spend_data import SpendData, SpendDataRow
from app.models.document import Document
from app.api.v1.dependencies import get_tenant_context, TenantContext
from app.services.activity_service import log_file_upload, get_client_ip

router = APIRouter()

# Column mapping for spend data
COLUMN_MAPPINGS = {
    "supplier": ["supplier", "supplier_name", "supplier_id", "vendor", "vendor_name"],
    "spend": ["spend", "spend_usd", "spend_amount", "amount", "total_spend", "value"],
    "country": ["country", "region", "location", "supplier_country", "geography"],
    "category": ["category", "category_name", "product_category", "commodity"],
    "volume": ["volume", "quantity", "qty", "units", "volume_kg", "volume_mt"],
    "price": ["price", "unit_price", "price_per_unit", "rate", "cost_per_unit"],
}


def detect_column(columns: list, field: str) -> Optional[str]:
    """Detect which column matches a field."""
    mappings = COLUMN_MAPPINGS.get(field, [])
    for col in columns:
        col_lower = col.lower().strip().replace(" ", "_").replace("-", "_")
        if col_lower in mappings:
            return col
    return None


async def save_upload_file(file: UploadFile, session_id: uuid.UUID) -> str:
    """Save uploaded file to disk."""
    # Create upload directory if not exists
    upload_dir = os.path.join(settings.upload_dir, str(session_id))
    os.makedirs(upload_dir, exist_ok=True)

    # Generate unique filename
    ext = os.path.splitext(file.filename)[1].lower()
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(upload_dir, filename)

    # Save file
    async with aiofiles.open(filepath, "wb") as f:
        content = await file.read()
        await f.write(content)

    return filepath


@router.post("/spend-data")
async def upload_spend_data(
    request: Request,
    session_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload spend data CSV/Excel file for analysis.
    """
    tenant.require_permission("categories", "create")
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

    # Validate file type
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".csv", ".xlsx", ".xls"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV and Excel files are supported"
        )

    # Validate file size
    content = await file.read()
    if len(content) > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Max size: {settings.max_upload_size_mb}MB"
        )

    # Save file
    await file.seek(0)
    filepath = await save_upload_file(file, session_id)

    # Parse file
    try:
        if ext == ".csv":
            df = pd.read_csv(BytesIO(content))
        else:
            df = pd.read_excel(BytesIO(content))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse file: {str(e)}"
        )

    # Get columns
    columns = df.columns.tolist()

    # Detect column mappings
    column_mapping = {}
    for field in COLUMN_MAPPINGS.keys():
        detected = detect_column(columns, field)
        if detected:
            column_mapping[field] = detected

    # Check data availability
    has_supplier = "supplier" in column_mapping
    has_location = "country" in column_mapping
    has_volume = "volume" in column_mapping
    has_price = "price" in column_mapping
    has_category = "category" in column_mapping
    has_spend = "spend" in column_mapping

    # Calculate aggregations
    total_spend = None
    spend_by_supplier = {}
    spend_by_location = {}
    spend_by_category = {}

    if has_spend:
        spend_col = column_mapping["spend"]
        df[spend_col] = pd.to_numeric(df[spend_col], errors="coerce")
        total_spend = float(df[spend_col].sum())

        if has_supplier:
            supplier_col = column_mapping["supplier"]
            spend_by_supplier = (
                df.groupby(supplier_col)[spend_col]
                .sum()
                .sort_values(ascending=False)
                .head(10)
                .to_dict()
            )

        if has_location:
            location_col = column_mapping["country"]
            spend_by_location = (
                df.groupby(location_col)[spend_col]
                .sum()
                .sort_values(ascending=False)
                .head(10)
                .to_dict()
            )

        if has_category:
            category_col = column_mapping["category"]
            spend_by_category = (
                df.groupby(category_col)[spend_col]
                .sum()
                .sort_values(ascending=False)
                .to_dict()
            )

    # Create SpendData record
    spend_data = SpendData(
        session_id=session_id,
        filename=file.filename,
        file_path=filepath,
        file_size=len(content),
        row_count=len(df),
        column_count=len(columns),
        columns=columns,
        column_mapping=column_mapping,
        has_supplier_data=has_supplier,
        has_location_data=has_location,
        has_volume_data=has_volume,
        has_price_data=has_price,
        has_category_data=has_category,
        total_spend=total_spend,
        unique_suppliers=df[column_mapping["supplier"]].nunique() if has_supplier else None,
        unique_locations=df[column_mapping["country"]].nunique() if has_location else None,
        unique_categories=df[column_mapping["category"]].nunique() if has_category else None,
        spend_by_supplier=spend_by_supplier,
        spend_by_location=spend_by_location,
        spend_by_category=spend_by_category,
        is_processed=True,
        processed_at=datetime.utcnow()
    )

    db.add(spend_data)

    # Store sample rows (first 1000)
    sample_df = df.head(1000)
    for idx, row in sample_df.iterrows():
        spend_row = SpendDataRow(
            spend_data_id=spend_data.id,
            row_number=idx,
            supplier_name=str(row.get(column_mapping.get("supplier"), "")) if has_supplier else None,
            category=str(row.get(column_mapping.get("category"), "")) if has_category else None,
            spend_amount=float(row.get(column_mapping.get("spend"), 0)) if has_spend else None,
            country=str(row.get(column_mapping.get("country"), "")) if has_location else None,
            volume=float(row.get(column_mapping.get("volume"), 0)) if has_volume else None,
            unit_price=float(row.get(column_mapping.get("price"), 0)) if has_price else None,
            raw_data=row.to_dict()
        )
        db.add(spend_row)

    # Update session status
    session.status = SessionStatus.UPLOADING
    session.add_log("System", f"Spend data uploaded: {file.filename} ({len(df)} rows)")

    # Log activity
    await log_file_upload(
        db=db,
        user=tenant.user,
        file_name=file.filename,
        file_type="spend_data",
        file_size=len(content),
        ip_address=get_client_ip(request)
    )

    await db.commit()

    return {
        "status": "success",
        "spend_data_id": str(spend_data.id),
        "filename": file.filename,
        "row_count": len(df),
        "columns": columns,
        "column_mapping": column_mapping,
        "data_availability": {
            "supplier": has_supplier,
            "location": has_location,
            "volume": has_volume,
            "price": has_price,
            "category": has_category,
            "spend": has_spend
        },
        "summary": {
            "total_spend": total_spend,
            "unique_suppliers": spend_data.unique_suppliers,
            "unique_locations": spend_data.unique_locations,
            "unique_categories": spend_data.unique_categories,
        },
        "spend_by_supplier": spend_by_supplier,
        "spend_by_location": spend_by_location,
    }


@router.post("/validate")
async def validate_file(
    file: UploadFile = File(...),
):
    """
    Validate a file and return detected columns without saving.
    Used for preview before full upload.
    """
    # Validate file type
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".csv", ".xlsx", ".xls"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV and Excel files are supported"
        )

    # Read file
    content = await file.read()

    # Parse file
    try:
        if ext == ".csv":
            df = pd.read_csv(BytesIO(content))
        else:
            df = pd.read_excel(BytesIO(content))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse file: {str(e)}"
        )

    columns = df.columns.tolist()

    # Detect mappings
    column_mapping = {}
    detected_fields = []
    for field in COLUMN_MAPPINGS.keys():
        detected = detect_column(columns, field)
        if detected:
            column_mapping[field] = detected
            detected_fields.append({
                "field": field,
                "column": detected,
                "description": f"Detected {field} data"
            })

    return {
        "status": "valid",
        "filename": file.filename,
        "row_count": len(df),
        "columns": columns,
        "column_mapping": column_mapping,
        "detected_fields": detected_fields,
        "sample_data": df.head(5).to_dict(orient="records")
    }


@router.post("/document")
async def upload_document(
    request: Request,
    session_id: uuid.UUID = Form(...),
    document_type: str = Form("other"),
    file: UploadFile = File(...),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a document (PDF, DOCX) for analysis.
    """
    tenant.require_permission("analyses", "create")
    # Verify session
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

    # Validate file type
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".pdf", ".docx"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF and DOCX files are supported"
        )

    # Save file
    content = await file.read()
    await file.seek(0)
    filepath = await save_upload_file(file, session_id)

    # Create document record
    document = Document(
        session_id=session_id,
        filename=os.path.basename(filepath),
        original_filename=file.filename,
        file_type=ext.replace(".", ""),
        file_size=len(content),
        file_path=filepath,
        document_type=document_type,
        is_processed=False
    )

    db.add(document)
    session.add_log("System", f"Document uploaded: {file.filename}")

    # Log activity
    await log_file_upload(
        db=db,
        user=tenant.user,
        file_name=file.filename,
        file_type=document_type,
        file_size=len(content),
        ip_address=get_client_ip(request)
    )

    await db.commit()
    await db.refresh(document)

    return {
        "status": "success",
        "document_id": str(document.id),
        "filename": file.filename,
        "document_type": document_type,
        "file_size": len(content),
        "is_processed": False,
        "message": "Document uploaded. Processing will begin shortly."
    }
