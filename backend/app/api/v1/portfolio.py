"""
Portfolio Endpoints
Manage user's procurement portfolio - categories and locations.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
import uuid
import pandas as pd
import io

from app.database import get_db
from app.models.user import User
from app.models.portfolio import PortfolioCategory, PortfolioLocation
from app.models.spend_data import SpendData
from app.models.session import AnalysisSession
from app.api.v1.auth import get_current_user
from app.schemas.portfolio import (
    PortfolioCategoryCreate,
    PortfolioCategoryUpdate,
    PortfolioCategoryResponse,
    PortfolioCategorySimple,
    PortfolioResponse,
    CategoryCreateResponse,
    CategoryDeleteResponse,
    SpendDataResponse,
    SpendUploadResponse,
    PortfolioDataResponse,
    LocationListResponse,
)

router = APIRouter()

# Available locations (from frontend AVAILABLE_LOCATIONS)
AVAILABLE_LOCATIONS = [
    # Regions
    "North America", "South America", "Europe", "Asia Pacific", "Middle East", "Africa",
    "Central America", "Caribbean", "Eastern Europe", "Western Europe", "Northern Europe",
    "Southern Europe", "East Asia", "Southeast Asia", "South Asia", "Central Asia",
    "Oceania", "Sub-Saharan Africa", "North Africa",
    # Major Countries
    "United States", "Canada", "Mexico", "Brazil", "Argentina", "Chile", "Colombia", "Peru",
    "United Kingdom", "Germany", "France", "Italy", "Spain", "Netherlands", "Belgium",
    "Switzerland", "Austria", "Sweden", "Norway", "Denmark", "Finland", "Poland",
    "Czech Republic", "Hungary", "Romania", "Greece", "Portugal", "Ireland",
    "China", "Japan", "South Korea", "India", "Indonesia", "Thailand", "Vietnam",
    "Malaysia", "Singapore", "Philippines", "Taiwan", "Hong Kong", "Bangladesh", "Pakistan",
    "Australia", "New Zealand",
    "Russia", "Turkey", "Ukraine", "Kazakhstan",
    "Saudi Arabia", "United Arab Emirates", "Israel", "Qatar", "Kuwait", "Egypt",
    "South Africa", "Nigeria", "Kenya", "Morocco", "Ghana", "Ethiopia",
    # US States
    "California", "Texas", "New York", "Florida", "Illinois", "Pennsylvania", "Ohio",
    "Georgia", "North Carolina", "Michigan", "New Jersey", "Virginia", "Washington",
    "Arizona", "Massachusetts", "Tennessee", "Indiana", "Missouri", "Maryland", "Wisconsin",
    "Colorado", "Minnesota", "South Carolina", "Alabama", "Louisiana", "Kentucky", "Oregon",
    "Oklahoma", "Connecticut", "Iowa", "Utah", "Nevada", "Arkansas", "Mississippi", "Kansas",
    # Canadian Provinces
    "Ontario", "Quebec", "British Columbia", "Alberta", "Manitoba", "Saskatchewan",
    # Major Cities
    "New York City", "Los Angeles", "Chicago", "Houston", "Phoenix", "San Francisco",
    "Seattle", "Boston", "Atlanta", "Miami", "Dallas", "Denver",
    "London", "Paris", "Berlin", "Munich", "Frankfurt", "Amsterdam", "Brussels", "Madrid",
    "Barcelona", "Milan", "Rome", "Vienna", "Zurich", "Stockholm", "Copenhagen",
    "Tokyo", "Shanghai", "Beijing", "Hong Kong", "Singapore", "Seoul", "Mumbai", "Delhi",
    "Bangalore", "Sydney", "Melbourne", "Dubai", "Tel Aviv", "São Paulo", "Mexico City",
]


@router.get("", response_model=PortfolioResponse)
async def get_portfolio(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user's full portfolio with all categories.
    """
    result = await db.execute(
        select(PortfolioCategory)
        .where(PortfolioCategory.user_id == current_user.id)
        .options(selectinload(PortfolioCategory.locations))
        .order_by(PortfolioCategory.sort_order, PortfolioCategory.created_at)
    )
    categories = result.scalars().all()

    return PortfolioResponse.from_categories(categories)


@router.post("/category", response_model=CategoryCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_data: PortfolioCategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Add a new category to the portfolio.
    Returns format: {success: true, data: {id, name, spend, locations}}
    """
    # Get max sort order
    result = await db.execute(
        select(PortfolioCategory.sort_order)
        .where(PortfolioCategory.user_id == current_user.id)
        .order_by(PortfolioCategory.sort_order.desc())
        .limit(1)
    )
    max_order = result.scalar_one_or_none() or 0

    # Create category
    category = PortfolioCategory(
        user_id=current_user.id,
        name=category_data.name,
        spend=category_data.spend,
        currency=category_data.currency,
        description=category_data.description,
        industry=category_data.industry,
        sort_order=max_order + 1
    )

    db.add(category)
    await db.flush()

    # Add locations if provided
    if category_data.locations:
        for loc_name in category_data.locations[:10]:  # Limit to 10 locations
            location = PortfolioLocation(
                category_id=category.id,
                name=loc_name
            )
            db.add(location)

    await db.commit()

    # Reload with locations
    result = await db.execute(
        select(PortfolioCategory)
        .where(PortfolioCategory.id == category.id)
        .options(selectinload(PortfolioCategory.locations))
    )
    category = result.scalar_one()

    return CategoryCreateResponse(
        success=True,
        data=PortfolioCategorySimple.from_model(category)
    )


@router.get("/category/{category_id}", response_model=PortfolioCategoryResponse)
async def get_category(
    category_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific category by ID.
    """
    result = await db.execute(
        select(PortfolioCategory)
        .where(
            PortfolioCategory.id == category_id,
            PortfolioCategory.user_id == current_user.id
        )
        .options(selectinload(PortfolioCategory.locations))
    )
    category = result.scalar_one_or_none()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )

    return PortfolioCategoryResponse.from_model(category)


@router.put("/category/{category_id}", response_model=CategoryCreateResponse)
async def update_category(
    category_id: uuid.UUID,
    category_data: PortfolioCategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a category.
    Returns format: {success: true, data: {id, name, spend, locations}}
    """
    result = await db.execute(
        select(PortfolioCategory)
        .where(
            PortfolioCategory.id == category_id,
            PortfolioCategory.user_id == current_user.id
        )
        .options(selectinload(PortfolioCategory.locations))
    )
    category = result.scalar_one_or_none()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )

    # Update fields
    update_data = category_data.model_dump(exclude_unset=True, exclude={"locations"})
    for field, value in update_data.items():
        setattr(category, field, value)

    # Update locations if provided
    if category_data.locations is not None:
        # Delete existing locations
        await db.execute(
            delete(PortfolioLocation).where(PortfolioLocation.category_id == category_id)
        )

        # Add new locations
        for loc_name in category_data.locations[:10]:
            location = PortfolioLocation(
                category_id=category.id,
                name=loc_name
            )
            db.add(location)

    await db.commit()

    # Reload
    result = await db.execute(
        select(PortfolioCategory)
        .where(PortfolioCategory.id == category_id)
        .options(selectinload(PortfolioCategory.locations))
    )
    category = result.scalar_one()

    return CategoryCreateResponse(
        success=True,
        data=PortfolioCategorySimple.from_model(category)
    )


@router.delete("/category/{category_id}", response_model=CategoryDeleteResponse)
async def delete_category(
    category_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a category from the portfolio.
    Returns format: {success: true, deleted: {id, name, spend, locations}}
    """
    result = await db.execute(
        select(PortfolioCategory)
        .where(
            PortfolioCategory.id == category_id,
            PortfolioCategory.user_id == current_user.id
        )
        .options(selectinload(PortfolioCategory.locations))
    )
    category = result.scalar_one_or_none()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )

    # Store data for response before deletion
    deleted_data = PortfolioCategorySimple.from_model(category)

    await db.delete(category)
    await db.commit()

    return CategoryDeleteResponse(
        success=True,
        deleted=deleted_data
    )


@router.post("/category/{category_id}/location", response_model=CategoryCreateResponse)
async def add_location(
    category_id: uuid.UUID,
    location: str = Form(..., min_length=1, max_length=255),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Add a location to a category.
    Accepts FormData with 'location' field.
    Returns format: {success: true, data: {id, name, spend, locations}}
    """
    result = await db.execute(
        select(PortfolioCategory)
        .where(
            PortfolioCategory.id == category_id,
            PortfolioCategory.user_id == current_user.id
        )
        .options(selectinload(PortfolioCategory.locations))
    )
    category = result.scalar_one_or_none()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )

    # Check max locations
    if len(category.locations) >= 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 10 locations per category"
        )

    # Check if already exists
    if location in [loc.name for loc in category.locations]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Location already exists in this category"
        )

    new_location = PortfolioLocation(
        category_id=category.id,
        name=location
    )
    db.add(new_location)
    await db.commit()

    # Reload
    result = await db.execute(
        select(PortfolioCategory)
        .where(PortfolioCategory.id == category_id)
        .options(selectinload(PortfolioCategory.locations))
    )
    category = result.scalar_one()

    return CategoryCreateResponse(
        success=True,
        data=PortfolioCategorySimple.from_model(category)
    )


@router.delete("/category/{category_id}/location/{location_name:path}", response_model=CategoryCreateResponse)
async def remove_location(
    category_id: uuid.UUID,
    location_name: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Remove a location from a category.
    Returns format: {success: true, data: {id, name, spend, locations}}
    """
    result = await db.execute(
        select(PortfolioCategory)
        .where(
            PortfolioCategory.id == category_id,
            PortfolioCategory.user_id == current_user.id
        )
    )
    category = result.scalar_one_or_none()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )

    # Find and delete the location (URL decode the location name)
    from urllib.parse import unquote
    decoded_location = unquote(location_name)

    result = await db.execute(
        delete(PortfolioLocation).where(
            PortfolioLocation.category_id == category_id,
            PortfolioLocation.name == decoded_location
        )
    )

    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found in this category"
        )

    await db.commit()

    # Reload and return updated category
    result = await db.execute(
        select(PortfolioCategory)
        .where(PortfolioCategory.id == category_id)
        .options(selectinload(PortfolioCategory.locations))
    )
    category = result.scalar_one()

    return CategoryCreateResponse(
        success=True,
        data=PortfolioCategorySimple.from_model(category)
    )


@router.get("/locations", response_model=LocationListResponse)
async def get_available_locations(
    search: Optional[str] = Query(None, min_length=1),
    limit: int = Query(50, ge=1, le=200)
):
    """
    Get list of available locations for portfolio.
    Optionally filter by search term.
    """
    locations = AVAILABLE_LOCATIONS

    if search:
        search_lower = search.lower()
        locations = [
            loc for loc in locations
            if search_lower in loc.lower()
        ]

    return LocationListResponse(
        locations=locations[:limit],
        total=len(locations)
    )


@router.post("/upload", response_model=SpendUploadResponse)
async def upload_spend_data(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload CSV/Excel file to populate portfolio categories.
    Parses the file and creates categories based on spend data.
    Returns format: {success: true, message: str, data: {categories, total_spend, total_categories, total_rows}}
    """
    # Validate file type
    filename = file.filename or ""
    if not filename.lower().endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be CSV or Excel format"
        )

    try:
        # Read file content
        content = await file.read()

        # Parse based on file type
        if filename.lower().endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))

        # Normalize column names
        df.columns = [col.lower().strip().replace(' ', '_') for col in df.columns]

        # Find category and spend columns
        category_col = None
        spend_col = None

        for col in df.columns:
            if any(term in col for term in ['category', 'cat', 'type', 'group']):
                category_col = col
            if any(term in col for term in ['spend', 'amount', 'value', 'total', 'cost']):
                spend_col = col

        if not category_col:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not find category column in file"
            )

        if not spend_col:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not find spend/amount column in file"
            )

        # Find location column if exists
        location_col = None
        for col in df.columns:
            if any(term in col for term in ['location', 'region', 'country', 'geography']):
                location_col = col
                break

        # Group by category
        category_spend = df.groupby(category_col)[spend_col].sum().reset_index()

        # Get locations per category if available
        category_locations = {}
        if location_col:
            for cat in category_spend[category_col].unique():
                cat_df = df[df[category_col] == cat]
                locations = cat_df[location_col].dropna().unique().tolist()[:10]
                category_locations[cat] = locations

        # Create categories in database
        created_categories = []
        for _, row in category_spend.iterrows():
            cat_name = str(row[category_col])
            cat_spend = float(row[spend_col])

            # Check if category exists
            result = await db.execute(
                select(PortfolioCategory)
                .where(
                    PortfolioCategory.user_id == current_user.id,
                    PortfolioCategory.name == cat_name
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                # Update existing
                existing.spend = cat_spend
                category = existing
            else:
                # Create new
                category = PortfolioCategory(
                    user_id=current_user.id,
                    name=cat_name,
                    spend=cat_spend,
                )
                db.add(category)
                await db.flush()

            # Add locations
            if cat_name in category_locations:
                for loc_name in category_locations[cat_name]:
                    location = PortfolioLocation(
                        category_id=category.id,
                        name=loc_name
                    )
                    db.add(location)

            created_categories.append(category)

        await db.commit()

        # Reload all categories
        result = await db.execute(
            select(PortfolioCategory)
            .where(PortfolioCategory.user_id == current_user.id)
            .options(selectinload(PortfolioCategory.locations))
            .order_by(PortfolioCategory.sort_order)
        )
        all_categories = result.scalars().all()

        total_spend = sum(cat.spend for cat in all_categories)

        return SpendUploadResponse(
            success=True,
            message=f"Successfully processed {len(df)} rows into {len(created_categories)} categories",
            data=PortfolioDataResponse(
                categories=[PortfolioCategorySimple.from_model(cat) for cat in all_categories],
                total_spend=total_spend,
                total_categories=len(all_categories)
            )
        )

    except pd.errors.EmptyDataError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing file: {str(e)}"
        )


@router.get("/spend-data", response_model=SpendDataResponse)
async def get_spend_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get raw spend data for the user's active session.
    Returns format: {success: true, data: {columns, rows, sample} | null, message?: str}
    """
    # Get most recent session with spend data
    result = await db.execute(
        select(AnalysisSession)
        .where(AnalysisSession.user_id == current_user.id)
        .order_by(AnalysisSession.created_at.desc())
        .limit(1)
    )
    session = result.scalar_one_or_none()

    if not session:
        return SpendDataResponse(
            success=True,
            data=None,
            message="No active session found"
        )

    # Get spend data for session
    spend_result = await db.execute(
        select(SpendData)
        .where(SpendData.session_id == session.id)
        .limit(100)  # Limit for sample
    )
    spend_records = spend_result.scalars().all()

    if not spend_records:
        return SpendDataResponse(
            success=True,
            data=None,
            message="No spend data uploaded yet"
        )

    # Build sample data
    sample = []
    columns = set()
    for record in spend_records[:20]:  # First 20 for sample
        row = {
            "supplier_name": record.supplier_name,
            "category": record.category,
            "spend_amount": float(record.spend_amount) if record.spend_amount else None,
            "unit_price": float(record.unit_price) if record.unit_price else None,
            "quantity": float(record.quantity) if record.quantity else None,
            "region": record.region,
            "country": record.country,
            "currency": record.currency,
        }
        sample.append(row)
        columns.update(k for k, v in row.items() if v is not None)

    return SpendDataResponse(
        success=True,
        data={
            "columns": list(columns),
            "rows": len(spend_records),
            "sample": sample
        }
    )
