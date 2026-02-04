"use client";

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from "react";
import type {
  AnalysisResponse,
  Category,
  Opportunity,
  SavingsSummary,
  User,
} from "@/types/api";
import { demoSessionHelpers, getDemoSessionId } from "@/lib/supabase";

// ============================================================================
// Portfolio Types
// ============================================================================

export interface PortfolioItem {
  id: string;
  name: string;
  spend: number;
  locations: string[];
}

// Data Point Types for Review Page
export interface DataPointItem {
  id: string;
  name: string;
  fileName?: string;
  uploadedAt?: Date;
}

export interface DataPoint {
  id: string;
  name: string;
  items: DataPointItem[];
  canUpload: boolean;
  canView: boolean;
  isSpendData?: boolean;
}

// Proof Point and Opportunity Types for Review Page
export interface ProofPoint {
  id: string;
  name: string;
  description: string;
  isValidated: boolean;
}

export interface SetupOpportunity {
  id: string;
  name: string;
  description: string;
  potentialSavings: string;
  proofPoints: ProofPoint[];
}

// Activity History for Recent Conversations
export interface ActivityItem {
  id: string;
  type: "analysis" | "upload" | "validation" | "chat" | "portfolio" | "goals";
  title: string;
  description: string;
  timestamp: number; // Unix timestamp in ms
  metadata?: {
    categoryName?: string;
    fileName?: string;
    savings?: string;
    opportunityCount?: number;
  };
}

// Persisted file data (can't store File objects, so store metadata + parsed data)
export interface PersistedFileData {
  fileName: string;
  fileSize: number;
  uploadedAt: number;
  columns: string[];
  parsedData?: {
    headers: string[];
    rows: Record<string, string>[];
    // Document-specific content (for DOCX, PDF, etc.)
    htmlContent?: string;
    rawText?: string;
    isDocument?: boolean;
    documentType?: string;
  };
}

export interface PersistedReviewData {
  spendFile?: PersistedFileData;
  dataPointFiles: Record<string, PersistedFileData>;
}

// ============================================================================
// State Types
// ============================================================================

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;

  // Session
  sessionId: string | null;
  isLoading: boolean;
  error: string | null;

  // Analysis Data
  category: Category | null;
  opportunities: Opportunity[];
  savingsSummary: SavingsSummary | null;
  analysisResponse: AnalysisResponse | null;

  // Portfolio Data (persisted across pages)
  portfolioItems: PortfolioItem[];
  portfolioLoaded: boolean;

  // Selected categories for analysis (multi-select from portfolio page)
  selectedCategories: string[];

  // Review Data (persisted across pages)
  dataPoints: DataPoint[];
  setupOpportunities: SetupOpportunity[];

  // Setup Flow
  setupStep: number;
  setupData: {
    categoryName: string;
    spend: number;
    addressableSpendPct: number;
    savingsBenchmarkLow: number;
    savingsBenchmarkHigh: number;
    maturityScore: number;
    uploadedFile: File | null;
    goals: {
      cost: number;
      risk: number;
      esg: number;
    };
  };

  // Simulation Settings (for dynamic results)
  simulationSettings: {
    malaysiaPercent: number;
    indonesiaPercent: number;
    selectedCountry: "australia" | "canada";
  };

  // Computed procurement metrics (from frontend calculations)
  computedMetrics: Record<string, number> | null;

  // Activity history for recent conversations
  activityHistory: ActivityItem[];

  // Persisted review page data (survives navigation and refresh)
  persistedReviewData: PersistedReviewData;

  // Playbook data for dynamic opportunities
  playbookData: PlaybookData | null;

  // Spend analysis data for enriching opportunities
  spendAnalysis: SpendAnalysis | null;

  // Opportunity metrics from 7-step calculation (per-opportunity savings)
  opportunityMetrics: OpportunityMetricsData[] | null;
}

// Opportunity metrics data (simplified from procurement-metrics.ts)
export interface OpportunityMetricsData {
  opportunityId: string;
  name: string;
  impactScore: number;
  impactBucket: 'High' | 'Medium' | 'Low';
  savingsLow: number;
  savingsHigh: number;
  savingsEstimate: number;
  confidenceScore: number;
  confidenceBucket: 'High' | 'Medium' | 'Low';
}

// Playbook data structure
interface PlaybookData {
  entries: Array<{
    category: string;
    strategy: string;
    marketTrend: string;
    riskFactor: string;
    recommendations: string[];
    riskLevel?: string;
    priority?: string;
  }>;
  fileName: string;
  uploadedAt: number;
}

// Spend analysis results
export interface SpendAnalysis {
  totalSpend: number;
  spendBySupplier: Record<string, number>;
  spendByRegion: Record<string, number>;
  spendByCountry: Record<string, number>;
  supplierCount: number;
  topSuppliers: Array<{ name: string; spend: number; percentage: number }>;
  topRegions: Array<{ name: string; spend: number; percentage: number }>;
  // Price data for testing price-related proof points
  priceData?: {
    prices: number[];
    avgPrice: number;
    priceVariance: number;
  };
}

// ============================================================================
// Actions
// ============================================================================

type AppAction =
  | { type: "SET_USER"; payload: User | null }
  | { type: "SET_SESSION"; payload: string | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_ANALYSIS_RESPONSE"; payload: AnalysisResponse }
  | { type: "SET_OPPORTUNITIES"; payload: Opportunity[] }
  | { type: "UPDATE_OPPORTUNITY"; payload: { id: string; updates: Partial<Opportunity> } }
  | { type: "SET_SETUP_STEP"; payload: number }
  | { type: "UPDATE_SETUP_DATA"; payload: Partial<AppState["setupData"]> }
  | { type: "SET_PORTFOLIO_ITEMS"; payload: PortfolioItem[] }
  | { type: "ADD_PORTFOLIO_ITEM"; payload: PortfolioItem }
  | { type: "UPDATE_PORTFOLIO_ITEM"; payload: PortfolioItem }
  | { type: "REMOVE_PORTFOLIO_ITEM"; payload: string }
  | { type: "SET_PORTFOLIO_LOADED"; payload: boolean }
  | { type: "SET_SELECTED_CATEGORIES"; payload: string[] }
  | { type: "SET_DATA_POINTS"; payload: DataPoint[] }
  | { type: "UPDATE_DATA_POINT"; payload: DataPoint }
  | { type: "SET_SETUP_OPPORTUNITIES"; payload: SetupOpportunity[] }
  | { type: "UPDATE_SETUP_OPPORTUNITY"; payload: SetupOpportunity }
  | { type: "UPDATE_SIMULATION_SETTINGS"; payload: Partial<AppState["simulationSettings"]> }
  | { type: "SET_COMPUTED_METRICS"; payload: Record<string, number> | null }
  | { type: "SET_SAVINGS_SUMMARY"; payload: SavingsSummary | null }
  | { type: "ADD_ACTIVITY"; payload: ActivityItem }
  | { type: "SET_ACTIVITY_HISTORY"; payload: ActivityItem[] }
  | { type: "CLEAR_ACTIVITY_HISTORY" }
  | { type: "SET_PERSISTED_REVIEW_DATA"; payload: PersistedReviewData }
  | { type: "UPDATE_PERSISTED_SPEND_FILE"; payload: PersistedFileData | undefined }
  | { type: "UPDATE_PERSISTED_DATA_POINT_FILE"; payload: { dataPointId: string; data: PersistedFileData | undefined } }
  | { type: "CLEAR_PERSISTED_REVIEW_DATA" }
  | { type: "SET_PLAYBOOK_DATA"; payload: PlaybookData | null }
  | { type: "SET_SPEND_ANALYSIS"; payload: SpendAnalysis | null }
  | { type: "SET_OPPORTUNITY_METRICS"; payload: OpportunityMetricsData[] | null }
  | { type: "RESET_STATE" }
  | { type: "LOGOUT" };

// ============================================================================
// Initial State
// ============================================================================

// Default data points for review page
const defaultDataPoints: DataPoint[] = [
  { id: "spend", name: "Overall Spend", items: [], canUpload: true, canView: false, isSpendData: true },
  { id: "supply-master", name: "Supply Master", items: [], canUpload: true, canView: true },
  { id: "contracts", name: "Contracts", items: [], canUpload: true, canView: true },
  { id: "playbook", name: "Category Playbook", items: [], canUpload: true, canView: true },
  { id: "other", name: "Other", items: [], canUpload: true, canView: true },
];

// Default opportunities for review page - Matches backend agents
const defaultSetupOpportunities: SetupOpportunity[] = [
  {
    id: "volume-bundling",
    name: "Volume Bundling",
    description: "Aggregate demand across regions, consolidate tail spend, and leverage volume to achieve better pricing",
    potentialSavings: "0-5%",
    proofPoints: [
      { id: "vb-pp-1", name: "Regional Spend", description: "Spend distribution across different geographic regions", isValidated: false },
      { id: "vb-pp-2", name: "Tail Spend", description: "Fragmented spend across multiple small suppliers", isValidated: false },
      { id: "vb-pp-3", name: "Volume Leverage", description: "Total volume that can be consolidated for negotiations", isValidated: false },
      { id: "vb-pp-4", name: "Price Variance", description: "Price differences across suppliers for similar items", isValidated: false },
      { id: "vb-pp-5", name: "Avg Spend/Supplier", description: "Average spend per supplier indicating consolidation potential", isValidated: false },
      { id: "vb-pp-6", name: "Market Consolidation", description: "Market structure and consolidation opportunities", isValidated: false },
      { id: "vb-pp-7", name: "Supplier Location", description: "Geographic distribution of suppliers", isValidated: false },
      { id: "vb-pp-8", name: "Supplier Risk Rating", description: "Risk assessment of current supplier base", isValidated: false },
    ],
  },
  {
    id: "target-pricing",
    name: "Target Pricing",
    description: "Analyze price variances, tariff impacts, and cost structures to achieve optimal pricing",
    potentialSavings: "1-2%",
    proofPoints: [
      { id: "tp-pp-1", name: "Price Variance", description: "Price differences across suppliers and regions", isValidated: false },
      { id: "tp-pp-2", name: "Tariff Rate", description: "Import/export tariff impacts on pricing", isValidated: false },
      { id: "tp-pp-3", name: "Cost Structure", description: "Breakdown of cost components (raw materials, labor, logistics)", isValidated: false },
      { id: "tp-pp-4", name: "Unit Price", description: "Per-unit pricing analysis across suppliers", isValidated: false },
    ],
  },
  {
    id: "risk-management",
    name: "Risk Management",
    description: "Identify and mitigate supply chain risks including single sourcing, concentration, and external factors",
    potentialSavings: "1-3% cost avoidance",
    proofPoints: [
      { id: "rm-pp-1", name: "Single Sourcing", description: "Items or categories with only one supplier", isValidated: false },
      { id: "rm-pp-2", name: "Supplier Concentration", description: "Over-reliance on specific suppliers", isValidated: false },
      { id: "rm-pp-3", name: "Category Risk", description: "Inherent risk level of the category", isValidated: false },
      { id: "rm-pp-4", name: "Inflation", description: "Inflation impact on category costs", isValidated: false },
      { id: "rm-pp-5", name: "Exchange Rate", description: "Currency fluctuation risks", isValidated: false },
      { id: "rm-pp-6", name: "Geo Political", description: "Geopolitical risks affecting supply", isValidated: false },
      { id: "rm-pp-7", name: "Supplier Risk Rating", description: "Overall supplier risk assessment", isValidated: false },
    ],
  },
  {
    id: "respec-pack",
    name: "Re-specification Pack",
    description: "Identify opportunities to optimize specifications for cost savings without compromising quality",
    potentialSavings: "2-3%",
    proofPoints: [
      { id: "rp-pp-1", name: "Price Variance", description: "Price differences indicating specification optimization opportunities", isValidated: false },
      { id: "rp-pp-2", name: "Export Data", description: "Export patterns and alternative sourcing options", isValidated: false },
      { id: "rp-pp-3", name: "Cost Structure", description: "Cost breakdown to identify specification-driven savings", isValidated: false },
    ],
  },
];

const initialState: AppState = {
  user: null,
  isAuthenticated: false,
  sessionId: null,
  isLoading: false,
  error: null,
  category: null,
  opportunities: [],
  savingsSummary: null,
  analysisResponse: null,
  portfolioItems: [],
  portfolioLoaded: false,
  selectedCategories: [],
  dataPoints: defaultDataPoints,
  setupOpportunities: defaultSetupOpportunities,
  setupStep: 0,
  simulationSettings: {
    malaysiaPercent: 20,
    indonesiaPercent: 80,
    selectedCountry: "australia" as const,
  },
  computedMetrics: null,
  activityHistory: [],
  persistedReviewData: {
    spendFile: undefined,
    dataPointFiles: {},
  },
  playbookData: null,
  spendAnalysis: null,
  opportunityMetrics: null,
  setupData: {
    categoryName: "",
    spend: 0,
    addressableSpendPct: 0.8,
    savingsBenchmarkLow: 0.04,
    savingsBenchmarkHigh: 0.1,
    maturityScore: 2.5,
    uploadedFile: null,
    goals: {
      cost: 34,
      risk: 33,
      esg: 33,
    },
  },
};

// ============================================================================
// Reducer
// ============================================================================

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_USER":
      return {
        ...state,
        user: action.payload,
        isAuthenticated: action.payload !== null,
      };

    case "SET_SESSION":
      return {
        ...state,
        sessionId: action.payload,
      };

    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };

    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case "SET_ANALYSIS_RESPONSE":
      return {
        ...state,
        analysisResponse: action.payload,
        sessionId: action.payload.session_id,
        category: action.payload.category,
        opportunities: action.payload.opportunities,
        savingsSummary: action.payload.savings_summary,
        isLoading: false,
        error: null,
      };

    case "SET_OPPORTUNITIES":
      return {
        ...state,
        opportunities: action.payload,
      };

    case "UPDATE_OPPORTUNITY":
      return {
        ...state,
        opportunities: state.opportunities.map((opp) =>
          opp.id === action.payload.id
            ? { ...opp, ...action.payload.updates }
            : opp
        ),
      };

    case "SET_SETUP_STEP":
      return {
        ...state,
        setupStep: action.payload,
      };

    case "UPDATE_SETUP_DATA":
      return {
        ...state,
        setupData: {
          ...state.setupData,
          ...action.payload,
        },
      };

    case "SET_PORTFOLIO_ITEMS":
      return {
        ...state,
        portfolioItems: action.payload,
        portfolioLoaded: true,
      };

    case "ADD_PORTFOLIO_ITEM":
      return {
        ...state,
        portfolioItems: [...state.portfolioItems, action.payload],
      };

    case "UPDATE_PORTFOLIO_ITEM":
      return {
        ...state,
        portfolioItems: state.portfolioItems.map((item) =>
          item.id === action.payload.id ? action.payload : item
        ),
      };

    case "REMOVE_PORTFOLIO_ITEM":
      return {
        ...state,
        portfolioItems: state.portfolioItems.filter((item) => item.id !== action.payload),
      };

    case "SET_PORTFOLIO_LOADED":
      return {
        ...state,
        portfolioLoaded: action.payload,
      };

    case "SET_SELECTED_CATEGORIES":
      return {
        ...state,
        selectedCategories: action.payload,
      };

    case "SET_DATA_POINTS":
      return {
        ...state,
        dataPoints: action.payload,
      };

    case "UPDATE_DATA_POINT":
      return {
        ...state,
        dataPoints: state.dataPoints.map((dp) =>
          dp.id === action.payload.id ? action.payload : dp
        ),
      };

    case "SET_SETUP_OPPORTUNITIES":
      return {
        ...state,
        setupOpportunities: action.payload,
      };

    case "UPDATE_SETUP_OPPORTUNITY":
      return {
        ...state,
        setupOpportunities: state.setupOpportunities.map((opp) =>
          opp.id === action.payload.id ? action.payload : opp
        ),
      };

    case "UPDATE_SIMULATION_SETTINGS":
      return {
        ...state,
        simulationSettings: {
          ...state.simulationSettings,
          ...action.payload,
        },
      };

    case "SET_COMPUTED_METRICS":
      return {
        ...state,
        computedMetrics: action.payload,
      };

    case "SET_SAVINGS_SUMMARY":
      return {
        ...state,
        savingsSummary: action.payload,
      };

    case "ADD_ACTIVITY":
      return {
        ...state,
        // Add new activity to the beginning, keep max 50 items
        activityHistory: [action.payload, ...state.activityHistory].slice(0, 50),
      };

    case "SET_ACTIVITY_HISTORY":
      return {
        ...state,
        activityHistory: action.payload,
      };

    case "CLEAR_ACTIVITY_HISTORY":
      return {
        ...state,
        activityHistory: [],
      };

    case "SET_PERSISTED_REVIEW_DATA":
      return {
        ...state,
        persistedReviewData: action.payload,
      };

    case "UPDATE_PERSISTED_SPEND_FILE":
      return {
        ...state,
        persistedReviewData: {
          ...state.persistedReviewData,
          spendFile: action.payload,
        },
      };

    case "UPDATE_PERSISTED_DATA_POINT_FILE":
      return {
        ...state,
        persistedReviewData: {
          ...state.persistedReviewData,
          dataPointFiles: action.payload.data
            ? { ...state.persistedReviewData.dataPointFiles, [action.payload.dataPointId]: action.payload.data }
            : Object.fromEntries(
                Object.entries(state.persistedReviewData.dataPointFiles).filter(
                  ([key]) => key !== action.payload.dataPointId
                )
              ),
        },
      };

    case "CLEAR_PERSISTED_REVIEW_DATA":
      return {
        ...state,
        persistedReviewData: {
          spendFile: undefined,
          dataPointFiles: {},
        },
      };

    case "SET_PLAYBOOK_DATA":
      return {
        ...state,
        playbookData: action.payload,
      };

    case "SET_SPEND_ANALYSIS":
      return {
        ...state,
        spendAnalysis: action.payload,
      };

    case "SET_OPPORTUNITY_METRICS":
      return {
        ...state,
        opportunityMetrics: action.payload,
      };

    case "RESET_STATE":
      return {
        ...initialState,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      };

    case "LOGOUT":
      return initialState;

    default:
      return state;
  }
}

// ============================================================================
// Context
// ============================================================================

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  actions: {
    setUser: (user: User | null) => void;
    setSession: (sessionId: string | null) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setAnalysisResponse: (response: AnalysisResponse) => void;
    setOpportunities: (opportunities: Opportunity[]) => void;
    updateOpportunity: (id: string, updates: Partial<Opportunity>) => void;
    setSetupStep: (step: number) => void;
    updateSetupData: (data: Partial<AppState["setupData"]>) => void;
    setPortfolioItems: (items: PortfolioItem[]) => void;
    addPortfolioItem: (item: PortfolioItem) => void;
    updatePortfolioItem: (item: PortfolioItem) => void;
    removePortfolioItem: (id: string) => void;
    setPortfolioLoaded: (loaded: boolean) => void;
    setSelectedCategories: (categories: string[]) => void;
    setDataPoints: (dataPoints: DataPoint[]) => void;
    updateDataPoint: (dataPoint: DataPoint) => void;
    setSetupOpportunities: (opportunities: SetupOpportunity[]) => void;
    updateSetupOpportunity: (opportunity: SetupOpportunity) => void;
    updateSimulationSettings: (settings: Partial<AppState["simulationSettings"]>) => void;
    setComputedMetrics: (metrics: Record<string, number> | null) => void;
    setSavingsSummary: (summary: SavingsSummary | null) => void;
    addActivity: (activity: Omit<ActivityItem, "id" | "timestamp">) => void;
    clearActivityHistory: () => void;
    setPersistedReviewData: (data: PersistedReviewData) => void;
    updatePersistedSpendFile: (data: PersistedFileData | undefined) => void;
    updatePersistedDataPointFile: (dataPointId: string, data: PersistedFileData | undefined) => void;
    clearPersistedReviewData: () => void;
    setPlaybookData: (data: PlaybookData | null) => void;
    setSpendAnalysis: (data: SpendAnalysis | null) => void;
    setOpportunityMetrics: (metrics: OpportunityMetricsData[] | null) => void;
    resetState: () => void;
    logout: () => void;
  };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================

// Local storage keys for persistence (used as fallback and for immediate UI updates)
const ACTIVITY_STORAGE_KEY = "beroe_activity_history";
const REVIEW_DATA_STORAGE_KEY = "beroe_review_data";
const SETUP_DATA_STORAGE_KEY = "beroe_setup_data";
const SPEND_ANALYSIS_STORAGE_KEY = "beroe_spend_analysis";
const OPPORTUNITY_METRICS_STORAGE_KEY = "beroe_opportunity_metrics";
const SAVINGS_SUMMARY_STORAGE_KEY = "beroe_savings_summary";
const SETUP_OPPORTUNITIES_STORAGE_KEY = "beroe_setup_opportunities";

// Track if Supabase sync is enabled
const SUPABASE_SYNC_ENABLED = true;

// Load activity history from localStorage
const loadActivityHistory = (): ActivityItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error("Error loading activity history:", error);
  }
  return [];
};

// Save activity history to localStorage
const saveActivityHistory = (activities: ActivityItem[]) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(activities));
  } catch (error) {
    console.error("Error saving activity history:", error);
  }
};

// Load review data from localStorage
const loadPersistedReviewData = (): PersistedReviewData => {
  if (typeof window === "undefined") return { spendFile: undefined, dataPointFiles: {} };
  try {
    const saved = localStorage.getItem(REVIEW_DATA_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure dataPointFiles is always an object (handle corrupted/old data)
      return {
        spendFile: parsed.spendFile,
        dataPointFiles: parsed.dataPointFiles || {},
      };
    }
  } catch (error) {
    console.error("Error loading review data:", error);
  }
  return { spendFile: undefined, dataPointFiles: {} };
};

// Save review data to localStorage
const savePersistedReviewData = (data: PersistedReviewData) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REVIEW_DATA_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Error saving review data:", error);
  }
};

// Persistable setup data (excluding File objects)
interface PersistedSetupData {
  categoryName: string;
  spend: number;
  addressableSpendPct: number;
  savingsBenchmarkLow: number;
  savingsBenchmarkHigh: number;
  maturityScore: number;
  goals: {
    cost: number;
    risk: number;
    esg: number;
  };
}

// Load setup data from localStorage
const loadPersistedSetupData = (): Partial<PersistedSetupData> | null => {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(SETUP_DATA_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error("Error loading setup data:", error);
  }
  return null;
};

// Save setup data to localStorage (excluding File objects)
const savePersistedSetupData = (data: AppState["setupData"]) => {
  if (typeof window === "undefined") return;
  try {
    // Don't persist File objects - they can't be serialized
    const persistable: PersistedSetupData = {
      categoryName: data.categoryName,
      spend: data.spend,
      addressableSpendPct: data.addressableSpendPct,
      savingsBenchmarkLow: data.savingsBenchmarkLow,
      savingsBenchmarkHigh: data.savingsBenchmarkHigh,
      maturityScore: data.maturityScore,
      goals: data.goals,
    };
    localStorage.setItem(SETUP_DATA_STORAGE_KEY, JSON.stringify(persistable));
  } catch (error) {
    console.error("Error saving setup data:", error);
  }
};

// Load spend analysis from localStorage
const loadSpendAnalysis = (): SpendAnalysis | null => {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(SPEND_ANALYSIS_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error("Error loading spend analysis:", error);
  }
  return null;
};

// Save spend analysis to localStorage
const saveSpendAnalysis = (data: SpendAnalysis | null) => {
  if (typeof window === "undefined") return;
  try {
    if (data) {
      localStorage.setItem(SPEND_ANALYSIS_STORAGE_KEY, JSON.stringify(data));
    } else {
      localStorage.removeItem(SPEND_ANALYSIS_STORAGE_KEY);
    }
  } catch (error) {
    console.error("Error saving spend analysis:", error);
  }
};

// Load opportunity metrics from localStorage
const loadOpportunityMetrics = (): OpportunityMetricsData[] | null => {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(OPPORTUNITY_METRICS_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error("Error loading opportunity metrics:", error);
  }
  return null;
};

// Save opportunity metrics to localStorage
const saveOpportunityMetrics = (data: OpportunityMetricsData[] | null) => {
  if (typeof window === "undefined") return;
  try {
    if (data && data.length > 0) {
      localStorage.setItem(OPPORTUNITY_METRICS_STORAGE_KEY, JSON.stringify(data));
    } else {
      localStorage.removeItem(OPPORTUNITY_METRICS_STORAGE_KEY);
    }
  } catch (error) {
    console.error("Error saving opportunity metrics:", error);
  }
};

// Load savings summary from localStorage
const loadSavingsSummary = (): SavingsSummary | null => {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(SAVINGS_SUMMARY_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error("Error loading savings summary:", error);
  }
  return null;
};

// Save savings summary to localStorage
const saveSavingsSummary = (data: SavingsSummary | null) => {
  if (typeof window === "undefined") return;
  try {
    if (data) {
      localStorage.setItem(SAVINGS_SUMMARY_STORAGE_KEY, JSON.stringify(data));
    } else {
      localStorage.removeItem(SAVINGS_SUMMARY_STORAGE_KEY);
    }
  } catch (error) {
    console.error("Error saving savings summary:", error);
  }
};

// Load setup opportunities from localStorage
const loadSetupOpportunities = (): SetupOpportunity[] | null => {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(SETUP_OPPORTUNITIES_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error("Error loading setup opportunities:", error);
  }
  return null;
};

// Save setup opportunities to localStorage
const saveSetupOpportunities = (data: SetupOpportunity[]) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETUP_OPPORTUNITIES_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Error saving setup opportunities:", error);
  }
};

// ============================================================================
// Supabase Sync Functions (debounced to avoid excessive API calls)
// ============================================================================

let supabaseSyncTimeout: NodeJS.Timeout | null = null;

const syncToSupabase = async (data: {
  activity_history?: any[];
  setup_opportunities?: any[];
  savings_summary?: any;
  opportunity_metrics?: any[];
  category_name?: string;
  spend?: number;
  goals?: any;
  computed_metrics?: any;
}) => {
  if (!SUPABASE_SYNC_ENABLED) return;

  // Debounce Supabase sync to avoid excessive API calls
  if (supabaseSyncTimeout) {
    clearTimeout(supabaseSyncTimeout);
  }

  supabaseSyncTimeout = setTimeout(async () => {
    try {
      await demoSessionHelpers.saveFullDemoState(data);
      console.log("[Supabase] State synced successfully");
    } catch (error) {
      console.error("[Supabase] Failed to sync state:", error);
    }
  }, 1000); // 1 second debounce
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const isInitialLoadRef = useRef(true);
  const supabaseLoadedRef = useRef(false);

  // Load data from localStorage first (for immediate UI), then sync from Supabase
  React.useEffect(() => {
    const loadLocalAndRemoteData = async () => {
      // ======================================================================
      // Step 1: Load from localStorage first (instant UI updates)
      // ======================================================================
      const savedActivities = loadActivityHistory();
      if (savedActivities.length > 0) {
        dispatch({ type: "SET_ACTIVITY_HISTORY", payload: savedActivities });
      }

      const savedReviewData = loadPersistedReviewData();
      const hasDataPointFiles = savedReviewData.dataPointFiles && Object.keys(savedReviewData.dataPointFiles).length > 0;
      if (savedReviewData.spendFile || hasDataPointFiles) {
        dispatch({ type: "SET_PERSISTED_REVIEW_DATA", payload: savedReviewData });
      }

      // Load setup data (category name, spend, goals, etc.)
      const savedSetupData = loadPersistedSetupData();
      if (savedSetupData && savedSetupData.categoryName) {
        dispatch({ type: "UPDATE_SETUP_DATA", payload: savedSetupData });
      }

      // Load setup opportunities (proof points validation status)
      const savedSetupOpportunities = loadSetupOpportunities();
      if (savedSetupOpportunities && savedSetupOpportunities.length > 0) {
        dispatch({ type: "SET_SETUP_OPPORTUNITIES", payload: savedSetupOpportunities });
      }

      // Load spend analysis
      const savedSpendAnalysis = loadSpendAnalysis();
      if (savedSpendAnalysis) {
        dispatch({ type: "SET_SPEND_ANALYSIS", payload: savedSpendAnalysis });
      }

      // Load opportunity metrics (7-step calculation results)
      const savedOpportunityMetrics = loadOpportunityMetrics();
      if (savedOpportunityMetrics && savedOpportunityMetrics.length > 0) {
        dispatch({ type: "SET_OPPORTUNITY_METRICS", payload: savedOpportunityMetrics });
      }

      // Load savings summary
      const savedSavingsSummary = loadSavingsSummary();
      if (savedSavingsSummary) {
        dispatch({ type: "SET_SAVINGS_SUMMARY", payload: savedSavingsSummary });
      }

      // ======================================================================
      // Step 2: Load from Supabase (remote persistence)
      // ======================================================================
      if (SUPABASE_SYNC_ENABLED) {
        try {
          console.log("[Supabase] Loading state from remote...");
          const remoteState = await demoSessionHelpers.loadFullDemoState();

          if (remoteState.session) {
            console.log("[Supabase] Remote session found, syncing data...");

            // Sync activity history (prefer remote if exists and has more data)
            if (remoteState.activityHistory && remoteState.activityHistory.length > 0) {
              // Merge: use remote if it has newer/more data, else keep local
              const localLen = savedActivities.length;
              const remoteLen = remoteState.activityHistory.length;
              if (remoteLen >= localLen) {
                dispatch({ type: "SET_ACTIVITY_HISTORY", payload: remoteState.activityHistory });
                saveActivityHistory(remoteState.activityHistory);
              }
            }

            // Sync setup opportunities (proof points)
            if (remoteState.setupOpportunities && remoteState.setupOpportunities.length > 0) {
              dispatch({ type: "SET_SETUP_OPPORTUNITIES", payload: remoteState.setupOpportunities });
              saveSetupOpportunities(remoteState.setupOpportunities);
            }

            // Sync savings summary
            if (remoteState.savingsSummary) {
              dispatch({ type: "SET_SAVINGS_SUMMARY", payload: remoteState.savingsSummary });
              saveSavingsSummary(remoteState.savingsSummary);
            }

            // Sync opportunity metrics
            if (remoteState.opportunityMetrics && remoteState.opportunityMetrics.length > 0) {
              dispatch({ type: "SET_OPPORTUNITY_METRICS", payload: remoteState.opportunityMetrics });
              saveOpportunityMetrics(remoteState.opportunityMetrics);
            }

            // Sync setup data from session
            const session = remoteState.session;
            if (session.category_name) {
              dispatch({
                type: "UPDATE_SETUP_DATA",
                payload: {
                  categoryName: session.category_name,
                  spend: session.spend || 0,
                  goals: session.goals || { cost: 34, risk: 33, esg: 33 },
                }
              });
            }

            // Sync computed metrics
            if (session.computed_metrics) {
              dispatch({ type: "SET_COMPUTED_METRICS", payload: session.computed_metrics });
            }

            console.log("[Supabase] State sync complete");
          } else {
            console.log("[Supabase] No remote session found, will create on first save");
          }

          supabaseLoadedRef.current = true;
        } catch (error) {
          console.error("[Supabase] Failed to load remote state:", error);
        }
      }

      isInitialLoadRef.current = false;
    };

    loadLocalAndRemoteData();
  }, []);

  // Save activity history to localStorage and Supabase whenever it changes
  React.useEffect(() => {
    if (isInitialLoadRef.current) return;
    saveActivityHistory(state.activityHistory);
    syncToSupabase({ activity_history: state.activityHistory });
  }, [state.activityHistory]);

  // Save review data to localStorage whenever it changes
  React.useEffect(() => {
    if (isInitialLoadRef.current) return;
    savePersistedReviewData(state.persistedReviewData);
  }, [state.persistedReviewData]);

  // Save setup data to localStorage and Supabase whenever it changes
  React.useEffect(() => {
    if (isInitialLoadRef.current) return;
    // Only save if there's meaningful data (category name set)
    if (state.setupData.categoryName && state.setupData.categoryName !== "") {
      savePersistedSetupData(state.setupData);
      syncToSupabase({
        category_name: state.setupData.categoryName,
        spend: state.setupData.spend,
        goals: state.setupData.goals,
      });
    }
  }, [state.setupData]);

  // Save spend analysis to localStorage whenever it changes
  React.useEffect(() => {
    if (isInitialLoadRef.current) return;
    saveSpendAnalysis(state.spendAnalysis);
  }, [state.spendAnalysis]);

  // Save opportunity metrics to localStorage and Supabase whenever it changes
  React.useEffect(() => {
    if (isInitialLoadRef.current) return;
    saveOpportunityMetrics(state.opportunityMetrics);
    if (state.opportunityMetrics && state.opportunityMetrics.length > 0) {
      syncToSupabase({ opportunity_metrics: state.opportunityMetrics });
    }
  }, [state.opportunityMetrics]);

  // Save savings summary to localStorage and Supabase whenever it changes
  React.useEffect(() => {
    if (isInitialLoadRef.current) return;
    saveSavingsSummary(state.savingsSummary);
    if (state.savingsSummary) {
      syncToSupabase({ savings_summary: state.savingsSummary });
    }
  }, [state.savingsSummary]);

  // Save setup opportunities (proof points) to localStorage and Supabase whenever it changes
  React.useEffect(() => {
    if (isInitialLoadRef.current) return;
    saveSetupOpportunities(state.setupOpportunities);
    syncToSupabase({ setup_opportunities: state.setupOpportunities });
  }, [state.setupOpportunities]);

  // Save computed metrics to Supabase whenever it changes
  React.useEffect(() => {
    if (isInitialLoadRef.current) return;
    if (state.computedMetrics) {
      syncToSupabase({ computed_metrics: state.computedMetrics });
    }
  }, [state.computedMetrics]);

  const actions = {
    setUser: useCallback(
      (user: User | null) => dispatch({ type: "SET_USER", payload: user }),
      []
    ),
    setSession: useCallback(
      (sessionId: string | null) =>
        dispatch({ type: "SET_SESSION", payload: sessionId }),
      []
    ),
    setLoading: useCallback(
      (loading: boolean) => dispatch({ type: "SET_LOADING", payload: loading }),
      []
    ),
    setError: useCallback(
      (error: string | null) => dispatch({ type: "SET_ERROR", payload: error }),
      []
    ),
    setAnalysisResponse: useCallback(
      (response: AnalysisResponse) =>
        dispatch({ type: "SET_ANALYSIS_RESPONSE", payload: response }),
      []
    ),
    setOpportunities: useCallback(
      (opportunities: Opportunity[]) =>
        dispatch({ type: "SET_OPPORTUNITIES", payload: opportunities }),
      []
    ),
    updateOpportunity: useCallback(
      (id: string, updates: Partial<Opportunity>) =>
        dispatch({ type: "UPDATE_OPPORTUNITY", payload: { id, updates } }),
      []
    ),
    setSetupStep: useCallback(
      (step: number) => dispatch({ type: "SET_SETUP_STEP", payload: step }),
      []
    ),
    updateSetupData: useCallback(
      (data: Partial<AppState["setupData"]>) =>
        dispatch({ type: "UPDATE_SETUP_DATA", payload: data }),
      []
    ),
    setPortfolioItems: useCallback(
      (items: PortfolioItem[]) =>
        dispatch({ type: "SET_PORTFOLIO_ITEMS", payload: items }),
      []
    ),
    addPortfolioItem: useCallback(
      (item: PortfolioItem) =>
        dispatch({ type: "ADD_PORTFOLIO_ITEM", payload: item }),
      []
    ),
    updatePortfolioItem: useCallback(
      (item: PortfolioItem) =>
        dispatch({ type: "UPDATE_PORTFOLIO_ITEM", payload: item }),
      []
    ),
    removePortfolioItem: useCallback(
      (id: string) => dispatch({ type: "REMOVE_PORTFOLIO_ITEM", payload: id }),
      []
    ),
    setPortfolioLoaded: useCallback(
      (loaded: boolean) =>
        dispatch({ type: "SET_PORTFOLIO_LOADED", payload: loaded }),
      []
    ),
    setSelectedCategories: useCallback(
      (categories: string[]) =>
        dispatch({ type: "SET_SELECTED_CATEGORIES", payload: categories }),
      []
    ),
    setDataPoints: useCallback(
      (dataPoints: DataPoint[]) =>
        dispatch({ type: "SET_DATA_POINTS", payload: dataPoints }),
      []
    ),
    updateDataPoint: useCallback(
      (dataPoint: DataPoint) =>
        dispatch({ type: "UPDATE_DATA_POINT", payload: dataPoint }),
      []
    ),
    setSetupOpportunities: useCallback(
      (opportunities: SetupOpportunity[]) =>
        dispatch({ type: "SET_SETUP_OPPORTUNITIES", payload: opportunities }),
      []
    ),
    updateSetupOpportunity: useCallback(
      (opportunity: SetupOpportunity) =>
        dispatch({ type: "UPDATE_SETUP_OPPORTUNITY", payload: opportunity }),
      []
    ),
    updateSimulationSettings: useCallback(
      (settings: Partial<AppState["simulationSettings"]>) =>
        dispatch({ type: "UPDATE_SIMULATION_SETTINGS", payload: settings }),
      []
    ),
    setComputedMetrics: useCallback(
      (metrics: Record<string, number> | null) =>
        dispatch({ type: "SET_COMPUTED_METRICS", payload: metrics }),
      []
    ),
    setSavingsSummary: useCallback(
      (summary: SavingsSummary | null) =>
        dispatch({ type: "SET_SAVINGS_SUMMARY", payload: summary }),
      []
    ),
    addActivity: useCallback(
      (activity: Omit<ActivityItem, "id" | "timestamp">) =>
        dispatch({
          type: "ADD_ACTIVITY",
          payload: {
            ...activity,
            id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
          },
        }),
      []
    ),
    clearActivityHistory: useCallback(
      () => {
        dispatch({ type: "CLEAR_ACTIVITY_HISTORY" });
        // Also clear from localStorage
        if (typeof window !== "undefined") {
          localStorage.removeItem(ACTIVITY_STORAGE_KEY);
        }
      },
      []
    ),
    setPersistedReviewData: useCallback(
      (data: PersistedReviewData) =>
        dispatch({ type: "SET_PERSISTED_REVIEW_DATA", payload: data }),
      []
    ),
    updatePersistedSpendFile: useCallback(
      (data: PersistedFileData | undefined) =>
        dispatch({ type: "UPDATE_PERSISTED_SPEND_FILE", payload: data }),
      []
    ),
    updatePersistedDataPointFile: useCallback(
      (dataPointId: string, data: PersistedFileData | undefined) =>
        dispatch({ type: "UPDATE_PERSISTED_DATA_POINT_FILE", payload: { dataPointId, data } }),
      []
    ),
    clearPersistedReviewData: useCallback(
      () => {
        dispatch({ type: "CLEAR_PERSISTED_REVIEW_DATA" });
        // Also clear from localStorage
        if (typeof window !== "undefined") {
          localStorage.removeItem(REVIEW_DATA_STORAGE_KEY);
        }
      },
      []
    ),
    setPlaybookData: useCallback(
      (data: PlaybookData | null) =>
        dispatch({ type: "SET_PLAYBOOK_DATA", payload: data }),
      []
    ),
    setSpendAnalysis: useCallback(
      (data: SpendAnalysis | null) =>
        dispatch({ type: "SET_SPEND_ANALYSIS", payload: data }),
      []
    ),
    setOpportunityMetrics: useCallback(
      (metrics: OpportunityMetricsData[] | null) =>
        dispatch({ type: "SET_OPPORTUNITY_METRICS", payload: metrics }),
      []
    ),
    resetState: useCallback(() => dispatch({ type: "RESET_STATE" }), []),
    logout: useCallback(() => dispatch({ type: "LOGOUT" }), []),
  };

  return (
    <AppContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </AppContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}

export default AppContext;
