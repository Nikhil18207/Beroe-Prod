/**
 * API Types for Beroe Procurement Engine
 */

// ============================================================================
// Category Types
// ============================================================================

export interface CategoryInput {
  name: string;
  spend: number;
  addressable_spend_pct?: number;
  savings_benchmark_low?: number;
  savings_benchmark_high?: number;
  maturity_score?: number;
}

export interface Category {
  id: string;
  name: string;
  spend: number;
  addressable_spend: number;
}

// ============================================================================
// Opportunity Types
// ============================================================================

export type LeverTheme =
  | "Volume Bundling"
  | "Target Pricing"
  | "Risk Management"
  | "Re-specification Pack"
  | "Supplier Consolidation"
  | "Demand Management"
  | "Specification Optimization"
  | "Process Improvement"
  | "Regional Sourcing"
  | "Contract Optimization"
  | "Payment Terms"
  | "Risk Mitigation"
  | "ESG Compliance";

export interface Opportunity {
  id: string;
  name: string;
  lever_theme: LeverTheme;
  weightage: number;
  savings_low: number;
  savings_high: number;
  impact_score: number;
  impact_bucket: "Low" | "Medium" | "High";
  num_proof_points: number;
  flag_counts: {
    low: number;
    medium: number;
    high: number;
  };
}

export interface OpportunityDetail extends Opportunity {
  description?: string;
  maturity_score: number;
  savings_benchmark_low: number;
  savings_benchmark_high: number;
  proof_points: ProofPoint[];
  status: "potential" | "qualified" | "accepted" | "rejected";
}

// ============================================================================
// Proof Point Types
// ============================================================================

export type ImpactFlag = "Low" | "Medium" | "High" | "Not Tested";

export type ProofPointType =
  | "Market Price Data"
  | "Supplier Analysis"
  | "Contract Terms"
  | "Spend Analysis"
  | "Risk Assessment"
  | "ESG Compliance"
  | "Benchmark Comparison"
  | "Volume Analysis"
  | "Regional Analysis"
  | "Quality Metrics";

export interface ProofPoint {
  id: string;
  name: string;
  proof_type: ProofPointType;
  impact_flag: ImpactFlag;
  test_score: number | null;
  test_result: string | null;
  is_tested: boolean;
}

// ============================================================================
// Calculation Types
// ============================================================================

export interface SavingsSummary {
  total_savings_low: number;
  total_savings_high: number;
  confidence_score: number;
  confidence_bucket: "Low" | "Medium" | "High";
}

export interface CategoryCalculation {
  category_id: string;
  category_name: string;
  spend: number;
  addressable_spend_pct: number;
  addressable_spend: number;
  savings_benchmark_low: number;
  savings_benchmark_high: number;
  maturity_score: number;
  maturity_adjusted_savings_low: number;
  maturity_adjusted_savings_high: number;
  confidence_score: number;
  confidence_bucket: string;
  confidence_adjusted_savings_pct_low: number;
  confidence_adjusted_savings_pct_high: number;
  confidence_adjusted_savings_low: number;
  confidence_adjusted_savings_high: number;
}

export interface OpportunityCalculation {
  opportunity_id: string;
  opportunity_name: string;
  lever_theme: string;
  maturity_score: number;
  savings_benchmark_low: number;
  savings_benchmark_high: number;
  num_proof_points: number;
  low_flag_count: number;
  medium_flag_count: number;
  high_flag_count: number;
  initiative_impact_score: number;
  initiative_impact_bucket: string;
  intermediate_calc: number;
  initiative_weightage: number;
  initiative_savings_low: number;
  initiative_savings_high: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface AnalysisResponse {
  status: string;
  session_id: string;
  category: Category;
  savings_summary: SavingsSummary;
  opportunities: Opportunity[];
  detailed_results: {
    category_calculation: CategoryCalculation;
    opportunity_calculations: OpportunityCalculation[];
  };
  validation: {
    weightage_sum: number;
    savings_match_category: boolean;
  };
  agent_logs: Array<{
    timestamp: string;
    agent_name: string;
    message: string;
  }>;
}

export interface SessionResponse {
  session_id: string;
  category: Category | null;
  num_opportunities: number;
  logs: Array<{
    timestamp: string;
    agent_name: string;
    message: string;
  }>;
}

export interface ThemeResponse {
  themes: Array<{
    value: LeverTheme;
    name: string;
    description: string;
  }>;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
}

// ============================================================================
// User/Auth Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string;
  company?: string;
  role?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// ============================================================================
// Upload Types
// ============================================================================

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface SpendDataRow {
  supplier_name: string;
  category: string;
  spend_usd: number;
  country?: string;
  region?: string;
  transaction_date?: string;
}

// ============================================================================
// Portfolio Types
// ============================================================================

export interface PortfolioItem {
  id: string;
  name: string;
  spend: number;
  locations: string[];
}

export interface PortfolioData {
  categories: PortfolioItem[];
  total_spend: number;
  total_categories: number;
}

export interface PortfolioResponse {
  success: boolean;
  data: PortfolioData;
}

export interface CategoryCreateResponse {
  success: boolean;
  data: PortfolioItem;
}

export interface CategoryDeleteResponse {
  success: boolean;
  deleted: PortfolioItem;
}

export interface SpendDataInfo {
  columns: string[];
  rows: number;
  sample: Record<string, unknown>[];
}

export interface SpendDataGetResponse {
  success: boolean;
  data: SpendDataInfo | null;
  message?: string;
}

export interface SpendUploadResponse {
  success: boolean;
  message: string;
  data: PortfolioData & { total_rows?: number };
}
