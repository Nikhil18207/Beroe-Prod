"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ArrowRight,
  Pencil,
  Check,
  ChevronDown,
  Upload,
  ArrowUpRight,
  Home,
  Activity,
  ShieldCheck,
  Search,
  User,
  LogOut,
  FolderOpen,
  Loader2,
  FileSpreadsheet,
  X,
  AlertCircle,
  Eye,
  Plus,
  FileText,
  Database,
  BookOpen,
  MoreHorizontal,
  CheckCircle2,
  Circle,
  Zap,
  Target,
  AlertTriangle,
  RefreshCw,
  Save,
  ChevronRight,
  BarChart3,
  MapPin,
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  Building2,
  FileCheck,
  Filter,
  ListFilter,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useRef, useState, useEffect, useCallback, useMemo, useDeferredValue, memo } from "react";
import { useApp, type DataPoint, type DataPointItem, type SetupOpportunity, type ProofPoint } from "@/context/AppContext";
import { procurementApi, authApi } from "@/lib/api";
import {
  computeAllMetrics,
  calculateOpportunitySavings,
  calculateSavingsSummary,
  evaluateProofPoint,
  type SupplierProfile,
  type ContractInfo,
  type SpendRecord,
  type ComputedMetrics,
  type OpportunityMetrics,
} from "@/lib/calculations";
import { parseFile, getFileCategory, SUPPORTED_FORMATS_STRING } from "@/lib/fileParser";
import {
  detectAllColumns,
  detectAllColumnsCached,
  parseNumericValue,
  calculateRowSpend,
  getRowLocation,
  getRowSupplier,
  aggregateSpendDataFast,
  formatAggregatedData,
  clearColumnCache,
} from "@/lib/columnMatcher";
import { useSupabaseStorage } from "@/lib/hooks/useSupabaseStorage";
import { canEdit, canUpload, isViewer } from "@/types/api";
import { toast } from "sonner";

// Extended DataPoint with icon for UI
interface DataPointWithIcon extends DataPoint {
  icon: React.ReactNode;
}

// Define required data fields and their column mappings
interface DataField {
  name: string;
  requiredColumns: string[];
  description: string;
}

// Shared category column patterns - used for filtering spend data by selected categories
// Order matters: more specific patterns first, generic ones last
const CATEGORY_COLUMN_PATTERNS = [
  // Level 3 category (most specific)
  "category_level_3", "categorylevel3", "category_level3",
  // Material/Product names (common in spend data)
  "material_name", "materialname", "material_description",
  "material_code", "materialcode", "material_type",
  "product_name", "productname", "product_description",
  // Commodity types
  "commodity_type", "commoditytype", "commodity_name",
  // Sub-category
  "sub_category", "subcategory", "sub_commodity",
  // Generic category columns
  "category", "commodity", "segment", "product_type", "product",
  "item_category", "item_type", "item_name", "item",
  // Fallback patterns
  "material", "type", "description", "name"
];

// Generic/common words that shouldn't trigger a category match on their own
const GENERIC_CATEGORY_WORDS = new Set([
  'oil', 'oils', 'raw', 'refined', 'crude', 'pure', 'organic', 'natural',
  'grade', 'type', 'class', 'category', 'product', 'material', 'item',
  'bulk', 'packed', 'liquid', 'solid', 'powder', 'paste',
  'food', 'industrial', 'technical', 'commercial', 'premium', 'standard',
  'virgin', 'extra', 'light', 'heavy', 'dark', 'white', 'yellow', 'red',
  'high', 'low', 'medium', 'fine', 'coarse', 'processed', 'unprocessed',
  'seed', 'seeds', 'bean', 'beans', 'nut', 'nuts', 'fruit', 'fruits',
  'extract', 'extracts', 'derivative', 'derivatives', 'based', 'blend'
]);

// Levenshtein distance for fuzzy matching
const levenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[b.length][a.length];
};

// Smart category matching - handles variations like "Palm Oil" vs "Palm Oils"
// but won't match "Palm Oil" with "Soybean Oil" just because they share "Oil"
const isCategoryMatch = (category1: string, category2: string): boolean => {
  const norm1 = category1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const norm2 = category2.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Exact match after normalization
  if (norm1 === norm2) return true;

  // One fully contains the other
  // For shorter strings (3+ chars), still check contains for cases like "palm" in "palmoil"
  if (norm1.length >= 3 && norm2.length >= 3) {
    if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  }

  // Word-level matching - require significant word match
  const words1 = category1.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  const words2 = category2.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);

  // Get significant (non-generic) words
  const significant1 = words1.filter(w => !GENERIC_CATEGORY_WORDS.has(w) && !GENERIC_CATEGORY_WORDS.has(w.replace(/s$/, '')));
  const significant2 = words2.filter(w => !GENERIC_CATEGORY_WORDS.has(w) && !GENERIC_CATEGORY_WORDS.has(w.replace(/s$/, '')));

  // If both have significant words, at least one must match
  if (significant1.length > 0 && significant2.length > 0) {
    for (const w1 of significant1) {
      for (const w2 of significant2) {
        const w1NoS = w1.replace(/s$/, '');
        const w2NoS = w2.replace(/s$/, '');
        // Exact word match (ignoring trailing 's')
        if (w1 === w2 || w1NoS === w2NoS) return true;
        // Substring match (e.g., "soy" matches "soybean")
        if (w1.length >= 3 && w2.length >= 3) {
          if (w1.includes(w2) || w2.includes(w1)) return true;
        }
        // Fuzzy match for typos
        const wordMaxLen = Math.max(w1.length, w2.length);
        const wordMinLen = Math.min(w1.length, w2.length);
        if (wordMinLen >= 4 && (wordMaxLen - wordMinLen) <= 2) {
          const dist = levenshteinDistance(w1, w2);
          if (dist <= Math.max(1, Math.floor(wordMaxLen * 0.25))) return true;
        }
      }
    }
    return false; // No significant word matched
  }

  // Fallback: full string fuzzy match (only if very similar)
  const maxLen = Math.max(norm1.length, norm2.length);
  const minLen = Math.min(norm1.length, norm2.length);
  if (maxLen > 0 && (maxLen - minLen) / maxLen > 0.4) return false;
  const distance = levenshteinDistance(norm1, norm2);
  return distance <= Math.max(1, Math.floor(maxLen * 0.2));
};

// Spend Data Fields
const SPEND_DATA_FIELDS: DataField[] = [
  {
    name: "Spend by Location",
    requiredColumns: ["buyer_entity_id"],
    description: "Geographic spend distribution"
  },
  {
    name: "Spend by Supplier",
    requiredColumns: ["supplier_id"],
    description: "Supplier spend breakdown"
  },
  {
    name: "Volume by Supplier",
    requiredColumns: ["ordered_quantity"],
    description: "Volume data per supplier"
  },
  {
    name: "Volume by Geography",
    requiredColumns: ["ordered_quantity"],
    description: "Volume data by region"
  },
  {
    name: "Price",
    requiredColumns: ["should_cost_unit_price"],
    description: "Pricing information"
  }
];

// Supply Master Fields
const SUPPLY_MASTER_FIELDS: DataField[] = [
  {
    name: "Supplier ID",
    requiredColumns: ["supplier_id", "supplierid", "vendor_id", "vendorid", "supplier_code"],
    description: "Unique supplier identifier"
  },
  {
    name: "Supplier Name",
    requiredColumns: ["supplier_name", "suppliername", "vendor_name", "vendorname", "supplier"],
    description: "Supplier company name"
  },
  {
    name: "Contact Info",
    requiredColumns: ["email", "phone", "contact", "contact_person", "contact_email"],
    description: "Supplier contact details"
  },
  {
    name: "Location",
    requiredColumns: ["country", "region", "address", "city", "location", "headquarters"],
    description: "Supplier location"
  },
  {
    name: "Category",
    requiredColumns: ["category", "commodity", "segment", "product_type", "service_type"],
    description: "Supplier category/commodity"
  }
];

// Contracts Fields
const CONTRACTS_FIELDS: DataField[] = [
  {
    name: "Contract ID",
    requiredColumns: ["contract_id", "contractid", "contract_number", "agreement_id"],
    description: "Unique contract identifier"
  },
  {
    name: "Supplier",
    requiredColumns: ["supplier", "supplier_name", "vendor", "vendor_name", "party"],
    description: "Contract party/supplier"
  },
  {
    name: "Start Date",
    requiredColumns: ["start_date", "startdate", "effective_date", "commencement_date", "begin_date"],
    description: "Contract start date"
  },
  {
    name: "End Date",
    requiredColumns: ["end_date", "enddate", "expiry_date", "expiration_date", "termination_date"],
    description: "Contract end date"
  },
  {
    name: "Value",
    requiredColumns: ["value", "contract_value", "amount", "total_value", "spend"],
    description: "Contract value/amount"
  },
  {
    name: "Terms",
    requiredColumns: ["terms", "payment_terms", "conditions", "pricing_terms"],
    description: "Contract terms"
  }
];

// Category Playbook Fields
const PLAYBOOK_FIELDS: DataField[] = [
  {
    name: "Category",
    requiredColumns: ["category", "category_name", "commodity", "segment"],
    description: "Category identifier"
  },
  {
    name: "Strategy",
    requiredColumns: ["strategy", "sourcing_strategy", "approach", "methodology"],
    description: "Category strategy"
  },
  {
    name: "Market Analysis",
    requiredColumns: ["market", "market_analysis", "market_trends", "industry_analysis"],
    description: "Market intelligence"
  },
  {
    name: "Risk Assessment",
    requiredColumns: ["risk", "risk_assessment", "risk_level", "risk_factors"],
    description: "Category risk assessment"
  },
  {
    name: "Recommendations",
    requiredColumns: ["recommendation", "recommendations", "recommend", "action", "actions", "initiative", "initiatives", "opportunity", "opportunities", "suggestion", "suggestions", "next_steps", "nextsteps"],
    description: "Strategic recommendations"
  }
];

// Legacy constant for backward compatibility
const DATA_FIELDS = SPEND_DATA_FIELDS;

// Get fields by data point ID
const getFieldsForDataPoint = (dataPointId: string): DataField[] => {
  switch (dataPointId) {
    case "spend":
      return SPEND_DATA_FIELDS;
    case "supply-master":
      return SUPPLY_MASTER_FIELDS;
    case "contracts":
      return CONTRACTS_FIELDS;
    case "playbook":
      return PLAYBOOK_FIELDS;
    default:
      return [];
  }
};

// ============================================================================
// SUPER FLEXIBLE COLUMN MATCHING SYSTEM
// Handles: ANY case, numbers, symbols, abbreviations, partial matches
// Examples that ALL match "recommendations":
//   "Recommendation", "RECOMM", "rec_1", "Rec123", "RECOM-2", "recomm11", "REC", "recOM 1"
// ============================================================================

// Extract only letters from a string (removes numbers, symbols, spaces, underscores, etc.)
const extractLetters = (str: string): string => {
  return (str || '').toLowerCase().replace(/[^a-z]/g, '');
};

// Check if two strings match flexibly
const flexibleMatch = (csvColumn: string, requiredColumn: string): boolean => {
  const csvLetters = extractLetters(csvColumn);
  const requiredLetters = extractLetters(requiredColumn);

  // Skip if either is too short
  if (csvLetters.length < 2 || requiredLetters.length < 2) {
    return false;
  }

  // 1. Exact match (after extracting letters only)
  if (csvLetters === requiredLetters) {
    return true;
  }

  // 2. One contains the other fully
  if (csvLetters.includes(requiredLetters) || requiredLetters.includes(csvLetters)) {
    return true;
  }

  // 3. Prefix match - CSV starts with required OR required starts with CSV
  //    Handles: "rec" -> "recommendations", "recomm" -> "recommendations"
  if (csvLetters.length >= 2 && requiredLetters.startsWith(csvLetters)) {
    return true;
  }
  if (requiredLetters.length >= 2 && csvLetters.startsWith(requiredLetters)) {
    return true;
  }

  // 4. First N characters match (minimum 3)
  //    Handles: "recom" matching "recommendations", "supp" matching "supplier"
  const minChars = Math.min(csvLetters.length, requiredLetters.length, 3);
  if (minChars >= 3) {
    if (csvLetters.substring(0, minChars) === requiredLetters.substring(0, minChars)) {
      return true;
    }
  }

  // 5. Check if CSV matches any common short form (2-4 chars)
  //    Handles: "cat" -> "category", "qty" -> "quantity", "amt" -> "amount"
  if (csvLetters.length >= 2 && csvLetters.length <= 4 && requiredLetters.startsWith(csvLetters)) {
    return true;
  }

  // 6. Significant overlap - if 70%+ of shorter string matches start of longer
  const shorter = csvLetters.length <= requiredLetters.length ? csvLetters : requiredLetters;
  const longer = csvLetters.length > requiredLetters.length ? csvLetters : requiredLetters;
  const overlapLength = Math.floor(shorter.length * 0.7);
  if (overlapLength >= 3 && longer.startsWith(shorter.substring(0, overlapLength))) {
    return true;
  }

  // 7. Check if either string starts with first 3+ chars of the other
  if (csvLetters.length >= 3 && requiredLetters.substring(0, 3) === csvLetters.substring(0, 3)) {
    return true;
  }

  return false;
};

// Check if a column matches any of the required columns (SUPER FLEXIBLE)
const hasColumn = (csvColumns: string[], requiredColumns: string[]): boolean => {
  return requiredColumns.some(required => {
    return csvColumns.some(csv => flexibleMatch(csv, required));
  });
};

// Negative patterns - columns that should be excluded for certain types
const EXCLUDED_PATTERNS: Record<string, string[]> = {
  price: ['proof', 'point', 'primary', 'secondary', 'benchmark', 'reference', 'market'],
  rate: ['proof', 'point', 'primary', 'secondary', 'benchmark'],
  cost: ['proof', 'point', 'primary', 'secondary', 'benchmark'],
  spend: ['proof', 'point', 'benchmark', 'target', 'market'],
  supplier: [],  // Handled separately with scoring
};

// Check if a column should be excluded based on the required pattern
const shouldExcludeColumn = (csvColumn: string, requiredColumn: string): boolean => {
  if (!csvColumn || !requiredColumn) return false;
  const csvLower = csvColumn.toLowerCase();
  const excludePatterns = EXCLUDED_PATTERNS[requiredColumn.toLowerCase()];
  if (!excludePatterns) return false;

  return excludePatterns.some(pattern => csvLower.includes(pattern));
};

// Find which CSV column matches a required column (returns the original CSV column name)
const findMatchingColumn = (csvColumns: string[], requiredColumns: string[]): string | null => {
  // Filter out any undefined/null values
  const validCsvColumns = csvColumns.filter(col => col != null);
  const validRequiredColumns = requiredColumns.filter(col => col != null);

  // First pass: look for exact or strong matches, excluding bad patterns
  for (const required of validRequiredColumns) {
    for (const csv of validCsvColumns) {
      // Skip columns that should be excluded for this required type
      if (shouldExcludeColumn(csv, required)) {
        continue;
      }
      if (flexibleMatch(csv, required)) {
        return csv; // Return original column name (with original case/numbers)
      }
    }
  }
  return null;
};

// ============================================================================
// PROOF POINT TO DATA MAPPING
// Maps each proof point to the data sources and columns needed to validate it
// ============================================================================

interface ProofPointMapping {
  proofPointId: string;
  requiredDataPoints: string[]; // Which data points need to be validated
  requiredColumns: string[][]; // Columns to check (any match validates) - one array per data point
}

const PROOF_POINT_MAPPINGS: ProofPointMapping[] = [
  // Volume Bundling (8 proof points)
  {
    proofPointId: "vb-pp-1", // Regional Spend
    requiredDataPoints: ["spend"],
    requiredColumns: [["country", "region", "location", "geography"]]
  },
  {
    proofPointId: "vb-pp-2", // Tail Spend
    requiredDataPoints: ["spend"],
    requiredColumns: [["supplier", "supplier_name", "vendor", "spend", "spend_amount"]]
  },
  {
    proofPointId: "vb-pp-3", // Volume Leverage
    requiredDataPoints: ["spend"],
    requiredColumns: [["volume", "quantity", "qty", "units"]]
  },
  {
    proofPointId: "vb-pp-4", // Price Variance
    requiredDataPoints: ["spend"],
    requiredColumns: [["price", "unit_price", "rate", "cost"]]
  },
  {
    proofPointId: "vb-pp-5", // Avg Spend/Supplier
    requiredDataPoints: ["spend"],
    requiredColumns: [["supplier", "supplier_name", "vendor", "spend", "spend_amount"]]
  },
  {
    proofPointId: "vb-pp-6", // Market Consolidation
    requiredDataPoints: ["playbook"],
    requiredColumns: [["market", "market_analysis", "market_trend", "industry"]]
  },
  {
    proofPointId: "vb-pp-7", // Supplier Location
    requiredDataPoints: ["supply-master"],
    requiredColumns: [["country", "region", "location", "city", "address"]]
  },
  {
    proofPointId: "vb-pp-8", // Supplier Risk Rating
    requiredDataPoints: ["supply-master"],
    requiredColumns: [["risk", "risk_rating", "risk_level", "risk_score"]]
  },

  // Target Pricing (4 proof points)
  {
    proofPointId: "tp-pp-1", // Price Variance
    requiredDataPoints: ["spend"],
    requiredColumns: [["price", "unit_price", "rate", "cost"]]
  },
  {
    proofPointId: "tp-pp-2", // Tariff Rate
    requiredDataPoints: ["spend", "contracts"],
    requiredColumns: [["country", "region"], ["terms", "payment_terms"]]
  },
  {
    proofPointId: "tp-pp-3", // Cost Structure
    requiredDataPoints: ["spend"],
    requiredColumns: [["price", "unit_price", "spend", "spend_amount", "volume"]]
  },
  {
    proofPointId: "tp-pp-4", // Unit Price
    requiredDataPoints: ["spend"],
    requiredColumns: [["price", "unit_price", "rate", "cost_per_unit"]]
  },

  // Risk Management (7 proof points)
  {
    proofPointId: "rm-pp-1", // Single Sourcing
    requiredDataPoints: ["supply-master"],
    requiredColumns: [["supplier", "supplier_name", "supplier_id", "category"]]
  },
  {
    proofPointId: "rm-pp-2", // Supplier Concentration
    requiredDataPoints: ["spend", "supply-master"],
    requiredColumns: [["supplier", "supplier_name", "spend"], ["supplier_id", "supplier_name"]]
  },
  {
    proofPointId: "rm-pp-3", // Category Risk
    requiredDataPoints: ["playbook"],
    requiredColumns: [["risk", "risk_assessment", "risk_level", "risk_factor"]]
  },
  {
    proofPointId: "rm-pp-4", // Inflation
    requiredDataPoints: ["playbook"],
    requiredColumns: [["market", "market_trend", "market_analysis"]]
  },
  {
    proofPointId: "rm-pp-5", // Exchange Rate
    requiredDataPoints: ["spend"],
    requiredColumns: [["country", "region", "currency"]]
  },
  {
    proofPointId: "rm-pp-6", // Geo Political
    requiredDataPoints: ["spend", "supply-master"],
    requiredColumns: [["country", "region"], ["country", "region", "location"]]
  },
  {
    proofPointId: "rm-pp-7", // Supplier Risk Rating
    requiredDataPoints: ["supply-master"],
    requiredColumns: [["risk", "risk_rating", "risk_level", "risk_score"]]
  },

  // Re-specification Pack (3 proof points)
  {
    proofPointId: "rp-pp-1", // Price Variance
    requiredDataPoints: ["spend"],
    requiredColumns: [["price", "unit_price", "rate", "cost"]]
  },
  {
    proofPointId: "rp-pp-2", // Export Data
    requiredDataPoints: ["spend"],
    requiredColumns: [["country", "region", "location", "geography"]]
  },
  {
    proofPointId: "rp-pp-3", // Cost Structure
    requiredDataPoints: ["spend"],
    requiredColumns: [["price", "unit_price", "spend", "spend_amount", "volume"]]
  },
];

// ============================================================================
// PROOF POINT ID MAPPING
// Maps review page proof point IDs to procurement-metrics.ts threshold IDs
// ============================================================================
const PROOF_POINT_ID_TO_THRESHOLD_ID: Record<string, string> = {
  // Volume Bundling
  'vb-pp-1': 'PP_REGIONAL_SPEND',
  'vb-pp-2': 'PP_TAIL_SPEND',
  'vb-pp-3': 'PP_VOLUME_LEVERAGE',
  'vb-pp-4': 'PP_PRICE_VARIANCE',
  'vb-pp-5': 'PP_AVG_SPEND_SUPPLIER',
  'vb-pp-6': 'PP_MARKET_CONSOLIDATION',
  'vb-pp-7': 'PP_SUPPLIER_LOCATION',
  'vb-pp-8': 'PP_SUPPLIER_RISK_RATING',
  // Target Pricing
  'tp-pp-1': 'PP_PRICE_VARIANCE',
  'tp-pp-2': 'PP_TARIFF_RATE',
  'tp-pp-3': 'PP_COST_STRUCTURE',
  'tp-pp-4': 'PP_UNIT_PRICE',
  // Risk Management
  'rm-pp-1': 'PP_SINGLE_SOURCING',
  'rm-pp-2': 'PP_SUPPLIER_CONCENTRATION',
  'rm-pp-3': 'PP_CATEGORY_RISK',
  'rm-pp-4': 'PP_INFLATION',
  'rm-pp-5': 'PP_EXCHANGE_RATE',
  'rm-pp-6': 'PP_GEO_POLITICAL',
  'rm-pp-7': 'PP_SUPPLIER_RISK_RATING',
  // Re-specification Pack
  'rp-pp-1': 'PP_PRICE_VARIANCE',
  'rp-pp-2': 'PP_EXPORT_DATA',
  'rp-pp-3': 'PP_COST_STRUCTURE',
};

// Get the threshold ID for evaluation, returns original ID if no mapping exists
const getThresholdId = (proofPointId: string): string => {
  return PROOF_POINT_ID_TO_THRESHOLD_ID[proofPointId] || proofPointId;
};

// LocalStorage keys for analysis data (must match AppContext.tsx)
const ANALYSIS_STORAGE_KEYS = [
  "beroe_spend_analysis",
  "beroe_opportunity_metrics",
  "beroe_savings_summary",
  "beroe_llm_evaluations",
];

export default function ReviewDataPage() {
  const router = useRouter();
  const { state, actions } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dataPointFileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Clear all cached analysis data when uploading new files.
   * This ensures consistent confidence scores by removing stale calculations.
   */
  const clearAnalysisCache = useCallback(() => {
    console.log('[Review] Clearing analysis cache for fresh calculations...');

    // Clear column detection cache for fresh detection
    clearColumnCache();

    // Clear context state
    actions.setSpendAnalysis(null);
    actions.setOpportunityMetrics(null);
    actions.setSavingsSummary(null);
    actions.setComputedMetrics(null);
    actions.setLlmProofPointEvaluations(null);

    // Clear localStorage directly for immediate effect
    if (typeof window !== "undefined") {
      ANALYSIS_STORAGE_KEYS.forEach(key => {
        localStorage.removeItem(key);
      });
    }

    // Reset proof point validation status in setup opportunities
    state.setupOpportunities.forEach(opp => {
      const resetProofPoints = opp.proofPoints.map(pp => ({
        ...pp,
        isValidated: false,
        impact: "Not Tested" as const,
        testScore: null,
      }));
      actions.updateSetupOpportunity({ ...opp, proofPoints: resetProofPoints });
    });

    console.log('[Review] Analysis cache cleared successfully');
  }, [actions, state.setupOpportunities]);

  // Hydration fix: only show user-dependent UI after mount
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Permission checks - use safe defaults during SSR to avoid hydration mismatch
  // During SSR/hydration: assume full permissions (most common case)
  // After hydration: use actual user permissions
  const userIsViewer = isMounted ? isViewer(state.user) : false;
  const userCanEdit = isMounted ? canEdit(state.user) : true;
  const userCanUpload = isMounted ? canUpload(state.user) : true;

  // Supabase storage hook for persistent file storage
  const {
    isLoading: isSupabaseLoading,
    error: supabaseError,
    session: supabaseSession,
    uploadedFiles: supabaseFiles,
    isInitialized: isSupabaseInitialized,
    uploadFile: uploadToSupabase,
    deleteFile: deleteFromSupabase,
    getFilesByType: getSupabaseFilesByType,
    getLatestFile: getLatestSupabaseFile,
    updateSessionData: updateSupabaseSession,
    saveAnalysisResults: saveToSupabase,
  } = useSupabaseStorage();

  const [uploadedFile, setUploadedFile] = useState<File | null>(state.setupData.uploadedFile);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Processing modal state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("Analyzing your spend data...");
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [isParsingCsv, setIsParsingCsv] = useState(false);
  const [isSpendExpanded, setIsSpendExpanded] = useState(false);

  // Check if we have spend data (either actual file OR persisted data)
  const hasSpendData = uploadedFile || state.persistedReviewData.spendFile;
  const spendFileName = uploadedFile?.name || state.persistedReviewData.spendFile?.fileName || "";

  // Check if we have data point files (either actual OR persisted)
  const hasDataPointFile = (dataPointId: string): boolean => {
    return !!dataPointFiles[dataPointId] || !!state.persistedReviewData.dataPointFiles[dataPointId];
  };
  const getDataPointFileName = (dataPointId: string): string => {
    return dataPointFiles[dataPointId]?.name || state.persistedReviewData.dataPointFiles[dataPointId]?.fileName || "";
  };
  
  // Track parsed columns and files for each data point
  const [dataPointColumns, setDataPointColumns] = useState<Record<string, string[]>>({});
  const [dataPointFiles, setDataPointFiles] = useState<Record<string, File>>({});
  const [parsingDataPoints, setParsingDataPoints] = useState<Set<string>>(new Set());
  const [expandedDataPoints, setExpandedDataPoints] = useState<Set<string>>(new Set());

  // Store fully parsed data for summary display (CSV, XLSX, DOCX, PDF, etc.)
  interface ParsedCsvData {
    headers: string[];
    rows: Record<string, string>[];
    // Document-specific content (for DOCX, PDF, etc.)
    htmlContent?: string;
    rawText?: string;
    isDocument?: boolean;
    documentType?: string;
  }
  const [parsedCsvDataStore, setParsedCsvDataStore] = useState<Record<string, ParsedCsvData>>({});

  // Backend spend summary - pre-computed by backend for instant display (no client processing)
  // When this is set, frontend skips local parsing and uses this directly
  interface BackendSpendSummary {
    success: boolean;
    session_id: string;
    category_name: string;
    file_name: string;
    total_spend: number;
    row_count: number;
    supplier_count: number;
    location_count: number;
    top_suppliers: Array<{ name: string; spend: number; percentage: number }>;
    top_locations: Array<{ name: string; spend: number; percentage: number }>;
    detected_columns: Record<string, string | null>;
    price_stats?: { min: number; max: number; avg: number; variance: number };
    processed_at: string | null;
  }
  const [backendSpendSummary, setBackendSpendSummary] = useState<BackendSpendSummary | null>(null);
  const [isUploadingToBackend, setIsUploadingToBackend] = useState(false);

  // Get data points from context and add icons for UI
  const contextDataPoints = state.dataPoints;
  const dataPointIcons: Record<string, React.ReactNode> = {
    "spend": <Database className="h-4 w-4" />,
    "supply-master": <FileText className="h-4 w-4" />,
    "contracts": <FileSpreadsheet className="h-4 w-4" />,
    "playbook": <BookOpen className="h-4 w-4" />,
    "other": <MoreHorizontal className="h-4 w-4" />,
  };

  const dataPointsWithIcons: DataPointWithIcon[] = contextDataPoints.map(dp => ({
    ...dp,
    icon: dataPointIcons[dp.id] || <FileText className="h-4 w-4" />,
  }));

  // Get opportunities from context
  const opportunities = state.setupOpportunities;

  // Modal state for viewing/adding items
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedDataPoint, setSelectedDataPoint] = useState<DataPointWithIcon | null>(null);
  const [currentUploadTarget, setCurrentUploadTarget] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Opportunities modal state
  const [expandedOpportunities, setExpandedOpportunities] = useState<Set<string>>(new Set());
  const [isOpportunityModalOpen, setIsOpportunityModalOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<SetupOpportunity | null>(null);
  const [isOpportunitiesListOpen, setIsOpportunitiesListOpen] = useState(false);

  // Summary modal state
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [summaryDataPointId, setSummaryDataPointId] = useState<string | null>(null);

  // Sidebar accordion state - "Review your data" starts collapsed
  const [isReviewDataExpanded, setIsReviewDataExpanded] = useState(false);

  // ============================================================================
  // PERSISTENCE - Keep uploaded data after page refresh and navigation
  // Uses AppContext (localStorage) + Supabase for robust persistence
  // ============================================================================

  // Track if we've already restored persisted data to avoid duplicate restorations
  const [hasRestoredPersisted, setHasRestoredPersisted] = useState(false);
  const [hasRestoredFromSupabase, setHasRestoredFromSupabase] = useState(false);

  // Load persisted data from Supabase when initialized (takes priority over localStorage)
  useEffect(() => {
    if (!isSupabaseInitialized || hasRestoredFromSupabase) return;

    const restoreFromSupabase = async () => {
      try {
        // Check if we have files in Supabase
        if (supabaseFiles.length === 0 && !supabaseSession?.spend_data) {
          // No Supabase data, fall back to localStorage restoration
          setHasRestoredFromSupabase(true);
          return;
        }

        console.log('[Review] Restoring data from Supabase...', {
          files: supabaseFiles.length,
          hasSpendData: !!supabaseSession?.spend_data
        });

        // Restore spend file data from Supabase
        const spendFile = supabaseFiles.find(f => f.file_type === 'spend');
        if (spendFile && spendFile.parsed_data) {
          const { headers, rows, htmlContent, rawText } = spendFile.parsed_data;
          setCsvColumns(headers || []);
          setParsedCsvDataStore(prev => ({
            ...prev,
            spend: { headers, rows, htmlContent, rawText }
          }));

          // Update persisted data in AppContext too (for consistency)
          actions.updatePersistedSpendFile({
            fileName: spendFile.file_name,
            fileSize: spendFile.file_size,
            uploadedAt: new Date(spendFile.created_at).getTime(),
            columns: headers || [],
            parsedData: { headers, rows, htmlContent, rawText },
          });
        }

        // Restore other data point files from Supabase
        const fileTypeMap: Record<string, string> = {
          'playbook': 'playbook',
          'contracts': 'contracts',
          'supply-master': 'supply-master',
        };

        for (const [fileType, dataPointId] of Object.entries(fileTypeMap)) {
          const file = supabaseFiles.find(f => f.file_type === fileType);
          if (file && file.parsed_data) {
            const { headers, rows, htmlContent, rawText, isDocument, documentType } = file.parsed_data;

            setDataPointColumns(prev => ({ ...prev, [dataPointId]: headers || [] }));
            setParsedCsvDataStore(prev => ({
              ...prev,
              [dataPointId]: { headers, rows, htmlContent, rawText }
            }));

            // Update persisted data in AppContext
            actions.updatePersistedDataPointFile(dataPointId, {
              fileName: file.file_name,
              fileSize: file.file_size,
              uploadedAt: new Date(file.created_at).getTime(),
              columns: headers || [],
              parsedData: { headers, rows, htmlContent, rawText, isDocument, documentType },
            });

            // Update data point items in context
            const targetDataPoint = state.dataPoints.find(dp => dp.id === dataPointId);
            if (targetDataPoint && targetDataPoint.items.length === 0) {
              actions.updateDataPoint({
                ...targetDataPoint,
                items: [{
                  id: `supabase-${file.id}`,
                  name: file.file_name.replace(/\.[^/.]+$/, ""),
                  fileName: file.file_name,
                  uploadedAt: new Date(file.created_at),
                }]
              });
            }
          }
        }

        // Restore session data (category, spend, opportunities, etc.)
        if (supabaseSession) {
          if (supabaseSession.category_name) {
            actions.updateSetupData({ categoryName: supabaseSession.category_name });
          }
          if (supabaseSession.spend && supabaseSession.spend > 0) {
            actions.updateSetupData({ spend: Number(supabaseSession.spend) });
          }
          if (supabaseSession.computed_metrics) {
            // Extract opportunityMetrics if saved, then set the rest as computed metrics
            const { opportunityMetrics, ...restMetrics } = supabaseSession.computed_metrics;
            actions.setComputedMetrics(restMetrics);
            if (opportunityMetrics) {
              actions.setOpportunityMetrics(opportunityMetrics);
            }
          }
          if (supabaseSession.opportunities && supabaseSession.opportunities.length > 0) {
            // Merge validation status from Supabase into existing opportunities
            // Don't replace opportunities entirely - just update isValidated status
            const supabaseOpps = supabaseSession.opportunities;

            // Create a map of proof point validation status from Supabase
            const validationMap = new Map<string, boolean>();
            supabaseOpps.forEach((opp: any) => {
              if (opp.proofPoints) {
                opp.proofPoints.forEach((pp: any) => {
                  validationMap.set(`${opp.id}-${pp.id}`, pp.isValidated || false);
                });
              }
            });

            // Update existing opportunities with validation status from Supabase
            state.setupOpportunities.forEach(opp => {
              const updatedProofPoints = opp.proofPoints.map(pp => ({
                ...pp,
                isValidated: validationMap.get(`${opp.id}-${pp.id}`) || pp.isValidated,
              }));

              // Only update if there are actual validation changes
              const hasChanges = updatedProofPoints.some(
                (pp, idx) => pp.isValidated !== opp.proofPoints[idx].isValidated
              );

              if (hasChanges) {
                actions.updateSetupOpportunity({
                  ...opp,
                  proofPoints: updatedProofPoints,
                });
              }
            });
          }
        }

        setHasRestoredFromSupabase(true);
        setHasRestoredPersisted(true); // Skip localStorage restoration
        console.log('[Review] Restored data from Supabase successfully');
      } catch (err) {
        console.error('[Review] Failed to restore from Supabase:', err);
        setHasRestoredFromSupabase(true); // Continue with localStorage fallback
      }
    };

    restoreFromSupabase();
  }, [isSupabaseInitialized, supabaseFiles, supabaseSession, hasRestoredFromSupabase, actions, state.dataPoints]);

  // Load persisted data from localStorage (fallback if Supabase has no data)
  useEffect(() => {
    const persistedData = state.persistedReviewData;

    // Only restore once, and only if there's data to restore
    // Skip if we already restored from Supabase
    if (hasRestoredPersisted) return;
    if (!persistedData.spendFile && (!persistedData.dataPointFiles || Object.keys(persistedData.dataPointFiles).length === 0)) return;

    // Restore spend file data
    if (persistedData.spendFile) {
      setCsvColumns(persistedData.spendFile.columns);
      if (persistedData.spendFile.parsedData) {
        setParsedCsvDataStore(prev => ({
          ...prev,
          spend: persistedData.spendFile!.parsedData!
        }));
      }
      // Create a placeholder to show file is "uploaded" (actual File object can't be persisted)
      // The UI will show the file name from persisted data
    }

    // Restore data point files
    if (persistedData.dataPointFiles) {
      Object.entries(persistedData.dataPointFiles).forEach(([dataPointId, fileData]) => {
        setDataPointColumns(prev => ({ ...prev, [dataPointId]: fileData.columns }));
        if (fileData.parsedData) {
          setParsedCsvDataStore(prev => ({
            ...prev,
            [dataPointId]: fileData.parsedData!
          }));
        }

        // Update the data point items in context to show file is uploaded
        const targetDataPoint = state.dataPoints.find(dp => dp.id === dataPointId);
        if (targetDataPoint && targetDataPoint.items.length === 0) {
          actions.updateDataPoint({
            ...targetDataPoint,
            items: [{
              id: `persisted-${dataPointId}`,
              name: fileData.fileName.replace(/\.[^/.]+$/, ""),
              fileName: fileData.fileName,
              uploadedAt: new Date(fileData.uploadedAt),
            }]
          });
        }
      });
    }

    setHasRestoredPersisted(true);
  }, [state.persistedReviewData, hasRestoredPersisted, state.dataPoints, actions]); // Run when persisted data changes

  // BACKEND SUMMARY FETCH - Load pre-computed summary on page load for instant display
  // This handles page refresh: backend has the data, frontend displays instantly
  useEffect(() => {
    // Only fetch if we have a session and no backend summary yet
    if (!state.sessionId || backendSpendSummary) return;

    const fetchBackendSummary = async () => {
      try {
        console.log('[Review] Fetching backend spend summary for session:', state.sessionId);
        const summary = await procurementApi.getSpendSummary(state.sessionId!);

        if (summary.success && summary.total_spend > 0) {
          console.log('[Review] Backend summary loaded:', {
            totalSpend: summary.total_spend,
            rowCount: summary.row_count,
          });
          setBackendSpendSummary(summary);

          // Update context spend if not already set
          if (!state.setupData.spend || state.setupData.spend === 0) {
            actions.updateSetupData({ spend: summary.total_spend });
          }
        }
      } catch (err) {
        // Backend doesn't have data for this session - that's fine, will use local processing
        console.log('[Review] No backend summary available, using local data');
      }
    };

    fetchBackendSummary();
  }, [state.sessionId, backendSpendSummary, state.setupData.spend, actions]);

  // Note: The hasSpendData variable already handles checking both uploadedFile and persistedReviewData
  // so no additional sync effect is needed here

  // Data Validation Modal state
  interface CellError {
    row: number;
    column: string;
    columnIndex: number;
    value: string;
    error: string;
    severity: "error" | "warning";
  }

  interface ParsedData {
    headers: string[];
    rows: string[][];
    totalRows: number; // Total rows in file (may be more than displayed)
    htmlContent?: string; // Rich HTML content for document files (DOCX)
    isDocument?: boolean; // True if this is a document file (not tabular data)
    rawText?: string; // Raw text content for editing
    documentType?: string; // Detected document type (contract, supplier_master, playbook, etc.)
  }

  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [validationDataPoint, setValidationDataPoint] = useState<{ id: string; name: string; file?: File } | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [cellErrors, setCellErrors] = useState<CellError[]>([]);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const validationFileInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Use ref to track latest parsedData for revalidation
  const parsedDataRef = useRef<ParsedData | null>(null);

  // Flag to prevent LLM evaluation effect from running multiple times
  const llmEvaluationCompletedRef = useRef(false);

  // Virtual scrolling state
  const [scrollTop, setScrollTop] = useState(0);
  // Virtual scrolling constants - optimized for 1M+ rows
  const ROW_HEIGHT = 36; // Height of each row in pixels
  const VISIBLE_ROWS = 50; // Number of rows to render at once (increased for smoother scrolling)
  const BUFFER_ROWS = 20; // Extra rows to render above/below viewport (increased buffer)

  // Computed metrics state - stores calculated procurement analytics
  const [computedMetrics, setComputedMetrics] = useState<ComputedMetrics | null>(null);
  const [opportunityMetrics, setOpportunityMetrics] = useState<OpportunityMetrics[]>([]);

  // Category filter state for validation modal
  // "selected" = show only rows matching selected portfolio categories
  // "original" = show all original data without filtering
  // Default to "selected" if a category is already selected from portfolio page
  const [categoryFilterMode, setCategoryFilterModeRaw] = useState<"selected" | "original">(() => {
    // If user has selected categories or a category name, default to "selected" filter
    if (state.selectedCategories.length > 0 || (state.setupData.categoryName && state.setupData.categoryName !== "Category" && state.setupData.categoryName !== "")) {
      return "selected";
    }
    return "original";
  });

  // PERFORMANCE: Direct state change for instant UI response
  // Cache handles expensive computation, deferredValue prevents blocking
  const setCategoryFilterMode = useCallback((mode: "selected" | "original") => {
    setCategoryFilterModeRaw(mode);
  }, []);

  // PERFORMANCE: Defer the categoryFilterMode for expensive computations
  // This makes filteredData computation non-blocking when switching modes
  const deferredCategoryFilterMode = useDeferredValue(categoryFilterMode);

  // PERFORMANCE: Cache filtered data results to make switching instant
  // Key: stringified selectedCategories, Value: { rows, originalIndices, isFiltered }
  const filteredDataCacheRef = useRef<{
    key: string;
    data: { rows: string[][]; originalIndices: number[] | null; isFiltered: boolean };
  } | null>(null);

  // Document editor state for DOCX/document files
  const [documentContent, setDocumentContent] = useState<string>("");
  const documentEditorRef = useRef<HTMLDivElement>(null);

  // Parse uploaded file to extract column headers and full data when file changes
  useEffect(() => {
    // Race condition protection: cancel previous operations if file changes
    let isCancelled = false;

    if (uploadedFile) {
      setIsParsingCsv(true);

      // Use universal file parser for all file types
      parseFile(uploadedFile).then(async (result) => {
        // Check if this operation was cancelled (user uploaded a new file)
        if (isCancelled) {
          console.log('[Review] File parsing cancelled - newer file uploaded');
          return;
        }

        if (result.success && result.data) {
          const { headers, rows } = result.data;

          setCsvColumns(headers);

          // Store parsed data for spend summary
          setParsedCsvDataStore(prev => ({
            ...prev,
            spend: { headers, rows }
          }));

          const parsedDataForStorage = { headers, rows };

          // Persist spend file data for navigation/refresh survival (localStorage)
          actions.updatePersistedSpendFile({
            fileName: uploadedFile.name,
            fileSize: uploadedFile.size,
            uploadedAt: Date.now(),
            columns: headers,
            parsedData: parsedDataForStorage,
          });

          // Check again before async Supabase upload
          if (isCancelled) return;

          // Also upload to Supabase for cross-browser/device persistence
          try {
            await uploadToSupabase('spend', uploadedFile, parsedDataForStorage);
            if (!isCancelled) {
              console.log('[Review] Spend file uploaded to Supabase');
            }
          } catch (err) {
            if (!isCancelled) {
              console.error('[Review] Failed to upload spend file to Supabase:', err);
              // Show user feedback for Supabase upload failure
              toast.warning('Cloud sync failed - your data is saved locally', {
                description: 'Changes will sync when connection is restored.',
              });
            }
          }

          // Extract category name from the first row ONLY if not already set from portfolio
          // Portfolio selection takes priority over CSV-extracted category
          if (!isCancelled && (!state.setupData.categoryName || state.setupData.categoryName === "Category")) {
            const normalizedHeaders = headers.map(h => (h || '').toLowerCase().replace(/[\s_-]/g, ''));
            const categoryColIdx = normalizedHeaders.findIndex(h =>
              h && (h.includes('category') || h.includes('commodity') || h.includes('segment'))
            );
            if (categoryColIdx !== -1 && rows.length > 0) {
              const categoryValue = rows[0][headers[categoryColIdx]];
              if (categoryValue && categoryValue.trim()) {
                actions.updateSetupData({ categoryName: categoryValue.trim() });
              }
            }
          }
        } else {
          // Parsing failed, show error
          if (!isCancelled) {
            setCsvColumns([result.error || 'Failed to parse file']);
          }
        }
        if (!isCancelled) {
          setIsParsingCsv(false);
        }
      }).catch((err) => {
        if (!isCancelled) {
          setIsParsingCsv(false);
          setCsvColumns(['Failed to parse file']);
          toast.error('Failed to parse file', {
            description: err instanceof Error ? err.message : 'Please try a different file format.',
          });
        }
      });
    } else {
      setCsvColumns([]);
      setIsSpendExpanded(false);
      // Clear spend data when file is removed
      setParsedCsvDataStore(prev => {
        const updated = { ...prev };
        delete updated.spend;
        return updated;
      });
    }

    // Cleanup: cancel pending operations when file changes or component unmounts
    return () => {
      isCancelled = true;
    };
    // Note: Only uploadedFile should trigger re-parsing. actions/uploadToSupabase are used
    // inside but excluded from deps to prevent infinite loops (they're not memoized)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedFile]);

  // Keep ref in sync with parsedData state for accurate revalidation
  useEffect(() => {
    parsedDataRef.current = parsedData;
  }, [parsedData]);

  // Compute procurement metrics when CSV data changes
  // IMPORTANT: This respects the categoryFilterMode - calculations use filtered or original data
  useEffect(() => {
    const spendData = parsedCsvDataStore["spend"];
    const supplyMasterData = parsedCsvDataStore["supply-master"];
    const contractsData = parsedCsvDataStore["contracts"];

    if (!spendData || spendData.rows.length === 0) {
      setComputedMetrics(null);
      setOpportunityMetrics([]);
      return;
    }

    // Computing procurement metrics from CSV data

    // Extract supplier profiles from spend data
    const supplierSpend = new Map<string, {
      spend: number;
      country?: string;
      region?: string;
      riskScore?: number;
    }>();

    const spendRecords: SpendRecord[] = [];
    const { headers, rows } = spendData;

    // Use cached column detection for performance (same headers = same result)
    const sampleRows = rows.slice(0, 50);
    const columns = detectAllColumnsCached(headers, sampleRows);

    // Debug: Log detected columns and headers
    console.log('[Review] CSV Headers:', headers.slice(0, 10), '... (total:', headers.length, ')');
    console.log('[Review] Detected columns:', columns);
    console.log('[Review] Processing', rows.length, 'rows');
    console.log('[Review] Spend column detected:', columns.spend);
    console.log('[Review] Category filter mode:', deferredCategoryFilterMode);

    // Filter rows based on deferredCategoryFilterMode (deferred for smooth UI)
    let rowsToProcess = spendData.rows;

    if (deferredCategoryFilterMode === "selected") {
      // Get selected category names
      let selectedCategoryNames: string[] = [];
      if (state.selectedCategories && state.selectedCategories.length > 0) {
        selectedCategoryNames = state.selectedCategories.map(name => name.toLowerCase());
      } else if (state.setupData.categoryName && state.setupData.categoryName !== "Category") {
        selectedCategoryNames = state.setupData.categoryName
          .split(',')
          .map(name => name.trim().toLowerCase())
          .filter(name => name.length > 0);
      }

      if (selectedCategoryNames.length > 0) {
        // Find category column using shared patterns
        let categoryColIdx = -1;
        const normalizedHeaders = headers.map(h => (h || '').toLowerCase().replace(/[^a-z0-9]/g, ''));

        for (const priorityCol of CATEGORY_COLUMN_PATTERNS) {
          const normalizedPriority = priorityCol.replace(/[^a-z0-9]/g, '');
          const idx = normalizedHeaders.findIndex(h => h && h.includes(normalizedPriority));
          if (idx !== -1) {
            categoryColIdx = idx;
            break;
          }
        }

        if (categoryColIdx !== -1) {
          const categoryColName = headers[categoryColIdx];

          // Filter rows using the smart category matching function
          rowsToProcess = spendData.rows.filter(row => {
            const rowCategory = row[categoryColName];
            if (!rowCategory) return false;

            // Check if row category matches any selected category
            for (const selectedCat of selectedCategoryNames) {
              if (isCategoryMatch(rowCategory, selectedCat)) {
                return true;
              }
            }
            return false;
          });

          console.log('[Review] Filtered rows for selected categories:', rowsToProcess.length, 'of', spendData.rows.length);
        }
      }
    }

    console.log('[Review] Processing', rowsToProcess.length, 'rows (filter mode:', deferredCategoryFilterMode, ')');

    // Process rows using smart column matcher
    rowsToProcess.forEach(row => {
      const supplier = getRowSupplier(row, columns) || 'Unknown';
      const spend = calculateRowSpend(row, columns);
      const country = getRowLocation(row, columns);

      if (supplier && spend > 0) {
        const existing = supplierSpend.get(supplier) || { spend: 0 };
        supplierSpend.set(supplier, {
          ...existing,
          spend: existing.spend + spend,
          country: country || existing.country,
        });

        spendRecords.push({
          supplier,
          spend,
          country: country || undefined,
          price: columns.price ? parseNumericValue(row[columns.price]) : undefined,
          quantity: columns.quantity ? parseNumericValue(row[columns.quantity]) : undefined,
        });
      }
    });

    const totalSpend = Array.from(supplierSpend.values()).reduce((sum, s) => sum + s.spend, 0);

    // Calculate ORIGINAL total spend (from all rows, not filtered) for consistency with backend
    // This ensures dashboard and backend always use the same total spend value
    let originalTotalSpend = totalSpend;
    if (deferredCategoryFilterMode === "selected" && spendData.rows.length > rowsToProcess.length) {
      // Recalculate total spend from ALL rows
      const allSupplierSpend = new Map<string, number>();
      spendData.rows.forEach(row => {
        const supplier = getRowSupplier(row, columns) || 'Unknown';
        const spend = calculateRowSpend(row, columns);
        if (supplier && spend > 0) {
          allSupplierSpend.set(supplier, (allSupplierSpend.get(supplier) || 0) + spend);
        }
      });
      originalTotalSpend = Array.from(allSupplierSpend.values()).reduce((sum, s) => sum + s, 0);
    }

    // Debug: Log total spend calculation
    console.log('[Review] Filtered spend calculated from CSV:', totalSpend);
    console.log('[Review] Original total spend (all rows):', originalTotalSpend);
    console.log('[Review] Number of suppliers (filtered):', supplierSpend.size);
    console.log('[Review] Number of spend records (filtered):', spendRecords.length);

    // Convert to supplier profiles
    const suppliers: SupplierProfile[] = Array.from(supplierSpend.entries()).map(([name, data], idx) => ({
      id: `supplier-${idx}`,
      name,
      spend: data.spend,
      spendPercentage: totalSpend > 0 ? (data.spend / totalSpend) * 100 : 0,
      country: data.country,
      region: data.country, // Use country as region if not available
      riskScore: data.riskScore,
    })).sort((a, b) => b.spend - a.spend);

    // Extract contracts if available
    const contracts: ContractInfo[] = [];
    if (contractsData && contractsData.rows.length > 0) {
      const contractColumns = detectAllColumns(contractsData.headers);

      contractsData.rows.forEach((row, idx) => {
        contracts.push({
          id: contractColumns.id ? row[contractColumns.id] : `contract-${idx}`,
          supplierId: getRowSupplier(row, contractColumns) || `supplier-${idx}`,
          value: calculateRowSpend(row, contractColumns),
          status: (contractColumns.status ? row[contractColumns.status]?.toLowerCase() : 'active') as 'active' | 'expired' | 'pending',
        });
      });
    }

    // Compute all metrics
    const metrics = computeAllMetrics(suppliers, contracts, spendRecords);
    setComputedMetrics(metrics);
    // Metrics computed successfully

    // Store metrics in context for dashboard use
    actions.setComputedMetrics(metrics as unknown as Record<string, number>);

    // IMPORTANT: Always store ORIGINAL total spend (all rows) in setupData
    // This ensures consistency with backend processing which uses the full uploaded file
    // Filtered spend is used for metrics/display, but setupData.spend must reflect full data
    if (originalTotalSpend > 0) {
      actions.updateSetupData({ spend: originalTotalSpend });
    }

    // Evaluate proof points and calculate opportunity savings
    const maturityScore = state.setupData.maturityScore || 2.5;
    const oppMetrics: OpportunityMetrics[] = opportunities.map(opp => {
      // Map proof points to evaluation results
      const proofPointResults = opp.proofPoints.map(pp => {
        // Get the metric value for this proof point
        let value = 0;
        switch (pp.id) {
          case 'vb-pp-1': // Regional Spend
            value = metrics.regionalConcentration;
            break;
          case 'vb-pp-2': // Tail Spend
            value = metrics.tailSpendPercentage;
            break;
          case 'vb-pp-3': // Volume Leverage
            value = metrics.supplierCount;
            break;
          case 'vb-pp-4': // Price Variance
          case 'tp-pp-1': // Price Variance
          case 'rp-pp-1': // Price Variance
            value = metrics.priceVariance;
            break;
          case 'vb-pp-5': // Avg Spend/Supplier
            value = metrics.avgSpendPerSupplier;
            break;
          case 'vb-pp-6': // Market Consolidation
            value = metrics.hhiIndex;
            break;
          case 'vb-pp-7': // Supplier Location
            value = metrics.regionalConcentration;
            break;
          case 'vb-pp-8': // Supplier Risk Rating
          case 'rm-pp-7': // Supplier Risk Rating
            value = metrics.highRiskSupplierSpend;
            break;
          case 'tp-pp-2': // Tariff Rate
            value = 5; // Default estimate
            break;
          case 'tp-pp-3': // Cost Structure
          case 'rp-pp-3': // Cost Structure
            value = 50; // Default estimate
            break;
          case 'tp-pp-4': // Unit Price
            value = metrics.priceVariance > 0 ? metrics.priceVariance : 10;
            break;
          case 'rm-pp-1': // Single Sourcing
            value = metrics.singleSourceSpend;
            break;
          case 'rm-pp-2': // Supplier Concentration
            value = metrics.top3Concentration;
            break;
          case 'rm-pp-3': // Category Risk
            value = metrics.overallRiskScore;
            break;
          case 'rm-pp-4': // Inflation
            value = 5; // Default estimate
            break;
          case 'rm-pp-5': // Exchange Rate
            value = metrics.geoConcentrationRisk > 50 ? 30 : 15;
            break;
          case 'rm-pp-6': // Geo Political
            value = metrics.geoConcentrationRisk;
            break;
          case 'rp-pp-2': // Export Data
            value = metrics.regionalConcentration > 70 ? 25 : 10;
            break;
          default:
            value = 50; // Default
        }

        // Map proof point ID to threshold ID for correct evaluation
        const thresholdId = getThresholdId(pp.id);
        // Pass isValidated so confidence is calculated based on actual validation status
        return evaluateProofPoint(thresholdId, value, opp.id, pp.isValidated);
      });

      // Calculate savings using 7-step methodology
      const savings = calculateOpportunitySavings(
        opp.id,
        proofPointResults,
        totalSpend || state.setupData.spend || 50000000,
        maturityScore
      );

      return {
        opportunityId: opp.id,
        name: opp.name,
        proofPoints: proofPointResults,
        impactScore: savings.impactScore,
        impactBucket: savings.impactBucket,
        savingsLow: savings.savingsLow,
        savingsHigh: savings.savingsHigh,
        savingsEstimate: savings.savingsEstimate,
        confidenceScore: savings.confidenceScore,
        confidenceBucket: savings.confidenceBucket,
        weightage: savings.weightage,
      };
    });

    setOpportunityMetrics(oppMetrics);
    // Store opportunity metrics in context for opportunities page to use
    actions.setOpportunityMetrics(oppMetrics.map(m => ({
      opportunityId: m.opportunityId,
      name: m.name,
      impactScore: m.impactScore,
      impactBucket: m.impactBucket,
      savingsLow: m.savingsLow,
      savingsHigh: m.savingsHigh,
      savingsEstimate: m.savingsEstimate,
      confidenceScore: m.confidenceScore,
      confidenceBucket: m.confidenceBucket,
    })));
    // Opportunity metrics calculated

    // Calculate and store savings summary
    const savingsSummary = calculateSavingsSummary(
      oppMetrics,
      totalSpend || state.setupData.spend || 50000000,
      maturityScore
    );

    // Store in context for dashboard
    actions.setSavingsSummary({
      total_savings_low: savingsSummary.totalSavingsLow,
      total_savings_high: savingsSummary.totalSavingsHigh,
      confidence_score: savingsSummary.confidenceScore,
      confidence_bucket: savingsSummary.confidenceBucket,
    });

    // Savings summary calculated

    // Save analysis results to Supabase for persistence across page refreshes
    // Save both the calculated metrics (oppMetrics) and the raw opportunities with validation status
    saveToSupabase({
      opportunities: opportunities, // Save the actual opportunities with isValidated proof points
      computed_metrics: {
        ...metrics as unknown as Record<string, number>,
        opportunityMetrics: oppMetrics, // Include the calculated metrics as well
      },
      spend_data: spendData,
    }).catch(err => {
      console.error('[Review] Failed to save analysis results to Supabase:', err);
      // Show user feedback for sync failure - data is still saved locally
      toast.warning('Cloud sync failed', {
        description: 'Your analysis is saved locally and will sync when connection is restored.',
      });
    });

    // Note: actions and saveToSupabase are excluded from deps to prevent infinite loops
    // These are hook/context functions that may not be memoized and can cause re-renders
    // PERFORMANCE: Uses deferredCategoryFilterMode to avoid blocking UI during filter changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedCsvDataStore, opportunities, state.setupData.maturityScore, state.setupData.spend, deferredCategoryFilterMode, state.selectedCategories, state.setupData.categoryName]);

  // Calculate field availability based on CSV columns (for spend data) - USES FLEXIBLE MATCHING
  // Note: Check hasSpendData (includes persisted data) instead of uploadedFile (local state lost on navigation)
  const getFieldStatus = (field: DataField): { available: boolean; matchedColumn?: string } => {
    if (!hasSpendData || csvColumns.length === 0) {
      return { available: false };
    }

    // Use the flexible matching function
    const matchedColumn = findMatchingColumn(csvColumns, field.requiredColumns);
    if (matchedColumn) {
      return { available: true, matchedColumn };
    }

    return { available: false };
  };

  // Calculate field availability for any data point - USES FLEXIBLE MATCHING
  // For document files (DOCX, PDF), also checks content for relevant keywords
  const getDataPointFieldStatus = (dataPointId: string, field: DataField): { available: boolean; matchedColumn?: string } => {
    // For spend data, use the main csvColumns
    if (dataPointId === "spend") {
      return getFieldStatus(field);
    }

    // For other data points, use their stored columns
    const columns = dataPointColumns[dataPointId];

    // First try column matching (for spreadsheet files)
    if (columns && columns.length > 0) {
      const matchedColumn = findMatchingColumn(columns, field.requiredColumns);
      if (matchedColumn) {
        return { available: true, matchedColumn };
      }
    }

    // For document files (DOCX, PDF, etc.), check if content contains relevant keywords
    // Get the stored parsed data and check content
    const parsedData = parsedCsvDataStore[dataPointId];
    if (parsedData && parsedData.rows.length > 0) {
      // Combine all row values into searchable text
      const allContent = parsedData.rows
        .map(row => Object.values(row).join(' '))
        .join(' ')
        .toLowerCase();

      // Check if any of the required column keywords appear in the content
      const keywordsToCheck = field.requiredColumns.flatMap(col => {
        // Split column names like "supplier_name" into ["supplier", "name"]
        const parts = col.toLowerCase().replace(/[_-]/g, ' ').split(' ');
        return [col.toLowerCase().replace(/[_-]/g, ' '), ...parts];
      });

      // Check for keyword matches in content
      for (const keyword of keywordsToCheck) {
        if (keyword.length >= 3 && allContent.includes(keyword)) {
          return { available: true, matchedColumn: `(from: Content)` };
        }
      }

      // Also check field name itself
      const fieldNameKeywords = field.name.toLowerCase().split(' ');
      for (const keyword of fieldNameKeywords) {
        if (keyword.length >= 3 && allContent.includes(keyword)) {
          return { available: true, matchedColumn: `(from: Content)` };
        }
      }
    }

    return { available: false };
  };

  // Get field counts for a data point
  const getDataPointFieldCounts = (dataPointId: string): { available: number; total: number } => {
    const fields = getFieldsForDataPoint(dataPointId);
    if (fields.length === 0) return { available: 0, total: 0 };
    
    const available = fields.filter(field => getDataPointFieldStatus(dataPointId, field).available).length;
    return { available, total: fields.length };
  };

  // Check if a data point has all required fields
  const isDataPointFullyValidated = (dataPointId: string): boolean => {
    const { available, total } = getDataPointFieldCounts(dataPointId);
    return total > 0 && available === total;
  };

  // Helper to get file extension
  const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };

  // Helper to check if file format is supported
  const isSupportedFormat = (file: File): boolean => {
    const ext = getFileExtension(file.name);
    const supportedExtensions = [
      // Spreadsheets
      'csv', 'xlsx', 'xls', 'xlsm', 'xlsb', 'ods',
      // Documents
      'pdf', 'doc', 'docx', 'rtf', 'odt',
      // Text-based
      'txt', 'md', 'markdown', 'json', 'xml', 'yaml', 'yml',
      'tex', 'latex', 'html', 'htm', 'log', 'ini', 'cfg', 'conf'
    ];
    return supportedExtensions.includes(ext);
  };

  // Helper to get file type category - use imported function
  const getFileTypeCategory = (file: File): 'spreadsheet' | 'document' | 'text' | 'unknown' => {
    return getFileCategory(file.name);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!isSupportedFormat(file)) {
        setUploadError("Unsupported file format. Please upload CSV, Excel, PDF, Word, or text files.");
        return;
      }

      // Clear ALL old data for fresh upload - complete replacement
      // 1. Clear context state (spendAnalysis, opportunityMetrics, etc.)
      clearAnalysisCache();

      // 2. Clear local component state
      setBackendSpendSummary(null);
      setParsedCsvDataStore({});
      setCsvColumns([]);
      setIsSpendExpanded(false);

      // 3. Clear old session ID to generate fresh one for this upload
      // This ensures backend treats this as completely new data
      actions.setSession(null);

      setUploadedFile(file);
      setUploadError(null);
      actions.updateSetupData({ uploadedFile: file, spend: 0 });

      // Record activity
      actions.addActivity({
        type: "upload",
        title: `Uploaded spend data`,
        description: `Uploaded ${file.name} for ${state.setupData.categoryName || 'category'} analysis.`,
        metadata: {
          fileName: file.name,
          categoryName: state.setupData.categoryName,
        },
      });

      // BACKEND CLEAN UPLOAD: Process file on backend with automatic old data deletion
      // Backend returns pre-computed summary - no client-side processing needed
      // Always generate fresh UUID for new upload - ensures backend does clean replacement
      const sessionId = crypto.randomUUID();
      const categoryName = state.setupData.categoryName || 'Unknown';

      setIsUploadingToBackend(true);
      try {
        console.log('[Review] Uploading spend data to backend for clean replacement...');
        const summary = await procurementApi.uploadSpendDataClean({
          sessionId,
          categoryName,
          file,
        });

        if (summary.success) {
          console.log('[Review] Backend processed spend data:', {
            totalSpend: summary.total_spend,
            rowCount: summary.row_count,
            supplierCount: summary.supplier_count,
            locationCount: summary.location_count,
          });

          // Store backend summary for instant display
          setBackendSpendSummary(summary);

          // Update context spend from backend calculation
          if (summary.total_spend > 0) {
            actions.updateSetupData({ spend: summary.total_spend });
          }

          // Store the new session ID
          actions.setSession(sessionId);

          toast.success('Spend data uploaded successfully', {
            description: `Processed ${summary.row_count.toLocaleString()} rows, ${summary.supplier_count} suppliers`,
          });
        }
      } catch (err) {
        // Backend upload is optional - silently fallback to local processing
        console.log('[Review] Backend unavailable, using local processing');
        // Store session ID so local processing can use it
        actions.setSession(sessionId);
        // Local processing will happen via useEffect - no warning needed
      } finally {
        setIsUploadingToBackend(false);
      }
    }
  };

  const handleRemoveFile = async () => {
    setUploadedFile(null);
    actions.updateSetupData({ uploadedFile: null, spend: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    // Collapse the spend data expanded section
    setIsSpendExpanded(false);
    // Clear CSV columns
    setCsvColumns([]);
    // Clear parsed CSV data for spend (this resets the Spend card to show "-")
    setParsedCsvDataStore(prev => {
      const updated = { ...prev };
      delete updated.spend;
      return updated;
    });
    // Clear backend spend summary
    setBackendSpendSummary(null);
    // Clear persisted spend file data
    actions.updatePersistedSpendFile(undefined);
    // Close validation modal if it's open
    setIsValidationModalOpen(false);
    setParsedData(null);
    setCellErrors([]);

    // Delete from backend database too (clean removal)
    if (state.sessionId) {
      try {
        await procurementApi.deleteSpendData(state.sessionId);
        console.log('[Review] Deleted spend data from backend');
      } catch (err) {
        console.warn('[Review] Failed to delete from backend:', err);
        // Don't show error to user - local clear succeeded
      }
    }
  };

  // Handle removing a data point file
  const handleRemoveDataPointFile = (dataPointId: string) => {
    // Remove the file from dataPointFiles
    setDataPointFiles(prev => {
      const updated = { ...prev };
      delete updated[dataPointId];
      return updated;
    });
    // Clear the parsed columns for this data point
    setDataPointColumns(prev => {
      const updated = { ...prev };
      delete updated[dataPointId];
      return updated;
    });
    // Clear parsed CSV data for this data point
    setParsedCsvDataStore(prev => {
      const updated = { ...prev };
      delete updated[dataPointId];
      return updated;
    });
    // Clear persisted data for this data point
    actions.updatePersistedDataPointFile(dataPointId, undefined);
    // Clear items in the data point using context actions
    const targetDataPoint = state.dataPoints.find(dp => dp.id === dataPointId);
    if (targetDataPoint) {
      actions.updateDataPoint({ ...targetDataPoint, items: [] });
    }
    // Clear the file input if present
    if (dataPointFileInputRef.current) {
      dataPointFileInputRef.current.value = "";
    }
    // Collapse the expanded row
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      newSet.delete(dataPointId);
      return newSet;
    });
    // Close validation modal if it's open
    setIsValidationModalOpen(false);
    setParsedData(null);
    setCellErrors([]);
  };

  // Handle file upload for data points
  const handleDataPointFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentUploadTarget) {
      // Validate file format
      if (!isSupportedFormat(file)) {
        setUploadError("Unsupported file format. Please upload CSV, Excel, PDF, Word, or text files.");
        setCurrentUploadTarget(null);
        return;
      }

      const ext = getFileExtension(file.name);
      const fileCategory = getFileTypeCategory(file);

      const newItem: DataPointItem = {
        id: Date.now().toString(),
        name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension for display
        fileName: file.name,
        uploadedAt: new Date(),
      };

      // Update in context for persistence
      const targetDataPoint = contextDataPoints.find(dp => dp.id === currentUploadTarget);
      if (targetDataPoint) {
        actions.updateDataPoint({
          ...targetDataPoint,
          items: [...targetDataPoint.items, newItem]
        });
      }

      // Store the file reference
      setDataPointFiles(prev => ({ ...prev, [currentUploadTarget!]: file }));

      // Record activity for data point upload
      const dataPointName = targetDataPoint?.name || currentUploadTarget;
      actions.addActivity({
        type: "upload",
        title: `Uploaded ${dataPointName}`,
        description: `Added ${file.name} to ${dataPointName} for analysis.`,
        metadata: {
          fileName: file.name,
          categoryName: state.setupData.categoryName,
        },
      });

      // Parse all file types using universal file parser
      setParsingDataPoints(prev => new Set([...prev, currentUploadTarget]));

      // Map data point ID to Supabase file type
      const dataPointToFileType: Record<string, 'spend' | 'playbook' | 'contracts' | 'supply-master' | 'other'> = {
        'playbook': 'playbook',
        'contracts': 'contracts',
        'supply-master': 'supply-master',
        'other': 'other',
      };
      const supabaseFileType = dataPointToFileType[currentUploadTarget!] || 'other';

      // Use the universal file parser
      parseFile(file).then(async (result) => {
        if (result.success && result.data) {
          const { headers, rows, htmlContent, rawText, metadata } = result.data;

          // Set columns for display
          setDataPointColumns(prev => ({ ...prev, [currentUploadTarget!]: headers }));

          // Store parsed data for summary (including document content for DOCX/PDF)
          setParsedCsvDataStore(prev => ({
            ...prev,
            [currentUploadTarget!]: { headers, rows, htmlContent, rawText }
          }));

          const parsedDataForStorage = {
            headers,
            rows,
            htmlContent,
            rawText,
            isDocument: metadata?.isDocument,
            documentType: metadata?.documentType,
          };

          // Persist data point file for navigation/refresh survival (localStorage)
          actions.updatePersistedDataPointFile(currentUploadTarget!, {
            fileName: file.name,
            fileSize: file.size,
            uploadedAt: Date.now(),
            columns: headers,
            parsedData: parsedDataForStorage,
          });

          // Also upload to Supabase for cross-browser/device persistence
          try {
            await uploadToSupabase(supabaseFileType, file, parsedDataForStorage);
            console.log(`[Review] ${currentUploadTarget} file uploaded to Supabase`);
          } catch (err) {
            console.error(`[Review] Failed to upload ${currentUploadTarget} file to Supabase:`, err);
            // Don't block - localStorage still works as fallback
            toast.warning('Cloud sync failed for data file', {
              description: 'Your data is saved locally and will sync when connection is restored.',
            });
          }
        } else {
          // Parsing failed, show error info
          setDataPointColumns(prev => ({
            ...prev,
            [currentUploadTarget!]: [result.error || `${ext.toUpperCase()} file - will be processed on analysis`]
          }));
        }

        setParsingDataPoints(prev => {
          const newSet = new Set(prev);
          newSet.delete(currentUploadTarget!);
          return newSet;
        });
      }).catch(() => {
        // Handle any unexpected errors
        setDataPointColumns(prev => ({
          ...prev,
          [currentUploadTarget!]: [`${ext.toUpperCase()} file - will be processed on analysis`]
        }));
        setParsingDataPoints(prev => {
          const newSet = new Set(prev);
          newSet.delete(currentUploadTarget!);
          return newSet;
        });
      });

      setCurrentUploadTarget(null);
      if (dataPointFileInputRef.current) {
        dataPointFileInputRef.current.value = "";
      }
    }
  };

  // Trigger file upload for a specific data point
  const triggerDataPointUpload = (dataPointId: string) => {
    if (!userCanUpload) return; // VIEWER cannot upload
    setCurrentUploadTarget(dataPointId);
    dataPointFileInputRef.current?.click();
  };

  // Remove item from data point
  const removeDataPointItem = (dataPointId: string, itemId: string) => {
    if (!userCanEdit) return; // VIEWER cannot remove
    const targetDataPoint = contextDataPoints.find(dp => dp.id === dataPointId);
    if (targetDataPoint) {
      actions.updateDataPoint({
        ...targetDataPoint,
        items: targetDataPoint.items.filter(item => item.id !== itemId)
      });
    }
  };

  // Toggle row expansion
  const toggleRowExpansion = (dataPointId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dataPointId)) {
        newSet.delete(dataPointId);
      } else {
        newSet.add(dataPointId);
      }
      return newSet;
    });
  };

  // Open view modal
  const openViewModal = (dataPoint: DataPointWithIcon) => {
    setSelectedDataPoint(dataPoint);
    setIsViewModalOpen(true);
  };

  // Format date and time for display (uses user's local timezone automatically)
  const formatDateTime = (date?: Date) => {
    if (!date) return { date: "-", time: "" };
    const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
    return { date: dateStr, time: timeStr };
  };

  // Simple date format for backward compatibility
  const formatDate = (date?: Date) => {
    if (!date) return "-";
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Get status text for data point
  const getDataPointStatus = (dataPoint: DataPoint) => {
    if (dataPoint.isSpendData) {
      return hasSpendData ? "Uploaded" : "Not Uploaded";
    }
    const count = dataPoint.items.length;
    if (count === 0) return "Not Uploaded";
    return "Uploaded";
  };

  // Get last updated date for data point (returns Date object or null)
  const getLastUpdatedDate = (dataPoint: DataPoint): Date | null => {
    if (dataPoint.isSpendData && hasSpendData) {
      // Use persisted timestamp if available
      const persistedSpend = state.persistedReviewData.spendFile;
      if (persistedSpend) {
        return new Date(persistedSpend.uploadedAt);
      }
      return new Date();
    }
    if (dataPoint.items.length === 0) return null;
    const latestItem = dataPoint.items.reduce((latest, item) =>
      (item.uploadedAt && (!latest.uploadedAt || item.uploadedAt > latest.uploadedAt)) ? item : latest
    );
    return latestItem.uploadedAt || null;
  };

  // ============================================================================
  // Data Validation Functions
  // ============================================================================

  // Validate cell data - SIMPLE: just check for empty/missing values
  const validateCell = (value: string, columnName: string, rowIndex: number, colIndex: number): CellError | null => {
    const trimmedValue = value?.trim() || '';
    
    // Check for empty cells
    if (!trimmedValue || trimmedValue === '') {
      return {
        row: rowIndex,
        column: columnName,
        columnIndex: colIndex,
        value: "(empty)",
        error: "Missing value",
        severity: "error"
      };
    }
    
    // Check for Excel formula errors
    const excelErrors = ['#REF!', '#N/A', '#VALUE!', '#DIV/0!', '#NAME?', '#NULL!', '#NUM!', '#ERROR!'];
    if (excelErrors.some(err => trimmedValue.toUpperCase().includes(err))) {
      return {
        row: rowIndex,
        column: columnName,
        columnIndex: colIndex,
        value,
        error: "Excel formula error",
        severity: "error"
      };
    }

    return null;
  };

  // Simple CSV line parser - optimized
  const parseCSVLine = (line: string): string[] => {
    if (!line.includes('"')) {
      return line.split(',').map(v => v.trim());
    }
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/"/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/"/g, ''));
    return values;
  };

  // HIGH PERFORMANCE: Parse large files with streaming and chunking
  const parseAndValidateFile = async (file: File, dataPointId?: string) => {
    setIsValidating(true);
    setParsedData(null);
    setCellErrors([]);
    setParseProgress(0);
    setScrollTop(0);

    try {
      const ext = getFileExtension(file.name);
      const fileSize = file.size;
      const isLargeFile = fileSize > 5 * 1024 * 1024; // > 5MB

      // For non-CSV files (Excel, PDF, etc.), use universal parser
      if (ext !== 'csv') {
        setParseProgress(30);
        const result = await parseFile(file);
        setParseProgress(80);

        if (result.success && result.data) {
          const { headers, rows: parsedRows, htmlContent, rawText, metadata } = result.data;
          const isDocument = metadata?.isDocument || false;
          const documentType = metadata?.documentType;

          // Convert Record<string, string>[] to string[][] for validation modal
          const rows: string[][] = parsedRows.slice(0, 10000).map(row =>
            headers.map(h => row[h] || '')
          );

          setParsedData({
            headers,
            rows,
            totalRows: parsedRows.length,
            htmlContent,
            isDocument,
            rawText,
            documentType
          });
          setParseProgress(100);

          // Update dataPointColumns to keep in sync with parsed headers
          if (dataPointId) {
            if (dataPointId === "spend") {
              setCsvColumns(headers);
            } else {
              setDataPointColumns(prev => ({ ...prev, [dataPointId]: headers }));
            }
          }

          // Only validate tabular data, not documents
          if (!isDocument) {
            validateDataAsync(headers, rows, dataPointId);
          } else {
            setIsValidating(false);
          }
        } else {
          setCellErrors([{
            row: 0,
            column: "File",
            columnIndex: 0,
            value: "",
            error: result.error || "Failed to parse file",
            severity: "error"
          }]);
          setParsedData({ headers: [], rows: [], totalRows: 0 });
          setIsValidating(false);
        }
        return;
      }

      // For large CSV files, use streaming approach
      if (isLargeFile) {
        await parseLargeFile(file, dataPointId);
        return;
      }

      // For smaller CSV files, use simple approach
      const text = await file.text();
      const lines = text.split('\n');
      const nonEmptyLines = lines.filter(line => line.trim());

      if (nonEmptyLines.length === 0) {
        setCellErrors([{
          row: 0,
          column: "File",
          columnIndex: 0,
          value: "",
          error: "File is empty",
          severity: "error"
        }]);
        setParsedData({ headers: [], rows: [], totalRows: 0 });
        setIsValidating(false);
        return;
      }

      const headers = parseCSVLine(nonEmptyLines[0]);
      const totalRows = nonEmptyLines.length - 1;

      // Parse all rows for display (virtual scroll will handle rendering)
      const maxRowsToStore = Math.min(totalRows, 10000); // Store max 10k rows in memory
      const rows: string[][] = [];

      for (let i = 1; i <= maxRowsToStore; i++) {
        rows.push(parseCSVLine(nonEmptyLines[i]));
        if (i % 1000 === 0) {
          setParseProgress(Math.round((i / maxRowsToStore) * 100));
          await new Promise(resolve => setTimeout(resolve, 0)); // Yield to UI
        }
      }

      setParsedData({ headers, rows, totalRows });
      setParseProgress(100);

      // Update dataPointColumns to keep in sync with parsed headers
      if (dataPointId) {
        if (dataPointId === "spend") {
          setCsvColumns(headers);
        } else {
          setDataPointColumns(prev => ({ ...prev, [dataPointId]: headers }));
        }
      }

      // Validate asynchronously in background - pass dataPointId
      validateDataAsync(headers, rows, dataPointId);

    } catch (err) {
      console.error("Error parsing file:", err);
      setCellErrors([{
        row: 0,
        column: "File",
        columnIndex: 0,
        value: "",
        error: "Failed to parse file",
        severity: "error"
      }]);
      setIsValidating(false);
    }
  };

  // Parse very large files (> 5MB) with streaming
  const parseLargeFile = async (file: File, dataPointId?: string) => {
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
    const decoder = new TextDecoder();
    let headers: string[] = [];
    const rows: string[][] = [];
    let totalRows = 0;
    let leftover = '';
    let isFirstLine = true;
    const maxRowsToStore = 10000;
    
    const reader = file.stream().getReader();
    let bytesRead = 0;
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        bytesRead += value?.length || 0;
        setParseProgress(Math.round((bytesRead / file.size) * 100));
        
        const chunk = leftover + decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        // Keep last incomplete line for next chunk
        leftover = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          if (isFirstLine) {
            headers = parseCSVLine(line);
            isFirstLine = false;
            continue;
          }
          
          totalRows++;
          if (rows.length < maxRowsToStore) {
            rows.push(parseCSVLine(line));
          }
        }
        
        // Yield to UI every chunk
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      // Process leftover
      if (leftover.trim()) {
        totalRows++;
        if (rows.length < maxRowsToStore) {
          rows.push(parseCSVLine(leftover));
        }
      }
      
      setParsedData({ headers, rows, totalRows });
      setParseProgress(100);

      // Update dataPointColumns to keep in sync with parsed headers
      if (dataPointId) {
        if (dataPointId === "spend") {
          setCsvColumns(headers);
        } else {
          setDataPointColumns(prev => ({ ...prev, [dataPointId]: headers }));
        }
      }

      // Validate in background - pass dataPointId
      validateDataAsync(headers, rows, dataPointId);

    } catch (err) {
      console.error("Error streaming file:", err);
      setCellErrors([{
        row: 0,
        column: "File",
        columnIndex: 0,
        value: "",
        error: "Failed to read file",
        severity: "error"
      }]);
      setIsValidating(false);
    }
  };

  // Validate data asynchronously to not block UI
  // Optimized for large datasets - validates in larger batches with smart sampling
  const validateDataAsync = async (headers: string[], rows: string[][], dataPointIdOverride?: string) => {
    const errors: CellError[] = [];
    // For large datasets, validate first 2000 rows + sample every Nth row
    const directValidateRows = Math.min(rows.length, 2000);
    const maxErrors = 100; // Limit errors shown

    // ========== HEADER-LEVEL CHECKS ==========

    // Check for empty headers
    headers.forEach((header, idx) => {
      if (!header || header.trim() === '' && errors.length < maxErrors) {
        errors.push({
          row: 0,
          column: `Column ${idx + 1}`,
          columnIndex: idx,
          value: "(empty)",
          error: "Empty column header",
          severity: "error"
        });
      }
    });

    // ========== MISSING REQUIRED FIELDS CHECK ==========
    // Check if required fields are missing based on the data point being validated
    // Uses the SUPER FLEXIBLE matching system (handles any case, numbers, symbols, abbreviations)
    const dataPointId = dataPointIdOverride || validationDataPoint?.id;
    if (dataPointId) {
      const fields = getFieldsForDataPoint(dataPointId);

      fields.forEach((field) => {
        // Use the flexible matching function - same as used in getDataPointFieldStatus
        const matchedColumn = findMatchingColumn(headers, field.requiredColumns);

        if (!matchedColumn && errors.length < maxErrors) {
          errors.push({
            row: 0,
            column: field.name,
            columnIndex: -1,
            value: `Expected: ${field.requiredColumns.slice(0, 3).join(', ')} (or similar)`,
            error: `Missing required field: ${field.name}`,
            severity: "warning"
          });
        }
      });
    }
    
    // ========== SIMPLE VALIDATION ==========
    // Only check for:
    // 1. Duplicate rows (excluding first column which is usually ID)
    // 2. Empty/missing cells anywhere
    
    // Track for duplicate detection (use ALL columns EXCEPT the first one which is ID)
    const rowHashes = new Map<string, number>();

    // Optimized validation for large datasets
    // Use larger batches and reduced yields for better throughput
    const BATCH_SIZE = 500; // Increased from 100
    const headerCount = headers.length;
    const hasMultipleColumns = headerCount > 1;

    for (let batchStart = 0; batchStart < directValidateRows && errors.length < maxErrors; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, directValidateRows);

      for (let rowIdx = batchStart; rowIdx < batchEnd && errors.length < maxErrors; rowIdx++) {
        const row = rows[rowIdx];

        // Check for completely empty rows - optimized with early exit
        let isEmpty = true;
        for (let i = 0; i < row.length; i++) {
          if (row[i] && row[i].trim() !== '') {
            isEmpty = false;
            break;
          }
        }

        if (isEmpty) {
          errors.push({
            row: rowIdx + 1,
            column: "Row",
            columnIndex: 0,
            value: "(empty row)",
            error: "Empty row detected",
            severity: "warning"
          });
          continue;
        }

        // Check for duplicate rows - optimized key generation
        if (hasMultipleColumns) {
          // Build key without creating intermediate array
          let rowKey = '';
          for (let i = 1; i < row.length; i++) {
            if (i > 1) rowKey += '|';
            rowKey += (row[i] || '').trim().toLowerCase();
          }

          const existingRow = rowHashes.get(rowKey);
          if (existingRow !== undefined) {
            errors.push({
              row: rowIdx + 1,
              column: "Row",
              columnIndex: 0,
              value: `Duplicate of row ${existingRow + 1}`,
              error: `Duplicate row - same data as row ${existingRow + 1} (excluding ID column)`,
              severity: "warning"
            });
          } else {
            rowHashes.set(rowKey, rowIdx);
          }
        }

        // Check each cell for empty values
        const colCount = Math.min(row.length, headerCount);
        for (let colIdx = 0; colIdx < colCount && errors.length < maxErrors; colIdx++) {
          const error = validateCell(row[colIdx], headers[colIdx], rowIdx + 1, colIdx);
          if (error) {
            errors.push(error);
          }
        }
      }

      // Yield to UI less frequently - every 2000 rows instead of 100
      if (batchStart % 2000 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    setCellErrors(errors);
    setIsValidating(false);
    return errors; // Return errors for checking
  };

  // MEMOIZED: Get filtered rows based on category filter mode
  // When "selected", only show rows where the category column matches one of the selected portfolio items
  // Optimized for 1M+ rows - avoids unnecessary array allocations
  const filteredData = useMemo(() => {
    if (!parsedData) return { rows: [] as string[][], originalIndices: null as number[] | null, isFiltered: false };

    // If showing original data, return all rows - use null for originalIndices to signal "use index directly"
    // PERFORMANCE: Uses categoryFilterMode directly with caching for instant switching
    if (categoryFilterMode === "original") {
      return {
        rows: parsedData.rows,
        originalIndices: null, // null means use direct index (optimization for large datasets)
        isFiltered: false
      };
    }

    // Get selected category names from context (set on portfolio page)
    let selectedCategoryNames: string[] = [];

    if (state.selectedCategories && state.selectedCategories.length > 0) {
      selectedCategoryNames = state.selectedCategories.map(name => name.toLowerCase());
    } else if (state.setupData.categoryName) {
      selectedCategoryNames = state.setupData.categoryName
        .split(',')
        .map(name => name.trim().toLowerCase())
        .filter(name => name.length > 0);
    }

    if (selectedCategoryNames.length === 0) {
      return {
        rows: parsedData.rows,
        originalIndices: null,
        isFiltered: false
      };
    }

    // PERFORMANCE: Check cache first for instant switching
    const cacheKey = `${parsedData.rows.length}-${selectedCategoryNames.sort().join('|')}`;
    if (filteredDataCacheRef.current?.key === cacheKey) {
      return filteredDataCacheRef.current.data;
    }

    // Find category column index using shared patterns
    let categoryColIdx = -1;
    const normalizedHeaders = parsedData.headers.map(h => (h || '').toLowerCase().replace(/[^a-z0-9]/g, ''));

    for (const priorityCol of CATEGORY_COLUMN_PATTERNS) {
      const normalizedPriority = priorityCol.replace(/[^a-z0-9]/g, '');
      const idx = normalizedHeaders.findIndex(h => h && h.includes(normalizedPriority));
      if (idx !== -1) {
        categoryColIdx = idx;
        break;
      }
    }

    if (categoryColIdx === -1) {
      return {
        rows: parsedData.rows,
        originalIndices: null,
        isFiltered: false
      };
    }

    // PERFORMANCE: Cache for smart category match results
    const matchCache = new Map<string, boolean>();

    // Filter rows using smart category matching
    const filteredRows: string[][] = [];
    const originalIndices: number[] = [];

    const rowCount = parsedData.rows.length;
    for (let idx = 0; idx < rowCount; idx++) {
      const row = parsedData.rows[idx];
      const categoryValue = row[categoryColIdx] || "";
      if (!categoryValue) continue;

      // Check against each selected category
      let matches = false;
      for (const selectedCat of selectedCategoryNames) {
        // Check cache first
        const cacheKey = `${categoryValue}|${selectedCat}`;
        let result = matchCache.get(cacheKey);
        if (result === undefined) {
          result = isCategoryMatch(categoryValue, selectedCat);
          matchCache.set(cacheKey, result);
        }
        if (result) {
          matches = true;
          break;
        }
      }

      if (matches) {
        filteredRows.push(row);
        originalIndices.push(idx);
      }
    }

    // PERFORMANCE: Cache the result for instant switching
    const result = { rows: filteredRows, originalIndices, isFiltered: true };
    filteredDataCacheRef.current = { key: cacheKey, data: result };
    return result;
  }, [parsedData, categoryFilterMode, state.selectedCategories, state.setupData.categoryName]);

  // PERFORMANCE: Pre-compute filtered data when file is parsed for instant switching
  // This runs once when parsedData changes and warms the cache in the background
  useEffect(() => {
    if (!parsedData || parsedData.rows.length === 0) return;

    // Get selected category names
    let selectedCategoryNames: string[] = [];
    if (state.selectedCategories && state.selectedCategories.length > 0) {
      selectedCategoryNames = state.selectedCategories.map(name => name.toLowerCase());
    } else if (state.setupData.categoryName) {
      selectedCategoryNames = state.setupData.categoryName
        .split(',')
        .map(name => name.trim().toLowerCase())
        .filter(name => name.length > 0);
    }

    if (selectedCategoryNames.length === 0) return;

    const cacheKey = `${parsedData.rows.length}-${[...selectedCategoryNames].sort().join('|')}`;

    // Skip if already cached
    if (filteredDataCacheRef.current?.key === cacheKey) return;

    // Pre-compute in background using requestIdleCallback for non-blocking operation
    const preComputeFilter = () => {
      // Find category column using shared patterns
      const normalizedHeaders = parsedData.headers.map(h => (h || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
      let categoryColIdx = -1;

      for (const priorityCol of CATEGORY_COLUMN_PATTERNS) {
        const normalizedPriority = priorityCol.replace(/[^a-z0-9]/g, '');
        const idx = normalizedHeaders.findIndex(h => h && h.includes(normalizedPriority));
        if (idx !== -1) {
          categoryColIdx = idx;
          break;
        }
      }

      if (categoryColIdx === -1) return;

      // Smart filtering using category matching that handles generic words properly
      const filteredRows: string[][] = [];
      const originalIndices: number[] = [];

      for (let idx = 0; idx < parsedData.rows.length; idx++) {
        const row = parsedData.rows[idx];
        const categoryValue = row[categoryColIdx] || "";
        if (!categoryValue) continue;

        // Check if row matches any selected category
        let matches = false;
        for (const selectedCat of selectedCategoryNames) {
          if (isCategoryMatch(categoryValue, selectedCat)) {
            matches = true;
            break;
          }
        }

        if (matches) {
          filteredRows.push(row);
          originalIndices.push(idx);
        }
      }

      // Store in cache
      filteredDataCacheRef.current = {
        key: cacheKey,
        data: { rows: filteredRows, originalIndices, isFiltered: true }
      };
    };

    // Run in background
    if ('requestIdleCallback' in window) {
      (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(preComputeFilter);
    } else {
      setTimeout(preComputeFilter, 50);
    }
  }, [parsedData, state.selectedCategories, state.setupData.categoryName]);

  // MEMOIZED: Virtual scrolling - Calculate which rows to render
  // Optimized for 1M+ rows - avoids slice when possible
  // Uses filteredData directly for instant updates (cache makes it fast)
  const visibleRows = useMemo(() => {
    const emptyResult = { startIndex: 0, endIndex: 0, rows: [] as string[][], originalIndices: [] as number[], totalFilteredRows: 0 };

    if (!parsedData) return emptyResult;
    if (!filteredData || !filteredData.rows) return emptyResult;

    const { rows: filteredRows, originalIndices, isFiltered } = filteredData;

    // Safety check for valid array
    if (!Array.isArray(filteredRows) || filteredRows.length === 0) return emptyResult;

    const startIndex = Math.max(0, Math.floor((scrollTop || 0) / ROW_HEIGHT) - BUFFER_ROWS);
    const endIndex = Math.min(
      filteredRows.length,
      startIndex + VISIBLE_ROWS + BUFFER_ROWS * 2
    );

    // Safety check for valid range
    const rangeLength = Math.max(0, endIndex - startIndex);
    if (rangeLength === 0) return emptyResult;

    // Generate indices for visible range - avoid creating full index array
    const visibleIndices: number[] = new Array(rangeLength);
    if (isFiltered && originalIndices) {
      // Use actual original indices for filtered data
      for (let i = 0; i < visibleIndices.length; i++) {
        visibleIndices[i] = originalIndices[startIndex + i] ?? (startIndex + i);
      }
    } else {
      // Direct mapping for original data (no filtering)
      for (let i = 0; i < visibleIndices.length; i++) {
        visibleIndices[i] = startIndex + i;
      }
    }

    return {
      startIndex,
      endIndex,
      rows: filteredRows.slice(startIndex, endIndex),
      originalIndices: visibleIndices,
      totalFilteredRows: filteredRows.length
    };
  }, [parsedData, filteredData, scrollTop]);

  // MEMOIZED: Filter cell errors based on category filter mode
  // When viewing "Selected Categories", only show errors for rows that are in the filtered view
  // Uses filteredData for non-blocking updates when switching filter modes
  const filteredCellErrors = useMemo(() => {
    const { originalIndices, isFiltered } = filteredData;

    // If showing original data (not filtered), return all errors
    if (!isFiltered || !originalIndices) {
      return cellErrors;
    }

    // Get the set of original row indices that are in the filtered view
    const filteredRowSet = new Set(originalIndices);

    // Filter errors to only include those for rows in the filtered view
    // Note: error.row is 1-based, originalIndices are 0-based
    return cellErrors.filter(error => {
      // Header-level errors (row 0) should always be shown
      if (error.row === 0) return true;
      // For row errors, check if the original row index is in the filtered set
      return filteredRowSet.has(error.row - 1);
    });
  }, [cellErrors, categoryFilterMode, filteredData]);

  // MEMOIZED: Count errors by severity for quick checks
  const errorCounts = useMemo(() => {
    let errors = 0;
    let warnings = 0;
    for (const e of cellErrors) {
      if (e.severity === "error") errors++;
      else warnings++;
    }
    return { errors, warnings, total: cellErrors.length };
  }, [cellErrors]);

  // MEMOIZED: Count filtered errors by severity
  const filteredErrorCounts = useMemo(() => {
    let errors = 0;
    let warnings = 0;
    for (const e of filteredCellErrors) {
      if (e.severity === "error") errors++;
      else warnings++;
    }
    return { errors, warnings, total: filteredCellErrors.length };
  }, [filteredCellErrors]);

  // Reset scroll position when category filter mode changes
  useEffect(() => {
    setScrollTop(0);
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTop = 0;
    }
  }, [categoryFilterMode]);

  // Handle table scroll for virtual scrolling - throttled with RAF for performance
  const scrollRafRef = useRef<number | null>(null);
  const handleTableScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;

    // Cancel any pending RAF
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
    }

    // Schedule update on next animation frame for smooth performance
    scrollRafRef.current = requestAnimationFrame(() => {
      setScrollTop(newScrollTop);
      scrollRafRef.current = null;
    });
  }, []);

  // Open validation modal for a data point - INSTANT OPEN, deferred processing
  const openValidationModal = (dataPointId: string, dataPointName: string) => {
    // INSTANT: Open modal immediately with loading state
    setValidationDataPoint({ id: dataPointId, name: dataPointName });
    setIsValidationModalOpen(true);
    setParsedData(null);
    setCellErrors([]);
    setEditingCell(null);
    setScrollTop(0);
    filteredDataCacheRef.current = null;

    // DEFERRED: Process data on next frame for smooth animation
    requestAnimationFrame(() => {
      // Get the file to validate
      if (dataPointId === "spend") {
        if (uploadedFile) {
          setValidationDataPoint({ id: dataPointId, name: dataPointName, file: uploadedFile });
          parseAndValidateFile(uploadedFile, dataPointId);
          return;
        }
        // Check persisted spend data (after refresh)
        const persistedSpend = state.persistedReviewData.spendFile;
        const storedSpendData = parsedCsvDataStore["spend"];
        if (storedSpendData || persistedSpend?.parsedData) {
          const data = storedSpendData || persistedSpend?.parsedData;
          if (data) {
            // Use setTimeout to chunk the work and keep UI responsive
            setTimeout(() => {
              const rows2D = data.rows.map(row =>
                data.headers.map(h => row[h] || '')
              );
              setParsedData({
                headers: data.headers,
                rows: rows2D,
                totalRows: rows2D.length,
              });
              // Validate in next frame
              requestAnimationFrame(() => {
                const errors: CellError[] = [];
                const maxErrorsToShow = 100; // Limit for performance
                for (let rowIdx = 0; rowIdx < rows2D.length && errors.length < maxErrorsToShow; rowIdx++) {
                  const row = rows2D[rowIdx];
                  for (let colIdx = 0; colIdx < row.length && errors.length < maxErrorsToShow; colIdx++) {
                    const error = validateCell(row[colIdx], data.headers[colIdx], rowIdx + 1, colIdx);
                    if (error) errors.push(error);
                  }
                }
                setCellErrors(errors);
              });
            }, 0);
          }
          return;
        }
      }

      // For other data points, use the stored file if available
      const storedFile = dataPointFiles[dataPointId];
      if (storedFile) {
        setValidationDataPoint({ id: dataPointId, name: dataPointName, file: storedFile });
        parseAndValidateFile(storedFile, dataPointId);
      } else {
        // No file object, but check if we have persisted parsed data (from refresh)
        const persistedFileData = state.persistedReviewData.dataPointFiles[dataPointId];
        const storedParsedData = parsedCsvDataStore[dataPointId];

        if (storedParsedData || persistedFileData?.parsedData) {
          // Use the already parsed/persisted data - no need to re-parse
          const data = storedParsedData || persistedFileData?.parsedData;
          if (data) {
            // Defer processing for smooth UI
            setTimeout(() => {
              const isDocument = data.isDocument || persistedFileData?.parsedData?.isDocument ||
                (data.htmlContent !== undefined || data.rawText !== undefined);

              // Convert rows to 2D array format for the modal
              const rows2D = data.rows.map(row =>
                data.headers.map(h => row[h] || '')
              );

              setParsedData({
                headers: data.headers,
                rows: rows2D,
                totalRows: rows2D.length,
                htmlContent: data.htmlContent,
                rawText: data.rawText,
                isDocument,
                documentType: data.documentType || persistedFileData?.parsedData?.documentType,
              });

              // Validate tabular data in next frame
              if (!isDocument) {
                requestAnimationFrame(() => {
                  const errors: CellError[] = [];
                  const maxErrorsToShow = 100;
                  for (let rowIdx = 0; rowIdx < rows2D.length && errors.length < maxErrorsToShow; rowIdx++) {
                    const row = rows2D[rowIdx];
                    for (let colIdx = 0; colIdx < row.length && errors.length < maxErrorsToShow; colIdx++) {
                      const error = validateCell(row[colIdx], data.headers[colIdx], rowIdx + 1, colIdx);
                      if (error) errors.push(error);
                    }
                  }
                  setCellErrors(errors);
                });
              }
            }, 0);
          }
        } else {
          // No data available
          setParsedData(null);
        }
      }
    });
  };

  // Handle cell edit
  const startEditingCell = (rowIdx: number, colIdx: number, value: string) => {
    if (!userCanEdit) return; // VIEWER cannot edit cells
    setEditingCell({ row: rowIdx, col: colIdx });
    setEditValue(value);
  };

  const saveEditedCell = () => {
    if (editingCell && parsedData) {
      // Use functional update to ensure we're working with latest state
      setParsedData(prevData => {
        if (!prevData) return prevData;

        const newRows = [...prevData.rows];
        newRows[editingCell.row][editingCell.col] = editValue;

        // Re-validate the edited cell with the NEW value
        const header = prevData.headers[editingCell.col];
        const newError = validateCell(editValue, header, editingCell.row + 1, editingCell.col);

        // Remove old error for this cell and add new one if exists
        setCellErrors(prev => {
          const filtered = prev.filter(e => !(e.row === editingCell.row + 1 && e.columnIndex === editingCell.col));
          return newError ? [...filtered, newError] : filtered;
        });

        return { ...prevData, rows: newRows };
      });

      setEditingCell(null);
      setEditValue("");
    }
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  // MEMOIZED: Create error lookup map for O(1) cell error checking
  const cellErrorMap = useMemo(() => {
    const map = new Map<string, CellError>();
    for (const error of cellErrors) {
      const key = `${error.row}-${error.columnIndex}`;
      map.set(key, error);
    }
    return map;
  }, [cellErrors]);

  // Check if a cell has an error - O(1) lookup
  const getCellError = useCallback((rowIdx: number, colIdx: number): CellError | undefined => {
    const key = `${rowIdx + 1}-${colIdx}`;
    return cellErrorMap.get(key);
  }, [cellErrorMap]);

  // Convert parsed data back to CSV and create a new File object
  // ALWAYS saves ALL rows - filter toggle is only for viewing, not for permanent modification
  const createUpdatedFile = (): File | null => {
    // Use ref to get the LATEST parsedData (includes all edits)
    const currentData = parsedDataRef.current;

    if (!currentData || !validationDataPoint?.file) return null;

    // ALWAYS save ALL rows - preserve original data integrity
    // The category filter is only for display/viewing purposes
    const rowsToSave = currentData.rows;

    // Build CSV content from parsed data
    const csvRows: string[] = [];

    // Add headers
    csvRows.push(currentData.headers.map(h => {
      // Escape values containing commas or quotes
      if (h.includes(',') || h.includes('"') || h.includes('\n')) {
        return `"${h.replace(/"/g, '""')}"`;
      }
      return h;
    }).join(','));

    // Add ALL data rows
    rowsToSave.forEach(row => {
      csvRows.push(row.map(cell => {
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const originalName = validationDataPoint.file.name;
    const updatedFileName = originalName.replace(/\.(csv|xlsx?)$/i, `_updated.csv`);

    return new File([blob], updatedFileName, { type: 'text/csv' });
  };

  // Revalidate entire dataset (after edits)
  const revalidateEntireFile = async () => {
    // Use ref to get the LATEST parsedData (includes all edits)
    const currentData = parsedDataRef.current;

    if (!currentData) return;

    setIsValidating(true);
    setCellErrors([]);

    // Run full validation on the LATEST parsed data (with all edits)
    const errors = await validateDataAsync(currentData.headers, currentData.rows);

    // Show success message if no errors
    if (errors.filter(e => e.severity === "error").length === 0) {
      // All good! Could show a toast/notification here
    }
  };

  // Save edited data and close modal
  const confirmAndSaveData = async () => {
    // Use ref to get the LATEST parsedData (includes all edits)
    const currentData = parsedDataRef.current;

    if (!currentData || !validationDataPoint) {
      setIsValidationModalOpen(false);
      return;
    }

    // PERFORMANCE: Close modal IMMEDIATELY for instant feedback
    // Then run validation and save in background
    setIsValidationModalOpen(false);

    // For document files (DOCX, PDF), just save the content
    // No need to create CSV files or re-parse
    if (currentData.isDocument) {
      // Update persisted data with any edits to the document content
      const dataPointId = validationDataPoint.id;
      const persistedFileData = state.persistedReviewData.dataPointFiles[dataPointId];

      if (persistedFileData) {
        // Update the persisted data with edited content
        actions.updatePersistedDataPointFile(dataPointId, {
          ...persistedFileData,
          parsedData: {
            ...persistedFileData.parsedData!,
            headers: currentData.headers,
            rows: currentData.rows.map(row => {
              const rowObj: Record<string, string> = {};
              currentData.headers.forEach((h, i) => rowObj[h] = row[i] || '');
              return rowObj;
            }),
            htmlContent: currentData.htmlContent,
            rawText: currentData.rawText,
            isDocument: true,
            documentType: currentData.documentType,
          },
        });
      }

      // Also update parsedCsvDataStore
      setParsedCsvDataStore(prev => ({
        ...prev,
        [dataPointId]: {
          headers: currentData.headers,
          rows: currentData.rows.map(row => {
            const rowObj: Record<string, string> = {};
            currentData.headers.forEach((h, i) => rowObj[h] = row[i] || '');
            return rowObj;
          }),
          htmlContent: currentData.htmlContent,
          rawText: currentData.rawText,
          isDocument: true,
          documentType: currentData.documentType,
        }
      }));

      // Auto-validate proof points with minimal delay
      requestAnimationFrame(() => {
        autoValidateProofPoints();
      });
      return;
    }

    // PERFORMANCE OPTIMIZATION: Save data immediately, defer heavy validation
    // This ensures smooth modal close animation

    const dataPointId = validationDataPoint.id;
    const allRows = currentData.rows;

    // Convert rows to objects immediately (fast operation)
    const rowsAsObjects = allRows.map(row => {
      const rowObj: Record<string, string> = {};
      currentData.headers.forEach((h, i) => rowObj[h] = row[i] || '');
      return rowObj;
    });

    // Update state IMMEDIATELY for instant UI response
    if (dataPointId === "spend") {
      setParsedCsvDataStore(prev => ({
        ...prev,
        spend: { headers: currentData.headers, rows: rowsAsObjects }
      }));
      // Update columns directly from currentData - NO need to re-parse!
      setCsvColumns(currentData.headers);

      // Update persisted data
      const persistedSpend = state.persistedReviewData.spendFile;
      if (persistedSpend) {
        actions.updatePersistedSpendFile({
          ...persistedSpend,
          parsedData: { headers: currentData.headers, rows: rowsAsObjects },
        });
      }
    } else {
      setParsedCsvDataStore(prev => ({
        ...prev,
        [dataPointId]: { headers: currentData.headers, rows: rowsAsObjects }
      }));
      // Update columns directly - NO need to re-parse!
      setDataPointColumns(prev => ({ ...prev, [dataPointId]: currentData.headers }));

      // Update persisted data
      const persistedFileData = state.persistedReviewData.dataPointFiles[dataPointId];
      if (persistedFileData) {
        actions.updatePersistedDataPointFile(dataPointId, {
          ...persistedFileData,
          parsedData: { headers: currentData.headers, rows: rowsAsObjects },
        });
      }
    }

    // Auto-validate proof points with minimal delay
    requestAnimationFrame(() => {
      autoValidateProofPoints();
    });

    // DEFER heavy validation to after animation completes (use requestIdleCallback if available)
    const runDeferredValidation = async () => {
      // Validate ALL rows to catch any hidden errors
      const allErrors = await validateDataAsync(currentData.headers, currentData.rows);

      // Check for errors in ALL rows (not just visible ones)
      const criticalErrors = allErrors.filter(e => e.severity === "error");
      const hasErrors = criticalErrors.length > 0;

      // If errors exist anywhere in the data, show toast notification
      if (hasErrors) {
        if (categoryFilterMode === "selected") {
          const filteredRowIndices = new Set(filteredData.rows.map((_, idx) => idx));
          const hiddenErrors = criticalErrors.filter(e => !filteredRowIndices.has(e.row));

          if (hiddenErrors.length > 0) {
            toast.error(`${hiddenErrors.length} error(s) found in data. Re-open to fix.`);
          } else {
            toast.error(`${criticalErrors.length} error(s) found. Re-open to fix.`);
          }
        } else {
          toast.error(`${criticalErrors.length} error(s) found. Re-open to fix.`);
        }
        return;
      }

      // No errors - create updated file with edits (only if we have original file)
      const updatedFile = createUpdatedFile();
      if (updatedFile) {
        if (dataPointId === "spend") {
          setUploadedFile(updatedFile);
          actions.updateSetupData({ uploadedFile: updatedFile });
        } else {
          setDataPointFiles(prev => ({ ...prev, [dataPointId]: updatedFile }));
        }
      }
    };

    // Use requestIdleCallback for heavy work, fallback to setTimeout
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as typeof window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(() => {
        runDeferredValidation();
      });
    } else {
      setTimeout(runDeferredValidation, 300); // Longer delay for smooth animation
    }
  };

  // Handle re-upload in validation modal
  const handleValidationReupload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validationDataPoint) {
      if (validationDataPoint.id === "spend") {
        setUploadedFile(file);
        actions.updateSetupData({ uploadedFile: file });
      } else {
        // Add as new item to the data point
        const newItem: DataPointItem = {
          id: Date.now().toString(),
          name: file.name.replace(/\.[^/.]+$/, ""),
          fileName: file.name,
          uploadedAt: new Date(),
        };
        const targetDataPoint = contextDataPoints.find(dp => dp.id === validationDataPoint.id);
        if (targetDataPoint) {
          actions.updateDataPoint({
            ...targetDataPoint,
            items: [...targetDataPoint.items, newItem]
          });
        }
      }
      
      setValidationDataPoint({ ...validationDataPoint, file });
      await parseAndValidateFile(file, validationDataPoint.id);

      if (validationFileInputRef.current) {
        validationFileInputRef.current.value = "";
      }
    }
  };

  // ============================================================================
  // End Data Validation Functions
  // ============================================================================

  // Calculate validation counts
  const needsValidationCount = contextDataPoints.filter(dp => dp.items.length > 0 || (dp.isSpendData && hasSpendData)).length;
  const notAvailableCount = contextDataPoints.filter(dp => dp.items.length === 0 && !(dp.isSpendData && hasSpendData)).length;

  // Calculate opportunity classification
  // Potential = exactly 1 proof point validated (shows opportunity exists)
  // Qualified = 2 or more proof points validated (enough evidence)
  const getValidatedProofPointsCount = (opportunity: SetupOpportunity) =>
    opportunity.proofPoints.filter(pp => pp.isValidated).length;

  const isQualifiedOpportunity = (opportunity: SetupOpportunity) =>
    getValidatedProofPointsCount(opportunity) >= 2;

  const qualifiedCount = opportunities.filter(isQualifiedOpportunity).length;
  const potentialCount = opportunities.filter(opp => !isQualifiedOpportunity(opp)).length;

  // Toggle proof point validation
  const toggleProofPointValidation = (opportunityId: string, proofPointId: string) => {
    const targetOpp = opportunities.find(opp => opp.id === opportunityId);
    if (targetOpp) {
      actions.updateSetupOpportunity({
        ...targetOpp,
        proofPoints: targetOpp.proofPoints.map(pp =>
          pp.id === proofPointId ? { ...pp, isValidated: !pp.isValidated } : pp
        ),
      });
    }
  };

  // ============================================================================
  // AUTO-VALIDATION: Automatically validate proof points based on uploaded data
  // ============================================================================

  // Check if a data point is fully validated (has file and no errors)
  const getValidatedDataPoints = (): Set<string> => {
    const validated = new Set<string>();

    // Check each data point
    contextDataPoints.forEach(dp => {
      if (isDataPointFullyValidated(dp.id)) {
        validated.add(dp.id);
      }
    });

    // Also check if spend data is validated via uploadedFile or persisted data
    if (hasSpendData && isDataPointFullyValidated("spend")) {
      validated.add("spend");
    }

    return validated;
  };

  // Check if columns exist in a data point's CSV
  const dataPointHasColumns = (dataPointId: string, requiredColumns: string[]): boolean => {
    // Get columns from the stored data
    const columns = dataPointColumns[dataPointId] || [];
    if (columns.length === 0 && dataPointId === "spend") {
      // Fall back to csvColumns for spend data
      return hasColumn(csvColumns, requiredColumns);
    }
    return hasColumn(columns, requiredColumns);
  };

  // Auto-validate all proof points based on validated data
  const autoValidateProofPoints = () => {
    const validatedDataPoints = getValidatedDataPoints();

    // Auto-validating proof points

    // Track which proof points should be validated
    const proofPointsToValidate = new Set<string>();

    // Check each mapping
    PROOF_POINT_MAPPINGS.forEach(mapping => {
      // Check if all required data points are validated
      const allDataPointsValidated = mapping.requiredDataPoints.every(
        dpId => validatedDataPoints.has(dpId)
      );

      if (!allDataPointsValidated) {
        return; // Skip if not all required data points are validated
      }

      // Check if required columns exist in the data
      let columnsExist = true;
      mapping.requiredDataPoints.forEach((dpId, idx) => {
        const requiredCols = mapping.requiredColumns[idx] || [];
        if (requiredCols.length > 0 && !dataPointHasColumns(dpId, requiredCols)) {
          columnsExist = false;
        }
      });

      if (columnsExist) {
        proofPointsToValidate.add(mapping.proofPointId);
        // Proof point validated
      }
    });

    // Update all opportunities with validated proof points
    // IMPORTANT: Reset all to false first, then only validate those that pass current checks
    opportunities.forEach(opp => {
      const updatedProofPoints = opp.proofPoints.map(pp => ({
        ...pp,
        // Only validate if it's in the current validation set (don't keep stale validations)
        isValidated: proofPointsToValidate.has(pp.id)
      }));

      // Only update if something changed
      const hasChanges = updatedProofPoints.some(
        (pp, idx) => pp.isValidated !== opp.proofPoints[idx].isValidated
      );

      if (hasChanges) {
        actions.updateSetupOpportunity({
          ...opp,
          proofPoints: updatedProofPoints
        });
      }
    });

    // Return count of newly validated proof points
    return proofPointsToValidate.size;
  };

  // Toggle opportunity expansion
  const toggleOpportunityExpansion = (opportunityId: string) => {
    setExpandedOpportunities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(opportunityId)) {
        newSet.delete(opportunityId);
      } else {
        newSet.add(opportunityId);
      }
      return newSet;
    });
  };

  // Open opportunity modal
  const openOpportunityModal = (opportunity: SetupOpportunity) => {
    setSelectedOpportunity(opportunity);
    setIsOpportunityModalOpen(true);
  };

  // Open summary modal for a data point
  const openSummaryModal = (dataPointId: string) => {
    setSummaryDataPointId(dataPointId);
    setIsSummaryModalOpen(true);
  };

  // Helper function to find a column in headers (case-insensitive, flexible matching)
  const findColumn = (headers: string[], possibleNames: string[]): string | null => {
    const normalizedHeaders = headers.map(h => (h || '').toLowerCase().replace(/[\s_-]/g, ''));
    for (const name of possibleNames) {
      const normalizedName = name.toLowerCase().replace(/[\s_-]/g, '');
      const idx = normalizedHeaders.findIndex(h => h && (h.includes(normalizedName) || normalizedName.includes(h)));
      if (idx !== -1) return headers[idx];
    }
    return null;
  };

  // Get summary data for display - extracts real data from parsed CSV or backend summary
  const getSummaryData = (dataPointId: string) => {
    const csvData = parsedCsvDataStore[dataPointId];
    const fallbackSpend = state.setupData.spend || 50000000;

    // ============================================================================
    // SPEND DATA - BACKEND SUMMARY FAST PATH (no client processing!)
    // If backend has pre-computed summary, use it directly for instant display
    // ============================================================================
    if (dataPointId === "spend" && backendSpendSummary?.success) {
      console.log('[getSummaryData] Using backend pre-computed summary (instant!)');
      return {
        totalSpend: backendSpendSummary.total_spend,
        locations: backendSpendSummary.top_locations.length > 0
          ? backendSpendSummary.top_locations
          : [{ name: "No location data", spend: 0, percentage: 0 }],
        suppliers: backendSpendSummary.top_suppliers.length > 0
          ? backendSpendSummary.top_suppliers
          : [{ name: "No supplier data", spend: 0, percentage: 0 }],
        contracts: [],
        playbook: { category: "", strategy: "", marketTrends: [], risks: [], recommendations: [] },
        rowCount: backendSpendSummary.row_count,
        // Extra metadata from backend
        supplierCount: backendSpendSummary.supplier_count,
        locationCount: backendSpendSummary.location_count,
        priceStats: backendSpendSummary.price_stats,
        detectedColumns: backendSpendSummary.detected_columns,
        fileName: backendSpendSummary.file_name,
        processedAt: backendSpendSummary.processed_at,
      };
    }

    // ============================================================================
    // SPEND DATA EXTRACTION - Local fallback using Smart Column Matcher
    // Used when backend summary not available (offline, error, etc.)
    // ============================================================================
    if (dataPointId === "spend" && csvData && csvData.rows.length > 0) {
      const { headers } = csvData;

      // Filter rows based on deferredCategoryFilterMode (deferred for smooth UI)
      let rows = csvData.rows;

      if (deferredCategoryFilterMode === "selected") {
        // Get selected category names from context
        let selectedCategoryNames: string[] = [];
        if (state.selectedCategories && state.selectedCategories.length > 0) {
          selectedCategoryNames = state.selectedCategories.map(name => name.toLowerCase());
        } else if (state.setupData.categoryName) {
          selectedCategoryNames = state.setupData.categoryName
            .split(',')
            .map(name => name.trim().toLowerCase())
            .filter(name => name.length > 0);
        }

        console.log('[getSummaryData] Category filtering:', {
          filterMode: deferredCategoryFilterMode,
          selectedCategories: state.selectedCategories,
          categoryName: state.setupData.categoryName,
          selectedCategoryNames,
          totalRowsBefore: csvData.rows.length,
        });

        if (selectedCategoryNames.length > 0) {
          // Find category column by header name using shared patterns
          let categoryColName: string | null = null;
          for (const priorityCol of CATEGORY_COLUMN_PATTERNS) {
            const foundHeader = headers.find(h =>
              h && h.toLowerCase().replace(/[^a-z0-9]/g, '').includes(priorityCol.replace(/[^a-z0-9]/g, ''))
            );
            if (foundHeader) {
              categoryColName = foundHeader;
              break;
            }
          }

          console.log('[getSummaryData] Found category column:', categoryColName, 'from headers:', headers.slice(0, 5));

          if (categoryColName) {
            // Filter using smart category matching
            const filtered: Record<string, string>[] = [];
            const rowCount = csvData.rows.length;

            for (let i = 0; i < rowCount; i++) {
              const row = csvData.rows[i];
              const categoryValue = row[categoryColName!] || "";
              if (!categoryValue) continue;

              // Check against each selected category using smart matching
              for (const selectedCat of selectedCategoryNames) {
                if (isCategoryMatch(categoryValue, selectedCat)) {
                  filtered.push(row);
                  break;
                }
              }
            }
            rows = filtered;
            console.log('[getSummaryData] Filtered to', filtered.length, 'rows from', rowCount);
          } else {
            console.log('[getSummaryData] No category column found - using all rows');
          }
        } else {
          console.log('[getSummaryData] No selected categories - using all rows');
        }
      } else {
        console.log('[getSummaryData] Filter mode is "original" - using all rows');
      }

      // Use smart column detection with caching for performance
      // First call computes, subsequent calls use cache for same headers
      const sampleRows = rows.slice(0, 50); // Sample for content-based detection
      const columns = detectAllColumnsCached(headers, sampleRows);

      // Debug: Log detected columns for troubleshooting
      console.log('[getSummaryData] Detected columns:', {
        country: columns.country,
        supplier: columns.supplier,
        spend: columns.spend,
        price: columns.price,
        quantity: columns.quantity,
        category: columns.category,
        rowCount: rows.length,
      });

      // Use optimized single-pass aggregation for large datasets
      const aggregated = aggregateSpendDataFast(rows, columns);
      const formatted = formatAggregatedData(aggregated, 6);

      const { totalSpend } = aggregated;
      const locations = formatted.locations;
      const suppliers = formatted.suppliers;

      return {
        totalSpend,
        locations: locations.length > 0 ? locations : [{ name: "No location data", spend: 0, percentage: 0 }],
        suppliers: suppliers.length > 0 ? suppliers : [{ name: "No supplier data", spend: 0, percentage: 0 }],
        contracts: [],
        playbook: { category: "", strategy: "", marketTrends: [], risks: [], recommendations: [] },
        rowCount: rows.length,
      };
    }

    // ============================================================================
    // SUPPLY MASTER DATA EXTRACTION
    // ============================================================================
    if (dataPointId === "supply-master" && csvData && csvData.rows.length > 0) {
      const { headers, rows } = csvData;

      const supplierNameCol = findColumn(headers, ['supplier_name', 'supplier', 'vendor_name', 'vendor', 'Supplier_Name', 'Vendor_Name']);
      const countryCol = findColumn(headers, ['country', 'location', 'region', 'supplier_country', 'Supplier_Country', 'Supplier_Region']);
      const statusCol = findColumn(headers, ['status', 'supplier_status', 'Supplier_Status']);
      const spendCol = findColumn(headers, ['annual_spend', 'spend', 'total_spend', 'value', 'extended_line_amount', 'Extended_Line_Amount']);
      const riskCol = findColumn(headers, ['risk_rating', 'risk', 'risk_level', 'Risk_Rating']);
      const categoryCol = findColumn(headers, ['category', 'product_category', 'spend_category', 'Spend_Category', 'Category_Level_1']);

      // Extract unique suppliers with their data
      const suppliers = rows.map(row => ({
        name: supplierNameCol ? row[supplierNameCol] : 'Unknown',
        country: countryCol ? row[countryCol] : 'Unknown',
        status: statusCol ? row[statusCol] : 'Unknown',
        spend: spendCol ? parseFloat(row[spendCol]) || 0 : 0,
        risk: riskCol ? row[riskCol] : 'Unknown',
        category: categoryCol ? row[categoryCol] : 'Unknown',
      })).filter(s => s.name && s.name !== 'Unknown');

      const totalSpend = suppliers.reduce((sum, s) => sum + s.spend, 0);
      const activeSuppliers = suppliers.filter(s => s.status === 'Active').length;
      const uniqueRegions = new Set(suppliers.map(s => s.country)).size;
      const uniqueCategories = new Set(suppliers.map(s => s.category)).size;

      // Aggregate by location
      const locationMap = new Map<string, number>();
      suppliers.forEach(s => {
        if (s.country) locationMap.set(s.country, (locationMap.get(s.country) || 0) + 1);
      });
      const locations = Array.from(locationMap.entries())
        .map(([name, count]) => ({ name, spend: count, percentage: Math.round((count / suppliers.length) * 100) }))
        .sort((a, b) => b.spend - a.spend).slice(0, 6);

      // Top suppliers by spend
      const topSuppliers = suppliers
        .filter(s => s.spend > 0)
        .map(s => ({ name: s.name, spend: s.spend, percentage: totalSpend > 0 ? Math.round((s.spend / totalSpend) * 100) : 0 }))
        .sort((a, b) => b.spend - a.spend).slice(0, 6);

      return {
        totalSpend,
        locations,
        suppliers: topSuppliers.length > 0 ? topSuppliers : suppliers.slice(0, 6).map(s => ({ name: s.name, spend: s.spend, percentage: 0 })),
        contracts: [],
        playbook: { category: "", strategy: "", marketTrends: [], risks: [], recommendations: [] },
        rowCount: rows.length,
        // Extra data for supply master
        supplierCount: suppliers.length,
        activeCount: activeSuppliers,
        regionCount: uniqueRegions,
        categoryCount: uniqueCategories,
        allSuppliers: suppliers,
      };
    }

    // ============================================================================
    // CONTRACTS DATA EXTRACTION
    // ============================================================================
    if (dataPointId === "contracts" && csvData && csvData.rows.length > 0) {
      const { headers, rows } = csvData;

      const contractNameCol = findColumn(headers, ['contract_name', 'name', 'contract_title', 'title']);
      const supplierCol = findColumn(headers, ['supplier_name', 'supplier', 'vendor']);
      const valueCol = findColumn(headers, ['contract_value', 'value', 'amount', 'total_value']);
      const statusCol = findColumn(headers, ['status', 'contract_status']);
      const endDateCol = findColumn(headers, ['end_date', 'expiry_date', 'expiry', 'expires']);
      const startDateCol = findColumn(headers, ['start_date', 'effective_date', 'start']);

      const contracts = rows.map(row => {
        const endDate = endDateCol ? row[endDateCol] : '';
        // Format expiry date
        let formattedExpiry = endDate;
        if (endDate && endDate.includes('-')) {
          const date = new Date(endDate);
          if (!isNaN(date.getTime())) {
            formattedExpiry = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          }
        }

        return {
          name: contractNameCol ? row[contractNameCol] : 'Unknown Contract',
          supplier: supplierCol ? row[supplierCol] : 'Unknown',
          value: valueCol ? parseFloat(row[valueCol]) || 0 : 0,
          status: statusCol ? row[statusCol] : 'Unknown',
          expiry: formattedExpiry,
        };
      }).filter(c => c.name && c.name !== 'Unknown Contract');

      const totalValue = contracts.reduce((sum, c) => sum + c.value, 0);
      const activeContracts = contracts.filter(c => c.status === 'Active').length;
      const expiringContracts = contracts.filter(c => c.status === 'Expiring' || c.status === 'Expired').length;

      return {
        totalSpend: totalValue,
        locations: [],
        suppliers: [],
        contracts: contracts.map(c => ({
          name: c.name,
          value: c.value,
          status: c.status,
          expiry: c.expiry,
        })),
        playbook: { category: "", strategy: "", marketTrends: [], risks: [], recommendations: [] },
        rowCount: rows.length,
        // Extra data for contracts
        contractCount: contracts.length,
        activeCount: activeContracts,
        expiringCount: expiringContracts,
      };
    }

    // ============================================================================
    // CATEGORY PLAYBOOK DATA EXTRACTION
    // ============================================================================
    if (dataPointId === "playbook" && csvData && csvData.rows.length > 0) {
      const { headers, rows } = csvData;

      const categoryCol = findColumn(headers, ['category', 'product_category']);
      const strategyCol = findColumn(headers, ['strategy', 'sourcing_strategy']);
      const trendCol = findColumn(headers, ['market_trend', 'trend', 'market_trends']);
      const riskFactorCol = findColumn(headers, ['risk_factor', 'risk_name', 'risk']);
      const riskLevelCol = findColumn(headers, ['risk_level', 'level', 'severity']);
      const recommendationCol = findColumn(headers, ['recommendation', 'recommendations', 'action']);
      const priorityCol = findColumn(headers, ['priority', 'importance']);

      // Extract unique values
      const category = categoryCol && rows[0] ? rows[0][categoryCol] : state.setupData.categoryName || "Edible Oils";
      const strategy = strategyCol && rows[0] ? rows[0][strategyCol] : "Dual Sourcing with Regional Optimization";

      // Extract market trends (unique)
      const marketTrends = trendCol
        ? [...new Set(rows.map(r => r[trendCol]).filter(Boolean))]
        : [];

      // Extract risks with levels
      const risksMap = new Map<string, { name: string; level: string; description: string }>();
      rows.forEach(row => {
        const riskName = riskFactorCol ? row[riskFactorCol] : null;
        const riskLevel = riskLevelCol ? row[riskLevelCol] : 'Medium';
        if (riskName && !risksMap.has(riskName)) {
          risksMap.set(riskName, {
            name: riskName,
            level: riskLevel,
            description: `Risk factor identified in category playbook`,
          });
        }
      });
      const risks = Array.from(risksMap.values());

      // Extract recommendations (unique)
      const recommendations = recommendationCol
        ? [...new Set(rows.map(r => r[recommendationCol]).filter(Boolean))]
        : [];

      return {
        totalSpend: fallbackSpend,
        locations: [],
        suppliers: [],
        contracts: [],
        playbook: {
          category,
          strategy,
          marketTrends: marketTrends.length > 0 ? marketTrends : ["No market trends defined"],
          risks: risks.length > 0 ? risks : [{ name: "No risks defined", level: "Low", description: "" }],
          recommendations: recommendations.length > 0 ? recommendations : ["No recommendations defined"],
        },
        rowCount: rows.length,
      };
    }

    // ============================================================================
    // FALLBACK - DEFAULT/PLACEHOLDER DATA
    // ============================================================================
    const defaultLocations = [
      { name: "United States", spend: fallbackSpend * 0.34, percentage: 34 },
      { name: "Canada", spend: fallbackSpend * 0.29, percentage: 29 },
      { name: "Mexico", spend: fallbackSpend * 0.21, percentage: 21 },
      { name: "Germany", spend: fallbackSpend * 0.07, percentage: 7 },
      { name: "Japan", spend: fallbackSpend * 0.05, percentage: 5 },
      { name: "Other", spend: fallbackSpend * 0.04, percentage: 4 },
    ];

    const defaultSuppliers = [
      { name: "Asia Pacific Grains", spend: fallbackSpend * 0.34, percentage: 34 },
      { name: "Pacific Rim Cereals", spend: fallbackSpend * 0.29, percentage: 29 },
      { name: "EuroGrain Trading", spend: fallbackSpend * 0.21, percentage: 21 },
      { name: "Orient Food Supply", spend: fallbackSpend * 0.07, percentage: 7 },
      { name: "Brazilian Grain Consortium", spend: fallbackSpend * 0.05, percentage: 5 },
      { name: "Nordic Cereals Ltd", spend: fallbackSpend * 0.04, percentage: 4 },
    ];

    const defaultContracts = [
      { name: "Master Supply Agreement - APAC", value: fallbackSpend * 0.35, status: "Active", expiry: "Dec 2025" },
      { name: "Framework Contract - Europe", value: fallbackSpend * 0.28, status: "Active", expiry: "Mar 2025" },
      { name: "Annual Purchase Order - NA", value: fallbackSpend * 0.22, status: "Active", expiry: "Jun 2025" },
      { name: "Spot Buy Agreement - LATAM", value: fallbackSpend * 0.10, status: "Expiring", expiry: "Jan 2025" },
      { name: "Emergency Supply Contract", value: fallbackSpend * 0.05, status: "Active", expiry: "Sep 2025" },
    ];

    const defaultPlaybook = {
      category: state.setupData.categoryName || "Edible Oils",
      strategy: "Dual Sourcing with Regional Optimization",
      marketTrends: [
        "Global commodity prices showing 5-8% volatility",
        "Sustainability certifications becoming mandatory",
        "Regional suppliers gaining market share",
      ],
      risks: [
        { name: "Supply Concentration", level: "High", description: "Top 3 suppliers represent 70% of volume" },
        { name: "Price Volatility", level: "Medium", description: "Commodity-linked pricing exposure" },
        { name: "Logistics", level: "Low", description: "Multiple shipping routes available" },
      ],
      recommendations: [
        "Diversify supplier base in APAC region",
        "Lock in 60% volume with fixed-price contracts",
        "Evaluate regional sourcing alternatives",
      ],
    };

    return {
      totalSpend: fallbackSpend,
      locations: defaultLocations,
      suppliers: defaultSuppliers,
      contracts: defaultContracts,
      playbook: defaultPlaybook,
      rowCount: 0,
    };
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount.toFixed(0)}`;
  };

  const handleContinue = async () => {
    setIsUploading(true);
    setUploadError(null);

    // Auto-validate proof points based on uploaded and validated data
    const validatedCount = autoValidateProofPoints();
    // Auto-validated proof points before running analysis

    // Gather all uploaded files from data points
    const supplyMasterFile = dataPointFiles["supply-master"];
    const contractsFile = dataPointFiles["contracts"];
    const playbookFile = dataPointFiles["playbook"];

    // Store playbook data in context for opportunities page
    if (playbookFile) {
      // Processing playbook file for context
      try {
        const playbookResult = await parseFile(playbookFile);
        // Playbook parse result processed
        if (playbookResult.success && playbookResult.data) {
          const { headers, rows } = playbookResult.data;
          // Playbook headers detected

          // Find columns once (not in loop)
          const categoryCol = findColumn(headers, ['category', 'product_category']);
          const strategyCol = findColumn(headers, ['strategy', 'sourcing_strategy']);
          const trendCol = findColumn(headers, ['market_trend', 'trend', 'market_trends']);
          const riskFactorCol = findColumn(headers, ['risk_factor', 'risk_name', 'risk']);
          const riskLevelCol = findColumn(headers, ['risk_level', 'level', 'severity']);
          const recommendationCol = findColumn(headers, ['recommendation', 'recommendations', 'action']);
          const priorityCol = findColumn(headers, ['priority', 'importance']);

          // Playbook columns detected

          // Parse playbook entries - split recommendations by semicolons
          const parseRecommendationText = (text: string): string[] => {
            if (!text) return [];
            return text
              .split(/[;]|\d+\.\s*/)
              .map(item => item.trim())
              .filter(item => item.length > 10);
          };

          const entries = rows.map(row => {
            const recText = recommendationCol ? row[recommendationCol] : '';
            return {
              category: categoryCol ? row[categoryCol] : '',
              strategy: strategyCol ? row[strategyCol] : '',
              marketTrend: trendCol ? row[trendCol] : '',
              riskFactor: riskFactorCol ? row[riskFactorCol] : '',
              recommendations: parseRecommendationText(recText),
              riskLevel: riskLevelCol ? row[riskLevelCol] : undefined,
              priority: priorityCol ? row[priorityCol] : undefined,
            };
          }).filter(entry => entry.category || entry.strategy);

          // Playbook entries parsed

          actions.setPlaybookData({
            entries,
            fileName: playbookFile.name,
            uploadedAt: Date.now(),
          });
          // Playbook data stored in context
        }
      } catch (err) {
        console.error('Error parsing playbook for context:', err);
      }
    }

    // PERFORMANCE: Call getSummaryData ONCE and reuse result
    // Note: Use hasSpendData (includes persisted data) and parsedCsvDataStore (persisted store) instead of uploadedFile/parsedData
    const spendSummary = hasSpendData && parsedCsvDataStore["spend"] ? getSummaryData("spend") : null;

    // Store spend analysis data in context
    if (spendSummary && spendSummary.totalSpend > 0) {
      const spendBySupplier: Record<string, number> = {};
      const spendByRegion: Record<string, number> = {};
      const spendByCountry: Record<string, number> = {};

      spendSummary.suppliers.forEach(s => {
        spendBySupplier[s.name] = s.spend;
      });

      spendSummary.locations.forEach(l => {
        spendByCountry[l.name] = l.spend;
        spendByRegion[l.name] = l.spend;
      });

      // PERFORMANCE: Use already-cached filteredData instead of re-filtering
      // The filteredData useMemo already has the filtered rows cached
      let priceData: { prices: number[]; avgPrice: number; priceVariance: number } | undefined;
      const spendCsvData = parsedCsvDataStore["spend"];
      if (spendCsvData && spendCsvData.rows.length > 0) {
        const { headers, rows: spendRows } = spendCsvData;
        // Use cached column detection for performance
        const columns = detectAllColumnsCached(headers, spendRows.slice(0, 50));

        if (columns.price) {
          // Use filteredData.rows if in selected mode, otherwise use all rows
          const rowsToUse = categoryFilterMode === "selected" && filteredData.isFiltered
            ? filteredData.rows
            : spendCsvData.rows;

          const prices: number[] = [];
          const rowCount = rowsToUse.length;
          for (let i = 0; i < rowCount; i++) {
            const row = rowsToUse[i];
            // Handle both array format (from filteredData) and object format (from spendCsvData)
            const priceValue = Array.isArray(row)
              ? row[headers.indexOf(columns.price!)]
              : row[columns.price!];
            const price = parseNumericValue(priceValue);
            if (price > 0) {
              prices.push(price);
            }
          }

          if (prices.length > 0) {
            const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
            const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
            const stdDev = Math.sqrt(variance);
            const priceVariance = avgPrice > 0 ? (stdDev / avgPrice) * 100 : 0;

            priceData = { prices, avgPrice, priceVariance };
          }
        }
      }

      console.log('[Review] Setting spendAnalysis:', {
        totalSpend: spendSummary.totalSpend,
        supplierCount: spendSummary.suppliers.length,
        rowCount: spendSummary.rowCount,
        categoryFilterMode: deferredCategoryFilterMode,
        selectedCategories: state.selectedCategories,
        categoryName: state.setupData.categoryName,
      });
      actions.setSpendAnalysis({
        totalSpend: spendSummary.totalSpend,
        spendBySupplier,
        spendByRegion,
        spendByCountry,
        supplierCount: spendSummary.suppliers.length,
        topSuppliers: spendSummary.suppliers.slice(0, 5).map(s => ({
          name: s.name,
          spend: s.spend,
          percentage: s.percentage,
        })),
        topRegions: spendSummary.locations.slice(0, 5).map(l => ({
          name: l.name,
          spend: l.spend,
          percentage: l.percentage,
        })),
        priceData,
      });
    }

    // Calculate total spend - reuse spendSummary (already computed above)
    const filteredSpend = spendSummary?.totalSpend || 0;
    const totalSpend = filteredSpend > 0
      ? filteredSpend
      : (state.portfolioItems.length > 0
          ? state.portfolioItems.reduce((sum, item) => sum + item.spend, 0)
          : state.setupData.spend || 50000000);

    try {
      let response;

      // Check if we have multiple files for full analysis
      const hasAdditionalFiles = supplyMasterFile || contractsFile || playbookFile;

      if (uploadedFile || hasAdditionalFiles) {
        // Use full analysis with all data files
        // Running full analysis with files

        response = await procurementApi.runFullAnalysis(
          state.setupData.categoryName || "Edible Oils",
          totalSpend,
          {
            spendFile: uploadedFile || undefined,
            supplyMasterFile: supplyMasterFile || undefined,
            contractsFile: contractsFile || undefined,
            playbookFile: playbookFile || undefined,
          },
          {
            addressable_spend_pct: state.setupData.addressableSpendPct,
            savings_benchmark_low: state.setupData.savingsBenchmarkLow,
            savings_benchmark_high: state.setupData.savingsBenchmarkHigh,
            maturity_score: state.setupData.maturityScore,
          }
        );
      } else {
        // Use quick analysis endpoint (no files)
        response = await procurementApi.analyzeQuick({
          name: state.setupData.categoryName || "Edible Oils",
          spend: totalSpend,
          addressable_spend_pct: state.setupData.addressableSpendPct,
          savings_benchmark_low: state.setupData.savingsBenchmarkLow,
          savings_benchmark_high: state.setupData.savingsBenchmarkHigh,
          maturity_score: state.setupData.maturityScore,
        });
      }

      // Store the analysis response in context
      actions.setAnalysisResponse(response);
      // Analysis complete

      // Record activity for dashboard
      const categoryForActivity = state.setupData.categoryName || "Edible Oils";
      const savingsLow = response.savings_summary?.total_savings_low || 0;
      const savingsHigh = response.savings_summary?.total_savings_high || 0;
      const formatSavings = (amount: number) => {
        if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
        if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
        return `$${amount.toFixed(0)}`;
      };

      actions.addActivity({
        type: "analysis",
        title: `Analysis completed for ${categoryForActivity}`,
        description: `Max identified ${response.opportunities?.length || 0} opportunities with potential savings of ${formatSavings(savingsLow)} - ${formatSavings(savingsHigh)}.`,
        metadata: {
          categoryName: categoryForActivity,
          savings: `${formatSavings(savingsLow)} - ${formatSavings(savingsHigh)}`,
          opportunityCount: response.opportunities?.length || 0,
        },
      });

      actions.setSetupStep(3);
      // Show processing modal instead of navigating to a separate page
      setIsProcessing(true);
      setProcessingStatus("Analyzing your spend data...");
    } catch (err) {
      console.error("Analysis error:", err);
      setUploadError(err instanceof Error ? err.message : "Analysis failed. Please try again.");

      // Record activity even for demo/fallback mode
      const categoryForActivity = state.setupData.categoryName || "Edible Oils";
      actions.addActivity({
        type: "analysis",
        title: `Analysis started for ${categoryForActivity}`,
        description: `Running analysis on ${categoryForActivity} category with ${uploadedFile ? 'uploaded spend data' : 'default data'}.`,
        metadata: {
          categoryName: categoryForActivity,
        },
      });

      // For demo, allow continuing even if backend is down
      actions.setSetupStep(3);
      // Show processing modal instead of navigating to a separate page
      setIsProcessing(true);
      setProcessingStatus("Analyzing your spend data...");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle processing animation and redirect - triggers LLM proof point evaluation
  useEffect(() => {
    // Reset flag when not processing (allows retry if user goes back)
    if (!isProcessing) {
      llmEvaluationCompletedRef.current = false;
      return;
    }

    // Prevent running multiple times (dependencies can change during execution)
    if (llmEvaluationCompletedRef.current) {
      console.log("[Review] LLM evaluation already completed, skipping re-run");
      return;
    }

    // Create abort controller for cleanup on unmount
    const abortController = new AbortController();
    let isAborted = false;

    const statuses = [
      "Analyzing your spend data...",
      "Evaluating proof points with AI...",
      "Calculating savings opportunities...",
      "Preparing your dashboard..."
    ];

    let currentIndex = 0;
    const statusInterval = setInterval(() => {
      currentIndex = (currentIndex + 1) % statuses.length;
      setProcessingStatus(statuses[currentIndex]);
    }, 1000);

    // Start LLM proof point evaluation in background (non-blocking)
    const evaluateProofPointsInBackground = async () => {
      // Check if aborted before starting
      if (isAborted) return;
      try {
        console.log("[Review] Starting LLM proof point evaluation in background...");

        // Get spend data for LLM evaluation
        const spendSummary = getSummaryData("spend");
        const spendData = {
          totalSpend: spendSummary?.totalSpend || state.spendAnalysis?.totalSpend || 0,
          supplierCount: spendSummary?.suppliers?.length || state.spendAnalysis?.supplierCount || 0,
          spendBySupplier: state.spendAnalysis?.spendBySupplier || {},
          spendByRegion: state.spendAnalysis?.spendByRegion || {},
        };

        // Get supplier data
        const supplierData = spendSummary?.suppliers?.map(s => ({
          name: s.name,
          spend: s.spend,
          share: s.percentage,
        })) || state.spendAnalysis?.topSuppliers || [];

        // Get computed metrics
        const metrics = state.computedMetrics || {};

        // Opportunity types to evaluate
        const opportunityTypes = ["volume-bundling", "target-pricing", "risk-management", "respec-pack"];

        // Evaluate all opportunities in parallel
        const evaluationPromises = opportunityTypes.map(async (oppType) => {
          try {
            // Find relevant proof points for this opportunity
            const opp = state.setupOpportunities.find(o => o.id === oppType);
            const proofPointsData = opp?.proofPoints?.map(pp => ({
              id: pp.id,
              name: pp.name,
              value: pp.score,
              data: { isValidated: pp.isValidated },
            })) || [];

            const result = await procurementApi.evaluateProofPoints({
              opportunityType: oppType,
              categoryName: state.setupData.categoryName || "Edible Oils",
              proofPointsData,
              spendData,
              supplierData,
              metrics,
            });

            return {
              oppType,
              evaluations: result.evaluations,
              summary: result.summary,
              model_used: result.model_used,
              thinking_time: result.thinking_time,
              computed_at: Date.now(),
            };
          } catch (error) {
            console.warn(`[Review] Failed to evaluate ${oppType}:`, error);
            return null;
          }
        });

        const results = await Promise.all(evaluationPromises);

        // Store results in context
        const llmEvaluations: Record<string, {
          evaluations: Array<{ id: string; impact: 'High' | 'Medium' | 'Low'; reasoning: string; data_point: string }>;
          summary: { high_count: number; medium_count: number; low_count: number; confidence_score: number; overall_assessment?: string };
          model_used: string;
          thinking_time: string;
          computed_at: number;
        }> = {};

        results.forEach(result => {
          if (result) {
            llmEvaluations[result.oppType] = {
              evaluations: result.evaluations,
              summary: result.summary,
              model_used: result.model_used,
              thinking_time: result.thinking_time,
              computed_at: result.computed_at,
            };
          }
        });

        // Check if aborted before storing results
        if (isAborted) return;

        if (Object.keys(llmEvaluations).length > 0) {
          actions.setLlmProofPointEvaluations(llmEvaluations);
          console.log("[Review] LLM evaluations stored:", Object.keys(llmEvaluations));
        }
      } catch (error) {
        if (isAborted) return;
        console.error("[Review] Background LLM evaluation failed:", error);
        // Non-blocking - continue with navigation even if LLM fails
      }
    };

    // Run evaluations and wait for completion before navigating
    const runEvaluationsAndNavigate = async () => {
      try {
        // Check if aborted before starting
        if (isAborted) return;

        // Update status to show LLM evaluation
        setProcessingStatus("Evaluating proof points with AI...");

        // Await all LLM evaluations (this takes 20-60 seconds)
        await evaluateProofPointsInBackground();

        // Check if aborted after evaluations complete
        if (isAborted) {
          console.log("[Review] Navigation aborted - component unmounted");
          return;
        }

        console.log("[Review] All LLM evaluations complete!");
        setProcessingStatus("Preparing your dashboard...");

        // Mark as completed to prevent re-runs
        llmEvaluationCompletedRef.current = true;

        // Mark setup as complete in backend
        try {
          await authApi.updateSetup({
            setup_step: 4,
            setup_completed: true,
          });
          console.log("[Setup] Marked setup as complete in backend");
        } catch (error) {
          console.warn("[Setup] Failed to update backend, continuing anyway:", error);
        }

        // Final abort check before navigation
        if (isAborted) return;

        // Navigate only after evaluations complete
        actions.setSetupStep(5);
        router.push("/dashboard");
      } catch (error) {
        if (isAborted) return;
        console.error("[Review] Evaluation failed, navigating anyway:", error);
        // Even on failure, navigate to dashboard
        actions.setSetupStep(5);
        router.push("/dashboard");
      }
    };

    // Start the evaluation process (this awaits completion before navigation)
    runEvaluationsAndNavigate();

    return () => {
      // Signal abort to all async operations
      isAborted = true;
      abortController.abort();
      clearInterval(statusInterval);
    };
    // Note: Only isProcessing should trigger this effect
    // Other dependencies are used inside but shouldn't re-trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProcessing, router]);
  // Get category name from context or default
  const categoryName = state.setupData.categoryName || "Category";

  // Calculate data review status for all data points based on validation
  const getDataPointReviewStatus = () => {
    const items: { name: string; status: "All Good" | "Needs Review" | "Not Uploaded"; id: string }[] = [];

    // Check Spend Data - based on field availability
    if (!hasSpendData) {
      items.push({
        id: "spend",
        name: `Spend Data (${categoryName})`,
        status: "Not Uploaded"
      });
    } else {
      // Check if all required fields are available
      const { available, total } = getDataPointFieldCounts("spend");
      
      if (available === total) {
        items.push({
          id: "spend",
          name: `Spend Data (${categoryName})`,
          status: "All Good"
        });
      } else {
        items.push({
          id: "spend",
          name: `Spend Data (${categoryName}) - ${available}/${total} fields`,
          status: "Needs Review"
        });
      }
    }
    
    // Check other data points with the same validation logic
    contextDataPoints.filter(dp => !dp.isSpendData).forEach(dp => {
      const fields = getFieldsForDataPoint(dp.id);
      const hasFields = fields.length > 0;
      
      if (dp.items.length === 0) {
        items.push({
          id: dp.id,
          name: dp.name,
          status: "Not Uploaded"
        });
      } else if (hasFields) {
        // Has field definitions - validate columns
        const { available, total } = getDataPointFieldCounts(dp.id);
        const columns = dataPointColumns[dp.id];
        
        if (!columns || columns.length === 0) {
          // File uploaded but not parsed yet (non-CSV or still parsing)
          items.push({
            id: dp.id,
            name: `${dp.name} - 0/${total} fields`,
            status: "Needs Review"
          });
        } else if (available === total) {
          items.push({
            id: dp.id,
            name: dp.name,
            status: "All Good"
          });
        } else {
          items.push({
            id: dp.id,
            name: `${dp.name} - ${available}/${total} fields`,
            status: "Needs Review"
          });
        }
      } else {
        // No field definitions - just check if uploaded
        items.push({
          id: dp.id,
          name: dp.name,
          status: "All Good"
        });
      }
    });
    
    return items;
  };

  const dataReviewItems = getDataPointReviewStatus();
  const allDataGood = dataReviewItems.every(item => item.status === "All Good");
  const needsReviewCount = dataReviewItems.filter(item => item.status === "Needs Review").length;
  const notUploadedCount = dataReviewItems.filter(item => item.status === "Not Uploaded").length;

  const steps = [
    { name: "Confirm your portfolio", completed: true, active: false },
    { name: "Set your optimization goals", completed: true, active: false },
    { name: "Review your data", completed: allDataGood && notUploadedCount === 0, active: true, subItems: dataReviewItems },
  ];

  // Calculate availability counts
  const availableFieldsCount = DATA_FIELDS.filter(field => getFieldStatus(field).available).length;
  const missingFieldsCount = DATA_FIELDS.length - availableFieldsCount;

  // Hidden file inputs
  // Supported file formats for all data uploads
  const SUPPORTED_FORMATS = SUPPORTED_FORMATS_STRING;

  const FileInput = (
    <>
      <input
        type="file"
        ref={fileInputRef}
        accept={SUPPORTED_FORMATS}
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        type="file"
        ref={dataPointFileInputRef}
        accept={SUPPORTED_FORMATS}
        onChange={handleDataPointFileSelect}
        className="hidden"
      />
    </>
  );

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-[#F8FBFE]">
      {/* Back Button */}
      <Link
        href="/setup/goals"
        className="absolute top-6 left-6 z-20 flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-gray-600 hover:bg-white hover:text-gray-900 transition-colors shadow-sm ring-1 ring-gray-100"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>

      {/* Viewer Read-Only Banner - userIsViewer is false during SSR to avoid hydration mismatch */}
      {state.user && userIsViewer && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white shadow-md">
          <Eye className="inline-block h-4 w-4 mr-2" />
          You are viewing in read-only mode. Contact your administrator for edit access.
        </div>
      )}

      {/* Background Decor - matching the goals page style */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-b from-[#E0F2FE]/40 via-[#F8FBFE] to-white" />
        
        {/* Yellow Building Detail - matching image */}
        <div className="absolute bottom-[-15%] left-[-5%] z-0 h-[60%] w-[50%] rotate-[-10deg] overflow-hidden border-t-[12px] border-white/40 bg-[#EAB308] shadow-2xl">
           <div className="absolute inset-0 flex flex-col space-y-8 pt-16">
             {Array.from({ length: 20 }).map((_, i) => (
               <div key={i} className="h-[1px] w-full bg-black/5" />
             ))}
           </div>
        </div>
      </div>

      {/* Left Icon Sidebar */}
      <div className="relative z-20 flex w-16 flex-col items-center border-r border-gray-200/40 bg-white/30 py-8 backdrop-blur-xl">
        <div className="mb-12 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
          <img src="/beroe cut.jpg" alt="Beroe" className="h-8 w-8 object-contain" />
        </div>
        
        <div className="flex flex-col gap-8 text-gray-400">
           <Home className="h-6 w-6" />
           <Activity className="h-6 w-6 text-blue-600" />
           <ShieldCheck className="h-6 w-6" />
        </div>

        <div className="mt-auto flex flex-col gap-8 text-gray-400">
           <Search className="h-6 w-6" />
           <User className="h-6 w-6" />
           <LogOut className="h-6 w-6 text-red-400/60" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-1 flex-col p-8 lg:p-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <Link href="/setup/goals" className="flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-black">
            <ChevronLeft className="h-4 w-4" />
            Go Back
          </Link>
          
          <Button
            onClick={handleContinue}
            disabled={isUploading}
            className="h-10 rounded-full bg-[#1A1C1E] px-5 text-sm font-medium text-white transition-all hover:bg-black disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                Run Analysis
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[380px_1fr]">
          {/* Left Column - Intro & Checklist */}
          <div className="space-y-10">
            <div className="space-y-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Max</span>
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                  <FolderOpen className="h-4.5 w-4.5 text-blue-500" />
                </div>
                <h1 className="text-3xl font-medium leading-[1.15] tracking-tight text-[#1A1C1E]">
                  Showing data for <span className="text-black font-semibold">Grains</span> based on the latest data available with Max
                </h1>
              </div>
              <p className="max-w-[340px] text-[14px] leading-relaxed text-gray-500">
                Validating your data will provide additional context for me to analyze opportunities and ensure the greatest value.
              </p>
            </div>

            {/* Profile Avatar stack - like in image */}
            <div className="flex items-center gap-2">
               <div className="h-8 w-8 rounded-full border-2 border-white bg-blue-100 shadow-sm overflow-hidden">
                  <div className="h-full w-full bg-gradient-to-tr from-blue-400 to-indigo-600" />
               </div>
               <div className="h-8 w-8 -ml-3 rounded-full border-2 border-white bg-purple-100 shadow-sm overflow-hidden">
                  <div className="h-full w-full bg-gradient-to-tr from-purple-400 to-pink-600 opacity-50" />
               </div>
            </div>

            {/* Checklist Card */}
            <div className="w-full max-w-[340px] overflow-hidden rounded-[32px] bg-white shadow-[0_20px_40px_rgba(0,0,0,0.03)] ring-1 ring-black/5">
              <div className="p-7 pb-4">
                <h2 className="text-[15px] font-semibold text-[#1A1C1E]">Complete your profile setup</h2>
              </div>
              
              <div className="space-y-1 p-2">
                {steps.map((step, idx) => (
                  <div key={idx} className="space-y-1">
                    <button
                      onClick={() => step.active && step.subItems && setIsReviewDataExpanded(!isReviewDataExpanded)}
                      className={`w-full flex items-center gap-4 rounded-2xl p-4 transition-colors focus:outline-none ${step.active ? 'bg-gray-50/80 hover:bg-gray-100/80 active:bg-gray-100/80 cursor-pointer' : step.completed ? 'bg-emerald-50/50' : ''}`}
                    >
                      <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${step.completed ? 'border-emerald-500 bg-emerald-500' : step.active ? 'border-black bg-white' : 'border-dashed border-gray-300'}`}>
                        {step.completed ? <Check className="h-3 w-3 text-white" /> : step.active && <div className="h-1.5 w-1.5 rounded-full bg-black" />}
                      </div>
                      <span className={`text-[14px] font-medium ${step.completed ? 'text-emerald-600' : 'text-[#1A1C1E]'}`}>{step.name}</span>
                      {step.active && step.subItems && (
                        <ChevronDown 
                          className={`ml-auto h-4 w-4 text-gray-400 transition-transform duration-200 ${isReviewDataExpanded ? 'rotate-0' : '-rotate-90'}`} 
                        />
                      )}
                    </button>
                    {step.active && step.subItems && isReviewDataExpanded && (
                      <div className="ml-9 space-y-2 pb-2 pr-4 max-h-[200px] overflow-y-auto">
                        {step.subItems.map((item, i) => {
                          // Get status color based on state
                          const getStatusColor = () => {
                            if (item.status === "All Good") return { bar: "bg-emerald-400", text: "text-emerald-500" };
                            if (item.status === "Needs Review") return { bar: "bg-amber-400", text: "text-amber-500" };
                            return { bar: "bg-red-400", text: "text-red-500" }; // Not Uploaded
                          };
                          const colors = getStatusColor();
                          
                          return (
                            <div key={i} className="flex items-center justify-between py-1.5">
                               <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className={`h-1.5 w-4 rounded-full flex-shrink-0 ${colors.bar}`} />
                                  <span className="text-[13px] font-medium text-gray-600 truncate">{item.name}</span>
                               </div>
                               {item.status === "Needs Review" ? (
                                 <button
                                   onClick={() => openValidationModal(item.id, item.name)}
                                   className="text-[11px] font-bold text-amber-500 hover:text-amber-600 hover:underline transition-colors flex-shrink-0 ml-2"
                                 >
                                   Review
                                 </button>
                               ) : item.status === "Not Uploaded" ? (
                                 <span className="text-[11px] font-bold text-red-500 flex-shrink-0 ml-2">Not Uploaded</span>
                               ) : (
                                 <span className="text-[11px] font-bold text-emerald-500 flex-shrink-0 ml-2 flex items-center gap-1">
                                   <Check className="h-3 w-3" /> Good
                                 </span>
                               )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-2 border-t border-gray-100 p-6 pt-5">
                <div className="flex items-center justify-between mb-3">
                   <span className="text-[12px] font-semibold text-gray-400">
                     {allDataGood && notUploadedCount === 0 ? "3 of 3 complete" : "2 of 3 complete"}
                   </span>
                   {(needsReviewCount > 0 || notUploadedCount > 0) && (
                     <span className="text-[11px] font-medium text-gray-500">
                       {needsReviewCount > 0 && <span className="text-amber-500">{needsReviewCount} needs review</span>}
                       {needsReviewCount > 0 && notUploadedCount > 0 && " · "}
                       {notUploadedCount > 0 && <span className="text-red-500">{notUploadedCount} missing</span>}
                     </span>
                   )}
                </div>
                <div className="h-[4px] w-full rounded-full bg-gray-50">
                  <div 
                    className={`h-full rounded-full transition-all duration-700 ${allDataGood && notUploadedCount === 0 ? "bg-emerald-500" : "bg-[#1A1C1E]"}`}
                    style={{ width: allDataGood && notUploadedCount === 0 ? "100%" : "66%" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Data Review Content */}
          <div className="space-y-8">
            {/* Top Stats Cards */}
            <div className="grid grid-cols-5 gap-4">
               <div className="rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/[0.03]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Spend</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xl font-semibold text-[#1A1C1E]">
                      {(() => {
                        // Only show spend from actual uploaded CSV data - not from hardcoded portfolio defaults
                        const spendCsvData = parsedCsvDataStore["spend"];
                        if (spendCsvData && spendCsvData.rows.length > 0) {
                          const summaryData = getSummaryData("spend");
                          return summaryData.totalSpend > 0 ? formatCurrency(summaryData.totalSpend) : '-';
                        }
                        // No data uploaded yet - show placeholder
                        return <span className="text-gray-400">Upload Data</span>;
                      })()}
                    </span>
                  </div>
               </div>

               <div className="rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/[0.03] relative group">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Cost</span>
                  <div className="mt-2">
                    <span className={`text-xl font-semibold ${
                      state.setupData.goals.cost >= 66 ? 'text-emerald-500' :
                      state.setupData.goals.cost >= 33 ? 'text-blue-500' : 'text-amber-500'
                    }`}>
                      {state.setupData.goals.cost >= 66 ? 'High' :
                       state.setupData.goals.cost >= 33 ? 'Medium' : 'Low'}
                    </span>
                  </div>
                  <Link
                    href="/setup/goals"
                    className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-400 opacity-0 group-hover:opacity-100 transition-all group-hover:bg-blue-100 group-hover:text-blue-500"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
               </div>

               <div className="rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/[0.03] relative group">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Risk</span>
                  <div className="mt-2">
                    <span className={`text-xl font-semibold ${
                      state.setupData.goals.risk >= 66 ? 'text-emerald-500' :
                      state.setupData.goals.risk >= 33 ? 'text-blue-500' : 'text-amber-500'
                    }`}>
                      {state.setupData.goals.risk >= 66 ? 'High' :
                       state.setupData.goals.risk >= 33 ? 'Medium' : 'Low'}
                    </span>
                  </div>
                  <Link
                    href="/setup/goals"
                    className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-400 opacity-0 group-hover:opacity-100 transition-all group-hover:bg-blue-100 group-hover:text-blue-500"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
               </div>

               <div className="rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/[0.03] relative group">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">ESG</span>
                  <div className="mt-2">
                    <span className={`text-xl font-semibold ${
                      state.setupData.goals.esg >= 66 ? 'text-emerald-500' :
                      state.setupData.goals.esg >= 33 ? 'text-blue-500' : 'text-amber-500'
                    }`}>
                      {state.setupData.goals.esg >= 66 ? 'High' :
                       state.setupData.goals.esg >= 33 ? 'Medium' : 'Low'}
                    </span>
                  </div>
                  <Link
                    href="/setup/goals"
                    className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-400 opacity-0 group-hover:opacity-100 transition-all group-hover:bg-blue-100 group-hover:text-blue-500"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
               </div>

               <button
                  onClick={() => setIsOpportunitiesListOpen(true)}
                  className="rounded-[32px] bg-gradient-to-br from-blue-500 to-indigo-600 p-5 shadow-sm ring-1 ring-black/[0.03] relative group cursor-pointer transition-all duration-200 ease-out hover:shadow-xl hover:shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] text-left"
               >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-100">Opportunities</span>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xl font-semibold text-white">
                      {qualifiedCount + potentialCount}
                    </span>
                    <span className="text-[12px] text-blue-100">available</span>
                  </div>
                  <div className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white">
                    <ArrowRight className="h-4 w-4" />
                  </div>
               </button>
            </div>

            {/* Hidden file input */}
            {FileInput}

            {/* Error message */}
            {uploadError && (
              <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
                {uploadError}
              </div>
            )}


            {/* Data Points Table Section */}
            <div className="rounded-[40px] bg-white p-8 shadow-[0_20px_60px_rgba(0,0,0,0.02)] ring-1 ring-black/5">
               <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-semibold text-[#1A1C1E]">Data Points</h3>
                  <div className="flex items-center gap-1 rounded-2xl bg-gray-50 p-1.5">
                     <button className="rounded-xl bg-white px-5 py-2 text-[13px] font-medium text-[#1A1C1E] shadow-sm ring-1 ring-black/5">All</button>
                     <button className="flex items-center gap-2 px-5 py-2 text-[13px] font-medium text-gray-500 transition-colors hover:text-black">
                        Has Data
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-600">{needsValidationCount}</span>
                     </button>
                     <button className="flex items-center gap-2 px-5 py-2 text-[13px] font-medium text-gray-500 transition-colors hover:text-black">
                        Not Available
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[11px] font-bold text-gray-600">{notAvailableCount}</span>
                     </button>
                  </div>
               </div>

               {/* Table */}
               <div className="w-full overflow-hidden">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="border-b border-gray-100 text-[12px] font-medium uppercase tracking-widest text-gray-400">
                           <th className="pb-4 pl-4 font-medium">Data</th>
                           <th className="pb-4 font-medium">Status</th>
                           <th className="pb-4 font-medium text-center">Last Updated</th>
                           <th className="pb-4 pr-4 text-right font-medium">Action</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                        {dataPointsWithIcons.map((dataPoint) => (
                           <React.Fragment key={dataPoint.id}>
                              <tr className="group transition-colors hover:bg-gray-50/50">
                                 <td className="py-6 pl-4">
                                    <div className="flex items-center gap-3">
                                       {/* Expand/collapse for spend data or items */}
                                       {((dataPoint.isSpendData && hasSpendData) || (!dataPoint.isSpendData && dataPoint.items.length > 0)) && (
                                          <button
                                             onClick={(e) => {
                                                e.stopPropagation();
                                                dataPoint.isSpendData ? setIsSpendExpanded(!isSpendExpanded) : toggleRowExpansion(dataPoint.id);
                                             }}
                                             className="flex items-center justify-center transition-transform duration-200 hover:bg-gray-100 active:bg-gray-100 focus:outline-none rounded p-1 -ml-1"
                                             style={{ transform: (dataPoint.isSpendData ? isSpendExpanded : expandedRows.has(dataPoint.id)) ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                                          >
                                             <ChevronDown className="h-4 w-4 text-gray-400" />
                                          </button>
                                       )}
                                       <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 text-gray-400">
                                          {dataPoint.icon}
                                       </div>
                                       <span className="text-[15px] font-medium text-[#1A1C1E]">
                                          {dataPoint.name}
                                          {!dataPoint.isSpendData && dataPoint.items.length > 0 && (
                                             <span className="ml-2 text-gray-400 font-normal">{dataPoint.items.length}</span>
                                          )}
                                       </span>
                                       {dataPoint.isSpendData && hasSpendData && (
                                          <span className="ml-2 text-[13px] text-gray-500">
                                             ({spendFileName})
                                          </span>
                                       )}
                                       {/* Show field counts for spend data */}
                                       {dataPoint.isSpendData && hasSpendData && !isParsingCsv && (
                                          <span className="ml-2 text-[11px] font-medium text-gray-400">
                                             {availableFieldsCount}/{DATA_FIELDS.length} fields available
                                          </span>
                                       )}
                                       {/* Show file name for other data points with files */}
                                       {!dataPoint.isSpendData && dataPoint.items.length > 0 && dataPoint.items[0]?.fileName && (
                                          <span className="ml-2 text-[13px] text-gray-500">
                                             ({dataPoint.items[0].fileName})
                                          </span>
                                       )}
                                       {/* Show field counts for other data points with validation */}
                                       {!dataPoint.isSpendData && dataPoint.items.length > 0 && getFieldsForDataPoint(dataPoint.id).length > 0 && (
                                          (() => {
                                             const { available, total } = getDataPointFieldCounts(dataPoint.id);
                                             const isParsing = parsingDataPoints.has(dataPoint.id);
                                             if (isParsing) {
                                                return (
                                                   <span className="ml-2 text-[11px] font-medium text-gray-400 flex items-center gap-1">
                                                      <Loader2 className="h-3 w-3 animate-spin" />
                                                      Analyzing...
                                                   </span>
                                                );
                                             }
                                             return (
                                                <span className={`ml-2 text-[11px] font-medium ${available === total ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                   {available}/{total} fields available
                                                </span>
                                             );
                                          })()
                                       )}
                                    </div>
                                 </td>
                                 <td className="py-6">
                                    <div className="flex items-center gap-2 text-[14px] text-gray-600 font-medium">
                                       {(() => {
                                          const hasFile = dataPoint.isSpendData ? !!hasSpendData : dataPoint.items.length > 0;
                                          const fields = getFieldsForDataPoint(dataPoint.id);
                                          const hasFieldDefs = fields.length > 0;
                                          
                                          if (!hasFile) {
                                             return (
                                                <>
                                                   <div className="h-4 w-4 rounded-full border border-dashed border-gray-300" />
                                                   <span className="text-gray-400">Not Uploaded</span>
                                                </>
                                             );
                                          }
                                          
                                          if (!hasFieldDefs) {
                                             // No validation required
                                             return (
                                                <>
                                                   <Check className="h-4 w-4 text-emerald-500" />
                                                   <span className="text-emerald-600">Uploaded</span>
                                                </>
                                             );
                                          }
                                          
                                          // Has field definitions - check validation status
                                          const { available, total } = getDataPointFieldCounts(dataPoint.id);
                                          const isParsing = dataPoint.isSpendData ? isParsingCsv : parsingDataPoints.has(dataPoint.id);
                                          
                                          if (isParsing) {
                                             return (
                                                <>
                                                   <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                                   <span className="text-gray-400">Analyzing...</span>
                                                </>
                                             );
                                          }
                                          
                                          if (available === total) {
                                             return (
                                                <>
                                                   <Check className="h-4 w-4 text-emerald-500" />
                                                   <span className="text-emerald-600">All Good</span>
                                                </>
                                             );
                                          }
                                          
                                          return (
                                             <>
                                                <AlertCircle className="h-4 w-4 text-amber-500" />
                                                <span className="text-amber-600">Needs Review</span>
                                             </>
                                          );
                                       })()}
                                    </div>
                                 </td>
                                 <td className="py-6 text-[14px] text-center">
                                    {(() => {
                                       const lastUpdated = getLastUpdatedDate(dataPoint);
                                       if (!lastUpdated) return <span className="text-gray-400">-</span>;
                                       const { date, time } = formatDateTime(lastUpdated);
                                       return (
                                          <div className="flex flex-col items-center">
                                             <span className="text-gray-600 font-medium">{date}</span>
                                             <span className="text-gray-400 text-[12px]">{time}</span>
                                          </div>
                                       );
                                    })()}
                                 </td>
                                 <td className="py-6 pr-4 text-right">
                                    {dataPoint.isSpendData ? (
                                       <div className="flex items-center justify-end gap-2">
                                          {hasSpendData && userCanEdit && (
                                             <button
                                                onClick={handleRemoveFile}
                                                className="inline-flex items-center gap-1 text-[14px] font-medium text-gray-400 transition-colors hover:text-red-500"
                                             >
                                                <X className="h-4 w-4" />
                                             </button>
                                          )}
                                          <button
                                             onClick={() => fileInputRef.current?.click()}
                                             disabled={!userCanUpload}
                                             className={`inline-flex items-center gap-2 text-[14px] font-semibold transition-colors ${
                                               userCanUpload
                                                 ? "text-gray-900 hover:text-blue-600"
                                                 : "text-gray-400 cursor-not-allowed"
                                             }`}
                                             title={!userCanUpload ? "Viewers cannot upload files" : undefined}
                                          >
                                             {hasSpendData ? "Change" : "Upload"}
                                             <Upload className="h-4 w-4" />
                                          </button>
                                          {hasSpendData && (
                                             <>
                                                {/* Show Validate button when data exists but not fully validated, or when user wants to re-validate */}
                                                {(uploadedFile || (hasSpendData && !isDataPointFullyValidated("spend"))) && (
                                                   <button
                                                      onClick={() => openValidationModal("spend", `Spend Data (${categoryName})`)}
                                                      className="ml-2 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-blue-600"
                                                   >
                                                      Validate
                                                      <ArrowRight className="h-4 w-4" />
                                                   </button>
                                                )}
                                                {/* Show Summary button when data is fully validated */}
                                                {isDataPointFullyValidated("spend") && (
                                                   <button
                                                      onClick={() => openSummaryModal("spend")}
                                                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-emerald-600"
                                                   >
                                                      Summary
                                                      <BarChart3 className="h-4 w-4" />
                                                   </button>
                                                )}
                                             </>
                                          )}
                                       </div>
                                    ) : (
                                       <div className="flex items-center justify-end gap-2">
                                          {/* X button to remove file */}
                                          {dataPoint.items.length > 0 && (
                                             <button
                                                onClick={() => handleRemoveDataPointFile(dataPoint.id)}
                                                className="inline-flex items-center gap-1 text-[14px] font-medium text-gray-400 transition-colors hover:text-red-500"
                                             >
                                                <X className="h-4 w-4" />
                                             </button>
                                          )}
                                          {dataPoint.canUpload && (
                                             <button
                                                onClick={() => triggerDataPointUpload(dataPoint.id)}
                                                className="inline-flex items-center gap-2 text-[14px] font-semibold text-gray-900 transition-all duration-150 ease-out hover:text-blue-600 hover:scale-105 active:scale-95"
                                             >
                                                {dataPoint.items.length > 0 ? "Change" : "Upload"}
                                                <Upload className="h-4 w-4" />
                                             </button>
                                          )}
                                          {/* Validate button for data points with validation and files */}
                                          {dataPoint.items.length > 0 && getFieldsForDataPoint(dataPoint.id).length > 0 && (
                                             <button
                                                onClick={() => openValidationModal(dataPoint.id, dataPoint.name)}
                                                className="ml-2 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-[13px] font-semibold text-white transition-all duration-150 ease-out hover:bg-blue-600 hover:scale-[1.02] hover:shadow-md hover:shadow-blue-500/30 active:scale-[0.98]"
                                             >
                                                Validate
                                                <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
                                             </button>
                                          )}
                                          {/* Summary button for validated data points */}
                                          {dataPoint.items.length > 0 && dataPoint.id !== "other" && isDataPointFullyValidated(dataPoint.id) && (
                                             <button
                                                onClick={() => openSummaryModal(dataPoint.id)}
                                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-[13px] font-semibold text-white transition-all duration-150 ease-out hover:bg-emerald-600 hover:scale-[1.02] hover:shadow-md hover:shadow-emerald-500/30 active:scale-[0.98]"
                                             >
                                                Summary
                                                <BarChart3 className="h-4 w-4" />
                                             </button>
                                          )}
                                       </div>
                                    )}
                                 </td>
                              </tr>
                              {/* Collapsible sub-items for spend data */}
                              {dataPoint.isSpendData && hasSpendData && isSpendExpanded && DATA_FIELDS.map((field, sIdx) => {
                                 const status = getFieldStatus(field);
                                 return (
                                    <tr key={sIdx} className="bg-gray-50/30 group transition-colors hover:bg-gray-50/50">
                                       <td className="py-4 pl-14">
                                          <span className="text-[14px] text-gray-600">{field.name}</span>
                                       </td>
                                       <td className="py-4">
                                          {isParsingCsv ? (
                                             <div className="flex items-center gap-2 text-[13px] text-gray-400">
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                Checking...
                                             </div>
                                          ) : status.available ? (
                                             <div className="flex items-center gap-2 text-[13px] text-emerald-600">
                                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                                                Available
                                             </div>
                                          ) : (
                                             <div className="flex items-center gap-2 text-[13px] text-amber-600">
                                                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                                Missing
                                             </div>
                                          )}
                                       </td>
                                       <td className="py-4 text-[13px] text-gray-400"></td>
                                       <td className="py-4 pr-4 text-right"></td>
                                    </tr>
                                 );
                              })}
                              {/* Collapsible sub-items for other data points - show field validation */}
                              {!dataPoint.isSpendData && expandedRows.has(dataPoint.id) && (() => {
                                 const fields = getFieldsForDataPoint(dataPoint.id);
                                 const isParsing = parsingDataPoints.has(dataPoint.id);
                                 
                                 // If has field definitions, show field status
                                 if (fields.length > 0) {
                                    return fields.map((field, fIdx) => {
                                       const status = getDataPointFieldStatus(dataPoint.id, field);
                                       return (
                                          <tr key={fIdx} className="bg-gray-50/30 group transition-colors hover:bg-gray-50/50">
                                             <td className="py-4 pl-14">
                                                <span className="text-[14px] text-gray-600">{field.name}</span>
                                             </td>
                                             <td className="py-4">
                                                {isParsing ? (
                                                   <div className="flex items-center gap-2 text-[13px] text-gray-400">
                                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                      Checking...
                                                   </div>
                                                ) : status.available ? (
                                                   <div className="flex items-center gap-2 text-[13px] text-emerald-600">
                                                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                                                      Available
                                                   </div>
                                                ) : (
                                                   <div className="flex items-center gap-2 text-[13px] text-amber-600">
                                                      <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                                      Missing
                                                   </div>
                                                )}
                                             </td>
                                             <td className="py-4 text-[13px] text-gray-400"></td>
                                             <td className="py-4 pr-4 text-right"></td>
                                          </tr>
                                       );
                                    });
                                 }
                                 
                                 // Otherwise show uploaded files
                                 return dataPoint.items.map((item) => (
                                    <tr key={item.id} className="bg-gray-50/30 group transition-colors hover:bg-gray-50/50">
                                       <td className="py-4 pl-14">
                                          <div className="flex items-center gap-3">
                                             <FileText className="h-4 w-4 text-gray-400" />
                                             <span className="text-[14px] text-gray-600">{item.name}</span>
                                             {item.fileName && (
                                                <span className="text-[11px] text-gray-400">({item.fileName})</span>
                                             )}
                                          </div>
                                       </td>
                                       <td className="py-4">
                                          <div className="flex items-center gap-2 text-[13px] text-emerald-600">
                                             <Check className="h-3.5 w-3.5 text-emerald-500" />
                                             Uploaded
                                          </div>
                                       </td>
                                       <td className="py-4 text-[13px] text-gray-400">{formatDate(item.uploadedAt)}</td>
                                       <td className="py-4 pr-4 text-right">
                                          <button
                                             onClick={() => removeDataPointItem(dataPoint.id, item.id)}
                                             className="inline-flex items-center gap-1 text-[13px] font-medium text-gray-400 transition-colors hover:text-red-500"
                                          >
                                             <X className="h-3.5 w-3.5" />
                                             Remove
                                          </button>
                                       </td>
                                    </tr>
                                 ));
                              })()}
                           </React.Fragment>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Opportunity Details Modal */}
      <Dialog open={isOpportunityModalOpen} onOpenChange={setIsOpportunityModalOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-[24px] p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                selectedOpportunity && isQualifiedOpportunity(selectedOpportunity)
                  ? 'bg-emerald-100'
                  : 'bg-amber-100'
              }`}>
                <Zap className={`h-5 w-5 ${
                  selectedOpportunity && isQualifiedOpportunity(selectedOpportunity)
                    ? 'text-emerald-600'
                    : 'text-amber-600'
                }`} />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold text-[#1A1C1E]">
                  {selectedOpportunity?.name}
                </DialogTitle>
                <p className="text-[13px] text-gray-500 mt-0.5">{selectedOpportunity?.description}</p>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-gray-50 p-4">
                <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Status</span>
                <p className={`text-lg font-bold ${
                  selectedOpportunity && isQualifiedOpportunity(selectedOpportunity)
                    ? 'text-emerald-600'
                    : 'text-amber-600'
                }`}>
                  {selectedOpportunity && isQualifiedOpportunity(selectedOpportunity) ? 'Qualified' : 'Potential'}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Potential Savings</span>
                <p className="text-lg font-bold text-[#1A1C1E]">{selectedOpportunity?.potentialSavings}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Validated</span>
                <p className="text-lg font-bold text-[#1A1C1E]">
                  {selectedOpportunity && getValidatedProofPointsCount(selectedOpportunity)}/{selectedOpportunity?.proofPoints.length}
                </p>
              </div>
            </div>

            {/* Proof Points */}
            <div>
              <h4 className="text-[14px] font-semibold text-[#1A1C1E] mb-3">Proof Points</h4>
              <div className="space-y-2">
                {selectedOpportunity?.proofPoints.map((proofPoint) => (
                  <div
                    key={proofPoint.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          if (selectedOpportunity) {
                            toggleProofPointValidation(selectedOpportunity.id, proofPoint.id);
                            // Update modal state
                            setSelectedOpportunity(prev =>
                              prev
                                ? {
                                    ...prev,
                                    proofPoints: prev.proofPoints.map(pp =>
                                      pp.id === proofPoint.id ? { ...pp, isValidated: !pp.isValidated } : pp
                                    ),
                                  }
                                : null
                            );
                          }
                        }}
                        className={`flex h-6 w-6 items-center justify-center rounded-full transition-all ${
                          proofPoint.isValidated
                            ? 'bg-emerald-500 text-white'
                            : 'border-2 border-gray-300 text-transparent hover:border-emerald-400'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <div>
                        <p className={`text-[14px] font-medium ${
                          proofPoint.isValidated ? 'text-[#1A1C1E]' : 'text-gray-500'
                        }`}>
                          {proofPoint.name}
                        </p>
                        <p className="text-[12px] text-gray-400">{proofPoint.description}</p>
                      </div>
                    </div>
                    <span className={`text-[12px] font-medium ${
                      proofPoint.isValidated ? 'text-emerald-600' : 'text-gray-400'
                    }`}>
                      {proofPoint.isValidated ? 'Validated' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 pt-4 border-t border-gray-100 flex justify-end">
            <Button
              onClick={() => setIsOpportunityModalOpen(false)}
              className="h-11 px-6 rounded-xl bg-[#1A1C1E] text-white hover:bg-black"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Items Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-[24px] p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-gray-100">
            <DialogTitle className="text-xl font-semibold text-[#1A1C1E]">
              {selectedDataPoint?.name} - {selectedDataPoint?.items.length} Item{selectedDataPoint?.items.length !== 1 ? 's' : ''}
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
            {selectedDataPoint?.items.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No items uploaded yet
              </div>
            ) : (
              selectedDataPoint?.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-[14px] font-medium text-gray-900">{item.name}</p>
                      {item.fileName && (
                        <p className="text-[12px] text-gray-500">{item.fileName}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[12px] text-gray-400">{formatDate(item.uploadedAt)}</span>
                    <button
                      onClick={() => {
                        if (selectedDataPoint) {
                          removeDataPointItem(selectedDataPoint.id, item.id);
                          // Update selectedDataPoint to reflect changes
                          setSelectedDataPoint(prev => prev ? {
                            ...prev,
                            items: prev.items.filter(i => i.id !== item.id)
                          } : null);
                        }
                      }}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-6 pt-4 border-t border-gray-100 flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                if (selectedDataPoint) {
                  triggerDataPointUpload(selectedDataPoint.id);
                }
              }}
              className="h-11 px-6 rounded-xl"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload More
            </Button>
            <Button
              onClick={() => setIsViewModalOpen(false)}
              className="h-11 px-6 rounded-xl bg-[#1A1C1E] text-white hover:bg-black"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Data Validation Modal */}
      <Dialog open={isValidationModalOpen} onOpenChange={setIsValidationModalOpen}>
        <DialogContent className="!max-w-[100vw] !w-[100vw] !h-[100vh] !rounded-none p-0 overflow-hidden flex flex-col border-0">
          {/* Hidden file input for re-upload */}
          <input
            type="file"
            ref={validationFileInputRef}
            accept={SUPPORTED_FORMATS}
            onChange={handleValidationReupload}
            className="hidden"
          />
          
          {/* Header */}
          <DialogHeader className="p-4 pb-3 border-b border-gray-100 flex-shrink-0 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                  <FileSpreadsheet className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold text-[#1A1C1E]">
                    Data Validation - {validationDataPoint?.name}
                  </DialogTitle>
                  <p className="text-[12px] text-gray-500 mt-0.5">
                    {validationDataPoint?.file?.name || "Review and fix data issues"}
                  </p>
                </div>
              </div>

              {/* Category Filter Toggle - Butter smooth with sliding indicator */}
              {parsedData && validationDataPoint?.id === "spend" && !parsedData.isDocument && (
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center p-1 rounded-full bg-gray-100">
                    {/* Sliding background indicator - using left position for proper animation */}
                    <motion.div
                      className="absolute top-1 bottom-1 rounded-full bg-indigo-500 shadow-sm"
                      initial={false}
                      animate={{
                        left: categoryFilterMode === "selected" ? 4 : 142,
                        width: categoryFilterMode === "selected" ? 138 : 80,
                      }}
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                    <button
                      onClick={() => setCategoryFilterMode("selected")}
                      className={`relative z-10 px-4 py-1.5 rounded-full text-[12px] font-medium transition-colors duration-200 ${
                        categoryFilterMode === "selected"
                          ? "text-white"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      Selected Categories
                    </button>
                    <button
                      onClick={() => setCategoryFilterMode("original")}
                      className={`relative z-10 px-4 py-1.5 rounded-full text-[12px] font-medium transition-colors duration-200 ${
                        categoryFilterMode === "original"
                          ? "text-white"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      All Data
                    </button>
                  </div>
                  {/* Row count with smooth fade */}
                  <AnimatePresence mode="wait">
                    {categoryFilterMode === "selected" && parsedData && (
                      <motion.span
                        key="row-count"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                        className="text-[11px] text-gray-500"
                      >
                        {visibleRows.totalFilteredRows || 0} of {parsedData.rows.length} rows
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Error Summary - uses memoized filteredErrorCounts for performance */}
              <div className="flex items-center gap-4">
                {filteredErrorCounts.total > 0 ? (
                  <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-red-50 border border-red-100">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <div>
                      <span className="text-[14px] font-semibold text-red-600">
                        {filteredErrorCounts.errors} Errors
                      </span>
                      {filteredErrorCounts.warnings > 0 && (
                        <span className="text-[14px] text-amber-600 ml-2">
                          · {filteredErrorCounts.warnings} Warnings
                        </span>
                      )}
                      {/* Show total errors if in filtered view and there are more in original */}
                      {categoryFilterMode === "selected" && errorCounts.total > filteredErrorCounts.total && (
                        <span className="text-[12px] text-gray-500 ml-2">
                          ({cellErrors.length} total in original)
                        </span>
                      )}
                    </div>
                  </div>
                ) : parsedData ? (
                  <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <span className="text-[14px] font-semibold text-emerald-600">All Good!</span>
                  </div>
                ) : null}
              </div>
            </div>
          </DialogHeader>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex">
            {/* Left Panel - Error List + Required Fields */}
            <div className="w-[320px] border-r border-gray-100 flex flex-col bg-gray-50/50">
              {/* Required Fields Section - Uses parsedData.headers for real-time matching */}
              {validationDataPoint && getFieldsForDataPoint(validationDataPoint.id).length > 0 && (
                <div className="p-4 border-b border-gray-100">
                  <h3 className="text-[14px] font-semibold text-gray-900">Required Fields</h3>
                  <div className="mt-3 space-y-2">
                    {getFieldsForDataPoint(validationDataPoint.id).map((field, idx) => {
                      // Use parsedData.headers directly if available (most up-to-date)
                      const columnsToCheck = parsedData?.headers || dataPointColumns[validationDataPoint.id] || [];
                      const matchedColumn = findMatchingColumn(columnsToCheck, field.requiredColumns);
                      const isAvailable = !!matchedColumn;

                      return (
                        <div key={idx} className="flex items-center gap-2">
                          {isAvailable ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                          )}
                          <span className={`text-[12px] ${isAvailable ? 'text-gray-600' : 'text-amber-600'}`}>
                            {field.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="p-4 border-b border-gray-100">
                <h3 className="text-[14px] font-semibold text-gray-900">Issues Found</h3>
                <p className="text-[12px] text-gray-500 mt-1">Click to navigate to issue</p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {isValidating ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : filteredErrorCounts.total === 0 && parsedData ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                    <p className="text-[14px] font-medium text-gray-600">No issues found</p>
                    <p className="text-[12px] text-gray-400 mt-1">{categoryFilterMode === "selected" ? "Your filtered data looks good!" : "Your data looks good!"}</p>
                  </div>
                ) : !parsedData ? (
                  <div className="text-center py-12">
                    <FileSpreadsheet className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-[14px] font-medium text-gray-500">No data to validate</p>
                    <p className="text-[12px] text-gray-400 mt-1">Close and upload a file first (CSV, Excel, PDF, Word, etc.)</p>
                  </div>
                ) : (
                  filteredCellErrors.map((error, idx) => {
                    // Calculate the row position in the filtered view for scrolling
                    // error.row is 1-based original row index
                    // We need to find where this row appears in filteredData.originalIndices
                    const originalRowIndex = error.row - 1; // Convert to 0-based
                    let filteredRowIndex = originalRowIndex; // Default to original for scrolling
                    let filteredRowNumber = error.row; // Row number to display in error list

                    if (categoryFilterMode === "selected" && filteredData.originalIndices) {
                      // Find the position of this row in the filtered data
                      const filteredPosition = filteredData.originalIndices.indexOf(originalRowIndex);
                      if (filteredPosition !== -1) {
                        filteredRowIndex = filteredPosition; // Position in filtered view for scrolling
                        filteredRowNumber = filteredPosition + 1; // 1-based for display
                      }
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          // For virtual scrolling, first update scrollTop to bring the row into view
                          if (tableContainerRef.current && parsedData) {
                            const containerHeight = tableContainerRef.current.clientHeight;
                            // Use filteredRowIndex for scroll position (position in current view)
                            const targetScrollTop = Math.max(0, filteredRowIndex * ROW_HEIGHT - (containerHeight / 2) + ROW_HEIGHT);

                            // Update state to trigger re-render with correct rows
                            setScrollTop(targetScrollTop);

                            // Also scroll the container
                            tableContainerRef.current.scrollTo({
                              top: targetScrollTop,
                              behavior: 'smooth'
                            });

                            // Wait for render and scroll, then highlight the cell
                            // Cell ID always uses ORIGINAL row number (error.row) because that's how the table renders
                            setTimeout(() => {
                              const cellId = `cell-${error.row}-${error.columnIndex}`;
                              const cell = document.getElementById(cellId);
                              if (cell) {
                                // Only scroll horizontally to show the column - vertical position is already set
                                const cellRect = cell.getBoundingClientRect();
                                const container = tableContainerRef.current;
                                if (container) {
                                  const containerRect = container.getBoundingClientRect();
                                  // Check if cell is outside horizontal view
                                  if (cellRect.left < containerRect.left || cellRect.right > containerRect.right) {
                                    cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                                  }
                                }
                                // Add highlight with smooth animation
                                cell.style.transition = 'box-shadow 200ms ease-out, transform 200ms ease-out';
                                cell.classList.add('ring-2', 'ring-blue-500', 'ring-offset-1', 'z-20', 'relative', 'scale-[1.02]');
                                setTimeout(() => {
                                  cell.classList.remove('scale-[1.02]');
                                }, 300);
                                setTimeout(() => {
                                  cell.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-1', 'z-20', 'relative');
                                }, 2500);
                              }
                            }, 350);
                          }
                        }}
                        className="w-full text-left p-3 rounded-xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm transition-all duration-150 ease-out"
                      >
                        <div className="flex items-start gap-3">
                          {error.severity === "error" ? (
                            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] font-medium ${error.severity === "error" ? "text-red-600" : "text-amber-600"}`}>
                              {error.error}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-1">
                              {categoryFilterMode === "selected" ? (
                                <>Row {filteredRowNumber} <span className="text-gray-400">(orig: {error.row})</span></>
                              ) : (
                                <>Row {error.row}</>
                              )} · Column "{error.column}"
                            </p>
                            {error.value && (
                              <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                                Value: "{error.value}"
                              </p>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Panel - Data Table with Virtual Scrolling OR Document Editor */}
            <div className="flex-1 min-w-0 overflow-hidden flex flex-col p-4">
              {isValidating && parseProgress < 100 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
                    <p className="text-[14px] text-gray-500 mt-3">
                      {parseProgress > 0 ? `Processing... ${parseProgress}%` : 'Loading file...'}
                    </p>
                    <div className="w-48 h-2 bg-gray-100 rounded-full mt-3 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${parseProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : parsedData?.isDocument ? (
                /* Document View - Fullscreen Editable Document */
                <div className="border border-gray-200 rounded-xl overflow-hidden flex-1 flex flex-col bg-white">
                  {/* Document Type Badge & Toolbar */}
                  <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span className="text-[13px] font-medium text-gray-700">
                        Document Editor
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700 uppercase">
                        {(parsedData as ParsedData & { documentType?: string }).documentType || 'Document'}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-400">
                      Edit document content below
                    </span>
                  </div>

                  {/* Fullscreen Editable Document Content */}
                  <div
                    ref={documentEditorRef}
                    className="flex-1 overflow-auto p-6"
                    style={{ minHeight: 400 }}
                  >
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      className="prose prose-sm max-w-none focus:outline-none min-h-full document-editor"
                      style={{
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        fontSize: '14px',
                        lineHeight: '1.7',
                        color: '#374151',
                      }}
                      dangerouslySetInnerHTML={{ __html: parsedData.htmlContent || parsedData.rawText || '' }}
                      onBlur={(e) => {
                        // Only update state when user leaves the editor (not on every keystroke)
                        // This prevents cursor jumping caused by React re-renders
                        const target = e.target as HTMLDivElement;
                        setParsedData(prev => prev ? {
                          ...prev,
                          rawText: target.innerText,
                          htmlContent: target.innerHTML
                        } : null);
                      }}
                    />
                  </div>

                  {/* Document Stats - shows "Editing..." while focused */}
                  <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">
                      {(parsedData.rawText?.split(/\s+/).filter(Boolean).length || 0).toLocaleString()} words
                      <span className="mx-2">·</span>
                      {(parsedData.rawText?.length || 0).toLocaleString()} characters
                    </span>
                    <span className="text-[11px] text-emerald-600 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Auto-saved
                    </span>
                  </div>
                </div>
              ) : parsedData ? (
                <motion.div
                  ref={tableContainerRef}
                  className="border border-gray-200 rounded-xl overflow-auto flex-1 relative smooth-scroll"
                  onScroll={handleTableScroll}
                  style={{ willChange: 'scroll-position' }}
                  initial={false}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  key={`table-${categoryFilterMode}`}
                >
                  {/* Virtual scrolling container - use filtered row count */}
                  <motion.div
                    style={{ height: (visibleRows.totalFilteredRows || parsedData.rows.length) * ROW_HEIGHT + 48, position: 'relative' }}
                    initial={{ opacity: 0.5 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <table className="text-left text-[13px] border-collapse" style={{ minWidth: 'max-content' }}>
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr style={{ height: 48 }}>
                          <th className="px-3 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wider border-b border-r border-gray-200 bg-gray-100 sticky left-0 z-20 w-16">
                            #
                          </th>
                          {parsedData.headers.map((header, idx) => (
                            <th
                              key={idx}
                              className="px-4 py-3 font-semibold text-gray-700 border-b border-r border-gray-200 bg-gray-50 whitespace-nowrap min-w-[120px]"
                            >
                              {header}
                              {cellErrorMap.has(`0-${idx}`) && (
                                <AlertTriangle className="inline h-3 w-3 text-amber-500 ml-1" />
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Spacer for rows above viewport */}
                        {visibleRows.startIndex > 0 && (
                          <tr style={{ height: visibleRows.startIndex * ROW_HEIGHT }}>
                            <td colSpan={parsedData.headers.length + 1} />
                          </tr>
                        )}

                        {/* Visible rows only */}
                        {visibleRows.rows.map((row, idx) => {
                          // Use original row index for error checking and cell IDs
                          const originalRowIdx = visibleRows.originalIndices?.[idx] ?? (visibleRows.startIndex + idx);
                          // Display row number (1-based, using original index)
                          const displayRowNum = originalRowIdx + 1;
                          return (
                            <tr key={`row-${originalRowIdx}`} className="hover:bg-blue-50/40" style={{ height: ROW_HEIGHT, contain: 'layout style paint' }}>
                              <td className="px-3 py-2 text-gray-400 font-medium border-r border-b border-gray-100 bg-gray-50 text-center sticky left-0 z-10">
                                {displayRowNum}
                              </td>
                              {row.map((cell, colIdx) => {
                                const error = getCellError(originalRowIdx, colIdx);
                                const isEditing = editingCell?.row === originalRowIdx && editingCell?.col === colIdx;

                                return (
                                  <td
                                    key={colIdx}
                                    id={`cell-${displayRowNum}-${colIdx}`}
                                    className={`px-4 py-2 border-r border-b border-gray-100 whitespace-nowrap max-w-[300px] truncate ${
                                      error
                                        ? error.severity === "error"
                                          ? "bg-red-50"
                                          : "bg-amber-50"
                                        : ""
                                    }`}
                                    style={{ contain: 'layout style paint' }}
                                  >
                                    {isEditing ? (
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="text"
                                          value={editValue}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') saveEditedCell();
                                            if (e.key === 'Escape') cancelEdit();
                                          }}
                                          className="flex-1 px-2 py-1 text-[13px] border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          autoFocus
                                        />
                                        <button
                                          onClick={saveEditedCell}
                                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          onClick={cancelEdit}
                                          className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div
                                        className={`flex items-center gap-2 group ${userCanEdit ? "cursor-pointer" : "cursor-default"}`}
                                        onClick={() => startEditingCell(originalRowIdx, colIdx, cell)}
                                        title={!userCanEdit ? "Read-only mode" : "Click to edit"}
                                      >
                                        <span className={`flex-1 truncate ${error ? (error.severity === "error" ? "text-red-700" : "text-amber-700") : "text-gray-700"}`}>
                                          {cell || <span className="text-gray-300 italic">empty</span>}
                                        </span>
                                        {error && (
                                          <AlertCircle className={`h-3.5 w-3.5 flex-shrink-0 ${error.severity === "error" ? "text-red-500" : "text-amber-500"}`} />
                                        )}
                                        {userCanEdit && (
                                          <Pencil className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                                        )}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}

                        {/* Spacer for rows below viewport */}
                        {(() => {
                          const totalRows = visibleRows.totalFilteredRows || parsedData.rows.length;
                          return visibleRows.endIndex < totalRows && (
                            <tr style={{ height: (totalRows - visibleRows.endIndex) * ROW_HEIGHT }}>
                              <td colSpan={parsedData.headers.length + 1} />
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </motion.div>
                </motion.div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <FileSpreadsheet className="h-16 w-16 text-gray-200 mx-auto mb-4" />
                    <p className="text-[16px] font-medium text-gray-500">No data to display</p>
                    <p className="text-[13px] text-gray-400 mt-1">Upload a file to see its contents</p>
                    <p className="text-[11px] text-gray-300 mt-2">Supported: CSV, Excel, PDF, Word, JSON, TXT</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
            <div className="text-[13px] text-gray-500 flex items-center gap-4">
              {parsedData && (
                parsedData.isDocument ? (
                  /* Document stats */
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span className="font-medium text-gray-700">Document</span>
                    </span>
                    <span>
                      <span className="font-semibold text-gray-700">
                        {(parsedData.rawText?.split(/\s+/).filter(Boolean).length || 0).toLocaleString()}
                      </span> words
                    </span>
                    <span>
                      <span className="font-semibold text-gray-700">
                        {(parsedData.rawText?.length || 0).toLocaleString()}
                      </span> characters
                    </span>
                  </div>
                ) : (
                  /* Table stats */
                  <>
                    <div>
                      <span className="font-semibold text-gray-700">{parsedData.totalRows.toLocaleString()}</span> total rows
                      <span className="mx-2">·</span>
                      <span className="font-semibold text-gray-700">{parsedData.headers.length}</span> columns
                    </div>
                    {parsedData.totalRows > parsedData.rows.length && (
                      <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[11px] font-medium">
                        Showing first {parsedData.rows.length.toLocaleString()} rows
                      </span>
                    )}
                    {isValidating && (
                      <span className="flex items-center gap-1.5 text-gray-400">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Validating...
                      </span>
                    )}
                  </>
                )
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setIsValidationModalOpen(false)}
                className="h-9 px-5 rounded-xl transition-all duration-150 ease-out hover:scale-[1.02] active:scale-[0.98]"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={revalidateEntireFile}
                className="h-9 px-5 rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-all duration-150 ease-out hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100"
                disabled={isValidating || !parsedData}
              >
                <RefreshCw className={`h-4 w-4 mr-2 transition-transform duration-300 ${isValidating ? 'animate-spin' : ''}`} />
                Revalidate
              </Button>
              <Button
                onClick={confirmAndSaveData}
                className="h-9 px-5 rounded-xl bg-[#1A1C1E] text-white hover:bg-black transition-all duration-150 ease-out hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100"
                disabled={isValidating}
              >
                <span className="flex items-center transition-all duration-200">
                  {isValidating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Validating...
                    </>
                  ) : (categoryFilterMode === "selected" ? filteredErrorCounts.errors : errorCounts.errors) > 0 ? (
                    <>
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Fix Errors First
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      {categoryFilterMode === "selected"
                        ? `Confirm & Save All Data`
                        : "Confirm & Save"}
                    </>
                  )}
                </span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Opportunities List Modal - Full Screen */}
      <Dialog open={isOpportunitiesListOpen} onOpenChange={setIsOpportunitiesListOpen}>
        <DialogContent className="!max-w-[100vw] !w-[100vw] !h-[100vh] !rounded-none p-0 overflow-hidden flex flex-col border-0">
          {/* Header */}
          <DialogHeader className="p-6 pb-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 via-indigo-50 to-white flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
                  <Zap className="h-7 w-7 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-semibold text-[#1A1C1E]">
                    Opportunities
                  </DialogTitle>
                  <p className="text-[14px] text-gray-500 mt-1">
                    {qualifiedCount} Qualified · {potentialCount} Potential · Based on your data analysis
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="text-[14px] font-semibold text-emerald-700">{qualifiedCount} Qualified</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-amber-50 border border-amber-100">
                  <Circle className="h-5 w-5 text-amber-500" />
                  <span className="text-[14px] font-semibold text-amber-700">{potentialCount} Potential</span>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Content - Grid of Opportunity Cards */}
          <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-2 gap-6">
                {opportunities.map((opportunity) => {
                  const validatedCount = getValidatedProofPointsCount(opportunity);
                  const isQualified = isQualifiedOpportunity(opportunity);
                  const confidencePercent = Math.round((validatedCount / opportunity.proofPoints.length) * 100);

                  return (
                    <motion.div
                      key={opportunity.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`rounded-3xl border-2 bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 ease-out overflow-hidden ${
                        isQualified
                          ? 'border-emerald-200 hover:shadow-emerald-100'
                          : 'border-amber-200 hover:shadow-amber-100'
                      }`}
                    >
                      {/* Card Header */}
                      <div className={`p-6 ${isQualified ? 'bg-gradient-to-r from-emerald-50 to-white' : 'bg-gradient-to-r from-amber-50 to-white'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                              isQualified ? 'bg-emerald-100' : 'bg-amber-100'
                            }`}>
                              <Zap className={`h-7 w-7 ${isQualified ? 'text-emerald-600' : 'text-amber-600'}`} />
                            </div>
                            <div>
                              <h3 className="text-xl font-semibold text-[#1A1C1E]">{opportunity.name}</h3>
                              <p className="text-[14px] text-gray-500 mt-1">{opportunity.description}</p>
                            </div>
                          </div>
                          <div className={`px-4 py-2 rounded-full text-[13px] font-bold ${
                            isQualified
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {isQualified ? 'Qualified' : 'Potential'}
                          </div>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-6 pt-4">
                        {/* Stats Row */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                          <div className="p-4 rounded-xl bg-gray-50">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Potential Savings</span>
                            <p className="text-xl font-bold text-emerald-600 mt-1">{opportunity.potentialSavings}</p>
                          </div>
                          <div className="p-4 rounded-xl bg-gray-50">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Confidence</span>
                            <p className="text-xl font-bold text-blue-600 mt-1">{confidencePercent}%</p>
                          </div>
                          <div className="p-4 rounded-xl bg-gray-50">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Proof Points</span>
                            <p className="text-xl font-bold text-gray-700 mt-1">{validatedCount}/{opportunity.proofPoints.length}</p>
                          </div>
                        </div>

                        {/* Proof Points List */}
                        <div>
                          <p className="text-[13px] font-semibold text-gray-700 mb-3">Validation Status</p>
                          <div className="grid grid-cols-2 gap-2">
                            {opportunity.proofPoints.map((pp) => (
                              <div
                                key={pp.id}
                                className={`flex items-center gap-2 p-3 rounded-xl ${
                                  pp.isValidated ? 'bg-emerald-50' : 'bg-gray-50'
                                }`}
                              >
                                {pp.isValidated ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                ) : (
                                  <Circle className="h-4 w-4 text-gray-300 flex-shrink-0" />
                                )}
                                <span className={`text-[13px] truncate ${pp.isValidated ? 'text-gray-900' : 'text-gray-500'}`}>
                                  {pp.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100 flex justify-end bg-white flex-shrink-0">
            <Button
              onClick={() => setIsOpportunitiesListOpen(false)}
              className="h-11 px-8 rounded-xl bg-[#1A1C1E] text-white hover:bg-black"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Summary Modal */}
      <Dialog open={isSummaryModalOpen} onOpenChange={setIsSummaryModalOpen}>
        <DialogContent className="!max-w-[100vw] !w-[100vw] !h-[100vh] !rounded-none p-0 overflow-hidden flex flex-col border-0">
          {summaryDataPointId && (() => {
            const summaryData = getSummaryData(summaryDataPointId);
            const dataPointName = summaryDataPointId === "spend" ? "Spend Data" :
              summaryDataPointId === "supply-master" ? "Supply Master" :
              summaryDataPointId === "contracts" ? "Contracts" :
              summaryDataPointId === "playbook" ? "Category Playbook" : "Data";

            return (
              <>
                {/* Header */}
                <div className="p-6 pb-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 via-teal-50 to-white flex-shrink-0">
                  <div className="flex items-center justify-between max-w-7xl mx-auto">
                    <div className="flex items-center gap-5">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
                        {summaryDataPointId === "spend" && <DollarSign className="h-7 w-7 text-white" />}
                        {summaryDataPointId === "supply-master" && <Users className="h-7 w-7 text-white" />}
                        {summaryDataPointId === "contracts" && <FileCheck className="h-7 w-7 text-white" />}
                        {summaryDataPointId === "playbook" && <BookOpen className="h-7 w-7 text-white" />}
                      </div>
                      <div>
                        <DialogTitle className="text-2xl font-semibold text-[#1A1C1E]">
                          {dataPointName} Summary
                        </DialogTitle>
                        <p className="text-[14px] text-gray-500 mt-1">
                          {state.setupData.categoryName || "Category"} · Jun '24 - May '25
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {summaryData.rowCount > 0 && (
                        <span className="flex items-center gap-2 rounded-xl bg-blue-100 px-5 py-2.5">
                          <Database className="h-5 w-5 text-blue-600" />
                          <span className="text-[14px] font-semibold text-blue-700">{summaryData.rowCount.toLocaleString()} rows</span>
                        </span>
                      )}
                      <span className="flex items-center gap-2 rounded-xl bg-emerald-100 px-5 py-2.5">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        <span className="text-[14px] font-semibold text-emerald-700">Validated</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-8 overflow-y-auto bg-gray-50/30">
                  <div className="max-w-7xl mx-auto">
                  {/* Spend Data Summary */}
                  {summaryDataPointId === "spend" && (
                    <div className="space-y-6">
                      {/* Total Spend Card */}
                      <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[13px] font-bold uppercase tracking-widest text-gray-500">Total Spend</span>
                            <p className="text-4xl font-bold text-[#1A1C1E] mt-2">{formatCurrency(summaryData.totalSpend)}</p>
                          </div>
                          <div className="flex items-center gap-8">
                            <div className="text-right">
                              <span className="text-[13px] font-bold uppercase tracking-widest text-gray-500">Period</span>
                              <p className="text-xl font-semibold text-gray-700 mt-2">Jun '24 - May '25</p>
                            </div>
                            <div className="text-right border-l border-blue-200 pl-8">
                              <span className="text-[13px] font-bold uppercase tracking-widest text-gray-500">Last Updated</span>
                              <p className="text-xl font-semibold text-gray-700 mt-2">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Two Column Grid */}
                      <div className="grid grid-cols-2 gap-6">
                        {/* Spend by Location */}
                        <div className="rounded-2xl border border-gray-100 bg-white p-6">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                              <MapPin className="h-5 w-5 text-blue-500" />
                            </div>
                            <h4 className="text-[15px] font-semibold text-[#1A1C1E]">Spend by Location</h4>
                          </div>
                          <div className="space-y-3">
                            {summaryData.locations.map((loc, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="w-3 h-3 rounded-full bg-blue-500" style={{ opacity: 1 - (idx * 0.12) }} />
                                  <span className="text-[15px] font-medium text-gray-800">{loc.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="text-[15px] font-semibold text-gray-900">{formatCurrency(loc.spend)}</span>
                                  <span className="text-[15px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg min-w-[65px] text-center">{loc.percentage}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Spend by Supplier */}
                        <div className="rounded-2xl border border-gray-100 bg-white p-6">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50">
                              <Building2 className="h-5 w-5 text-purple-500" />
                            </div>
                            <h4 className="text-[15px] font-semibold text-[#1A1C1E]">Spend by Supplier</h4>
                          </div>
                          <div className="space-y-3">
                            {summaryData.suppliers.map((supplier, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="w-3 h-3 rounded-full bg-purple-500" style={{ opacity: 1 - (idx * 0.12) }} />
                                  <span className="text-[15px] font-medium text-gray-800">{supplier.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="text-[15px] font-semibold text-gray-900">{formatCurrency(supplier.spend)}</span>
                                  <span className="text-[15px] font-bold text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg min-w-[65px] text-center">{supplier.percentage}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Supply Master Summary */}
                  {summaryDataPointId === "supply-master" && (
                    <div className="space-y-6">
                      {/* Stats Row */}
                      <div className="grid grid-cols-4 gap-4">
                        <div className="rounded-2xl bg-blue-50 p-5">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-blue-600">Total Suppliers</span>
                          <p className="text-2xl font-bold text-[#1A1C1E] mt-2">{(summaryData as any).supplierCount || summaryData.suppliers.length}</p>
                        </div>
                        <div className="rounded-2xl bg-emerald-50 p-5">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">Active</span>
                          <p className="text-2xl font-bold text-[#1A1C1E] mt-2">{(summaryData as any).activeCount || summaryData.suppliers.length - 1}</p>
                        </div>
                        <div className="rounded-2xl bg-purple-50 p-5">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-purple-600">Regions</span>
                          <p className="text-2xl font-bold text-[#1A1C1E] mt-2">{(summaryData as any).regionCount || summaryData.locations.length}</p>
                        </div>
                        <div className="rounded-2xl bg-amber-50 p-5">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-amber-600">Categories</span>
                          <p className="text-2xl font-bold text-[#1A1C1E] mt-2">{(summaryData as any).categoryCount || 1}</p>
                        </div>
                      </div>

                      {/* Supplier List */}
                      <div className="rounded-2xl border border-gray-100 bg-white p-6">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                            <Users className="h-5 w-5 text-blue-500" />
                          </div>
                          <h4 className="text-[15px] font-semibold text-[#1A1C1E]">Top Suppliers by Spend</h4>
                        </div>
                        <div className="space-y-3">
                          {summaryData.suppliers.map((supplier, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[14px] font-bold text-gray-600 shadow-sm">
                                  {idx + 1}
                                </div>
                                <span className="text-[15px] font-medium text-gray-900">{supplier.name}</span>
                              </div>
                              <div className="flex items-center gap-5">
                                <span className="text-[15px] font-semibold text-gray-900">{formatCurrency(supplier.spend)}</span>
                                <div className="w-32 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 rounded-full"
                                    style={{ width: `${supplier.percentage}%` }}
                                  />
                                </div>
                                <span className="text-[15px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg min-w-[65px] text-center">{supplier.percentage}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Geographic Distribution */}
                      <div className="rounded-2xl border border-gray-100 bg-white p-6">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                            <MapPin className="h-5 w-5 text-emerald-500" />
                          </div>
                          <h4 className="text-[15px] font-semibold text-[#1A1C1E]">Supplier Geographic Distribution</h4>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          {summaryData.locations.slice(0, 6).map((loc, idx) => (
                            <div key={idx} className="p-4 rounded-xl bg-gray-50">
                              <p className="text-[14px] font-medium text-gray-900">{loc.name}</p>
                              <p className="text-[12px] text-gray-500 mt-1">{loc.spend} supplier{loc.spend !== 1 ? 's' : ''}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Contracts Summary */}
                  {summaryDataPointId === "contracts" && (
                    <div className="space-y-6">
                      {/* Stats Row */}
                      <div className="grid grid-cols-4 gap-4">
                        <div className="rounded-2xl bg-blue-50 p-5">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-blue-600">Total Contracts</span>
                          <p className="text-2xl font-bold text-[#1A1C1E] mt-2">{summaryData.contracts.length}</p>
                        </div>
                        <div className="rounded-2xl bg-emerald-50 p-5">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">Active</span>
                          <p className="text-2xl font-bold text-[#1A1C1E] mt-2">{summaryData.contracts.filter(c => c.status === "Active").length}</p>
                        </div>
                        <div className="rounded-2xl bg-amber-50 p-5">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-amber-600">Expiring Soon</span>
                          <p className="text-2xl font-bold text-[#1A1C1E] mt-2">{summaryData.contracts.filter(c => c.status === "Expiring").length}</p>
                        </div>
                        <div className="rounded-2xl bg-purple-50 p-5">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-purple-600">Total Value</span>
                          <p className="text-2xl font-bold text-[#1A1C1E] mt-2">{formatCurrency(summaryData.totalSpend)}</p>
                        </div>
                      </div>

                      {/* Contracts List */}
                      <div className="rounded-2xl border border-gray-100 bg-white p-6">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                            <FileCheck className="h-5 w-5 text-blue-500" />
                          </div>
                          <h4 className="text-[15px] font-semibold text-[#1A1C1E]">Contract Portfolio</h4>
                        </div>
                        <div className="space-y-3">
                          {summaryData.contracts.map((contract, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                                  contract.status === "Active" ? "bg-emerald-100" : "bg-amber-100"
                                }`}>
                                  <FileText className={`h-5 w-5 ${
                                    contract.status === "Active" ? "text-emerald-600" : "text-amber-600"
                                  }`} />
                                </div>
                                <div>
                                  <p className="text-[14px] font-medium text-gray-900">{contract.name}</p>
                                  <p className="text-[12px] text-gray-500 mt-0.5">Expires: {contract.expiry}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className={`px-3 py-1 rounded-full text-[12px] font-semibold ${
                                  contract.status === "Active"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}>
                                  {contract.status}
                                </span>
                                <span className="text-[15px] font-bold text-gray-900">{formatCurrency(contract.value)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Category Playbook Summary */}
                  {summaryDataPointId === "playbook" && (
                    <div className="space-y-6">
                      {/* Category Header */}
                      <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-600">Category</span>
                            <p className="text-2xl font-bold text-[#1A1C1E] mt-1">{summaryData.playbook.category}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-600">Strategy</span>
                            <p className="text-lg font-semibold text-gray-700 mt-1">{summaryData.playbook.strategy}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        {/* Market Trends */}
                        <div className="rounded-2xl border border-gray-100 bg-white p-6">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                              <TrendingUp className="h-5 w-5 text-blue-500" />
                            </div>
                            <h4 className="text-[15px] font-semibold text-[#1A1C1E]">Market Trends</h4>
                          </div>
                          <div className="space-y-3">
                            {summaryData.playbook.marketTrends.map((trend, idx) => (
                              <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-blue-50/50">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                                <p className="text-[14px] text-gray-700">{trend}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Recommendations */}
                        <div className="rounded-2xl border border-gray-100 bg-white p-6">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            </div>
                            <h4 className="text-[15px] font-semibold text-[#1A1C1E]">Recommendations</h4>
                          </div>
                          <div className="space-y-3">
                            {summaryData.playbook.recommendations.map((rec, idx) => (
                              <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50/50">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                <p className="text-[14px] text-gray-700">{rec}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Risk Assessment */}
                      <div className="rounded-2xl border border-gray-100 bg-white p-6">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                          </div>
                          <h4 className="text-[15px] font-semibold text-[#1A1C1E]">Risk Assessment</h4>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          {summaryData.playbook.risks.map((risk, idx) => (
                            <div key={idx} className={`p-4 rounded-xl ${
                              risk.level === "High" ? "bg-red-50" :
                              risk.level === "Medium" ? "bg-amber-50" : "bg-emerald-50"
                            }`}>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-[14px] font-semibold text-gray-900">{risk.name}</p>
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                  risk.level === "High" ? "bg-red-100 text-red-700" :
                                  risk.level === "Medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                                }`}>
                                  {risk.level}
                                </span>
                              </div>
                              <p className="text-[12px] text-gray-600">{risk.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
                  <p className="text-[14px] text-gray-500">
                    Data validated and ready for analysis
                  </p>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setIsSummaryModalOpen(false)}
                      className="h-11 px-6 rounded-xl"
                    >
                      Close
                    </Button>
                    <Button
                      onClick={() => {
                        setIsSummaryModalOpen(false);
                        handleContinue();
                      }}
                      className="h-11 px-8 rounded-xl bg-[#1A1C1E] text-white hover:bg-black"
                    >
                      Run Analysis
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Processing Overlay Modal */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#F8FBFE]/95 backdrop-blur-sm"
          >
            <div className="relative flex flex-col items-center max-w-2xl text-center space-y-8">
              {/* Central AI Orb Animation */}
              <div className="relative h-40 w-40">
                {/* Animated Glow Layers */}
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.6, 0.3],
                    rotate: [0, 180, 360]
                  }}
                  transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-400/30 via-purple-500/20 to-indigo-400/30 blur-3xl"
                />

                <motion.div
                  animate={{
                    scale: [1, 1.1, 1],
                    rotate: [0, -180, -360]
                  }}
                  transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                  className="absolute inset-4 rounded-full bg-gradient-to-bl from-cyan-400/20 via-blue-500/20 to-purple-400/20 blur-2xl"
                />

                {/* Core Orb */}
                <motion.div
                  animate={{
                    y: [0, -8, 0],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="relative h-full w-full rounded-full bg-white shadow-[0_0_60px_rgba(59,130,246,0.3)] ring-1 ring-white/50 overflow-hidden"
                >
                  {/* Internal Swirls */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-white to-purple-500/10" />

                  <motion.div
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.5, 0.8, 0.5],
                      x: [-20, 20, -20],
                      y: [-20, 20, -20]
                    }}
                    transition={{
                      duration: 6,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="absolute -inset-10 bg-gradient-to-tr from-blue-400 via-indigo-500 to-purple-500 blur-xl opacity-40 mix-blend-multiply"
                  />

                  <motion.div
                    animate={{
                      scale: [1.2, 0.8, 1.2],
                      x: [20, -20, 20],
                      y: [20, -20, 20]
                    }}
                    transition={{
                      duration: 7,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="absolute -inset-10 bg-gradient-to-br from-cyan-300 via-blue-400 to-indigo-500 blur-xl opacity-30 mix-blend-screen"
                  />

                  {/* Surface Reflection */}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-black/5" />
                </motion.div>
              </div>

              {/* Text Content */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="space-y-4"
              >
                <h1 className="text-3xl font-medium tracking-tight text-[#1A1C1E] font-serif italic">
                  Thanks for validating your data
                </h1>
                <p className="text-lg text-gray-400/80 font-medium">
                  {processingStatus}
                </p>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
