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
  FileCheck
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
import React, { useRef, useState, useEffect, useCallback } from "react";
import { useApp, type DataPoint, type DataPointItem, type SetupOpportunity, type ProofPoint } from "@/context/AppContext";
import { procurementApi } from "@/lib/api";
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

// Spend Data Fields
const SPEND_DATA_FIELDS: DataField[] = [
  {
    name: "Spend by Location",
    requiredColumns: ["country", "region", "location", "supplier_country", "supplier_region", "geography"],
    description: "Geographic spend distribution"
  },
  {
    name: "Spend by Supplier",
    requiredColumns: ["supplier", "supplier_name", "supplier_id", "vendor", "vendor_name"],
    description: "Supplier spend breakdown"
  },
  {
    name: "Volume by Supplier",
    requiredColumns: ["volume", "quantity", "qty", "units", "volume_kg", "volume_mt"],
    description: "Volume data per supplier"
  },
  {
    name: "Volume by Geography",
    requiredColumns: ["volume", "quantity", "qty"],
    description: "Volume data by region"
  },
  {
    name: "Price",
    requiredColumns: ["price", "unit_price", "price_per_unit", "rate", "cost_per_unit"],
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
    requiredColumns: ["recommendations", "actions", "initiatives", "opportunities"],
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

// Check if a column matches any of the required columns
// Uses strict matching - column must start with or equal the required name
const hasColumn = (csvColumns: string[], requiredColumns: string[]): boolean => {
  const normalizedCsvColumns = csvColumns.map(col => col.toLowerCase().replace(/[\s_-]/g, ''));
  return requiredColumns.some(required => {
    const normalizedRequired = required.replace(/[\s_-]/g, '').toLowerCase();
    return normalizedCsvColumns.some(csv =>
      // Exact match OR starts with required name (e.g., "spendamount" starts with "spend")
      csv === normalizedRequired ||
      csv.startsWith(normalizedRequired) ||
      // Allow suffix match for common patterns (e.g., "unitprice" ends with "price")
      (normalizedRequired.length >= 4 && csv.endsWith(normalizedRequired))
    );
  });
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

export default function ReviewDataPage() {
  const router = useRouter();
  const { state, actions } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dataPointFileInputRef = useRef<HTMLInputElement>(null);

  const [uploadedFile, setUploadedFile] = useState<File | null>(state.setupData.uploadedFile);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [isParsingCsv, setIsParsingCsv] = useState(false);
  const [isSpendExpanded, setIsSpendExpanded] = useState(false);
  
  // Track parsed columns and files for each data point
  const [dataPointColumns, setDataPointColumns] = useState<Record<string, string[]>>({});
  const [dataPointFiles, setDataPointFiles] = useState<Record<string, File>>({});
  const [parsingDataPoints, setParsingDataPoints] = useState<Set<string>>(new Set());
  const [expandedDataPoints, setExpandedDataPoints] = useState<Set<string>>(new Set());

  // Store fully parsed CSV data for summary display
  interface ParsedCsvData {
    headers: string[];
    rows: Record<string, string>[];
  }
  const [parsedCsvDataStore, setParsedCsvDataStore] = useState<Record<string, ParsedCsvData>>({});

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

  // Virtual scrolling state
  const [scrollTop, setScrollTop] = useState(0);
  const ROW_HEIGHT = 36; // Height of each row in pixels
  const VISIBLE_ROWS = 30; // Number of rows to render at once
  const BUFFER_ROWS = 10; // Extra rows to render above/below viewport

  // Computed metrics state - stores calculated procurement analytics
  const [computedMetrics, setComputedMetrics] = useState<ComputedMetrics | null>(null);
  const [opportunityMetrics, setOpportunityMetrics] = useState<OpportunityMetrics[]>([]);

  // Parse CSV to extract column headers and full data when file changes
  useEffect(() => {
    if (uploadedFile) {
      setIsParsingCsv(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          const lines = text.split('\n').filter(line => line.trim());
          // Get headers
          const headers = lines[0].split(',').map(col => col.trim().replace(/"/g, ''));
          setCsvColumns(headers);

          // Parse all rows into objects for summary
          const rows: Record<string, string>[] = [];
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(val => val.trim().replace(/"/g, ''));
            const row: Record<string, string> = {};
            headers.forEach((header, idx) => {
              row[header] = values[idx] || '';
            });
            rows.push(row);
          }

          // Store parsed data for spend summary
          setParsedCsvDataStore(prev => ({
            ...prev,
            spend: { headers, rows }
          }));

          // Extract category name from the first row and update context
          const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/[\s_-]/g, ''));
          const categoryColIdx = normalizedHeaders.findIndex(h =>
            h.includes('category') || h.includes('commodity') || h.includes('segment')
          );
          if (categoryColIdx !== -1 && rows.length > 0) {
            const categoryValue = rows[0][headers[categoryColIdx]];
            if (categoryValue && categoryValue.trim()) {
              actions.updateSetupData({ categoryName: categoryValue.trim() });
            }
          }
        }
        setIsParsingCsv(false);
      };
      reader.onerror = () => {
        setIsParsingCsv(false);
        setCsvColumns([]);
      };
      reader.readAsText(uploadedFile);
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
  }, [uploadedFile]);

  // Keep ref in sync with parsedData state for accurate revalidation
  useEffect(() => {
    parsedDataRef.current = parsedData;
  }, [parsedData]);

  // Compute procurement metrics when CSV data changes
  useEffect(() => {
    const spendData = parsedCsvDataStore["spend"];
    const supplyMasterData = parsedCsvDataStore["supply-master"];
    const contractsData = parsedCsvDataStore["contracts"];

    if (!spendData || spendData.rows.length === 0) {
      setComputedMetrics(null);
      setOpportunityMetrics([]);
      return;
    }

    console.log("Computing procurement metrics from CSV data...");

    // Extract supplier profiles from spend data
    const supplierSpend = new Map<string, {
      spend: number;
      country?: string;
      region?: string;
      riskScore?: number;
    }>();

    const spendRecords: SpendRecord[] = [];
    const { headers, rows } = spendData;

    // Find columns
    const findCol = (possibleNames: string[]): string | null => {
      const normalized = headers.map(h => h.toLowerCase().replace(/[\s_-]/g, ''));
      for (const name of possibleNames) {
        const idx = normalized.findIndex(h => h.includes(name.toLowerCase()));
        if (idx !== -1) return headers[idx];
      }
      return null;
    };

    const supplierCol = findCol(['supplier', 'vendor', 'suppliername', 'vendorname']);
    const spendCol = findCol(['spend', 'amount', 'value', 'totalspend']);
    const countryCol = findCol(['country', 'location', 'region']);
    const priceCol = findCol(['price', 'unitprice']);
    const volumeCol = findCol(['volume', 'quantity', 'qty']);

    // Process rows
    rows.forEach(row => {
      const supplier = supplierCol ? row[supplierCol] : 'Unknown';
      let spend = spendCol ? parseFloat(row[spendCol]?.replace(/[$,]/g, '') || '0') : 0;

      // Calculate spend from price * volume if spend not available
      if (spend === 0 && priceCol && volumeCol) {
        const price = parseFloat(row[priceCol]?.replace(/[$,]/g, '') || '0');
        const volume = parseFloat(row[volumeCol]?.replace(/[,]/g, '') || '0');
        spend = price * volume;
      }

      if (supplier && spend > 0) {
        const existing = supplierSpend.get(supplier) || { spend: 0 };
        supplierSpend.set(supplier, {
          ...existing,
          spend: existing.spend + spend,
          country: countryCol ? row[countryCol] : existing.country,
        });

        spendRecords.push({
          supplier,
          spend,
          country: countryCol ? row[countryCol] : undefined,
          price: priceCol ? parseFloat(row[priceCol]?.replace(/[$,]/g, '') || '0') : undefined,
          quantity: volumeCol ? parseFloat(row[volumeCol]?.replace(/[,]/g, '') || '0') : undefined,
        });
      }
    });

    const totalSpend = Array.from(supplierSpend.values()).reduce((sum, s) => sum + s.spend, 0);

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
      const contractHeaders = contractsData.headers;
      const contractIdCol = findCol(['contractid', 'contractnumber']);
      const contractSupplierCol = findCol(['supplier', 'vendor']);
      const contractValueCol = findCol(['value', 'amount', 'contractvalue']);
      const contractStatusCol = findCol(['status']);

      contractsData.rows.forEach((row, idx) => {
        contracts.push({
          id: contractIdCol ? row[contractIdCol] : `contract-${idx}`,
          supplierId: contractSupplierCol ? row[contractSupplierCol] : `supplier-${idx}`,
          value: contractValueCol ? parseFloat(row[contractValueCol]?.replace(/[$,]/g, '') || '0') : 0,
          status: (contractStatusCol ? row[contractStatusCol]?.toLowerCase() : 'active') as 'active' | 'expired' | 'pending',
        });
      });
    }

    // Compute all metrics
    const metrics = computeAllMetrics(suppliers, contracts, spendRecords);
    setComputedMetrics(metrics);
    console.log("Computed metrics:", metrics);

    // Store metrics in context for dashboard use
    actions.setComputedMetrics(metrics as unknown as Record<string, number>);

    // Also update the total spend in setupData so opportunities page has access
    if (totalSpend > 0) {
      actions.updateSetupData({ spend: totalSpend });
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

        return evaluateProofPoint(pp.id, value, opp.id);
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
    console.log("Opportunity metrics:", oppMetrics);

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

    console.log("Savings summary:", savingsSummary);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedCsvDataStore, opportunities, state.setupData.maturityScore, state.setupData.spend]);

  // Calculate field availability based on CSV columns (for spend data)
  const getFieldStatus = (field: DataField): { available: boolean; matchedColumn?: string } => {
    if (!uploadedFile || csvColumns.length === 0) {
      return { available: false };
    }

    const normalizedCsvColumns = csvColumns.map(col => col.toLowerCase().replace(/[\s_-]/g, ''));

    for (const required of field.requiredColumns) {
      const normalizedRequired = required.replace(/[\s_-]/g, '');
      const matchIndex = normalizedCsvColumns.findIndex(csv => csv.includes(normalizedRequired));
      if (matchIndex !== -1) {
        return { available: true, matchedColumn: csvColumns[matchIndex] };
      }
    }

    return { available: false };
  };

  // Calculate field availability for any data point
  const getDataPointFieldStatus = (dataPointId: string, field: DataField): { available: boolean; matchedColumn?: string } => {
    // For spend data, use the main csvColumns
    if (dataPointId === "spend") {
      return getFieldStatus(field);
    }
    
    // For other data points, use their stored columns
    const columns = dataPointColumns[dataPointId];
    if (!columns || columns.length === 0) {
      return { available: false };
    }

    const normalizedColumns = columns.map(col => col.toLowerCase().replace(/[\s_-]/g, ''));

    for (const required of field.requiredColumns) {
      const normalizedRequired = required.replace(/[\s_-]/g, '');
      const matchIndex = normalizedColumns.findIndex(csv => csv.includes(normalizedRequired));
      if (matchIndex !== -1) {
        return { available: true, matchedColumn: columns[matchIndex] };
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
    const supportedExtensions = ['csv', 'xlsx', 'xls', 'pdf', 'doc', 'docx', 'txt', 'json'];
    return supportedExtensions.includes(ext);
  };

  // Helper to get file type category
  const getFileTypeCategory = (file: File): 'spreadsheet' | 'document' | 'text' | 'unknown' => {
    const ext = getFileExtension(file.name);
    if (['csv', 'xlsx', 'xls'].includes(ext)) return 'spreadsheet';
    if (['pdf', 'doc', 'docx'].includes(ext)) return 'document';
    if (['txt', 'json'].includes(ext)) return 'text';
    return 'unknown';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!isSupportedFormat(file)) {
        setUploadError("Unsupported file format. Please upload CSV, Excel, PDF, Word, or text files.");
        return;
      }
      setUploadedFile(file);
      setUploadError(null);
      actions.updateSetupData({ uploadedFile: file });
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    actions.updateSetupData({ uploadedFile: null });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
    // Clear items in the data point using context actions
    const targetDataPoint = state.dataPoints.find(dp => dp.id === dataPointId);
    if (targetDataPoint) {
      actions.updateDataPoint({ ...targetDataPoint, items: [] });
    }
    // Clear the file input if present
    if (dataPointFileInputRef.current) {
      dataPointFileInputRef.current.value = "";
    }
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

      // Parse spreadsheet files (CSV, Excel) for column detection and validation
      if (fileCategory === 'spreadsheet') {
        setParsingDataPoints(prev => new Set([...prev, currentUploadTarget]));

        if (ext === 'csv') {
          // Parse CSV file
          const reader = new FileReader();
          reader.onload = (ev) => {
            const text = ev.target?.result as string;
            if (text) {
              const lines = text.split('\n').filter(line => line.trim());
              const headers = lines[0].split(',').map(col => col.trim().replace(/"/g, ''));
              setDataPointColumns(prev => ({ ...prev, [currentUploadTarget!]: headers }));

              // Parse all rows into objects for summary
              const rows: Record<string, string>[] = [];
              for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(val => val.trim().replace(/"/g, ''));
                const row: Record<string, string> = {};
                headers.forEach((header, idx) => {
                  row[header] = values[idx] || '';
                });
                rows.push(row);
              }

              // Store parsed data for summary
              setParsedCsvDataStore(prev => ({
                ...prev,
                [currentUploadTarget!]: { headers, rows }
              }));
            }
            setParsingDataPoints(prev => {
              const newSet = new Set(prev);
              newSet.delete(currentUploadTarget!);
              return newSet;
            });
          };
          reader.onerror = () => {
            setParsingDataPoints(prev => {
              const newSet = new Set(prev);
              newSet.delete(currentUploadTarget!);
              return newSet;
            });
          };
          reader.readAsText(file);
        } else if (ext === 'xlsx' || ext === 'xls') {
          // For Excel files, we'll process them on the backend
          // For now, just mark as uploaded and let backend handle parsing
          setDataPointColumns(prev => ({
            ...prev,
            [currentUploadTarget!]: ['Excel file - columns will be detected on processing']
          }));
          setParsingDataPoints(prev => {
            const newSet = new Set(prev);
            newSet.delete(currentUploadTarget!);
            return newSet;
          });
        }
      } else if (fileCategory === 'document') {
        // For documents (PDF, Word), mark as uploaded
        // Backend will extract text/tables from these
        setDataPointColumns(prev => ({
          ...prev,
          [currentUploadTarget!]: [`${ext.toUpperCase()} document - content will be extracted on processing`]
        }));
      } else if (fileCategory === 'text') {
        // For text/JSON files, try to parse
        const reader = new FileReader();
        reader.onload = (ev) => {
          const text = ev.target?.result as string;
          if (text && ext === 'json') {
            try {
              const jsonData = JSON.parse(text);
              // If JSON is an array of objects, extract keys as headers
              if (Array.isArray(jsonData) && jsonData.length > 0) {
                const headers = Object.keys(jsonData[0]);
                setDataPointColumns(prev => ({ ...prev, [currentUploadTarget!]: headers }));
                setParsedCsvDataStore(prev => ({
                  ...prev,
                  [currentUploadTarget!]: { headers, rows: jsonData }
                }));
              }
            } catch {
              setDataPointColumns(prev => ({
                ...prev,
                [currentUploadTarget!]: ['JSON file - structure will be analyzed on processing']
              }));
            }
          } else {
            setDataPointColumns(prev => ({
              ...prev,
              [currentUploadTarget!]: ['Text file - content will be analyzed on processing']
            }));
          }
        };
        reader.readAsText(file);
      }

      setCurrentUploadTarget(null);
      if (dataPointFileInputRef.current) {
        dataPointFileInputRef.current.value = "";
      }
    }
  };

  // Trigger file upload for a specific data point
  const triggerDataPointUpload = (dataPointId: string) => {
    setCurrentUploadTarget(dataPointId);
    dataPointFileInputRef.current?.click();
  };

  // Remove item from data point
  const removeDataPointItem = (dataPointId: string, itemId: string) => {
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
      return uploadedFile ? "Uploaded" : "Not Uploaded";
    }
    const count = dataPoint.items.length;
    if (count === 0) return "Not Uploaded";
    return "Uploaded";
  };

  // Get last updated date for data point (returns Date object or null)
  const getLastUpdatedDate = (dataPoint: DataPoint): Date | null => {
    if (dataPoint.isSpendData && uploadedFile) {
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
  const parseAndValidateFile = async (file: File) => {
    setIsValidating(true);
    setParsedData(null);
    setCellErrors([]);
    setParseProgress(0);
    setScrollTop(0);
    
    try {
      const fileSize = file.size;
      const isLargeFile = fileSize > 5 * 1024 * 1024; // > 5MB
      
      // For very large files, use streaming approach
      if (isLargeFile) {
        await parseLargeFile(file);
        return;
      }
      
      // For smaller files, use simple approach
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
      
      // Validate asynchronously in background
      validateDataAsync(headers, rows);
      
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
  const parseLargeFile = async (file: File) => {
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
      
      // Validate in background
      validateDataAsync(headers, rows);
      
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
  const validateDataAsync = async (headers: string[], rows: string[][]) => {
    const errors: CellError[] = [];
    const maxValidateRows = Math.min(rows.length, 1000); // Validate first 1000 rows
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
    
    // ========== SIMPLE VALIDATION ==========
    // Only check for:
    // 1. Duplicate rows (excluding first column which is usually ID)
    // 2. Empty/missing cells anywhere
    
    // Track for duplicate detection (use ALL columns EXCEPT the first one which is ID)
    const rowHashes = new Map<string, number>();
    
    // Validate in batches to keep UI responsive
    const BATCH_SIZE = 100;
    for (let batchStart = 0; batchStart < maxValidateRows && errors.length < maxErrors; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, maxValidateRows);
      
      for (let rowIdx = batchStart; rowIdx < batchEnd && errors.length < maxErrors; rowIdx++) {
        const row = rows[rowIdx];
        
        // Check for completely empty rows
        const isEmptyRow = row.every(cell => !cell || cell.trim() === '');
        if (isEmptyRow) {
          if (errors.length < maxErrors) {
            errors.push({
              row: rowIdx + 1,
              column: "Row",
              columnIndex: 0,
              value: "(empty row)",
              error: "Empty row detected",
              severity: "warning"
            });
          }
          continue; // Skip further checks for empty rows
        }
        
        // Check for duplicate rows (using all columns EXCEPT the first one - which is typically ID)
        // Skip column 0, use columns 1 onwards for duplicate detection
        if (headers.length > 1) {
          const rowKey = row.slice(1).map(cell => (cell || '').trim().toLowerCase()).join('|');
          const existingRow = rowHashes.get(rowKey);
          if (existingRow !== undefined && errors.length < maxErrors) {
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
        for (let colIdx = 0; colIdx < Math.min(row.length, headers.length) && errors.length < maxErrors; colIdx++) {
          const error = validateCell(row[colIdx], headers[colIdx], rowIdx + 1, colIdx);
          if (error) {
            errors.push(error);
          }
        }
      }
      
      // Yield to UI between batches
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    setCellErrors(errors);
    setIsValidating(false);
    return errors; // Return errors for checking
  };

  // Virtual scrolling: Calculate which rows to render
  const getVisibleRows = () => {
    if (!parsedData) return { startIndex: 0, endIndex: 0, rows: [] };
    
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
    const endIndex = Math.min(
      parsedData.rows.length,
      startIndex + VISIBLE_ROWS + BUFFER_ROWS * 2
    );
    
    return {
      startIndex,
      endIndex,
      rows: parsedData.rows.slice(startIndex, endIndex)
    };
  };

  // Handle table scroll for virtual scrolling
  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Open validation modal for a data point
  const openValidationModal = async (dataPointId: string, dataPointName: string) => {
    setValidationDataPoint({ id: dataPointId, name: dataPointName });
    setIsValidationModalOpen(true);
    setParsedData(null);
    setCellErrors([]);
    setEditingCell(null);
    setScrollTop(0);

    // Get the file to validate
    if (dataPointId === "spend" && uploadedFile) {
      setValidationDataPoint({ id: dataPointId, name: dataPointName, file: uploadedFile });
      await parseAndValidateFile(uploadedFile);
    } else {
      // For other data points, use the stored file if available
      const storedFile = dataPointFiles[dataPointId];
      if (storedFile) {
        setValidationDataPoint({ id: dataPointId, name: dataPointName, file: storedFile });
        await parseAndValidateFile(storedFile);
      } else {
        // Check if we have columns but no file (from previous session)
        const dataPoint = contextDataPoints.find(dp => dp.id === dataPointId);
        if (dataPoint && dataPoint.items.length > 0) {
          // Show message that file needs to be re-uploaded for detailed validation
          setParsedData(null);
        }
      }
    }
  };

  // Handle cell edit
  const startEditingCell = (rowIdx: number, colIdx: number, value: string) => {
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

  // Check if a cell has an error
  const getCellError = (rowIdx: number, colIdx: number): CellError | undefined => {
    return cellErrors.find(e => e.row === rowIdx + 1 && e.columnIndex === colIdx);
  };

  // Convert parsed data back to CSV and create a new File object
  const createUpdatedFile = (): File | null => {
    // Use ref to get the LATEST parsedData (includes all edits)
    const currentData = parsedDataRef.current;

    if (!currentData || !validationDataPoint?.file) return null;

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

    // Add data rows
    currentData.rows.forEach(row => {
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
    const updatedFileName = originalName.replace(/\.csv$/i, '_updated.csv');
    
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

    // First, revalidate the entire file with current edits (using ref for latest data)
    setIsValidating(true);
    setCellErrors([]);
    const errors = await validateDataAsync(currentData.headers, currentData.rows);

    // Check if errors still exist after revalidation
    const hasErrors = errors.filter(e => e.severity === "error").length > 0;

    // If errors still exist, don't close - let user continue fixing
    if (hasErrors) {
      setIsValidating(false);
      return;
    }

    // No errors - create updated file with edits
    const updatedFile = createUpdatedFile();

    if (updatedFile) {
      if (validationDataPoint.id === "spend") {
        // Update the spend data file
        setUploadedFile(updatedFile);
        actions.updateSetupData({ uploadedFile: updatedFile });

        // Re-parse to update CSV columns for field detection
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          if (text) {
            const firstLine = text.split('\n')[0];
            const columns = firstLine.split(',').map(col => col.trim().replace(/"/g, ''));
            setCsvColumns(columns);
          }
        };
        reader.readAsText(updatedFile);
      } else {
        // For other data points (supply-master, contracts, playbook)
        setDataPointFiles(prev => ({ ...prev, [validationDataPoint.id]: updatedFile }));

        // Re-parse to update columns for validation
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          if (text) {
            const firstLine = text.split('\n')[0];
            const columns = firstLine.split(',').map(col => col.trim().replace(/"/g, ''));
            setDataPointColumns(prev => ({ ...prev, [validationDataPoint.id]: columns }));
          }
        };
        reader.readAsText(updatedFile);
      }
    }

    setIsValidating(false);
    // Close modal - data is validated and saved
    setIsValidationModalOpen(false);

    // Auto-validate proof points after successful data validation
    setTimeout(() => {
      const count = autoValidateProofPoints();
      console.log(`Auto-validated ${count} proof points after data validation`);
    }, 100);
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
      await parseAndValidateFile(file);
      
      if (validationFileInputRef.current) {
        validationFileInputRef.current.value = "";
      }
    }
  };

  // ============================================================================
  // End Data Validation Functions
  // ============================================================================

  // Calculate validation counts
  const needsValidationCount = contextDataPoints.filter(dp => dp.items.length > 0 || (dp.isSpendData && uploadedFile)).length;
  const notAvailableCount = contextDataPoints.filter(dp => dp.items.length === 0 && !(dp.isSpendData && uploadedFile)).length;

  // Calculate opportunity classification (Qualified = more than 2 validated proof points, Potential = 2 or less)
  const getValidatedProofPointsCount = (opportunity: SetupOpportunity) =>
    opportunity.proofPoints.filter(pp => pp.isValidated).length;

  const isQualifiedOpportunity = (opportunity: SetupOpportunity) =>
    getValidatedProofPointsCount(opportunity) > 2;

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

    // Also check if spend data is validated via uploadedFile
    if (uploadedFile && isDataPointFullyValidated("spend")) {
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

    console.log("Auto-validating proof points...");
    console.log("Validated data points:", Array.from(validatedDataPoints));
    console.log("Available columns per data point:", dataPointColumns);

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
        console.log(`✓ Proof point ${mapping.proofPointId} validated`);
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
    const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/[\s_-]/g, ''));
    for (const name of possibleNames) {
      const normalizedName = name.toLowerCase().replace(/[\s_-]/g, '');
      const idx = normalizedHeaders.findIndex(h => h.includes(normalizedName) || normalizedName.includes(h));
      if (idx !== -1) return headers[idx];
    }
    return null;
  };

  // Get summary data for display - extracts real data from parsed CSV
  const getSummaryData = (dataPointId: string) => {
    const csvData = parsedCsvDataStore[dataPointId];
    const fallbackSpend = state.setupData.spend || 50000000;

    // ============================================================================
    // SPEND DATA EXTRACTION
    // ============================================================================
    if (dataPointId === "spend" && csvData && csvData.rows.length > 0) {
      const { headers, rows } = csvData;

      const supplierCol = findColumn(headers, ['supplier_name', 'supplier', 'vendor_name', 'vendor']);
      const countryCol = findColumn(headers, ['country', 'location', 'geography', 'region']);
      const spendCol = findColumn(headers, ['spend_amount', 'spend', 'amount', 'total_spend', 'value']);
      const volumeCol = findColumn(headers, ['volume', 'quantity', 'qty', 'units']);
      const priceCol = findColumn(headers, ['price', 'unit_price', 'price_per_unit', 'rate']);

      const getRowSpend = (row: Record<string, string>): number => {
        if (spendCol && row[spendCol]) return parseFloat(row[spendCol]) || 0;
        if (volumeCol && priceCol && row[volumeCol] && row[priceCol]) {
          return (parseFloat(row[volumeCol]) || 0) * (parseFloat(row[priceCol]) || 0);
        }
        return 0;
      };

      const locationMap = new Map<string, number>();
      const supplierMap = new Map<string, number>();

      rows.forEach(row => {
        const spend = getRowSpend(row);
        if (countryCol && row[countryCol]) {
          locationMap.set(row[countryCol], (locationMap.get(row[countryCol]) || 0) + spend);
        }
        if (supplierCol && row[supplierCol]) {
          supplierMap.set(row[supplierCol], (supplierMap.get(row[supplierCol]) || 0) + spend);
        }
      });

      const totalSpend = rows.reduce((sum, row) => sum + getRowSpend(row), 0);

      const locations = Array.from(locationMap.entries())
        .map(([name, spend]) => ({ name, spend, percentage: totalSpend > 0 ? Math.round((spend / totalSpend) * 100) : 0 }))
        .sort((a, b) => b.spend - a.spend).slice(0, 6);

      const suppliers = Array.from(supplierMap.entries())
        .map(([name, spend]) => ({ name, spend, percentage: totalSpend > 0 ? Math.round((spend / totalSpend) * 100) : 0 }))
        .sort((a, b) => b.spend - a.spend).slice(0, 6);

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

      const supplierNameCol = findColumn(headers, ['supplier_name', 'supplier', 'vendor_name', 'vendor']);
      const countryCol = findColumn(headers, ['country', 'location', 'region']);
      const statusCol = findColumn(headers, ['status', 'supplier_status']);
      const spendCol = findColumn(headers, ['annual_spend', 'spend', 'total_spend', 'value']);
      const riskCol = findColumn(headers, ['risk_rating', 'risk', 'risk_level']);
      const categoryCol = findColumn(headers, ['category', 'product_category']);

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
    console.log(`Auto-validated ${validatedCount} proof points before running analysis`);

    // Gather all uploaded files from data points
    const supplyMasterFile = dataPointFiles["supply-master"];
    const contractsFile = dataPointFiles["contracts"];
    const playbookFile = dataPointFiles["playbook"];

    // Calculate total spend from portfolio or uploaded data
    const totalSpend = state.portfolioItems.length > 0
      ? state.portfolioItems.reduce((sum, item) => sum + item.spend, 0)
      : state.setupData.spend || 50000000;

    try {
      let response;

      // Check if we have multiple files for full analysis
      const hasAdditionalFiles = supplyMasterFile || contractsFile || playbookFile;

      if (uploadedFile || hasAdditionalFiles) {
        // Use full analysis with all data files
        console.log("Running full analysis with files:", {
          spend: uploadedFile?.name,
          supplyMaster: supplyMasterFile?.name,
          contracts: contractsFile?.name,
          playbook: playbookFile?.name,
        });

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
      console.log("Analysis complete:", response);

      actions.setSetupStep(3);
      router.push("/setup/processing");
    } catch (err) {
      console.error("Analysis error:", err);
      setUploadError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
      // For demo, allow continuing even if backend is down
      actions.setSetupStep(3);
      router.push("/setup/processing");
    } finally {
      setIsUploading(false);
    }
  };
  // Get category name from context or default
  const categoryName = state.setupData.categoryName || "Category";

  // Calculate data review status for all data points based on validation
  const getDataPointReviewStatus = () => {
    const items: { name: string; status: "All Good" | "Needs Review" | "Not Uploaded"; id: string }[] = [];
    
    // Check Spend Data - based on field availability
    if (!uploadedFile) {
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
  const SUPPORTED_FORMATS = ".csv,.xlsx,.xls,.pdf,.doc,.docx,.txt,.json";

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
        <div className="mb-12 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="h-5 w-5 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500" />
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
            <div className="grid grid-cols-4 gap-4">
               <div className="rounded-[32px] bg-white p-6 shadow-sm ring-1 ring-black/[0.03]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Spend</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-semibold text-[#1A1C1E]">
                      -
                    </span>
                  </div>
               </div>

               <div className="rounded-[32px] bg-white p-6 shadow-sm ring-1 ring-black/[0.03] relative group">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Cost</span>
                  <div className="mt-2">
                    <span className={`text-2xl font-semibold ${
                      state.setupData.goals.cost >= 66 ? 'text-emerald-500' :
                      state.setupData.goals.cost >= 33 ? 'text-amber-500' : 'text-red-500'
                    }`}>
                      {state.setupData.goals.cost >= 66 ? 'High' :
                       state.setupData.goals.cost >= 33 ? 'Medium' : 'Low'}
                    </span>
                  </div>
                  <Link
                    href="/setup/goals"
                    className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-400 opacity-0 group-hover:opacity-100 transition-all group-hover:bg-blue-100 group-hover:text-blue-500"
                  >
                    <Pencil className="h-5 w-5" />
                  </Link>
               </div>

               <div className="rounded-[32px] bg-white p-6 shadow-sm ring-1 ring-black/[0.03] relative group">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Risk</span>
                  <div className="mt-2">
                    <span className={`text-2xl font-semibold ${
                      state.setupData.goals.risk >= 66 ? 'text-emerald-500' :
                      state.setupData.goals.risk >= 33 ? 'text-amber-500' : 'text-red-500'
                    }`}>
                      {state.setupData.goals.risk >= 66 ? 'High' :
                       state.setupData.goals.risk >= 33 ? 'Medium' : 'Low'}
                    </span>
                  </div>
                  <Link
                    href="/setup/goals"
                    className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-400 opacity-0 group-hover:opacity-100 transition-all group-hover:bg-blue-100 group-hover:text-blue-500"
                  >
                    <Pencil className="h-5 w-5" />
                  </Link>
               </div>

               <button
                  onClick={() => setIsOpportunitiesListOpen(true)}
                  className="rounded-[32px] bg-gradient-to-br from-blue-500 to-indigo-600 p-6 shadow-sm ring-1 ring-black/[0.03] relative group cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] text-left"
               >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-100">Opportunities</span>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-2xl font-semibold text-white">
                      {qualifiedCount + potentialCount}
                    </span>
                    <span className="text-[13px] text-blue-100">available</span>
                  </div>
                  <div className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white">
                    <ArrowRight className="h-5 w-5" />
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
                                       {((dataPoint.isSpendData && uploadedFile) || (!dataPoint.isSpendData && dataPoint.items.length > 0)) && (
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
                                       {dataPoint.isSpendData && uploadedFile && (
                                          <span className="ml-2 text-[13px] text-gray-500">
                                             ({uploadedFile.name})
                                          </span>
                                       )}
                                       {/* Show field counts for spend data */}
                                       {dataPoint.isSpendData && uploadedFile && !isParsingCsv && (
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
                                          const hasFile = dataPoint.isSpendData ? !!uploadedFile : dataPoint.items.length > 0;
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
                                          {uploadedFile && (
                                             <button
                                                onClick={handleRemoveFile}
                                                className="inline-flex items-center gap-1 text-[14px] font-medium text-gray-400 transition-colors hover:text-red-500"
                                             >
                                                <X className="h-4 w-4" />
                                             </button>
                                          )}
                                          <button
                                             onClick={() => fileInputRef.current?.click()}
                                             className="inline-flex items-center gap-2 text-[14px] font-semibold text-gray-900 transition-colors hover:text-blue-600"
                                          >
                                             {uploadedFile ? "Change" : "Upload"}
                                             <Upload className="h-4 w-4" />
                                          </button>
                                          {uploadedFile && (
                                             <>
                                                <button
                                                   onClick={() => openValidationModal("spend", `Spend Data (${categoryName})`)}
                                                   className="ml-2 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-blue-600"
                                                >
                                                   Validate
                                                   <ArrowRight className="h-4 w-4" />
                                                </button>
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
                                                className="inline-flex items-center gap-2 text-[14px] font-semibold text-gray-900 transition-colors hover:text-blue-600"
                                             >
                                                {dataPoint.items.length > 0 ? "Change" : "Upload"}
                                                <Upload className="h-4 w-4" />
                                             </button>
                                          )}
                                          {/* Validate button for data points with validation and files */}
                                          {dataPoint.items.length > 0 && getFieldsForDataPoint(dataPoint.id).length > 0 && (
                                             <button
                                                onClick={() => openValidationModal(dataPoint.id, dataPoint.name)}
                                                className="ml-2 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-blue-600"
                                             >
                                                Validate
                                                <ArrowRight className="h-4 w-4" />
                                             </button>
                                          )}
                                          {/* Summary button for validated data points */}
                                          {dataPoint.items.length > 0 && dataPoint.id !== "other" && isDataPointFullyValidated(dataPoint.id) && (
                                             <button
                                                onClick={() => openSummaryModal(dataPoint.id)}
                                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-emerald-600"
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
                              {dataPoint.isSpendData && uploadedFile && isSpendExpanded && DATA_FIELDS.map((field, sIdx) => {
                                 const status = getFieldStatus(field);
                                 return (
                                    <tr key={sIdx} className="bg-gray-50/30 group transition-colors hover:bg-gray-50/50">
                                       <td className="py-4 pl-14">
                                          <span className="text-[14px] text-gray-600">{field.name}</span>
                                          {status.available && status.matchedColumn && (
                                             <span className="ml-2 text-[11px] text-gray-400">
                                                (from: {status.matchedColumn})
                                             </span>
                                          )}
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
                                                {status.available && status.matchedColumn && (
                                                   <span className="ml-2 text-[11px] text-gray-400">
                                                      (from: {status.matchedColumn})
                                                   </span>
                                                )}
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
              
              {/* Error Summary */}
              <div className="flex items-center gap-4">
                {cellErrors.length > 0 ? (
                  <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-red-50 border border-red-100">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <div>
                      <span className="text-[14px] font-semibold text-red-600">
                        {cellErrors.filter(e => e.severity === "error").length} Errors
                      </span>
                      {cellErrors.filter(e => e.severity === "warning").length > 0 && (
                        <span className="text-[14px] text-amber-600 ml-2">
                          · {cellErrors.filter(e => e.severity === "warning").length} Warnings
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
              {/* Required Fields Section */}
              {validationDataPoint && getFieldsForDataPoint(validationDataPoint.id).length > 0 && (
                <div className="p-4 border-b border-gray-100">
                  <h3 className="text-[14px] font-semibold text-gray-900">Required Fields</h3>
                  <div className="mt-3 space-y-2">
                    {getFieldsForDataPoint(validationDataPoint.id).map((field, idx) => {
                      const status = getDataPointFieldStatus(validationDataPoint.id, field);
                      return (
                        <div key={idx} className="flex items-center gap-2">
                          {status.available ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                          )}
                          <span className={`text-[12px] ${status.available ? 'text-gray-600' : 'text-amber-600'}`}>
                            {field.name}
                          </span>
                          {status.available && status.matchedColumn && (
                            <span className="text-[10px] text-gray-400 ml-auto">
                              {status.matchedColumn}
                            </span>
                          )}
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
                ) : cellErrors.length === 0 && parsedData ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                    <p className="text-[14px] font-medium text-gray-600">No issues found</p>
                    <p className="text-[12px] text-gray-400 mt-1">Your data looks good!</p>
                  </div>
                ) : !parsedData ? (
                  <div className="text-center py-12">
                    <FileSpreadsheet className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-[14px] font-medium text-gray-500">No data to validate</p>
                    <p className="text-[12px] text-gray-400 mt-1">Close and upload a file first (CSV, Excel, PDF, Word, etc.)</p>
                  </div>
                ) : (
                  cellErrors.map((error, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        // For virtual scrolling, first update scrollTop to bring the row into view
                        if (tableContainerRef.current && parsedData) {
                          const targetRow = error.row - 1; // Convert to 0-based index
                          const containerHeight = tableContainerRef.current.clientHeight;
                          const targetScrollTop = Math.max(0, targetRow * ROW_HEIGHT - (containerHeight / 2) + ROW_HEIGHT);
                          
                          // Update state to trigger re-render with correct rows
                          setScrollTop(targetScrollTop);
                          
                          // Also scroll the container
                          tableContainerRef.current.scrollTo({
                            top: targetScrollTop,
                            behavior: 'smooth'
                          });
                          
                          // Wait for render and scroll, then highlight the cell
                          setTimeout(() => {
                            const cell = document.getElementById(`cell-${error.row}-${error.columnIndex}`);
                            if (cell) {
                              // Horizontal scroll to show the column
                              cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                              cell.classList.add('ring-2', 'ring-blue-500', 'ring-offset-1', 'z-20', 'relative');
                              setTimeout(() => {
                                cell.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-1', 'z-20', 'relative');
                              }, 2500);
                            }
                          }, 350);
                        }
                      }}
                      className="w-full text-left p-3 rounded-xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all"
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
                            Row {error.row} · Column "{error.column}"
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
                  ))
                )}
              </div>
            </div>

            {/* Right Panel - Data Table with Virtual Scrolling */}
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
              ) : parsedData ? (
                <div 
                  ref={tableContainerRef}
                  className="border border-gray-200 rounded-xl overflow-auto flex-1"
                  onScroll={handleTableScroll}
                >
                  {/* Virtual scrolling container */}
                  <div style={{ height: parsedData.rows.length * ROW_HEIGHT + 48, position: 'relative' }}>
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
                              {cellErrors.some(e => e.row === 0 && e.columnIndex === idx) && (
                                <AlertTriangle className="inline h-3 w-3 text-amber-500 ml-1" />
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Spacer for rows above viewport */}
                        {getVisibleRows().startIndex > 0 && (
                          <tr style={{ height: getVisibleRows().startIndex * ROW_HEIGHT }}>
                            <td colSpan={parsedData.headers.length + 1} />
                          </tr>
                        )}
                        
                        {/* Visible rows only */}
                        {getVisibleRows().rows.map((row, idx) => {
                          const actualRowIdx = getVisibleRows().startIndex + idx;
                          return (
                            <tr key={actualRowIdx} className="hover:bg-blue-50/30" style={{ height: ROW_HEIGHT }}>
                              <td className="px-3 py-2 text-gray-400 font-medium border-r border-b border-gray-100 bg-gray-50 text-center sticky left-0 z-10">
                                {actualRowIdx + 1}
                              </td>
                              {row.map((cell, colIdx) => {
                                const error = getCellError(actualRowIdx, colIdx);
                                const isEditing = editingCell?.row === actualRowIdx && editingCell?.col === colIdx;
                                
                                return (
                                  <td
                                    key={colIdx}
                                    id={`cell-${actualRowIdx + 1}-${colIdx}`}
                                    className={`px-4 py-2 border-r border-b border-gray-100 whitespace-nowrap max-w-[300px] truncate ${
                                      error
                                        ? error.severity === "error"
                                          ? "bg-red-50"
                                          : "bg-amber-50"
                                        : ""
                                    }`}
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
                                        className="flex items-center gap-2 group cursor-pointer"
                                        onClick={() => startEditingCell(actualRowIdx, colIdx, cell)}
                                      >
                                        <span className={`flex-1 truncate ${error ? (error.severity === "error" ? "text-red-700" : "text-amber-700") : "text-gray-700"}`}>
                                          {cell || <span className="text-gray-300 italic">empty</span>}
                                        </span>
                                        {error && (
                                          <AlertCircle className={`h-3.5 w-3.5 flex-shrink-0 ${error.severity === "error" ? "text-red-500" : "text-amber-500"}`} />
                                        )}
                                        <Pencil className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                        
                        {/* Spacer for rows below viewport */}
                        {getVisibleRows().endIndex < parsedData.rows.length && (
                          <tr style={{ height: (parsedData.rows.length - getVisibleRows().endIndex) * ROW_HEIGHT }}>
                            <td colSpan={parsedData.headers.length + 1} />
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
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
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setIsValidationModalOpen(false)}
                className="h-9 px-5 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={revalidateEntireFile}
                className="h-9 px-5 rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                disabled={isValidating || !parsedData}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isValidating ? 'animate-spin' : ''}`} />
                Revalidate
              </Button>
              <Button
                onClick={confirmAndSaveData}
                className="h-9 px-5 rounded-xl bg-[#1A1C1E] text-white hover:bg-black"
                disabled={isValidating}
              >
                {isValidating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : cellErrors.filter(e => e.severity === "error").length > 0 ? (
                  <>
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Fix Errors First
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Confirm & Save
                  </>
                )}
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
                      className={`rounded-3xl border-2 bg-white shadow-sm hover:shadow-lg transition-all overflow-hidden ${
                        isQualified
                          ? 'border-emerald-200'
                          : 'border-amber-200'
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
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] rounded-[32px] p-0 overflow-hidden">
          {summaryDataPointId && (() => {
            const summaryData = getSummaryData(summaryDataPointId);
            const dataPointName = summaryDataPointId === "spend" ? "Spend Data" :
              summaryDataPointId === "supply-master" ? "Supply Master" :
              summaryDataPointId === "contracts" ? "Contracts" :
              summaryDataPointId === "playbook" ? "Category Playbook" : "Data";

            return (
              <>
                {/* Header */}
                <div className="p-6 pb-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100">
                        {summaryDataPointId === "spend" && <DollarSign className="h-6 w-6 text-emerald-600" />}
                        {summaryDataPointId === "supply-master" && <Users className="h-6 w-6 text-emerald-600" />}
                        {summaryDataPointId === "contracts" && <FileCheck className="h-6 w-6 text-emerald-600" />}
                        {summaryDataPointId === "playbook" && <BookOpen className="h-6 w-6 text-emerald-600" />}
                      </div>
                      <div>
                        <DialogTitle className="text-xl font-semibold text-[#1A1C1E]">
                          {dataPointName} Summary
                        </DialogTitle>
                        <p className="text-[13px] text-gray-500 mt-0.5">
                          {state.setupData.categoryName || "Category"} · Jun '24 - May '25
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {summaryData.rowCount > 0 && (
                        <span className="flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2">
                          <Database className="h-4 w-4 text-blue-600" />
                          <span className="text-[13px] font-semibold text-blue-700">{summaryData.rowCount} rows</span>
                        </span>
                      )}
                      <span className="flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span className="text-[13px] font-semibold text-emerald-700">Validated</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                  {/* Spend Data Summary */}
                  {summaryDataPointId === "spend" && (
                    <div className="space-y-6">
                      {/* Total Spend Card */}
                      <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Total Spend</span>
                            <p className="text-3xl font-bold text-[#1A1C1E] mt-1">{formatCurrency(summaryData.totalSpend)}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Period</span>
                            <p className="text-lg font-semibold text-gray-700 mt-1">Jun '24 - May '25</p>
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
                          <div className="space-y-4">
                            {summaryData.locations.map((loc, idx) => (
                              <div key={idx} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-blue-500" style={{ opacity: 1 - (idx * 0.15) }} />
                                  <span className="text-[14px] text-gray-700">{loc.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-[14px] font-semibold text-gray-900">{formatCurrency(loc.spend)}</span>
                                  <span className="text-[12px] text-gray-400 w-10 text-right">{loc.percentage}%</span>
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
                          <div className="space-y-4">
                            {summaryData.suppliers.map((supplier, idx) => (
                              <div key={idx} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-purple-500" style={{ opacity: 1 - (idx * 0.15) }} />
                                  <span className="text-[14px] text-gray-700">{supplier.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-[14px] font-semibold text-gray-900">{formatCurrency(supplier.spend)}</span>
                                  <span className="text-[12px] text-gray-400 w-10 text-right">{supplier.percentage}%</span>
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
                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[12px] font-bold text-gray-500">
                                  {idx + 1}
                                </div>
                                <span className="text-[14px] font-medium text-gray-900">{supplier.name}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-[14px] font-semibold text-gray-900">{formatCurrency(supplier.spend)}</span>
                                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 rounded-full"
                                    style={{ width: `${supplier.percentage}%` }}
                                  />
                                </div>
                                <span className="text-[12px] text-gray-500 w-10 text-right">{supplier.percentage}%</span>
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

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-white">
                  <p className="text-[13px] text-gray-500">
                    Data validated and ready for analysis
                  </p>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setIsSummaryModalOpen(false)}
                      className="h-10 px-5 rounded-xl"
                    >
                      Close
                    </Button>
                    <Button
                      onClick={() => {
                        setIsSummaryModalOpen(false);
                        handleContinue();
                      }}
                      className="h-10 px-6 rounded-xl bg-[#1A1C1E] text-white hover:bg-black"
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
    </div>
  );
}
