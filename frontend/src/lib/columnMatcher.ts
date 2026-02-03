/**
 * Smart Column Matcher
 * Intelligently detects column types from any naming convention
 */

// Column type definitions with extensive patterns
export type ColumnType =
  | 'supplier'
  | 'spend'
  | 'country'
  | 'region'
  | 'price'
  | 'quantity'
  | 'category'
  | 'date'
  | 'contract'
  | 'risk'
  | 'currency'
  | 'description'
  | 'id'
  | 'status'
  | 'unknown';

// Patterns for each column type - ordered by priority (most specific first)
const COLUMN_PATTERNS: Record<ColumnType, string[]> = {
  supplier: [
    'suppliername', 'vendorname', 'sellername', 'providername',
    'supplier', 'vendor', 'seller', 'provider', 'manufacturer',
    'company', 'firm', 'merchant', 'contractor'
    // Removed short patterns that cause false matches
  ],
  spend: [
    'extendedlineamount', 'lineamount', 'totalamount', 'spendamount',
    'invoicedamount', 'purchaseamount', 'orderamount', 'annualspend',
    'totalspend', 'totalvalue', 'spendvalue', 'purchasevalue',
    'spend', 'expenditure', 'disbursement', 'outlay', 'payment',
    'extended', 'invoice', 'amount', 'value', 'total'
    // Note: 'amount', 'value', 'total' are generic but commonly used for spend
  ],
  country: [
    'suppliercountry', 'buyercountry', 'vendorcountry', 'shipcountry',
    'country', 'nation'
    // Removed short/generic patterns
  ],
  region: [
    'supplierregion', 'buyerregion', 'vendorregion',
    'region', 'geography', 'territory',
    'emea', 'apac', 'latam', 'americas'
    // Removed 'location' as it's too generic
  ],
  price: [
    'unitprice', 'unitcost', 'priceperunit', 'costperunit',
    'priceinvoiced', 'pricecontracted', 'targetprice', 'marketprice',
    'unitpriceinvoiced', 'unitpricecontracted', 'targetunitprice',
    'price'
    // Removed generic 'rate', 'cost', 'unit', 'per' that match unintended columns
  ],
  quantity: [
    'orderedquantity', 'receivedquantity', 'invoicedquantity', 'shippedquantity',
    'quantity', 'qty', 'volume', 'units',
    'ordered', 'received', 'invoiced', 'shipped', 'delivered'
    // Removed 'count', 'number', 'amount' that are too generic
  ],
  category: [
    'category', 'segment', 'classification', 'type', 'class', 'group',
    'commodity', 'product', 'service', 'material', 'goods',
    'division', 'department', 'section', 'line',
    'cat', 'seg', 'cls', 'grp'
  ],
  date: [
    'date', 'time', 'period', 'year', 'month', 'day', 'week', 'quarter',
    'start', 'end', 'begin', 'finish', 'from', 'to', 'due', 'effective',
    'created', 'modified', 'updated', 'posted', 'processed',
    'dt', 'yr', 'mo', 'qtr'
  ],
  contract: [
    'contract', 'agreement', 'deal', 'arrangement', 'terms',
    'po', 'purchase', 'order', 'requisition', 'request',
    'ctr', 'agr', 'ord'
  ],
  risk: [
    'risk', 'rating', 'score', 'level', 'grade', 'tier',
    'assessment', 'evaluation', 'ranking',
    'high', 'medium', 'low', 'critical'
  ],
  currency: [
    'currency', 'curr', 'ccy', 'money', 'monetary',
    'usd', 'eur', 'gbp', 'jpy', 'cny', 'inr'
  ],
  description: [
    'description', 'desc', 'detail', 'note', 'comment', 'remark',
    'specification', 'spec', 'info', 'information', 'text',
    'name', 'title', 'label'
  ],
  id: [
    'id', 'code', 'number', 'key', 'identifier', 'reference',
    'num', 'no', 'ref', 'idx'
  ],
  status: [
    'status', 'state', 'condition', 'phase', 'stage',
    'active', 'inactive', 'pending', 'approved', 'rejected',
    'sts', 'stat'
  ],
  unknown: []
};

// Normalize a string for comparison (lowercase, remove special chars)
const normalize = (str: string): string => {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
};

// Negative patterns - columns that should NOT match certain types
const NEGATIVE_PATTERNS: Partial<Record<ColumnType, string[]>> = {
  price: ['proof', 'point', 'primary', 'secondary', 'benchmark', 'reference', 'market'],
  spend: ['proof', 'point', 'benchmark', 'target', 'market'],
};

// Check if a header matches a pattern
const matchesPattern = (normalizedHeader: string, patterns: string[]): boolean => {
  for (const pattern of patterns) {
    const normalizedPattern = normalize(pattern);
    // Only check if header contains the pattern (not bidirectional)
    if (normalizedHeader.includes(normalizedPattern)) {
      return true;
    }
  }
  return false;
};

// Check if header should be excluded based on negative patterns
const hasNegativeMatch = (normalizedHeader: string, type: ColumnType): boolean => {
  const negatives = NEGATIVE_PATTERNS[type];
  if (!negatives) return false;

  for (const negative of negatives) {
    if (normalizedHeader.includes(negative)) {
      return true;
    }
  }
  return false;
};

// Special check for supplier - prefer Name over ID/Code
const isSupplierNameColumn = (normalizedHeader: string): boolean => {
  return normalizedHeader.includes('name') &&
         (normalizedHeader.includes('supplier') ||
          normalizedHeader.includes('vendor') ||
          normalizedHeader.includes('seller') ||
          normalizedHeader.includes('provider'));
};

const isSupplierIdColumn = (normalizedHeader: string): boolean => {
  return !normalizedHeader.includes('name') &&
         (normalizedHeader.includes('id') ||
          normalizedHeader.includes('code') ||
          normalizedHeader.includes('number') ||
          normalizedHeader.includes('key') ||
          normalizedHeader.includes('ref'));
};

// Detect the type of a single column
export const detectColumnType = (header: string): ColumnType => {
  const normalized = normalize(header);

  // Check each type in priority order
  const types: ColumnType[] = [
    'supplier', 'spend', 'country', 'region', 'price', 'quantity',
    'category', 'date', 'contract', 'risk', 'currency', 'description', 'id', 'status'
  ];

  for (const type of types) {
    if (matchesPattern(normalized, COLUMN_PATTERNS[type])) {
      return type;
    }
  }

  return 'unknown';
};

// Find the best column for a given type from a list of headers
export const findColumnByType = (headers: string[], type: ColumnType, excludeColumns: string[] = []): string | null => {
  const patterns = COLUMN_PATTERNS[type];
  if (!patterns || patterns.length === 0) return null;

  // Score each header
  const scored: { header: string; score: number }[] = [];

  for (const header of headers) {
    if (excludeColumns.includes(header)) continue;

    const normalized = normalize(header);

    // Skip if header matches negative patterns for this type
    if (hasNegativeMatch(normalized, type)) {
      continue;
    }

    let score = 0;

    for (let i = 0; i < patterns.length; i++) {
      const normalizedPattern = normalize(patterns[i]);

      // Exact match (highest score)
      if (normalized === normalizedPattern) {
        score = 1000;
        break;
      }

      // Header contains pattern - prefer longer pattern matches and patterns earlier in the list
      if (normalized.includes(normalizedPattern)) {
        // Score based on: pattern length (longer = better) + position in pattern list (earlier = better)
        const patternScore = 100 + normalizedPattern.length * 10 - i;
        score = Math.max(score, patternScore);
      }
    }

    // Supplier-specific scoring
    if (type === 'supplier') {
      // Strong bonus for Name columns
      if (isSupplierNameColumn(normalized)) {
        score += 100;
      }
      // Penalty for ID/Code columns (still match, but lower priority)
      else if (isSupplierIdColumn(normalized)) {
        score -= 50;
      }
      // Generic name bonus
      else if (normalized.includes('name')) {
        score += 50;
      }
    }

    // Bonus for price columns with "unit" or "invoiced" (more specific)
    if (type === 'price') {
      if (normalized.includes('unit')) score += 30;
      if (normalized.includes('invoiced')) score += 20;
      if (normalized.includes('contracted')) score += 20;
    }

    // Bonus for spend columns with "extended" or "total" or "amount"
    if (type === 'spend') {
      if (normalized.includes('extended')) score += 40;
      if (normalized.includes('total')) score += 30;
      if (normalized.includes('amount')) score += 20;
      if (normalized.includes('line')) score += 15;
    }

    if (score > 0) {
      scored.push({ header, score });
    }
  }

  // Sort by score and return best match
  scored.sort((a, b) => b.score - a.score);
  return scored.length > 0 ? scored[0].header : null;
};

// Smart column detection - finds all relevant columns in a dataset
export interface DetectedColumns {
  supplier: string | null;
  spend: string | null;
  country: string | null;
  region: string | null;
  price: string | null;
  quantity: string | null;
  category: string | null;
  date: string | null;
  id: string | null;
  status: string | null;
  risk: string | null;
  contract: string | null;
  [key: string]: string | null;
}

export const detectAllColumns = (headers: string[]): DetectedColumns => {
  const detected: DetectedColumns = {
    supplier: null,
    spend: null,
    country: null,
    region: null,
    price: null,
    quantity: null,
    category: null,
    date: null,
    id: null,
    status: null,
    risk: null,
    contract: null,
  };

  const usedColumns: string[] = [];

  // Detect in priority order to avoid conflicts
  // e.g., "supplier_country" should match "country" not "supplier"

  // First pass: find most specific matches
  detected.supplier = findColumnByType(headers, 'supplier', usedColumns);
  if (detected.supplier) usedColumns.push(detected.supplier);

  detected.spend = findColumnByType(headers, 'spend', usedColumns);
  if (detected.spend) usedColumns.push(detected.spend);

  detected.country = findColumnByType(headers, 'country', usedColumns);
  if (detected.country) usedColumns.push(detected.country);

  detected.region = findColumnByType(headers, 'region', usedColumns);
  if (detected.region) usedColumns.push(detected.region);

  detected.price = findColumnByType(headers, 'price', usedColumns);
  if (detected.price) usedColumns.push(detected.price);

  detected.quantity = findColumnByType(headers, 'quantity', usedColumns);
  if (detected.quantity) usedColumns.push(detected.quantity);

  detected.category = findColumnByType(headers, 'category', usedColumns);
  if (detected.category) usedColumns.push(detected.category);

  detected.date = findColumnByType(headers, 'date', usedColumns);
  if (detected.date) usedColumns.push(detected.date);

  detected.id = findColumnByType(headers, 'id', usedColumns);
  if (detected.id) usedColumns.push(detected.id);

  detected.status = findColumnByType(headers, 'status', usedColumns);
  if (detected.status) usedColumns.push(detected.status);

  detected.risk = findColumnByType(headers, 'risk', usedColumns);
  if (detected.risk) usedColumns.push(detected.risk);

  detected.contract = findColumnByType(headers, 'contract', usedColumns);
  if (detected.contract) usedColumns.push(detected.contract);

  return detected;
};

// Get numeric value from a cell (handles currency, commas, etc.)
export const parseNumericValue = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;

  // Remove currency symbols, commas, spaces, and other non-numeric chars except decimal point and minus
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

// Analyze data to determine column types by content (for ambiguous headers)
export const analyzeColumnContent = (headers: string[], rows: Record<string, string>[], maxSamples = 10): Map<string, ColumnType> => {
  const analysis = new Map<string, ColumnType>();

  for (const header of headers) {
    const samples = rows.slice(0, maxSamples).map(row => row[header]).filter(Boolean);

    // Check if it's numeric
    const numericCount = samples.filter(s => !isNaN(parseFloat(String(s).replace(/[^0-9.\-]/g, '')))).length;
    const isNumeric = numericCount > samples.length * 0.8;

    // Check if it's a date
    const dateCount = samples.filter(s => !isNaN(Date.parse(s))).length;
    const isDate = dateCount > samples.length * 0.8;

    // Check if it looks like a country code
    const countryCodeCount = samples.filter(s => /^[A-Z]{2,3}$/.test(String(s).trim())).length;
    const isCountryCode = countryCodeCount > samples.length * 0.8;

    // Header-based detection
    const headerType = detectColumnType(header);

    if (headerType !== 'unknown') {
      analysis.set(header, headerType);
    } else if (isDate) {
      analysis.set(header, 'date');
    } else if (isCountryCode) {
      analysis.set(header, 'country');
    } else if (isNumeric) {
      // Could be spend, price, or quantity - need more context
      analysis.set(header, 'unknown');
    } else {
      analysis.set(header, 'unknown');
    }
  }

  return analysis;
};

// Calculate spend from a row (tries multiple methods)
export const calculateRowSpend = (
  row: Record<string, string>,
  columns: DetectedColumns
): number => {
  // Method 1: Direct spend column
  if (columns.spend && row[columns.spend]) {
    const spend = parseNumericValue(row[columns.spend]);
    if (spend > 0) return spend;
  }

  // Method 2: Price × Quantity
  if (columns.price && columns.quantity && row[columns.price] && row[columns.quantity]) {
    const price = parseNumericValue(row[columns.price]);
    const quantity = parseNumericValue(row[columns.quantity]);
    if (price > 0 && quantity > 0) return price * quantity;
  }

  return 0;
};

// Get location from a row (tries country first, then region)
export const getRowLocation = (
  row: Record<string, string>,
  columns: DetectedColumns
): string | null => {
  if (columns.country && row[columns.country]) {
    return row[columns.country];
  }
  if (columns.region && row[columns.region]) {
    return row[columns.region];
  }
  return null;
};

// Get supplier from a row
export const getRowSupplier = (
  row: Record<string, string>,
  columns: DetectedColumns
): string | null => {
  if (columns.supplier && row[columns.supplier]) {
    return row[columns.supplier];
  }
  return null;
};
