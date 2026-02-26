/**
 * Smart Column Matcher v2.0
 * Ultra-intelligent column detection that handles ANY naming convention
 * - Abbreviations (sup, supp, suppl → supplier)
 * - Numbers in names (sup1, supplier_2 → supplier)
 * - Fuzzy matching for typos
 * - Synonym groups
 * - Content-based detection as fallback
 */

// Column type definitions
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

// ============================================================================
// ABBREVIATION MAPPINGS - Maps short forms to canonical terms
// ============================================================================
const ABBREVIATION_MAP: Record<string, string[]> = {
  // Supplier variations
  'supplier': ['sup', 'supp', 'suppl', 'splr', 'suplr', 'suppli', 'supplr'],
  'vendor': ['vnd', 'vndr', 'vend', 'vendr'],
  'seller': ['sel', 'selr', 'sellr'],
  'manufacturer': ['mfr', 'mfg', 'manuf', 'mnfr', 'manu'],
  'provider': ['prov', 'prvdr', 'provdr'],
  'company': ['comp', 'cmp', 'co', 'corp'],

  // Location variations
  'country': ['ctry', 'cntry', 'cnty', 'cty', 'nat', 'nation'],
  'region': ['reg', 'rgn', 'regn', 'regi'],
  'location': ['loc', 'locn', 'loca'],
  'geography': ['geo', 'geog'],
  'territory': ['terr', 'terri', 'tty'],
  'state': ['st', 'stt'],
  'city': ['cty', 'cit'],

  // Spend/Amount variations
  'spend': ['spnd', 'spd', 'expend', 'exp'],
  'amount': ['amt', 'amnt', 'amout'],
  'value': ['val', 'vlu', 'valu'],
  'total': ['tot', 'ttl', 'totl'],
  'extended': ['ext', 'extd', 'extn'],
  'invoice': ['inv', 'invc', 'invce'],
  'payment': ['pay', 'pmt', 'paym', 'pymnt'],
  'purchase': ['pur', 'purch', 'purc', 'po'],
  'order': ['ord', 'ordr'],

  // Price variations
  'price': ['prc', 'prce', 'pric'],
  'cost': ['cst', 'cots'],
  'rate': ['rt', 'rte'],
  'unit': ['unt', 'un'],

  // Quantity variations
  'quantity': ['qty', 'qnty', 'quant', 'qantity', 'quan'],
  'volume': ['vol', 'volm'],
  'units': ['unts', 'uts'],

  // Category variations
  'category': ['cat', 'catg', 'categ', 'ctgry', 'catagory'],
  'segment': ['seg', 'segm', 'sgmt'],
  'commodity': ['comm', 'comd', 'cmdty', 'commod'],
  'product': ['prod', 'prd', 'prdt'],
  'material': ['mat', 'matl', 'matr'],
  'service': ['svc', 'serv', 'srv'],
  'classification': ['class', 'cls', 'classif'],
  'type': ['typ', 'tp'],
  'group': ['grp', 'grpg'],

  // Date variations
  'date': ['dt', 'dte'],
  'year': ['yr', 'yrs'],
  'month': ['mo', 'mth', 'mnth'],
  'quarter': ['qtr', 'qrtr', 'q'],
  'period': ['per', 'prd', 'peri'],

  // Contract variations
  'contract': ['ctr', 'cntr', 'cont', 'contr', 'cntrt'],
  'agreement': ['agr', 'agrmt', 'agrmnt'],

  // Risk variations
  'risk': ['rsk', 'rsk'],
  'rating': ['rtg', 'rat', 'rtng'],
  'score': ['scr', 'scor'],

  // Status variations
  'status': ['sts', 'stat', 'stts'],

  // ID variations
  'identifier': ['id', 'idn', 'ident'],
  'number': ['num', 'no', 'nbr', 'nr'],
  'code': ['cd', 'cde'],
  'reference': ['ref', 'refr', 'rfrnc'],

  // Description variations
  'description': ['desc', 'descr', 'descript', 'dscrptn'],
  'name': ['nm', 'nme'],
  'title': ['ttl', 'titl'],

  // Currency variations
  'currency': ['curr', 'ccy', 'cur', 'crcy'],

  // Buyer/Purchaser variations (for negative matching)
  'buyer': ['buy', 'buyr', 'byr'],
  'purchaser': ['purch', 'purchsr'],
  'customer': ['cust', 'cstmr', 'custmr'],
};

// ============================================================================
// SYNONYM GROUPS - Terms that mean the same thing
// ============================================================================
const SYNONYM_GROUPS: Record<ColumnType, string[][]> = {
  supplier: [
    ['supplier', 'vendor', 'seller', 'provider', 'manufacturer', 'merchant', 'contractor', 'firm', 'company', 'partner'],
  ],
  spend: [
    ['spend', 'expenditure', 'expense', 'outlay', 'disbursement'],
    ['amount', 'value', 'total', 'sum'],
    ['invoice', 'payment', 'purchase'],
    ['extended', 'line'],
  ],
  country: [
    ['country', 'nation', 'ctry'],
    ['origin', 'destination', 'source'],
  ],
  region: [
    ['region', 'territory', 'area', 'zone', 'geography', 'geo'],
    ['emea', 'apac', 'latam', 'americas', 'asia', 'europe', 'africa'],
    ['state', 'province', 'district'],
  ],
  price: [
    ['price', 'cost', 'rate', 'tariff'],
    ['unit', 'per'],
  ],
  quantity: [
    ['quantity', 'volume', 'count', 'units', 'pieces'],
    ['ordered', 'received', 'invoiced', 'shipped', 'delivered'],
  ],
  category: [
    ['category', 'segment', 'classification', 'class', 'group', 'type'],
    ['commodity', 'product', 'material', 'goods', 'service', 'item'],
    ['division', 'department', 'section', 'line', 'family'],
    ['level', 'tier', 'hierarchy'],
  ],
  date: [
    ['date', 'time', 'period', 'timestamp'],
    ['year', 'month', 'day', 'week', 'quarter'],
    ['start', 'end', 'begin', 'finish', 'from', 'to', 'due', 'effective'],
    ['created', 'modified', 'updated', 'posted', 'processed'],
  ],
  contract: [
    ['contract', 'agreement', 'deal', 'arrangement'],
    ['terms', 'conditions'],
    ['purchase', 'order', 'requisition', 'request', 'po'],
  ],
  risk: [
    ['risk', 'hazard', 'threat', 'danger'],
    ['rating', 'score', 'level', 'grade', 'tier', 'rank'],
    ['assessment', 'evaluation', 'analysis'],
  ],
  currency: [
    ['currency', 'money', 'monetary'],
    ['usd', 'eur', 'gbp', 'jpy', 'cny', 'inr', 'aud', 'cad', 'chf'],
  ],
  description: [
    ['description', 'detail', 'note', 'comment', 'remark', 'memo'],
    ['specification', 'spec', 'info', 'information'],
    ['name', 'title', 'label', 'text'],
  ],
  id: [
    ['id', 'identifier', 'key', 'index'],
    ['code', 'number', 'reference', 'ref'],
  ],
  status: [
    ['status', 'state', 'condition', 'phase', 'stage'],
    ['active', 'inactive', 'pending', 'approved', 'rejected', 'closed', 'open'],
  ],
  unknown: [],
};

// ============================================================================
// NEGATIVE PATTERNS - Columns that should NOT match certain types
// ============================================================================
const NEGATIVE_PATTERNS: Partial<Record<ColumnType, string[]>> = {
  price: ['proof', 'point', 'primary', 'secondary', 'benchmark', 'reference', 'market', 'target'],
  spend: ['proof', 'point', 'benchmark', 'target', 'market', 'budget', 'forecast'],
  supplier: ['buyer', 'customer', 'purchaser', 'client'],
  country: [], // Will handle buyer/supplier preference differently
  region: [],
};

// ============================================================================
// SUPPLIER-SIDE INDICATORS - Prefer these for location/supplier columns
// ============================================================================
const SUPPLIER_SIDE_TERMS = ['supplier', 'vendor', 'seller', 'provider', 'manufacturer', 'source', 'origin', 'ship', 'from'];
const BUYER_SIDE_TERMS = ['buyer', 'purchaser', 'customer', 'client', 'destination', 'to', 'recv', 'receiving'];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize a string for comparison
 * - Lowercase
 * - Remove special characters
 * - Remove numbers (configurable)
 */
const normalize = (str: string, removeNumbers = false): string => {
  let result = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (removeNumbers) {
    result = result.replace(/[0-9]/g, '');
  }
  return result;
};

/**
 * Strip trailing/leading numbers from a string
 * e.g., "supplier1" → "supplier", "2vendor" → "vendor", "sup_3_name" → "sup_name"
 */
const stripNumbers = (str: string): string => {
  return str.replace(/^[0-9_\-]+|[0-9_\-]+$/g, '').replace(/[0-9]/g, '');
};

/**
 * Expand abbreviations in a string
 * e.g., "sup_ctry" → "supplier_country"
 */
const expandAbbreviations = (str: string): string[] => {
  const normalized = normalize(str, true); // Remove numbers too
  const results: string[] = [normalized];

  // Try to expand each known abbreviation
  for (const [fullWord, abbreviations] of Object.entries(ABBREVIATION_MAP)) {
    for (const abbr of abbreviations) {
      if (normalized.includes(abbr)) {
        // Create expanded version
        const expanded = normalized.replace(new RegExp(abbr, 'g'), fullWord);
        if (!results.includes(expanded)) {
          results.push(expanded);
        }
      }
    }
    // Also check if the full word is there
    if (normalized.includes(fullWord)) {
      results.push(normalized);
    }
  }

  return results;
};

/**
 * Levenshtein distance for fuzzy matching
 */
const levenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[b.length][a.length];
};

/**
 * Check if two strings are similar (fuzzy match)
 * Returns similarity score 0-1 (1 = exact match)
 */
const getSimilarity = (str1: string, str2: string): number => {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLen);
};

/**
 * Check if header contains a negative pattern for the given type
 */
const hasNegativeMatch = (normalizedHeader: string, type: ColumnType): boolean => {
  const negatives = NEGATIVE_PATTERNS[type];
  if (!negatives || negatives.length === 0) return false;

  return negatives.some(neg => normalizedHeader.includes(neg));
};

/**
 * Check if header indicates supplier-side data
 */
const isSupplierSide = (header: string): boolean => {
  const normalized = normalize(header, true);
  return SUPPLIER_SIDE_TERMS.some(term => normalized.includes(term));
};

/**
 * Check if header indicates buyer-side data
 */
const isBuyerSide = (header: string): boolean => {
  const normalized = normalize(header, true);
  return BUYER_SIDE_TERMS.some(term => normalized.includes(term));
};

/**
 * Check if a value looks like a country name or code
 */
const looksLikeCountry = (value: string): boolean => {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();

  // Country codes (2-3 letter uppercase)
  if (/^[A-Z]{2,3}$/.test(trimmed)) return true;

  // Common country names
  const countryPatterns = [
    /^(united|us|usa|uk|china|india|germany|france|japan|brazil|canada|australia|mexico|indonesia|russia|south|north|new)/i,
    /(states|kingdom|republic|islands)$/i,
  ];
  return countryPatterns.some(p => p.test(trimmed));
};

/**
 * Check if a value looks like a company/supplier name
 */
const looksLikeCompanyName = (value: string): boolean => {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();

  // Company suffixes
  const companySuffixes = /(inc|llc|ltd|corp|co|gmbh|ag|sa|plc|pvt|pty|bv|nv|ab|as|oy|spa|srl|kk|kg)\.?$/i;
  if (companySuffixes.test(trimmed)) return true;

  // Multiple words with capital letters (typical company names)
  const words = trimmed.split(/\s+/);
  if (words.length >= 2 && words.every(w => /^[A-Z]/.test(w))) return true;

  return false;
};

/**
 * Check if a value looks like a monetary amount
 */
const looksLikeAmount = (value: string): boolean => {
  if (!value) return false;
  const cleaned = String(value).replace(/[$,\s€£¥₹]/g, '');
  return /^-?\d+\.?\d*$/.test(cleaned) && parseFloat(cleaned) !== 0;
};

/**
 * Check if a value looks like a date
 */
const looksLikeDate = (value: string): boolean => {
  if (!value || typeof value !== 'string') return false;
  // Common date patterns
  const datePatterns = [
    /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/,  // MM/DD/YYYY or DD-MM-YYYY
    /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/,     // YYYY-MM-DD
    /^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$/,   // Month DD, YYYY
    /^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}$/,     // DD Month YYYY
  ];
  return datePatterns.some(p => p.test(value.trim())) || !isNaN(Date.parse(value));
};

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

/**
 * Calculate match score for a header against a column type
 * Higher score = better match
 */
const calculateMatchScore = (header: string, type: ColumnType): number => {
  const normalized = normalize(header, false);
  const normalizedNoNumbers = normalize(header, true);
  const expanded = expandAbbreviations(header);

  // Check negative patterns first
  if (hasNegativeMatch(normalized, type)) {
    return -1; // Explicitly exclude
  }

  let maxScore = 0;
  const synonymGroups = SYNONYM_GROUPS[type] || [];

  // Flatten all synonyms for this type
  const allSynonyms = synonymGroups.flat();

  // Also add abbreviation expansions of synonyms
  const allPatterns = new Set<string>();
  for (const syn of allSynonyms) {
    allPatterns.add(syn);
    // Add abbreviations that map to this synonym
    const abbrs = ABBREVIATION_MAP[syn] || [];
    abbrs.forEach(a => allPatterns.add(a));
  }

  // Check each expanded version of the header
  for (const expandedHeader of expanded) {
    for (const pattern of allPatterns) {
      // Exact match (highest priority)
      if (expandedHeader === pattern || normalizedNoNumbers === pattern) {
        maxScore = Math.max(maxScore, 1000 + pattern.length * 10);
        continue;
      }

      // Header contains pattern
      if (expandedHeader.includes(pattern) || normalizedNoNumbers.includes(pattern)) {
        const score = 500 + pattern.length * 10;
        maxScore = Math.max(maxScore, score);
        continue;
      }

      // Pattern contains header (header is an abbreviation of pattern)
      if (pattern.includes(expandedHeader) && expandedHeader.length >= 3) {
        const score = 300 + expandedHeader.length * 5;
        maxScore = Math.max(maxScore, score);
        continue;
      }

      // Fuzzy match (for typos)
      if (pattern.length >= 4 && expandedHeader.length >= 4) {
        const similarity = getSimilarity(expandedHeader, pattern);
        if (similarity >= 0.8) { // 80% similar
          const score = 200 + Math.floor(similarity * 100);
          maxScore = Math.max(maxScore, score);
        }
      }
    }
  }

  // ============================================================================
  // TYPE-SPECIFIC BONUSES
  // ============================================================================

  // Supplier-specific bonuses
  if (type === 'supplier') {
    if (normalized.includes('name') || normalizedNoNumbers.includes('name')) {
      maxScore += 100; // Prefer name columns over ID columns
    }
    if (normalized.includes('id') || normalized.includes('code') || normalized.includes('number')) {
      maxScore -= 50; // Slight penalty for ID/code columns
    }
    // Penalty for buyer-side columns
    if (isBuyerSide(header)) {
      maxScore -= 200;
    }
  }

  // Spend-specific bonuses
  if (type === 'spend') {
    if (normalized.includes('extended') || normalized.includes('line')) maxScore += 50;
    if (normalized.includes('total')) maxScore += 40;
    if (normalized.includes('amount') || normalized.includes('value')) maxScore += 30;
    if (normalized.includes('annual') || normalized.includes('yearly')) maxScore += 20;
  }

  // Price-specific bonuses
  if (type === 'price') {
    if (normalized.includes('unit')) maxScore += 50;
    if (normalized.includes('invoiced') || normalized.includes('contracted')) maxScore += 30;
    if (normalized.includes('per')) maxScore += 20;
  }

  // Country/Region - PREFER SUPPLIER SIDE
  if (type === 'country' || type === 'region') {
    if (isSupplierSide(header)) {
      maxScore += 100; // Strong bonus for supplier-side location
    }
    if (isBuyerSide(header)) {
      maxScore -= 50; // Penalty for buyer-side location
    }
  }

  // Quantity-specific bonuses
  if (type === 'quantity') {
    if (normalized.includes('ordered') || normalized.includes('invoiced')) maxScore += 30;
    if (normalized.includes('received') || normalized.includes('delivered')) maxScore += 20;
  }

  // Category-specific bonuses
  if (type === 'category') {
    // Prefer more specific category columns
    if (normalized.includes('level') || normalized.includes('l1') || normalized.includes('l2') || normalized.includes('l3')) {
      maxScore += 30;
    }
    if (normalized.includes('commodity') || normalized.includes('material')) maxScore += 20;
  }

  return maxScore;
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Detect the type of a single column
 */
export const detectColumnType = (header: string): ColumnType => {
  if (!header || typeof header !== 'string') return 'unknown';

  const types: ColumnType[] = [
    'supplier', 'spend', 'country', 'region', 'price', 'quantity',
    'category', 'date', 'contract', 'risk', 'currency', 'description', 'id', 'status'
  ];

  let bestType: ColumnType = 'unknown';
  let bestScore = 0;

  for (const type of types) {
    const score = calculateMatchScore(header, type);
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  return bestScore > 0 ? bestType : 'unknown';
};

/**
 * Find the best column for a given type from a list of headers
 */
export const findColumnByType = (
  headers: string[],
  type: ColumnType,
  excludeColumns: string[] = [],
  rows?: Record<string, string>[]
): string | null => {
  if (!headers || !Array.isArray(headers) || headers.length === 0) return null;

  const scored: { header: string; score: number; contentBonus: number }[] = [];

  for (const header of headers) {
    if (!header || typeof header !== 'string') continue;
    if (excludeColumns.includes(header)) continue;

    const score = calculateMatchScore(header, type);
    if (score <= 0) continue;

    // Content-based bonus (if rows are provided)
    let contentBonus = 0;
    if (rows && rows.length > 0) {
      const sampleSize = Math.min(rows.length, 20);
      const samples = rows.slice(0, sampleSize).map(r => r[header]).filter(Boolean);

      if (samples.length > 0) {
        if (type === 'country') {
          const countryMatches = samples.filter(looksLikeCountry).length;
          contentBonus = (countryMatches / samples.length) * 50;
        } else if (type === 'supplier') {
          const companyMatches = samples.filter(looksLikeCompanyName).length;
          contentBonus = (companyMatches / samples.length) * 50;
        } else if (type === 'spend' || type === 'price' || type === 'quantity') {
          const amountMatches = samples.filter(looksLikeAmount).length;
          contentBonus = (amountMatches / samples.length) * 50;
        } else if (type === 'date') {
          const dateMatches = samples.filter(looksLikeDate).length;
          contentBonus = (dateMatches / samples.length) * 50;
        }
      }
    }

    scored.push({ header, score, contentBonus });
  }

  if (scored.length === 0) return null;

  // Sort by total score (header score + content bonus)
  scored.sort((a, b) => (b.score + b.contentBonus) - (a.score + a.contentBonus));

  // Debug logging
  if (scored.length > 0) {
    console.log(`[ColumnMatcher] Best matches for "${type}":`, scored.slice(0, 3).map(s =>
      `${s.header} (score: ${s.score}, content: ${s.contentBonus.toFixed(0)})`
    ));
  }

  return scored[0].header;
};

// Smart column detection result interface
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

/**
 * Detect all relevant columns in a dataset
 * Uses smart matching with content-based verification
 */
export const detectAllColumns = (
  headers: string[],
  rows?: Record<string, string>[]
): DetectedColumns => {
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

  if (!headers || !Array.isArray(headers) || headers.length === 0) {
    return detected;
  }

  const validHeaders = headers.filter(h => h && typeof h === 'string');
  const usedColumns: string[] = [];

  // Detection order matters - more specific types first
  const detectionOrder: (keyof DetectedColumns)[] = [
    'supplier',  // Detect supplier first (important for spend analysis)
    'spend',     // Main financial metric
    'country',   // Location - prefer supplier country
    'region',    // Secondary location
    'price',     // Unit pricing
    'quantity',  // Volume data
    'category',  // Product categorization
    'date',      // Time-based data
    'id',        // Identifiers
    'status',    // Status fields
    'risk',      // Risk metrics
    'contract',  // Contract data
  ];

  for (const type of detectionOrder) {
    const column = findColumnByType(validHeaders, type as ColumnType, usedColumns, rows);
    if (column) {
      detected[type] = column;
      usedColumns.push(column);
    }
  }

  console.log('[ColumnMatcher] Final detected columns:', detected);

  return detected;
};

/**
 * Parse numeric value from a cell (handles currency, commas, etc.)
 */
export const parseNumericValue = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;

  // Remove currency symbols, commas, spaces, and other non-numeric chars
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Analyze column content to help with ambiguous headers
 */
export const analyzeColumnContent = (
  headers: string[],
  rows: Record<string, string>[],
  maxSamples = 20
): Map<string, ColumnType> => {
  const analysis = new Map<string, ColumnType>();

  for (const header of headers) {
    if (!header) continue;

    const samples = rows.slice(0, maxSamples).map(row => row[header]).filter(Boolean);
    if (samples.length === 0) {
      analysis.set(header, 'unknown');
      continue;
    }

    // Try header-based detection first
    const headerType = detectColumnType(header);
    if (headerType !== 'unknown') {
      analysis.set(header, headerType);
      continue;
    }

    // Content-based detection
    const countryCount = samples.filter(looksLikeCountry).length;
    const companyCount = samples.filter(looksLikeCompanyName).length;
    const amountCount = samples.filter(looksLikeAmount).length;
    const dateCount = samples.filter(looksLikeDate).length;

    const threshold = samples.length * 0.6; // 60% of samples must match

    if (countryCount >= threshold) {
      analysis.set(header, 'country');
    } else if (companyCount >= threshold) {
      analysis.set(header, 'supplier');
    } else if (dateCount >= threshold) {
      analysis.set(header, 'date');
    } else if (amountCount >= threshold) {
      // Could be spend, price, or quantity - need more context
      analysis.set(header, 'unknown');
    } else {
      analysis.set(header, 'unknown');
    }
  }

  return analysis;
};

/**
 * Calculate spend from a row (tries multiple methods)
 */
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

/**
 * Get location from a row (tries country first, then region)
 * Always prefers supplier-side location data
 */
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

/**
 * Get supplier from a row
 */
export const getRowSupplier = (
  row: Record<string, string>,
  columns: DetectedColumns
): string | null => {
  if (columns.supplier && row[columns.supplier]) {
    return row[columns.supplier];
  }
  return null;
};

/**
 * Get category from a row
 */
export const getRowCategory = (
  row: Record<string, string>,
  columns: DetectedColumns
): string | null => {
  if (columns.category && row[columns.category]) {
    return row[columns.category];
  }
  return null;
};

// ============================================================================
// PERFORMANCE OPTIMIZATIONS
// ============================================================================

/**
 * Cache for column detection results
 * Key: hash of headers array
 */
const columnDetectionCache = new Map<string, DetectedColumns>();
const CACHE_MAX_SIZE = 50;

/**
 * Generate a simple hash for headers array (for caching)
 */
const hashHeaders = (headers: string[]): string => {
  return headers.slice(0, 20).join('|').toLowerCase();
};

/**
 * Cached version of detectAllColumns
 * Uses memoization to avoid re-computing for same headers
 */
export const detectAllColumnsCached = (
  headers: string[],
  rows?: Record<string, string>[]
): DetectedColumns => {
  const cacheKey = hashHeaders(headers);

  // Check cache
  if (columnDetectionCache.has(cacheKey)) {
    console.log('[ColumnMatcher] Using cached detection result');
    return columnDetectionCache.get(cacheKey)!;
  }

  // Compute and cache
  const result = detectAllColumns(headers, rows);

  // Manage cache size
  if (columnDetectionCache.size >= CACHE_MAX_SIZE) {
    const firstKey = columnDetectionCache.keys().next().value;
    if (firstKey) columnDetectionCache.delete(firstKey);
  }

  columnDetectionCache.set(cacheKey, result);
  return result;
};

/**
 * Clear the column detection cache
 */
export const clearColumnCache = (): void => {
  columnDetectionCache.clear();
  console.log('[ColumnMatcher] Cache cleared');
};

/**
 * Optimized batch aggregation for large datasets
 * Processes data in a single pass with minimal memory allocation
 */
export interface AggregatedSpendData {
  totalSpend: number;
  spendByLocation: Map<string, number>;
  spendBySupplier: Map<string, number>;
  spendByCategory: Map<string, number>;
  rowCount: number;
  priceStats?: {
    min: number;
    max: number;
    avg: number;
    variance: number;
  };
}

export const aggregateSpendDataFast = (
  rows: Record<string, string>[],
  columns: DetectedColumns
): AggregatedSpendData => {
  const spendByLocation = new Map<string, number>();
  const spendBySupplier = new Map<string, number>();
  const spendByCategory = new Map<string, number>();
  let totalSpend = 0;
  let priceSum = 0;
  let priceCount = 0;
  let priceMin = Infinity;
  let priceMax = -Infinity;
  const prices: number[] = [];

  // Single pass through all rows
  const rowCount = rows.length;
  for (let i = 0; i < rowCount; i++) {
    const row = rows[i];

    // Calculate spend for this row
    const spend = calculateRowSpend(row, columns);
    if (spend <= 0) continue;

    totalSpend += spend;

    // Aggregate by location (supplier country preferred)
    if (columns.country) {
      const location = row[columns.country];
      if (location) {
        spendByLocation.set(location, (spendByLocation.get(location) || 0) + spend);
      }
    }

    // Aggregate by supplier
    if (columns.supplier) {
      const supplier = row[columns.supplier];
      if (supplier) {
        spendBySupplier.set(supplier, (spendBySupplier.get(supplier) || 0) + spend);
      }
    }

    // Aggregate by category
    if (columns.category) {
      const category = row[columns.category];
      if (category) {
        spendByCategory.set(category, (spendByCategory.get(category) || 0) + spend);
      }
    }

    // Collect price data
    if (columns.price) {
      const price = parseNumericValue(row[columns.price]);
      if (price > 0) {
        priceSum += price;
        priceCount++;
        priceMin = Math.min(priceMin, price);
        priceMax = Math.max(priceMax, price);
        // Only keep prices for variance calculation if reasonable count
        if (prices.length < 10000) {
          prices.push(price);
        }
      }
    }
  }

  // Calculate price statistics
  let priceStats: AggregatedSpendData['priceStats'];
  if (priceCount > 0) {
    const avg = priceSum / priceCount;
    // Calculate variance only if we have the prices array
    let variance = 0;
    if (prices.length > 0) {
      const squaredDiffs = prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0);
      variance = squaredDiffs / prices.length;
    }
    priceStats = {
      min: priceMin,
      max: priceMax,
      avg,
      variance: avg > 0 ? (Math.sqrt(variance) / avg) * 100 : 0,
    };
  }

  return {
    totalSpend,
    spendByLocation,
    spendBySupplier,
    spendByCategory,
    rowCount,
    priceStats,
  };
};

/**
 * Convert aggregated data to sorted arrays for display
 * Limits results to top N entries
 */
export interface SpendDataItem {
  name: string;
  spend: number;
  percentage: number;
}

export const formatAggregatedData = (
  aggregated: AggregatedSpendData,
  topN = 10
): {
  locations: SpendDataItem[];
  suppliers: SpendDataItem[];
  categories: SpendDataItem[];
} => {
  const total = aggregated.totalSpend;

  const mapToArray = (map: Map<string, number>): SpendDataItem[] => {
    return Array.from(map.entries())
      .map(([name, spend]) => ({
        name,
        spend,
        percentage: total > 0 ? Math.round((spend / total) * 100) : 0,
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, topN);
  };

  return {
    locations: mapToArray(aggregated.spendByLocation),
    suppliers: mapToArray(aggregated.spendBySupplier),
    categories: mapToArray(aggregated.spendByCategory),
  };
};

/**
 * Process spend data with progress callback for large datasets
 * Uses requestIdleCallback for non-blocking processing
 */
export const processSpendDataAsync = (
  rows: Record<string, string>[],
  columns: DetectedColumns,
  onProgress?: (progress: number) => void,
  chunkSize = 5000
): Promise<AggregatedSpendData> => {
  return new Promise((resolve) => {
    const result: AggregatedSpendData = {
      totalSpend: 0,
      spendByLocation: new Map(),
      spendBySupplier: new Map(),
      spendByCategory: new Map(),
      rowCount: rows.length,
    };

    let currentIndex = 0;
    const totalRows = rows.length;

    const processChunk = () => {
      const endIndex = Math.min(currentIndex + chunkSize, totalRows);

      for (let i = currentIndex; i < endIndex; i++) {
        const row = rows[i];
        const spend = calculateRowSpend(row, columns);

        if (spend > 0) {
          result.totalSpend += spend;

          if (columns.country) {
            const location = row[columns.country];
            if (location) {
              result.spendByLocation.set(
                location,
                (result.spendByLocation.get(location) || 0) + spend
              );
            }
          }

          if (columns.supplier) {
            const supplier = row[columns.supplier];
            if (supplier) {
              result.spendBySupplier.set(
                supplier,
                (result.spendBySupplier.get(supplier) || 0) + spend
              );
            }
          }

          if (columns.category) {
            const category = row[columns.category];
            if (category) {
              result.spendByCategory.set(
                category,
                (result.spendByCategory.get(category) || 0) + spend
              );
            }
          }
        }
      }

      currentIndex = endIndex;

      if (onProgress) {
        onProgress(Math.round((currentIndex / totalRows) * 100));
      }

      if (currentIndex < totalRows) {
        // Schedule next chunk
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(processChunk);
        } else {
          setTimeout(processChunk, 0);
        }
      } else {
        resolve(result);
      }
    };

    // Start processing
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(processChunk);
    } else {
      setTimeout(processChunk, 0);
    }
  });
};
