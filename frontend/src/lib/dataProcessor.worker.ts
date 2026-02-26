/**
 * Web Worker for Heavy Data Processing
 * Runs expensive operations off the main thread for smooth UI
 */

// Types for worker communication
interface ProcessSpendDataMessage {
  type: 'PROCESS_SPEND_DATA';
  payload: {
    headers: string[];
    rows: Record<string, string>[];
    selectedCategories?: string[];
    categoryColumn?: string;
  };
}

interface DetectColumnsMessage {
  type: 'DETECT_COLUMNS';
  payload: {
    headers: string[];
    sampleRows: Record<string, string>[];
  };
}

interface AggregateDataMessage {
  type: 'AGGREGATE_DATA';
  payload: {
    rows: Record<string, string>[];
    columns: {
      supplier: string | null;
      spend: string | null;
      country: string | null;
      price: string | null;
      quantity: string | null;
      category: string | null;
    };
    chunkSize?: number;
  };
}

type WorkerMessage = ProcessSpendDataMessage | DetectColumnsMessage | AggregateDataMessage;

// ============================================================================
// ABBREVIATION MAPPINGS (copied from columnMatcher for worker isolation)
// ============================================================================
const ABBREVIATION_MAP: Record<string, string[]> = {
  'supplier': ['sup', 'supp', 'suppl', 'splr', 'suplr', 'suppli', 'supplr'],
  'vendor': ['vnd', 'vndr', 'vend', 'vendr'],
  'country': ['ctry', 'cntry', 'cnty', 'cty', 'nat', 'nation'],
  'region': ['reg', 'rgn', 'regn', 'regi'],
  'spend': ['spnd', 'spd', 'expend', 'exp'],
  'amount': ['amt', 'amnt', 'amout'],
  'value': ['val', 'vlu', 'valu'],
  'total': ['tot', 'ttl', 'totl'],
  'quantity': ['qty', 'qnty', 'quant', 'qantity', 'quan'],
  'category': ['cat', 'catg', 'categ', 'ctgry', 'catagory'],
  'price': ['prc', 'prce', 'pric'],
  'buyer': ['buy', 'buyr', 'byr'],
};

const SUPPLIER_SIDE_TERMS = ['supplier', 'vendor', 'seller', 'provider', 'source', 'origin', 'ship', 'from'];
const BUYER_SIDE_TERMS = ['buyer', 'purchaser', 'customer', 'client', 'destination', 'to'];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const normalize = (str: string, removeNumbers = false): string => {
  let result = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (removeNumbers) {
    result = result.replace(/[0-9]/g, '');
  }
  return result;
};

const expandAbbreviations = (str: string): string[] => {
  const normalized = normalize(str, true);
  const results: string[] = [normalized];

  for (const [fullWord, abbreviations] of Object.entries(ABBREVIATION_MAP)) {
    for (const abbr of abbreviations) {
      if (normalized.includes(abbr)) {
        const expanded = normalized.replace(new RegExp(abbr, 'g'), fullWord);
        if (!results.includes(expanded)) {
          results.push(expanded);
        }
      }
    }
  }

  return results;
};

const parseNumericValue = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

const isSupplierSide = (header: string): boolean => {
  const normalized = normalize(header, true);
  return SUPPLIER_SIDE_TERMS.some(term => normalized.includes(term));
};

const isBuyerSide = (header: string): boolean => {
  const normalized = normalize(header, true);
  return BUYER_SIDE_TERMS.some(term => normalized.includes(term));
};

// ============================================================================
// FAST COLUMN DETECTION (optimized for worker)
// ============================================================================

interface DetectedColumns {
  supplier: string | null;
  spend: string | null;
  country: string | null;
  region: string | null;
  price: string | null;
  quantity: string | null;
  category: string | null;
}

const COLUMN_KEYWORDS: Record<keyof DetectedColumns, string[]> = {
  supplier: ['supplier', 'vendor', 'seller', 'provider', 'manufacturer', 'company', 'firm', 'merchant'],
  spend: ['spend', 'amount', 'value', 'total', 'extended', 'invoice', 'payment', 'expenditure', 'cost'],
  country: ['country', 'nation', 'ctry'],
  region: ['region', 'territory', 'area', 'geography', 'state', 'province'],
  price: ['price', 'cost', 'rate', 'unit'],
  quantity: ['quantity', 'qty', 'volume', 'units', 'count'],
  category: ['category', 'segment', 'commodity', 'product', 'material', 'type', 'class'],
};

function detectColumnsFast(headers: string[], sampleRows: Record<string, string>[]): DetectedColumns {
  const detected: DetectedColumns = {
    supplier: null,
    spend: null,
    country: null,
    region: null,
    price: null,
    quantity: null,
    category: null,
  };

  const usedColumns = new Set<string>();

  // Score all headers for each type
  for (const type of Object.keys(COLUMN_KEYWORDS) as (keyof DetectedColumns)[]) {
    let bestHeader: string | null = null;
    let bestScore = 0;

    for (const header of headers) {
      if (!header || usedColumns.has(header)) continue;

      const normalized = normalize(header, true);
      const expanded = expandAbbreviations(header);
      let score = 0;

      // Check keywords
      for (const keyword of COLUMN_KEYWORDS[type]) {
        for (const exp of expanded) {
          if (exp === keyword) {
            score = Math.max(score, 1000);
          } else if (exp.includes(keyword)) {
            score = Math.max(score, 500 + keyword.length * 10);
          }
        }
      }

      // Supplier-side preference for location columns
      if ((type === 'country' || type === 'region') && score > 0) {
        if (isSupplierSide(header)) score += 100;
        if (isBuyerSide(header)) score -= 50;
      }

      // Name preference for supplier column
      if (type === 'supplier' && score > 0) {
        if (normalized.includes('name')) score += 100;
        if (normalized.includes('id') || normalized.includes('code')) score -= 50;
      }

      // Extended/Total preference for spend
      if (type === 'spend' && score > 0) {
        if (normalized.includes('extended')) score += 50;
        if (normalized.includes('total')) score += 40;
        if (normalized.includes('line')) score += 30;
      }

      if (score > bestScore) {
        bestScore = score;
        bestHeader = header;
      }
    }

    if (bestHeader) {
      detected[type] = bestHeader;
      usedColumns.add(bestHeader);
    }
  }

  return detected;
}

// ============================================================================
// CHUNKED DATA AGGREGATION (for large datasets)
// ============================================================================

interface AggregationResult {
  totalSpend: number;
  locationMap: Record<string, number>;
  supplierMap: Record<string, number>;
  categoryMap: Record<string, number>;
  rowCount: number;
  priceData?: {
    prices: number[];
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    priceVariance: number;
  };
}

function aggregateDataChunked(
  rows: Record<string, string>[],
  columns: DetectedColumns,
  chunkSize = 5000
): AggregationResult {
  const locationMap: Record<string, number> = {};
  const supplierMap: Record<string, number> = {};
  const categoryMap: Record<string, number> = {};
  const prices: number[] = [];
  let totalSpend = 0;

  // Process in chunks to avoid blocking
  const rowCount = rows.length;

  for (let i = 0; i < rowCount; i++) {
    const row = rows[i];

    // Calculate spend
    let spend = 0;
    if (columns.spend && row[columns.spend]) {
      spend = parseNumericValue(row[columns.spend]);
    } else if (columns.price && columns.quantity && row[columns.price] && row[columns.quantity]) {
      const price = parseNumericValue(row[columns.price]);
      const qty = parseNumericValue(row[columns.quantity]);
      spend = price * qty;
    }

    if (spend > 0) {
      totalSpend += spend;

      // Aggregate by location
      if (columns.country && row[columns.country]) {
        const location = row[columns.country];
        locationMap[location] = (locationMap[location] || 0) + spend;
      }

      // Aggregate by supplier
      if (columns.supplier && row[columns.supplier]) {
        const supplier = row[columns.supplier];
        supplierMap[supplier] = (supplierMap[supplier] || 0) + spend;
      }

      // Aggregate by category
      if (columns.category && row[columns.category]) {
        const category = row[columns.category];
        categoryMap[category] = (categoryMap[category] || 0) + spend;
      }

      // Collect prices
      if (columns.price && row[columns.price]) {
        const price = parseNumericValue(row[columns.price]);
        if (price > 0) prices.push(price);
      }
    }
  }

  // Calculate price statistics
  let priceData: AggregationResult['priceData'];
  if (prices.length > 0) {
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
    const priceVariance = avgPrice > 0 ? (Math.sqrt(variance) / avgPrice) * 100 : 0;

    priceData = { prices, avgPrice, minPrice, maxPrice, priceVariance };
  }

  return {
    totalSpend,
    locationMap,
    supplierMap,
    categoryMap,
    rowCount,
    priceData,
  };
}

// ============================================================================
// CATEGORY FILTERING (optimized)
// ============================================================================

function filterByCategory(
  rows: Record<string, string>[],
  categoryColumn: string,
  selectedCategories: string[]
): Record<string, string>[] {
  if (!categoryColumn || selectedCategories.length === 0) {
    return rows;
  }

  const normalizedSelected = new Set(
    selectedCategories.map(c => c.toLowerCase().replace(/[^a-z0-9]/g, ''))
  );

  return rows.filter(row => {
    const categoryValue = row[categoryColumn];
    if (!categoryValue) return false;

    const normalizedValue = categoryValue.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Exact match
    if (normalizedSelected.has(normalizedValue)) return true;

    // Partial match (category contains selected or vice versa)
    for (const selected of normalizedSelected) {
      if (normalizedValue.includes(selected) || selected.includes(normalizedValue)) {
        return true;
      }
    }

    return false;
  });
}

// ============================================================================
// WORKER MESSAGE HANDLER
// ============================================================================

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  try {
    switch (type) {
      case 'DETECT_COLUMNS': {
        const { headers, sampleRows } = payload;
        const columns = detectColumnsFast(headers, sampleRows);
        self.postMessage({ type: 'DETECT_COLUMNS_RESULT', payload: columns });
        break;
      }

      case 'AGGREGATE_DATA': {
        const { rows, columns, chunkSize } = payload;
        const result = aggregateDataChunked(rows, columns as DetectedColumns, chunkSize);
        self.postMessage({ type: 'AGGREGATE_DATA_RESULT', payload: result });
        break;
      }

      case 'PROCESS_SPEND_DATA': {
        const { headers, rows, selectedCategories, categoryColumn } = payload;

        // Step 1: Detect columns
        const sampleRows = rows.slice(0, 100); // Sample for detection
        const columns = detectColumnsFast(headers, sampleRows);

        // Step 2: Filter by category if needed
        let filteredRows = rows;
        if (selectedCategories && selectedCategories.length > 0 && columns.category) {
          filteredRows = filterByCategory(rows, categoryColumn || columns.category, selectedCategories);
        }

        // Step 3: Aggregate data
        const result = aggregateDataChunked(filteredRows, columns);

        // Step 4: Format results
        const locations = Object.entries(result.locationMap)
          .map(([name, spend]) => ({
            name,
            spend,
            percentage: result.totalSpend > 0 ? Math.round((spend / result.totalSpend) * 100) : 0,
          }))
          .sort((a, b) => b.spend - a.spend)
          .slice(0, 10);

        const suppliers = Object.entries(result.supplierMap)
          .map(([name, spend]) => ({
            name,
            spend,
            percentage: result.totalSpend > 0 ? Math.round((spend / result.totalSpend) * 100) : 0,
          }))
          .sort((a, b) => b.spend - a.spend)
          .slice(0, 10);

        const categories = Object.entries(result.categoryMap)
          .map(([name, spend]) => ({
            name,
            spend,
            percentage: result.totalSpend > 0 ? Math.round((spend / result.totalSpend) * 100) : 0,
          }))
          .sort((a, b) => b.spend - a.spend)
          .slice(0, 10);

        self.postMessage({
          type: 'PROCESS_SPEND_DATA_RESULT',
          payload: {
            columns,
            totalSpend: result.totalSpend,
            locations,
            suppliers,
            categories,
            rowCount: result.rowCount,
            filteredRowCount: filteredRows.length,
            priceData: result.priceData,
          },
        });
        break;
      }

      default:
        self.postMessage({ type: 'ERROR', payload: `Unknown message type: ${type}` });
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      payload: error instanceof Error ? error.message : 'Unknown error in worker',
    });
  }
};

// Signal that worker is ready
self.postMessage({ type: 'READY' });
