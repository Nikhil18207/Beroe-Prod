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


# ============================================================================
# CLEAN SPEND DATA MANAGEMENT
# New upload = Delete old completely, store fresh data
# ============================================================================

class SpendSummaryResponse(BaseModel):
    """Pre-computed spend summary for instant frontend display."""
    success: bool
    session_id: str
    category_name: str
    file_name: str

    # Instant metrics (no processing needed)
    total_spend: float
    row_count: int
    supplier_count: int
    location_count: int

    # Pre-sorted top items for display
    top_suppliers: List[dict]
    # [{"name": "Supplier A", "spend": 140000, "percentage": 27}, ...]
    top_locations: List[dict]
    # [{"name": "USA", "spend": 140000, "percentage": 27}, ...]

    # Detected columns (for reference)
    detected_columns: dict

    # Price stats if available
    price_stats: Optional[dict] = None

    # Status
    processed_at: Optional[str] = None


@router.post("/spend/upload", response_model=SpendSummaryResponse)
async def upload_spend_data_clean(
    session_id: UUID = Form(...),
    category_name: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload spend data with CLEAN REPLACEMENT - STREAMING VERSION.

    Optimized for N MILLION rows:
    - Streams file to disk first (doesn't load entire file in memory)
    - Processes CSV in chunks (configurable chunk size)
    - Single-pass aggregation while streaming
    - Batch database inserts during streaming
    - Running statistics for price calculations

    Memory usage: O(chunk_size) instead of O(total_rows)
    """
    from app.models.spend_data import SpendData, SpendDataRow
    from sqlalchemy import delete
    from datetime import datetime
    import pandas as pd
    import tempfile
    import os
    import shutil

    # Configuration for N million row handling
    CHUNK_SIZE = 50000  # Process 50K rows at a time
    BATCH_SIZE = 5000   # Insert 5K rows per DB transaction
    MAX_PRICE_SAMPLES = 10000  # Limit price samples for variance calculation

    try:
        logger.info(f"[SpendUpload] Starting STREAMING upload for session {session_id}, category: {category_name}")

        # =====================
        # STEP 1: DELETE OLD DATA
        # =====================
        await db.execute(
            delete(SpendData).where(SpendData.session_id == session_id)
        )
        await db.commit()
        logger.info(f"[SpendUpload] Deleted old spend data for session {session_id}")

        # =====================
        # STEP 2: STREAM FILE TO DISK
        # =====================
        # Don't load entire file into memory - stream to temp file
        file_type = file.filename.split(".")[-1].lower()

        if file_type not in ["csv", "xlsx", "xls"]:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file_type}. Use CSV or Excel."
            )

        # Create temp file
        temp_dir = tempfile.mkdtemp()
        temp_path = os.path.join(temp_dir, f"upload.{file_type}")
        file_size = 0

        try:
            # Stream upload to disk in chunks (memory efficient)
            with open(temp_path, "wb") as temp_file:
                while chunk := await file.read(1024 * 1024):  # 1MB chunks
                    temp_file.write(chunk)
                    file_size += len(chunk)

            logger.info(f"[SpendUpload] Streamed {file_size / (1024*1024):.1f}MB to temp file")

            # =====================
            # STEP 3: DETECT COLUMNS (read only header)
            # =====================
            if file_type == "csv":
                # Read just the header
                header_df = pd.read_csv(temp_path, nrows=0)
            else:
                # Excel - read just header
                header_df = pd.read_excel(temp_path, nrows=0)

            headers = list(header_df.columns)
            logger.info(f"[SpendUpload] Detected {len(headers)} columns")

            # Smart column detection
            ABBREVIATIONS = {
                'supplier': ['sup', 'supp', 'suppl', 'splr', 'vnd', 'vndr', 'vendor', 'seller', 'provider'],
                'country': ['ctry', 'cntry', 'cnty', 'nation', 'loc', 'location'],
                'spend': ['amt', 'amnt', 'amount', 'val', 'value', 'tot', 'total', 'ext', 'extended'],
                'price': ['prc', 'prce', 'cost', 'rate', 'unit'],
                'quantity': ['qty', 'qnty', 'quant', 'vol', 'volume'],
                'category': ['cat', 'catg', 'seg', 'segment', 'comm', 'commodity', 'prod', 'product'],
                'region': ['reg', 'rgn', 'geo', 'territory', 'area'],
            }
            SUPPLIER_SIDE = ['supplier', 'vendor', 'seller', 'source', 'origin', 'ship', 'from']
            BUYER_SIDE = ['buyer', 'purchaser', 'customer', 'dest', 'destination', 'to']

            def detect_column(col_type: str) -> Optional[str]:
                best_col, best_score = None, 0
                keywords = ABBREVIATIONS.get(col_type, [col_type])
                for col in headers:
                    col_lower = col.lower().replace('_', '').replace(' ', '').replace('-', '')
                    score = 0
                    for kw in keywords:
                        if col_lower == kw:
                            score = 1000
                        elif kw in col_lower:
                            score = max(score, 500 + len(kw) * 10)
                    if col_type in ['country', 'region'] and score > 0:
                        if any(s in col_lower for s in SUPPLIER_SIDE): score += 100
                        if any(b in col_lower for b in BUYER_SIDE): score -= 50
                    if col_type == 'supplier' and score > 0:
                        if 'name' in col_lower: score += 100
                        if 'id' in col_lower or 'code' in col_lower: score -= 50
                    if score > best_score:
                        best_score, best_col = score, col
                return best_col

            detected = {
                'supplier': detect_column('supplier'),
                'country': detect_column('country'),
                'region': detect_column('region'),
                'spend': detect_column('spend'),
                'price': detect_column('price'),
                'quantity': detect_column('quantity'),
                'category': detect_column('category'),
            }
            logger.info(f"[SpendUpload] Detected columns: {detected}")

            spend_col = detected['spend']
            supplier_col = detected['supplier']
            country_col = detected['country']
            category_col = detected['category']
            price_col = detected['price']
            quantity_col = detected['quantity']
            region_col = detected['region']

            # =====================
            # STEP 4: CREATE SPEND_DATA RECORD FIRST
            # =====================
            # We create the parent record first so we can insert rows as we stream
            spend_data = SpendData(
                session_id=session_id,
                filename=file.filename,
                file_path=f"/uploads/{session_id}/{file.filename}",
                file_size=file_size,
                row_count=0,  # Will update after streaming
                column_count=len(headers),
                columns=headers,
                column_mapping=detected,
                has_supplier_data=bool(supplier_col),
                has_location_data=bool(country_col or region_col),
                has_volume_data=bool(quantity_col),
                has_price_data=bool(price_col),
                has_category_data=bool(category_col),
                total_spend=0,
                unique_suppliers=0,
                unique_locations=0,
                unique_categories=0,
                spend_by_supplier={},
                spend_by_location={},
                spend_by_category={},
                is_processed=False,
                processed_at=None
            )
            db.add(spend_data)
            await db.commit()
            await db.refresh(spend_data)
            spend_data_id = spend_data.id

            # =====================
            # STEP 5: STREAM PROCESS FILE IN CHUNKS
            # =====================
            # Aggregation accumulators (memory efficient)
            spend_by_supplier = {}
            spend_by_location = {}
            spend_by_category = {}
            total_spend = 0
            total_rows = 0

            # Running statistics for prices (no need to store all prices)
            price_count = 0
            price_sum = 0
            price_sum_sq = 0
            price_min = float('inf')
            price_max = float('-inf')

            # Batch insert buffer
            rows_to_insert = []

            def parse_number(val) -> Optional[float]:
                if pd.isna(val): return None
                try:
                    return float(str(val).replace(',', '').replace('$', ''))
                except:
                    return None

            def process_chunk(chunk_df, start_row):
                nonlocal total_spend, total_rows, spend_by_supplier, spend_by_location, spend_by_category
                nonlocal price_count, price_sum, price_sum_sq, price_min, price_max, rows_to_insert

                for idx, row in chunk_df.iterrows():
                    row_num = start_row + idx + 1
                    total_rows += 1

                    # Calculate spend
                    spend = parse_number(row.get(spend_col)) if spend_col else None
                    if spend is None and price_col and quantity_col:
                        price = parse_number(row.get(price_col))
                        qty = parse_number(row.get(quantity_col))
                        if price and qty:
                            spend = price * qty

                    if spend and spend > 0:
                        total_spend += spend

                        # Aggregate by supplier
                        if supplier_col and pd.notna(row.get(supplier_col)):
                            supplier = str(row[supplier_col])
                            spend_by_supplier[supplier] = spend_by_supplier.get(supplier, 0) + spend

                        # Aggregate by location
                        if country_col and pd.notna(row.get(country_col)):
                            location = str(row[country_col])
                            spend_by_location[location] = spend_by_location.get(location, 0) + spend

                        # Aggregate by category
                        if category_col and pd.notna(row.get(category_col)):
                            cat = str(row[category_col])
                            spend_by_category[cat] = spend_by_category.get(cat, 0) + spend

                    # Running price statistics
                    if price_col:
                        price = parse_number(row.get(price_col))
                        if price and price > 0:
                            price_count += 1
                            price_sum += price
                            price_sum_sq += price * price
                            price_min = min(price_min, price)
                            price_max = max(price_max, price)

                    # Get values for row insert
                    unit_price = parse_number(row.get(price_col)) if price_col else None
                    volume = parse_number(row.get(quantity_col)) if quantity_col else None

                    # Create row data
                    row_data = SpendDataRow(
                        spend_data_id=spend_data_id,
                        row_number=row_num,
                        supplier_name=str(row[supplier_col]) if supplier_col and pd.notna(row.get(supplier_col)) else None,
                        category=str(row[category_col]) if category_col and pd.notna(row.get(category_col)) else None,
                        spend_amount=spend if spend and spend > 0 else None,
                        country=str(row[country_col]) if country_col and pd.notna(row.get(country_col)) else None,
                        region=str(row[region_col]) if region_col and pd.notna(row.get(region_col)) else None,
                        volume=volume,
                        unit_price=unit_price,
                        raw_data=None  # Skip raw_data for large files to save space
                    )
                    rows_to_insert.append(row_data)

                    # Batch insert
                    if len(rows_to_insert) >= BATCH_SIZE:
                        return True  # Signal to commit batch
                return False

            # Process file in chunks
            logger.info(f"[SpendUpload] Starting chunked processing (chunk_size={CHUNK_SIZE})...")

            if file_type == "csv":
                # CSV: Use chunked reader
                chunk_iter = pd.read_csv(temp_path, chunksize=CHUNK_SIZE)
                start_row = 0
                for chunk_num, chunk_df in enumerate(chunk_iter):
                    process_chunk(chunk_df, start_row)
                    start_row += len(chunk_df)

                    # Commit batch if ready
                    if rows_to_insert and len(rows_to_insert) >= BATCH_SIZE:
                        db.add_all(rows_to_insert)
                        await db.commit()
                        logger.info(f"[SpendUpload] Processed {total_rows:,} rows...")
                        rows_to_insert = []

            else:
                # Excel: Read in chunks manually
                # Excel files need to be loaded, but we process in chunks
                excel_df = pd.read_excel(temp_path)
                for start_idx in range(0, len(excel_df), CHUNK_SIZE):
                    chunk_df = excel_df.iloc[start_idx:start_idx + CHUNK_SIZE]
                    process_chunk(chunk_df, start_idx)

                    if rows_to_insert and len(rows_to_insert) >= BATCH_SIZE:
                        db.add_all(rows_to_insert)
                        await db.commit()
                        logger.info(f"[SpendUpload] Processed {total_rows:,} rows...")
                        rows_to_insert = []

            # Insert remaining rows
            if rows_to_insert:
                db.add_all(rows_to_insert)
                await db.commit()

            logger.info(f"[SpendUpload] Completed processing {total_rows:,} total rows")

            # =====================
            # STEP 6: UPDATE SPEND_DATA WITH FINAL STATS
            # =====================
            # Calculate price statistics from running values
            price_stats = None
            if price_count > 0:
                avg_price = price_sum / price_count
                # Variance using running sums: Var = E[X^2] - E[X]^2
                variance = (price_sum_sq / price_count) - (avg_price * avg_price)
                std_dev = variance ** 0.5 if variance > 0 else 0
                price_stats = {
                    "min": price_min if price_min != float('inf') else 0,
                    "max": price_max if price_max != float('-inf') else 0,
                    "avg": avg_price,
                    "variance": (std_dev / avg_price * 100) if avg_price > 0 else 0
                }

            # Update the spend_data record with final values
            spend_data.row_count = total_rows
            spend_data.total_spend = total_spend
            spend_data.unique_suppliers = len(spend_by_supplier)
            spend_data.unique_locations = len(spend_by_location)
            spend_data.unique_categories = len(spend_by_category)
            spend_data.spend_by_supplier = spend_by_supplier
            spend_data.spend_by_location = spend_by_location
            spend_data.spend_by_category = spend_by_category
            spend_data.is_processed = True
            spend_data.processed_at = datetime.utcnow()

            await db.commit()

            logger.info(f"[SpendUpload] Final stats: {total_rows:,} rows, ${total_spend:,.0f} total spend, {len(spend_by_supplier)} suppliers")

            # =====================
            # STEP 7: FORMAT RESPONSE
            # =====================
            def format_top(data: dict, limit: int = 10) -> List[dict]:
                sorted_items = sorted(data.items(), key=lambda x: x[1], reverse=True)[:limit]
                return [
                    {
                        "name": name,
                        "spend": spend,
                        "percentage": round((spend / total_spend) * 100) if total_spend > 0 else 0
                    }
                    for name, spend in sorted_items
                ]

            return SpendSummaryResponse(
                success=True,
                session_id=str(session_id),
                category_name=category_name,
                file_name=file.filename,
                total_spend=total_spend,
                row_count=total_rows,
                supplier_count=len(spend_by_supplier),
                location_count=len(spend_by_location),
                top_suppliers=format_top(spend_by_supplier),
                top_locations=format_top(spend_by_location),
                detected_columns=detected,
                price_stats=price_stats,
                processed_at=datetime.utcnow().isoformat()
            )

        finally:
            # Clean up temp file
            shutil.rmtree(temp_dir, ignore_errors=True)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[SpendUpload] Error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process spend data: {str(e)}"
        )


@router.get("/spend/summary/{session_id}", response_model=SpendSummaryResponse)
async def get_spend_summary(
    session_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get pre-computed spend summary for instant display.

    This is what the frontend should call on page load.
    Returns INSTANT data - no processing, just database read.
    """
    from app.models.spend_data import SpendData
    from sqlalchemy import select

    try:
        # Fetch from database
        result = await db.execute(
            select(SpendData).where(SpendData.session_id == session_id)
        )
        spend_data = result.scalar_one_or_none()

        if not spend_data:
            raise HTTPException(
                status_code=404,
                detail="No spend data found for this session. Upload a file first."
            )

        # Format top items
        def format_top(data: dict, limit: int = 10) -> List[dict]:
            if not data:
                return []
            sorted_items = sorted(data.items(), key=lambda x: x[1], reverse=True)[:limit]
            total = spend_data.total_spend or 1
            return [
                {
                    "name": name,
                    "spend": spend,
                    "percentage": round((spend / total) * 100) if total > 0 else 0
                }
                for name, spend in sorted_items
            ]

        return SpendSummaryResponse(
            success=True,
            session_id=str(session_id),
            category_name="",  # Would need to join with session table
            file_name=spend_data.filename,
            total_spend=spend_data.total_spend or 0,
            row_count=spend_data.row_count,
            supplier_count=spend_data.unique_suppliers or 0,
            location_count=spend_data.unique_locations or 0,
            top_suppliers=format_top(spend_data.spend_by_supplier or {}),
            top_locations=format_top(spend_data.spend_by_location or {}),
            detected_columns=spend_data.column_mapping or {},
            processed_at=spend_data.processed_at.isoformat() if spend_data.processed_at else None
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[SpendSummary] Error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


class SpendRowResponse(BaseModel):
    """Individual spend row for paginated results."""
    id: str
    row_number: int
    supplier_name: Optional[str]
    category: Optional[str]
    spend_amount: Optional[float]
    country: Optional[str]
    region: Optional[str]
    volume: Optional[float]
    unit_price: Optional[float]
    raw_data: Optional[dict]


class PaginatedRowsResponse(BaseModel):
    """Paginated spend rows response."""
    success: bool
    session_id: str
    total_rows: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool
    rows: List[SpendRowResponse]


@router.get("/spend/rows/{session_id}", response_model=PaginatedRowsResponse)
async def get_spend_rows_paginated(
    session_id: UUID,
    page: int = 1,
    page_size: int = 100,
    supplier_filter: Optional[str] = None,
    country_filter: Optional[str] = None,
    category_filter: Optional[str] = None,
    sort_by: str = "row_number",
    sort_order: str = "asc",
    db: AsyncSession = Depends(get_db)
):
    """
    Get paginated spend data rows for efficient large dataset handling.

    Supports filtering by supplier, country, category.
    Supports sorting by any column.
    Default page size is 100 rows, max is 1000.

    Use this for virtual scrolling in the frontend.
    """
    from app.models.spend_data import SpendData, SpendDataRow
    from sqlalchemy import select, func, desc, asc

    # Validate page size
    page_size = min(max(page_size, 10), 1000)  # Between 10 and 1000
    page = max(page, 1)
    offset = (page - 1) * page_size

    try:
        # First get the SpendData to verify it exists
        spend_data_result = await db.execute(
            select(SpendData).where(SpendData.session_id == session_id)
        )
        spend_data = spend_data_result.scalar_one_or_none()

        if not spend_data:
            raise HTTPException(
                status_code=404,
                detail="No spend data found for this session"
            )

        # Build query for rows
        query = select(SpendDataRow).where(SpendDataRow.spend_data_id == spend_data.id)

        # Apply filters
        if supplier_filter:
            query = query.where(SpendDataRow.supplier_name.ilike(f"%{supplier_filter}%"))
        if country_filter:
            query = query.where(SpendDataRow.country.ilike(f"%{country_filter}%"))
        if category_filter:
            query = query.where(SpendDataRow.category.ilike(f"%{category_filter}%"))

        # Count total matching rows
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total_rows = total_result.scalar() or 0

        # Apply sorting
        sort_column = getattr(SpendDataRow, sort_by, SpendDataRow.row_number)
        if sort_order.lower() == "desc":
            query = query.order_by(desc(sort_column))
        else:
            query = query.order_by(asc(sort_column))

        # Apply pagination
        query = query.offset(offset).limit(page_size)

        # Execute query
        result = await db.execute(query)
        rows = result.scalars().all()

        # Calculate pagination info
        total_pages = (total_rows + page_size - 1) // page_size if total_rows > 0 else 1

        return PaginatedRowsResponse(
            success=True,
            session_id=str(session_id),
            total_rows=total_rows,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1,
            rows=[
                SpendRowResponse(
                    id=str(row.id),
                    row_number=row.row_number,
                    supplier_name=row.supplier_name,
                    category=row.category,
                    spend_amount=row.spend_amount,
                    country=row.country,
                    region=row.region,
                    volume=row.volume,
                    unit_price=row.unit_price,
                    raw_data=row.raw_data
                )
                for row in rows
            ]
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[SpendRows] Error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.delete("/spend/{session_id}")
async def delete_spend_data(
    session_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete all spend data for a session.
    Use this when user wants to clear their data completely.
    """
    from app.models.spend_data import SpendData
    from sqlalchemy import delete

    try:
        result = await db.execute(
            delete(SpendData).where(SpendData.session_id == session_id)
        )
        await db.commit()

        return {
            "success": True,
            "message": f"Deleted spend data for session {session_id}",
            "rows_deleted": result.rowcount
        }

    except Exception as e:
        logger.error(f"[SpendDelete] Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
