"""
Market Price Service - Intelligent Market Price Detection and Price Variance Analysis

This service:
1. Auto-detects market price data from uploaded files (spend data or separate market files)
2. Matches supplier prices to market prices by month and product/category
3. Calculates the new Price Variance formula:
   - Monthly deviation = (supplier_price - market_price) / market_price × 100
   - Classification: Below Market (<-10%), At Market (-10% to +10%), Above Market (>+10%)
   - Final impact based on majority classification across months
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from dataclasses import dataclass
from enum import Enum
import structlog
import re

logger = structlog.get_logger()


class PricePosition(str, Enum):
    """Classification of supplier price vs market price."""
    BELOW_MARKET = "Below Market"  # Favorable: supplier price < market price by >10%
    AT_MARKET = "At Market"        # Neutral: within ±10%
    ABOVE_MARKET = "Above Market"  # Unfavorable: supplier price > market price by >10%
    UNKNOWN = "Unknown"            # No market data available


@dataclass
class MonthlyPriceAnalysis:
    """Analysis of a single month's price comparison."""
    month: str  # YYYY-MM format
    supplier_price: float
    market_price: float
    deviation_pct: float
    position: PricePosition


@dataclass
class PriceVarianceResult:
    """Complete price variance analysis result."""
    overall_position: PricePosition
    overall_deviation_pct: float
    months_analyzed: int
    monthly_breakdown: List[MonthlyPriceAnalysis]
    below_market_months: int
    at_market_months: int
    above_market_months: int
    avg_supplier_price: float
    avg_market_price: float
    market_data_source: str  # Where market prices came from
    confidence: str  # High/Medium/Low based on data quality


class MarketPriceService:
    """
    Intelligent service for market price detection and price variance analysis.

    Detects market prices from:
    1. Same spend file (columns like 'market_price', 'benchmark_price', etc.)
    2. Separate market insights file (MarketInsights.xlsx format)
    3. Context data passed from frontend
    """

    # Columns that indicate market/benchmark prices
    MARKET_PRICE_COLUMNS = [
        'market_price', 'marketprice', 'market price',
        'benchmark_price', 'benchmarkprice', 'benchmark price',
        'market_rate', 'marketrate', 'market rate',
        'reference_price', 'referenceprice', 'reference price',
        'index_price', 'indexprice', 'index price',
        'avg_market', 'avgmarket', 'avg market',
        'market_avg', 'marketavg', 'market avg',
        'external_price', 'externalprice', 'external price',
    ]

    # Columns that indicate supplier prices (for matching)
    SUPPLIER_PRICE_COLUMNS = [
        'price', 'unit_price', 'unitprice', 'unit price',
        'supplier_price', 'supplierprice', 'supplier price',
        'purchase_price', 'purchaseprice', 'purchase price',
        'invoice_price', 'invoiceprice', 'invoice price',
        'cost', 'unit_cost', 'unitcost',
    ]

    # Columns that indicate date (for monthly matching)
    DATE_COLUMNS = [
        'date', 'transaction_date', 'transactiondate', 'transaction date',
        'invoice_date', 'invoicedate', 'invoice date',
        'purchase_date', 'purchasedate', 'purchase date',
        'month', 'period', 'year_month', 'yearmonth',
    ]

    # Columns that indicate category/product type
    CATEGORY_COLUMNS = [
        'category', 'product_category', 'productcategory', 'product category',
        'commodity', 'product_type', 'producttype', 'product type',
        'material', 'material_type', 'materialtype',
        'item_category', 'itemcategory', 'item category',
    ]

    def __init__(self):
        self._market_data_cache: Dict[str, pd.DataFrame] = {}

    def _normalize_column_name(self, col: str) -> str:
        """Normalize column name for matching."""
        return col.lower().strip().replace(' ', '').replace('_', '')

    def _find_column(self, df: pd.DataFrame, candidates: List[str]) -> Optional[str]:
        """Find a column matching any of the candidate names."""
        df_cols_normalized = {self._normalize_column_name(c): c for c in df.columns}

        for candidate in candidates:
            normalized = self._normalize_column_name(candidate)
            if normalized in df_cols_normalized:
                return df_cols_normalized[normalized]

        return None

    def _detect_market_price_in_spend_data(
        self,
        spend_data: pd.DataFrame
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Detect if spend data contains market price column.

        Returns:
            Tuple of (market_price_column, supplier_price_column) or (None, None)
        """
        market_col = self._find_column(spend_data, self.MARKET_PRICE_COLUMNS)
        supplier_col = self._find_column(spend_data, self.SUPPLIER_PRICE_COLUMNS)

        if market_col and supplier_col:
            logger.info(f"[MarketPrice] Found market price in spend data: {market_col}, supplier: {supplier_col}")
            return market_col, supplier_col

        return None, None

    def _detect_market_data_file(
        self,
        market_data: Optional[pd.DataFrame] = None
    ) -> bool:
        """Check if a separate market data file is provided and valid."""
        if market_data is None or market_data.empty:
            return False

        # Check for expected structure: Month column + price columns
        has_month = self._find_column(market_data, ['month', 'date', 'period'])
        has_prices = any(
            col.lower() not in ['month', 'date', 'period']
            for col in market_data.columns
        )

        return has_month is not None and has_prices

    def _extract_month(self, date_val: Any) -> Optional[str]:
        """Extract YYYY-MM format from various date representations."""
        if pd.isna(date_val):
            return None

        try:
            if isinstance(date_val, pd.Timestamp):
                return date_val.strftime('%Y-%m')
            elif isinstance(date_val, datetime):
                return date_val.strftime('%Y-%m')
            elif isinstance(date_val, str):
                # Try various formats
                for fmt in ['%Y-%m-%d', '%Y-%m', '%d/%m/%Y', '%m/%d/%Y', '%Y%m']:
                    try:
                        dt = datetime.strptime(date_val[:10], fmt)
                        return dt.strftime('%Y-%m')
                    except:
                        continue
                # Try extracting YYYY-MM pattern
                match = re.search(r'(\d{4})-(\d{2})', str(date_val))
                if match:
                    return f"{match.group(1)}-{match.group(2)}"
            return None
        except:
            return None

    def _classify_deviation(self, deviation_pct: float) -> PricePosition:
        """
        Classify price deviation.

        New formula thresholds:
        - Below Market: deviation < -10% (supplier price significantly below market = favorable)
        - At Market: -10% <= deviation <= +10% (within acceptable range)
        - Above Market: deviation > +10% (supplier price significantly above market = unfavorable)
        """
        if deviation_pct < -10:
            return PricePosition.BELOW_MARKET
        elif deviation_pct > 10:
            return PricePosition.ABOVE_MARKET
        else:
            return PricePosition.AT_MARKET

    def _match_category_to_market_column(
        self,
        category: str,
        market_columns: List[str]
    ) -> Optional[str]:
        """
        Match a category name to the appropriate market price column.

        Handles variations like:
        - "Palm Oil" -> "Palm Oil" column
        - "palm" -> "Palm Oil" column
        - "Edible Oils" -> "Avg Price" column (general average)
        """
        if not category:
            return None

        cat_lower = category.lower().strip()

        # Direct match
        for col in market_columns:
            if col.lower().strip() == cat_lower:
                return col

        # Partial match (category name in column or vice versa)
        for col in market_columns:
            col_lower = col.lower().strip()
            # Skip date/month columns
            if col_lower in ['month', 'date', 'period']:
                continue

            if cat_lower in col_lower or col_lower in cat_lower:
                return col

            # Word overlap
            cat_words = set(re.split(r'[\s\-_]+', cat_lower))
            col_words = set(re.split(r'[\s\-_]+', col_lower))
            if cat_words & col_words:
                return col

        # Fall back to average/general price column if exists
        for col in market_columns:
            col_lower = col.lower().strip()
            if 'avg' in col_lower or 'average' in col_lower or 'general' in col_lower:
                return col

        return None

    def analyze_price_variance(
        self,
        spend_data: pd.DataFrame,
        category: str = "",
        market_data: Optional[pd.DataFrame] = None,
        context_data: Optional[Dict[str, Any]] = None
    ) -> PriceVarianceResult:
        """
        Main method: Analyze price variance comparing supplier prices to market prices.

        Intelligently detects market prices from:
        1. spend_data itself (if it has market_price column)
        2. Separate market_data DataFrame
        3. Context data passed from frontend

        Args:
            spend_data: Spend data with supplier prices
            category: Category name for matching market prices
            market_data: Optional separate market price DataFrame
            context_data: Optional context with additional market info

        Returns:
            PriceVarianceResult with comprehensive analysis
        """
        logger.info(f"[MarketPrice] Analyzing price variance for category: {category}")

        # Try to find market prices in order of preference

        # 1. Check if spend_data has market price column
        market_col, supplier_col = self._detect_market_price_in_spend_data(spend_data)

        if market_col and supplier_col:
            return self._analyze_with_inline_market_price(
                spend_data, market_col, supplier_col, category
            )

        # 2. Check if separate market data file provided
        if market_data is not None and not market_data.empty:
            return self._analyze_with_separate_market_file(
                spend_data, market_data, category
            )

        # 3. Check context_data for market prices
        if context_data and 'market_prices' in context_data:
            return self._analyze_with_context_market_data(
                spend_data, context_data['market_prices'], category
            )

        # 4. No market data available - return unknown
        logger.warning("[MarketPrice] No market price data found")
        return PriceVarianceResult(
            overall_position=PricePosition.UNKNOWN,
            overall_deviation_pct=0,
            months_analyzed=0,
            monthly_breakdown=[],
            below_market_months=0,
            at_market_months=0,
            above_market_months=0,
            avg_supplier_price=0,
            avg_market_price=0,
            market_data_source="none",
            confidence="Low"
        )

    def _analyze_with_inline_market_price(
        self,
        spend_data: pd.DataFrame,
        market_col: str,
        supplier_col: str,
        category: str
    ) -> PriceVarianceResult:
        """Analyze when market price is in the same spend file."""
        logger.info(f"[MarketPrice] Using inline market price column: {market_col}")

        date_col = self._find_column(spend_data, self.DATE_COLUMNS)

        # Get valid rows with both prices
        valid_data = spend_data[
            (spend_data[supplier_col].notna()) &
            (spend_data[market_col].notna()) &
            (spend_data[supplier_col] > 0) &
            (spend_data[market_col] > 0)
        ].copy()

        if valid_data.empty:
            return self._empty_result("No valid price data", "inline")

        monthly_analyses = []

        if date_col:
            # Group by month
            valid_data['_month'] = valid_data[date_col].apply(self._extract_month)
            valid_data = valid_data[valid_data['_month'].notna()]

            for month, group in valid_data.groupby('_month'):
                avg_supplier = group[supplier_col].mean()
                avg_market = group[market_col].mean()

                if avg_market > 0:
                    deviation = ((avg_supplier - avg_market) / avg_market) * 100
                    position = self._classify_deviation(deviation)

                    monthly_analyses.append(MonthlyPriceAnalysis(
                        month=str(month),
                        supplier_price=avg_supplier,
                        market_price=avg_market,
                        deviation_pct=deviation,
                        position=position
                    ))
        else:
            # No date column - single overall analysis
            avg_supplier = valid_data[supplier_col].mean()
            avg_market = valid_data[market_col].mean()

            if avg_market > 0:
                deviation = ((avg_supplier - avg_market) / avg_market) * 100
                position = self._classify_deviation(deviation)

                monthly_analyses.append(MonthlyPriceAnalysis(
                    month="overall",
                    supplier_price=avg_supplier,
                    market_price=avg_market,
                    deviation_pct=deviation,
                    position=position
                ))

        return self._compile_result(monthly_analyses, "inline (spend data)")

    def _analyze_with_separate_market_file(
        self,
        spend_data: pd.DataFrame,
        market_data: pd.DataFrame,
        category: str
    ) -> PriceVarianceResult:
        """Analyze using separate market data file (e.g., MarketInsights.xlsx)."""
        logger.info(f"[MarketPrice] Using separate market file with {len(market_data)} rows")

        # Find supplier price column
        supplier_col = self._find_column(spend_data, self.SUPPLIER_PRICE_COLUMNS)
        if not supplier_col:
            return self._empty_result("No supplier price column found", "separate file")

        # Find date column in spend data
        spend_date_col = self._find_column(spend_data, self.DATE_COLUMNS)

        # Find month column in market data
        market_month_col = self._find_column(market_data, ['month', 'date', 'period'])

        # Find the right market price column for the category
        market_price_columns = [c for c in market_data.columns
                               if c.lower() not in ['month', 'date', 'period']]

        market_price_col = self._match_category_to_market_column(category, market_price_columns)

        if not market_price_col:
            # Use first numeric column or average
            for col in market_price_columns:
                if market_data[col].dtype in ['int64', 'float64']:
                    market_price_col = col
                    break

        if not market_price_col:
            return self._empty_result("No market price column matched", "separate file")

        logger.info(f"[MarketPrice] Matched category '{category}' to market column: {market_price_col}")

        # Build market price lookup by month
        market_lookup = {}
        if market_month_col:
            for _, row in market_data.iterrows():
                month = self._extract_month(row[market_month_col])
                if month:
                    market_lookup[month] = row[market_price_col]

        if not market_lookup:
            # No monthly data - use average
            avg_market = market_data[market_price_col].mean()
            market_lookup = {"overall": avg_market}

        monthly_analyses = []

        # Get valid supplier prices
        valid_spend = spend_data[
            (spend_data[supplier_col].notna()) &
            (spend_data[supplier_col] > 0)
        ].copy()

        if spend_date_col and len(market_lookup) > 1:
            # Monthly analysis
            valid_spend['_month'] = valid_spend[spend_date_col].apply(self._extract_month)
            valid_spend = valid_spend[valid_spend['_month'].notna()]

            for month, group in valid_spend.groupby('_month'):
                avg_supplier = group[supplier_col].mean()
                market_price = market_lookup.get(str(month))

                if market_price is None:
                    # Try to find closest month
                    continue

                # Handle unit mismatch (spend might be per unit, market might be per MT)
                # Common case: spend data is $/kg, market data is $/MT (metric ton = 1000kg)
                # ratio = supplier/market: if < 0.01, market is ~100x larger ($/MT vs $/kg)
                ratio = avg_supplier / market_price if market_price > 0 else 0

                if ratio < 0.01:
                    # Supplier is $/kg (~$1-3), Market is $/MT (~$1000)
                    # Convert market to $/kg by dividing by 1000
                    market_price = market_price / 1000
                elif ratio > 100:
                    # Opposite case: supplier is $/MT, market is $/kg
                    # Convert market to $/MT by multiplying by 1000
                    market_price = market_price * 1000

                if market_price > 0:
                    deviation = ((avg_supplier - market_price) / market_price) * 100
                    position = self._classify_deviation(deviation)

                    monthly_analyses.append(MonthlyPriceAnalysis(
                        month=str(month),
                        supplier_price=avg_supplier,
                        market_price=market_price,
                        deviation_pct=deviation,
                        position=position
                    ))
        else:
            # Overall analysis
            avg_supplier = valid_spend[supplier_col].mean()
            market_price = list(market_lookup.values())[0] if market_lookup else 0

            if market_price > 0:
                # Handle unit mismatch (same logic as monthly analysis)
                ratio = avg_supplier / market_price
                if ratio < 0.01:
                    # Supplier is $/kg, Market is $/MT → convert market to $/kg
                    market_price = market_price / 1000
                elif ratio > 100:
                    # Supplier is $/MT, Market is $/kg → convert market to $/MT
                    market_price = market_price * 1000

                deviation = ((avg_supplier - market_price) / market_price) * 100
                position = self._classify_deviation(deviation)

                monthly_analyses.append(MonthlyPriceAnalysis(
                    month="overall",
                    supplier_price=avg_supplier,
                    market_price=market_price,
                    deviation_pct=deviation,
                    position=position
                ))

        return self._compile_result(monthly_analyses, f"separate file ({market_price_col})")

    def _analyze_with_context_market_data(
        self,
        spend_data: pd.DataFrame,
        market_prices: Dict[str, float],
        category: str
    ) -> PriceVarianceResult:
        """Analyze using market prices from context (frontend-provided)."""
        logger.info(f"[MarketPrice] Using context-provided market prices")

        supplier_col = self._find_column(spend_data, self.SUPPLIER_PRICE_COLUMNS)
        if not supplier_col:
            return self._empty_result("No supplier price column", "context")

        valid_spend = spend_data[
            (spend_data[supplier_col].notna()) &
            (spend_data[supplier_col] > 0)
        ]

        if valid_spend.empty:
            return self._empty_result("No valid supplier prices", "context")

        avg_supplier = valid_spend[supplier_col].mean()

        # Get market price from context
        market_price = market_prices.get(category) or market_prices.get('default', 0)

        if market_price <= 0:
            return self._empty_result("No market price for category", "context")

        deviation = ((avg_supplier - market_price) / market_price) * 100
        position = self._classify_deviation(deviation)

        monthly_analyses = [MonthlyPriceAnalysis(
            month="overall",
            supplier_price=avg_supplier,
            market_price=market_price,
            deviation_pct=deviation,
            position=position
        )]

        return self._compile_result(monthly_analyses, "context data")

    def _compile_result(
        self,
        monthly_analyses: List[MonthlyPriceAnalysis],
        source: str
    ) -> PriceVarianceResult:
        """
        Compile monthly analyses into overall result.

        NEW CLASSIFICATION LOGIC (Buyer Lens):

        Step 1: Compute monthly variance = (supplier - market) / market × 100
            - Negative = Good (below market)
            - Positive = Risk (above market)

        Step 2: Count months by deviation thresholds:
            - months_above_5pct: deviation > +5%
            - months_above_10pct: deviation > +10%
            - months_above_20pct: deviation > +20%
            - months_at_or_below_market: deviation <= 0%

        Step 3: Classify impact:

        🟢 LOW Impact (Bundling Friendly):
            - At or below market (≤ 0%) for majority of months
            - No more than 1 month > +5% above market
            - No month > +10%

        🟠 MEDIUM Impact:
            - 1-2 months > +10% above market
            - OR 3-4 months between +5% to +10%
            - OR inconsistent pattern but no sustained overpricing

        🔴 HIGH Impact:
            - ≥3 months > +10% above market
            - OR ≥5 months > +5% above market
            - OR Any single month > +20% above market
        """
        if not monthly_analyses:
            return self._empty_result("No monthly analyses", source)

        total = len(monthly_analyses)

        # Count months by deviation thresholds
        months_at_or_below_market = sum(1 for m in monthly_analyses if m.deviation_pct <= 0)
        months_above_5pct = sum(1 for m in monthly_analyses if m.deviation_pct > 5)
        months_above_10pct = sum(1 for m in monthly_analyses if m.deviation_pct > 10)
        months_above_20pct = sum(1 for m in monthly_analyses if m.deviation_pct > 20)
        months_between_5_and_10 = sum(1 for m in monthly_analyses if 5 < m.deviation_pct <= 10)

        # Legacy position counts (for backward compatibility)
        below_count = sum(1 for m in monthly_analyses if m.position == PricePosition.BELOW_MARKET)
        at_count = sum(1 for m in monthly_analyses if m.position == PricePosition.AT_MARKET)
        above_count = sum(1 for m in monthly_analyses if m.position == PricePosition.ABOVE_MARKET)

        # =====================================================================
        # NEW CLASSIFICATION LOGIC (Buyer Lens)
        # =====================================================================

        # 🔴 HIGH Impact: Sustained overpricing risk
        if (months_above_10pct >= 3 or              # ≥3 months > +10%
            months_above_5pct >= 5 or               # ≥5 months > +5%
            months_above_20pct >= 1):               # Any single month > +20%
            overall_position = PricePosition.ABOVE_MARKET

        # 🟢 LOW Impact: Bundling friendly, competitive pricing
        elif (months_at_or_below_market > total / 2 and   # Majority at/below market
              months_above_5pct <= 1 and                   # No more than 1 month > +5%
              months_above_10pct == 0):                    # No month > +10%
            overall_position = PricePosition.BELOW_MARKET

        # 🟠 MEDIUM Impact: Some pricing discipline gaps
        else:
            # This captures:
            # - 1-2 months > +10%
            # - 3-4 months between +5% to +10%
            # - Inconsistent patterns
            overall_position = PricePosition.AT_MARKET

        # Average deviation
        avg_deviation = np.mean([m.deviation_pct for m in monthly_analyses])
        avg_supplier = np.mean([m.supplier_price for m in monthly_analyses])
        avg_market = np.mean([m.market_price for m in monthly_analyses])

        # Confidence based on data quality
        if total >= 6:
            confidence = "High"
        elif total >= 3:
            confidence = "Medium"
        else:
            confidence = "Low"

        logger.info(
            f"[MarketPrice] Classification: {overall_position.value} | "
            f"Months: {total} | At/Below: {months_at_or_below_market} | "
            f">5%: {months_above_5pct} | >10%: {months_above_10pct} | >20%: {months_above_20pct}"
        )

        return PriceVarianceResult(
            overall_position=overall_position,
            overall_deviation_pct=avg_deviation,
            months_analyzed=total,
            monthly_breakdown=monthly_analyses,
            below_market_months=below_count,
            at_market_months=at_count,
            above_market_months=above_count,
            avg_supplier_price=avg_supplier,
            avg_market_price=avg_market,
            market_data_source=source,
            confidence=confidence
        )

    def _empty_result(self, reason: str, source: str) -> PriceVarianceResult:
        """Return empty result when analysis cannot be performed."""
        logger.warning(f"[MarketPrice] Empty result: {reason}")
        return PriceVarianceResult(
            overall_position=PricePosition.UNKNOWN,
            overall_deviation_pct=0,
            months_analyzed=0,
            monthly_breakdown=[],
            below_market_months=0,
            at_market_months=0,
            above_market_months=0,
            avg_supplier_price=0,
            avg_market_price=0,
            market_data_source=source,
            confidence="Low"
        )


# Singleton instance
_market_price_service: Optional[MarketPriceService] = None


def get_market_price_service() -> MarketPriceService:
    """Get or create singleton instance."""
    global _market_price_service
    if _market_price_service is None:
        _market_price_service = MarketPriceService()
    return _market_price_service
