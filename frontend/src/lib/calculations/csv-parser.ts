/**
 * CSV Data Parser
 *
 * Parses uploaded CSV files and extracts supplier profiles,
 * spend records, and contract information for metrics calculation.
 */

import type { SupplierProfile, SpendRecord, ContractInfo } from './procurement-metrics';

// =============================================================================
// TYPES
// =============================================================================

export interface ParsedSpendData {
  suppliers: SupplierProfile[];
  spendRecords: SpendRecord[];
  totalSpend: number;
  categoryName: string;
  columns: string[];
  rowCount: number;
}

export interface ParsedSupplierMaster {
  suppliers: Partial<SupplierProfile>[];
  columns: string[];
  rowCount: number;
}

export interface ParsedContracts {
  contracts: ContractInfo[];
  columns: string[];
  rowCount: number;
}

// Column name mappings (case-insensitive)
const COLUMN_MAPPINGS = {
  supplier: ['supplier', 'supplier_name', 'vendor', 'vendor_name', 'supplier_id'],
  spend: ['spend', 'spend_usd', 'amount', 'value', 'total_spend', 'spend_amount'],
  category: ['category', 'category_name', 'subcategory', 'material_group'],
  country: ['country', 'supplier_country', 'location', 'origin'],
  region: ['region', 'supplier_region', 'geographic_region'],
  price: ['price', 'unit_price', 'price_per_unit', 'unit_cost'],
  quantity: ['quantity', 'qty', 'volume', 'units'],
  riskRating: ['risk_rating', 'risk_score', 'supplier_risk', 'risk'],
  qualityRating: ['quality_rating', 'quality_score', 'quality'],
  contractId: ['contract_id', 'contract_number', 'agreement_id'],
  contractValue: ['contract_value', 'contract_amount', 'agreement_value'],
  paymentTerms: ['payment_terms', 'terms', 'payment_term'],
  expiryDate: ['expiry_date', 'end_date', 'contract_end', 'expires'],
  status: ['status', 'contract_status', 'state'],
  isDiverse: ['is_diverse', 'diverse_supplier', 'diversity', 'mwbe'],
  hasCertifications: ['has_certifications', 'certified', 'certifications'],
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Find the actual column name from CSV headers that matches our expected column
 */
function findColumn(headers: string[], targetColumn: keyof typeof COLUMN_MAPPINGS): string | null {
  const possibleNames = COLUMN_MAPPINGS[targetColumn];
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());

  for (const name of possibleNames) {
    const index = lowerHeaders.indexOf(name.toLowerCase());
    if (index !== -1) {
      return headers[index];
    }
  }

  // Try partial match
  for (const name of possibleNames) {
    const index = lowerHeaders.findIndex(h => h.includes(name.toLowerCase()));
    if (index !== -1) {
      return headers[index];
    }
  }

  return null;
}

/**
 * Parse a CSV string into rows
 */
function parseCSV(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      rows.push(row);
    }
  }

  return { headers, rows };
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Parse numeric value from string
 */
function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse date from string
 */
function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return isNaN(date.getTime()) ? undefined : date;
}

/**
 * Parse boolean from string
 */
function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  const lower = value.toLowerCase().trim();
  return ['true', 'yes', '1', 'y'].includes(lower);
}

// =============================================================================
// MAIN PARSER FUNCTIONS
// =============================================================================

/**
 * Parse spend data CSV file
 */
export function parseSpendData(csvText: string): ParsedSpendData {
  const { headers, rows } = parseCSV(csvText);

  // Find column mappings
  const supplierCol = findColumn(headers, 'supplier');
  const spendCol = findColumn(headers, 'spend');
  const categoryCol = findColumn(headers, 'category');
  const countryCol = findColumn(headers, 'country');
  const regionCol = findColumn(headers, 'region');
  const priceCol = findColumn(headers, 'price');
  const quantityCol = findColumn(headers, 'quantity');
  const riskCol = findColumn(headers, 'riskRating');
  const qualityCol = findColumn(headers, 'qualityRating');

  // Aggregate spend by supplier
  const supplierSpend: Record<string, {
    spend: number;
    country?: string;
    region?: string;
    riskRating?: number;
    qualityRating?: number;
  }> = {};

  const spendRecords: SpendRecord[] = [];
  let totalSpend = 0;
  let categoryName = 'Unknown';

  for (const row of rows) {
    const supplier = supplierCol ? row[supplierCol] : 'Unknown';
    const spend = spendCol ? parseNumber(row[spendCol]) : 0;
    const category = categoryCol ? row[categoryCol] : undefined;
    const country = countryCol ? row[countryCol] : undefined;
    const region = regionCol ? row[regionCol] : undefined;
    const price = priceCol ? parseNumber(row[priceCol]) : undefined;
    const quantity = quantityCol ? parseNumber(row[quantityCol]) : undefined;
    const riskRating = riskCol ? parseNumber(row[riskCol]) : undefined;
    const qualityRating = qualityCol ? parseNumber(row[qualityCol]) : undefined;

    if (supplier && spend > 0) {
      if (!supplierSpend[supplier]) {
        supplierSpend[supplier] = { spend: 0, country, region, riskRating, qualityRating };
      }
      supplierSpend[supplier].spend += spend;
      totalSpend += spend;

      if (category && categoryName === 'Unknown') {
        categoryName = category;
      }

      spendRecords.push({
        supplier,
        spend,
        category,
        country,
        region,
        price,
        quantity,
        riskRating,
        qualityRating,
      });
    }
  }

  // Convert to supplier profiles
  const suppliers: SupplierProfile[] = Object.entries(supplierSpend).map(([name, data], index) => ({
    id: `supplier-${index}`,
    name,
    spend: data.spend,
    spendPercentage: totalSpend > 0 ? (data.spend / totalSpend) * 100 : 0,
    country: data.country,
    region: data.region,
    riskScore: data.riskRating,
    qualityRating: data.qualityRating,
  }));

  // Sort by spend descending
  suppliers.sort((a, b) => b.spend - a.spend);

  return {
    suppliers,
    spendRecords,
    totalSpend,
    categoryName,
    columns: headers,
    rowCount: rows.length,
  };
}

/**
 * Parse supplier master CSV file
 */
export function parseSupplierMaster(csvText: string): ParsedSupplierMaster {
  const { headers, rows } = parseCSV(csvText);

  const supplierCol = findColumn(headers, 'supplier');
  const countryCol = findColumn(headers, 'country');
  const regionCol = findColumn(headers, 'region');
  const riskCol = findColumn(headers, 'riskRating');
  const qualityCol = findColumn(headers, 'qualityRating');
  const diverseCol = findColumn(headers, 'isDiverse');
  const certCol = findColumn(headers, 'hasCertifications');

  const suppliers: Partial<SupplierProfile>[] = rows.map((row, index) => ({
    id: `supplier-${index}`,
    name: supplierCol ? row[supplierCol] : `Supplier ${index}`,
    country: countryCol ? row[countryCol] : undefined,
    region: regionCol ? row[regionCol] : undefined,
    riskScore: riskCol ? parseNumber(row[riskCol]) : undefined,
    qualityRating: qualityCol ? parseNumber(row[qualityCol]) : undefined,
    isDiverse: diverseCol ? parseBoolean(row[diverseCol]) : undefined,
    hasCertifications: certCol ? parseBoolean(row[certCol]) : undefined,
  }));

  return {
    suppliers,
    columns: headers,
    rowCount: rows.length,
  };
}

/**
 * Parse contracts CSV file
 */
export function parseContracts(csvText: string): ParsedContracts {
  const { headers, rows } = parseCSV(csvText);

  const contractIdCol = findColumn(headers, 'contractId');
  const supplierCol = findColumn(headers, 'supplier');
  const valueCol = findColumn(headers, 'contractValue');
  const paymentCol = findColumn(headers, 'paymentTerms');
  const expiryCol = findColumn(headers, 'expiryDate');
  const statusCol = findColumn(headers, 'status');

  const contracts: ContractInfo[] = rows.map((row, index) => ({
    id: contractIdCol ? row[contractIdCol] : `contract-${index}`,
    supplierId: supplierCol ? row[supplierCol] : `supplier-${index}`,
    value: valueCol ? parseNumber(row[valueCol]) : 0,
    paymentTerms: paymentCol ? row[paymentCol] : undefined,
    expiryDate: expiryCol ? parseDate(row[expiryCol]) : undefined,
    status: (statusCol ? row[statusCol]?.toLowerCase() : 'active') as 'active' | 'expired' | 'pending',
  }));

  return {
    contracts,
    columns: headers,
    rowCount: rows.length,
  };
}

/**
 * Merge supplier master data with spend data
 */
export function mergeSupplierData(
  spendSuppliers: SupplierProfile[],
  masterSuppliers: Partial<SupplierProfile>[]
): SupplierProfile[] {
  const masterByName = new Map(
    masterSuppliers.map(s => [s.name?.toLowerCase(), s])
  );

  return spendSuppliers.map(supplier => {
    const masterData = masterByName.get(supplier.name.toLowerCase());

    if (masterData) {
      return {
        ...supplier,
        country: masterData.country || supplier.country,
        region: masterData.region || supplier.region,
        riskScore: masterData.riskScore ?? supplier.riskScore,
        qualityRating: masterData.qualityRating ?? supplier.qualityRating,
        isDiverse: masterData.isDiverse,
        hasCertifications: masterData.hasCertifications,
      };
    }

    return supplier;
  });
}

/**
 * Read file as text
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Parse file based on type
 */
export async function parseFile(
  file: File,
  type: 'spend' | 'supplier-master' | 'contracts'
): Promise<ParsedSpendData | ParsedSupplierMaster | ParsedContracts> {
  const text = await readFileAsText(file);

  switch (type) {
    case 'spend':
      return parseSpendData(text);
    case 'supplier-master':
      return parseSupplierMaster(text);
    case 'contracts':
      return parseContracts(text);
    default:
      throw new Error(`Unknown file type: ${type}`);
  }
}

export default {
  parseSpendData,
  parseSupplierMaster,
  parseContracts,
  mergeSupplierData,
  readFileAsText,
  parseFile,
};
