/**
 * Procurement API Service
 * Handles all communication with the Beroe backend
 */

import apiClient from "./client";
import type {
  AnalysisResponse,
  CategoryInput,
  SessionResponse,
  ThemeResponse,
  HealthResponse,
  LeverTheme,
  User,
  AuthResponse,
} from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

// ============================================================================
// Auth API (separate from procurementApi for clarity)
// ============================================================================

export interface SetupUpdateData {
  setup_step?: number;
  setup_completed?: boolean;
  preferences?: Record<string, unknown>;
  goals?: { cost: number; risk: number; esg: number };
}

export interface GoalsUpdateData {
  cost: number;
  risk: number;
  esg: number;
}

export const authApi = {
  /**
   * Get current user from token
   */
  getMe: () => apiClient.get<User>("/auth/me"),

  /**
   * Update user profile
   */
  updateProfile: (data: Partial<User>) => apiClient.put<User>("/auth/me", data),

  /**
   * Update setup wizard progress
   */
  updateSetup: (data: SetupUpdateData) => apiClient.put<User>("/auth/me/setup", data),

  /**
   * Update user goals (cost/risk/esg)
   */
  updateGoals: (data: GoalsUpdateData) => apiClient.put<User>("/auth/me/goals", data),

  /**
   * Update setup step
   */
  updateSetupStep: (step: number) =>
    apiClient.put<User>(`/auth/me/setup-step?step=${step}`),

  /**
   * Login with JSON body
   */
  login: (email: string, password: string) =>
    apiClient.post<AuthResponse>("/auth/login/json", { email, password }, { skipAuth: true }),

  /**
   * Register new user
   */
  register: (data: {
    name: string;
    email: string;
    username: string;
    password: string;
    organization_name?: string;
    organization_id?: string;
  }) => apiClient.post<AuthResponse>("/auth/register", data, { skipAuth: true }),
};

export const procurementApi = {
  // ============================================================================
  // Health & Status
  // ============================================================================

  /**
   * Check API health
   */
  healthCheck: () => apiClient.get<HealthResponse>("/"),

  /**
   * Get detailed health status
   */
  detailedHealth: () =>
    apiClient.get<{
      status: string;
      components: Record<string, string>;
      active_sessions: number;
    }>("/health"),

  // ============================================================================
  // Analysis
  // ============================================================================

  /**
   * Run full analysis with file upload
   */
  analyzeWithUpload: async (
    categoryName: string,
    spend: number,
    file: File,
    options?: {
      addressable_spend_pct?: number;
      savings_benchmark_low?: number;
      savings_benchmark_high?: number;
      maturity_score?: number;
    }
  ): Promise<AnalysisResponse> => {
    const formData = new FormData();
    formData.append("category_name", categoryName);
    formData.append("spend", spend.toString());
    formData.append("spend_file", file);

    if (options?.addressable_spend_pct) {
      formData.append(
        "addressable_spend_pct",
        options.addressable_spend_pct.toString()
      );
    }
    if (options?.savings_benchmark_low) {
      formData.append(
        "savings_benchmark_low",
        options.savings_benchmark_low.toString()
      );
    }
    if (options?.savings_benchmark_high) {
      formData.append(
        "savings_benchmark_high",
        options.savings_benchmark_high.toString()
      );
    }
    if (options?.maturity_score) {
      formData.append("maturity_score", options.maturity_score.toString());
    }

    return apiClient.upload<AnalysisResponse>("/analyze", formData, {
      timeout: 120000, // 2 minutes for file processing
    });
  },

  /**
   * Run quick analysis without file upload (uses default data)
   */
  analyzeQuick: (categoryInput: CategoryInput) =>
    apiClient.post<AnalysisResponse>("/analyze/quick", categoryInput, {
      timeout: 120000, // 2 minutes to match file upload analysis
    }),

  // ============================================================================
  // Sessions
  // ============================================================================

  /**
   * Get session details
   */
  getSession: (sessionId: string) =>
    apiClient.get<SessionResponse>(`/session/${sessionId}`),

  /**
   * Add opportunity to session
   */
  addOpportunity: (
    sessionId: string,
    params: {
      lever_theme: LeverTheme;
      name: string;
      maturity_score?: number;
      savings_benchmark_low?: number;
      savings_benchmark_high?: number;
      description?: string;
    }
  ) => {
    const searchParams = new URLSearchParams({
      lever_theme: params.lever_theme,
      name: params.name,
      ...(params.maturity_score && {
        maturity_score: params.maturity_score.toString(),
      }),
      ...(params.savings_benchmark_low && {
        savings_benchmark_low: params.savings_benchmark_low.toString(),
      }),
      ...(params.savings_benchmark_high && {
        savings_benchmark_high: params.savings_benchmark_high.toString(),
      }),
      ...(params.description && { description: params.description }),
    });

    return apiClient.post<{
      status: string;
      opportunity_id: string;
      opportunity_name: string;
      num_proof_points: number;
    }>(`/session/${sessionId}/add-opportunity?${searchParams}`);
  },

  /**
   * Recalculate session savings
   */
  recalculateSession: (sessionId: string) =>
    apiClient.post<{
      status: string;
      savings_summary: {
        total_savings_low: number;
        total_savings_high: number;
        confidence_score: number;
        confidence_bucket: string;
      };
      opportunities: Array<{
        id: string;
        name: string;
        weightage: number;
        savings_low: number;
        savings_high: number;
      }>;
    }>(`/session/${sessionId}/recalculate`),

  /**
   * Delete session
   */
  deleteSession: (sessionId: string) =>
    apiClient.delete<{ status: string; session_id: string }>(
      `/session/${sessionId}`
    ),

  // ============================================================================
  // Opportunities
  // ============================================================================

  /**
   * Get available opportunity themes
   */
  getOpportunityThemes: () => apiClient.get<ThemeResponse>("/opportunities/themes"),

  // ============================================================================
  // Portfolio
  // ============================================================================

  /**
   * Get user's portfolio with all categories
   */
  getPortfolio: () =>
    apiClient.get<{
      success: boolean;
      data: {
        categories: Array<{
          id: string;
          name: string;
          spend: number;
          locations: string[];
        }>;
        total_spend: number;
        total_categories: number;
      };
    }>("/portfolio"),

  /**
   * Add a new category to portfolio
   */
  addCategory: (data: { name: string; spend: number; locations?: string[] }) =>
    apiClient.post<{
      success: boolean;
      data: {
        id: string;
        name: string;
        spend: number;
        locations: string[];
      };
    }>("/portfolio/category", data),

  /**
   * Update a category in portfolio
   */
  updateCategory: (
    categoryId: string,
    data: { name?: string; spend?: number; locations?: string[] }
  ) =>
    apiClient.put<{
      success: boolean;
      data: {
        id: string;
        name: string;
        spend: number;
        locations: string[];
      };
    }>(`/portfolio/category/${categoryId}`, data),

  /**
   * Delete a category from portfolio
   */
  deleteCategory: (categoryId: string) =>
    apiClient.delete<{
      success: boolean;
      deleted: {
        id: string;
        name: string;
        spend: number;
        locations: string[];
      };
    }>(`/portfolio/category/${categoryId}`),

  /**
   * Add location to a category
   */
  addLocationToCategory: (categoryId: string, location: string) => {
    const formData = new FormData();
    formData.append("location", location);
    return apiClient.upload<{
      success: boolean;
      data: {
        id: string;
        name: string;
        spend: number;
        locations: string[];
      };
    }>(`/portfolio/category/${categoryId}/location`, formData);
  },

  /**
   * Remove location from a category
   */
  removeLocationFromCategory: (categoryId: string, location: string) =>
    apiClient.delete<{
      success: boolean;
      data: {
        id: string;
        name: string;
        spend: number;
        locations: string[];
      };
    }>(`/portfolio/category/${categoryId}/location/${encodeURIComponent(location)}`),

  /**
   * Upload CSV file to populate portfolio
   */
  uploadSpendData: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.upload<{
      success: boolean;
      message: string;
      data: {
        categories: Array<{
          id: string;
          name: string;
          spend: number;
          locations: string[];
        }>;
        total_spend: number;
        total_categories: number;
        total_rows: number;
      };
    }>("/portfolio/upload", formData, { timeout: 60000 });
  },

  /**
   * Get raw spend data
   */
  getSpendData: () =>
    apiClient.get<{
      success: boolean;
      data: {
        columns: string[];
        rows: number;
        sample: Record<string, unknown>[];
      } | null;
      message?: string;
    }>("/portfolio/spend-data"),

  // ============================================================================
  // Data Ingestion (for full analysis with all data sources)
  // ============================================================================

  /**
   * Ingest spend data file
   */
  ingestSpendData: async (sessionId: string, file: File) => {
    const formData = new FormData();
    formData.append("session_id", sessionId);
    formData.append("file", file);
    return apiClient.upload<{
      success: boolean;
      source_type: string;
      records_processed: number;
      errors: string[];
      warnings: string[];
      metadata: Record<string, unknown>;
    }>("/data/ingest/spend", formData, { timeout: 60000 });
  },

  /**
   * Ingest supply master file
   */
  ingestSupplierData: async (sessionId: string, file: File) => {
    const formData = new FormData();
    formData.append("session_id", sessionId);
    formData.append("file", file);
    return apiClient.upload<{
      success: boolean;
      source_type: string;
      records_processed: number;
      errors: string[];
      warnings: string[];
      metadata: Record<string, unknown>;
    }>("/data/ingest/suppliers", formData, { timeout: 60000 });
  },

  /**
   * Ingest contracts file
   */
  ingestContractData: async (sessionId: string, file: File) => {
    const formData = new FormData();
    formData.append("session_id", sessionId);
    formData.append("file", file);
    return apiClient.upload<{
      success: boolean;
      source_type: string;
      records_processed: number;
      errors: string[];
      warnings: string[];
      metadata: Record<string, unknown>;
    }>("/data/ingest/contracts", formData, { timeout: 60000 });
  },

  /**
   * Ingest category playbook file
   */
  ingestPlaybookData: async (sessionId: string, file: File) => {
    const formData = new FormData();
    formData.append("session_id", sessionId);
    formData.append("file", file);
    return apiClient.upload<{
      success: boolean;
      source_type: string;
      records_processed: number;
      errors: string[];
      warnings: string[];
      metadata: Record<string, unknown>;
    }>("/data/ingest/playbook", formData, { timeout: 60000 });
  },

  // ============================================================================
  // Document Analysis (PDF/DOCX extraction with Qwen 2.5)
  // ============================================================================

  /**
   * Analyze a single document (contract or playbook)
   * Uses Ollama + Qwen 2.5 for local AI extraction
   */
  analyzeDocument: async (
    file: File,
    documentType: "contract" | "playbook" | "supplier_agreement" | "policy" | "other",
    options?: {
      category?: string;
      sessionId?: string;
      extractionFocus?: string[];
    }
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", documentType);

    if (options?.category) {
      formData.append("category", options.category);
    }
    if (options?.sessionId) {
      formData.append("session_id", options.sessionId);
    }
    if (options?.extractionFocus) {
      formData.append("extraction_focus", options.extractionFocus.join(","));
    }

    return apiClient.upload<{
      document_id: string;
      document_name: string;
      document_type: string;
      summary: string;
      key_terms: Array<{ term: string; details: string; risk_level: string }>;
      pricing_info: Record<string, unknown>;
      risks: Array<{ risk: string; severity: string; mitigation: string }>;
      opportunities: Array<{ opportunity: string; potential_impact: string; action: string }>;
      compliance: Record<string, unknown>;
      recommendations: Array<{ recommendation: string; priority: string; rationale: string }>;
      processed_at: string;
    }>("/documents/analyze", formData, { timeout: 120000 });
  },

  /**
   * Demo document analysis (no auth required)
   * For testing document extraction
   */
  analyzeDocumentDemo: async (
    file: File,
    documentType: "contract" | "playbook" = "contract"
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", documentType);

    return apiClient.upload<{
      document_name: string;
      document_type: string;
      summary: string;
      key_terms: Array<{ term: string; details: string; risk_level: string }>;
      risks: Array<{ risk: string; severity: string; mitigation: string }>;
      opportunities: Array<{ opportunity: string; potential_impact: string; action: string }>;
      recommendations: Array<{ recommendation: string; priority: string; rationale: string }>;
      processed_at: string;
    }>("/documents/demo-analyze", formData, { timeout: 120000 });
  },

  /**
   * Get document analysis by ID
   */
  getDocumentAnalysis: (documentId: string) =>
    apiClient.get<{
      document_id: string;
      document_name: string;
      document_type: string;
      summary: string;
      key_terms: Array<{ term: string; details: string; risk_level: string }>;
      pricing_info: Record<string, unknown>;
      risks: Array<{ risk: string; severity: string; mitigation: string }>;
      opportunities: Array<{ opportunity: string; potential_impact: string; action: string }>;
      compliance: Record<string, unknown>;
      recommendations: Array<{ recommendation: string; priority: string; rationale: string }>;
      processed_at: string;
    }>(`/documents/${documentId}`),

  /**
   * List documents for a session
   */
  listSessionDocuments: (sessionId: string) =>
    apiClient.get<{
      documents: Array<{
        id: string;
        file_name: string;
        document_type: string;
        status: string;
        word_count: number;
        page_count: number;
        has_analysis: boolean;
        created_at: string;
        processed_at: string | null;
      }>;
      total: number;
    }>(`/documents/session/${sessionId}`),

  /**
   * Compute metrics after data ingestion
   */
  computeMetrics: (sessionId: string) =>
    apiClient.post<{
      success: boolean;
      metrics_computed: number;
      computation_time_ms: number;
      metrics: Record<string, unknown>;
    }>(`/data/compute/${sessionId}`),

  /**
   * Run full analysis with all data files
   * This is the main entry point for complete analysis
   */
  runFullAnalysis: async (
    categoryName: string,
    spend: number,
    files: {
      spendFile?: File;
      supplyMasterFile?: File;
      contractsFile?: File;
      playbookFile?: File;
    },
    options?: {
      addressable_spend_pct?: number;
      savings_benchmark_low?: number;
      savings_benchmark_high?: number;
      maturity_score?: number;
    }
  ): Promise<AnalysisResponse> => {
    // First, create analysis with spend file
    const formData = new FormData();
    formData.append("category_name", categoryName);
    formData.append("spend", spend.toString());

    if (files.spendFile) {
      formData.append("spend_file", files.spendFile);
    }
    if (options?.addressable_spend_pct) {
      formData.append("addressable_spend_pct", options.addressable_spend_pct.toString());
    }
    if (options?.savings_benchmark_low) {
      formData.append("savings_benchmark_low", options.savings_benchmark_low.toString());
    }
    if (options?.savings_benchmark_high) {
      formData.append("savings_benchmark_high", options.savings_benchmark_high.toString());
    }
    if (options?.maturity_score) {
      formData.append("maturity_score", options.maturity_score.toString());
    }

    // Initial analysis
    const response = await apiClient.upload<AnalysisResponse>("/analyze", formData, {
      timeout: 120000,
    });

    const sessionId = response.session_id;

    // Ingest additional data files if provided
    const ingestionPromises: Promise<unknown>[] = [];

    if (files.supplyMasterFile) {
      ingestionPromises.push(
        procurementApi.ingestSupplierData(sessionId, files.supplyMasterFile)
      );
    }
    if (files.contractsFile) {
      ingestionPromises.push(
        procurementApi.ingestContractData(sessionId, files.contractsFile)
      );
    }
    if (files.playbookFile) {
      ingestionPromises.push(
        procurementApi.ingestPlaybookData(sessionId, files.playbookFile)
      );
    }

    // Wait for all ingestions
    if (ingestionPromises.length > 0) {
      await Promise.all(ingestionPromises);

      // Compute metrics with all data
      await procurementApi.computeMetrics(sessionId);

      // Recalculate session with new data
      await procurementApi.recalculateSession(sessionId);
    }

    // Get updated session data
    const updatedSession = await procurementApi.getSession(sessionId);

    return {
      ...response,
      ...updatedSession,
    };
  },

  // ============================================================================
  // Chat / LLM Recommendations
  // ============================================================================

  /**
   * Send a message to the AI assistant (demo mode - no auth required)
   * Used for opportunity insights and recommendations
   */
  chatDemo: async (message: string) => {
    return apiClient.post<{
      status: string;
      user_message: { content: string };
      assistant_message: {
        content: string;
        thinking_time: string;
      };
    }>("/chat/demo-message", { content: message }, { timeout: 90000 });
  },

  /**
   * Generate opportunity insights using LLM
   * Sends COMPREHENSIVE context about the opportunity for truly conversational AI
   */
  getOpportunityInsights: async (
    opportunityType: string,
    categoryName: string,
    totalSpend: number,
    proofPoints: Array<{ name: string; isValidated: boolean; id?: string; description?: string }>,
    question?: string,
    // NEW: Additional context for conversational AI
    additionalContext?: {
      suppliers?: Array<{ name: string; spend: number; country?: string; riskRating?: string }>;
      recommendations?: Array<{ text: string; reason: string }>;
      metrics?: {
        priceVariance?: number;
        top3Concentration?: number;
        tailSpendPercentage?: number;
        supplierCount?: number;
      };
      locations?: string[];
      goals?: { cost: number; risk: number; esg: number };
      savingsPercentage?: string;
      // Chat history for memory
      chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
      // Rich file data for deep knowledge
      spendDataSample?: Array<Record<string, string | number>>; // First 10 rows of spend CSV
      contractSummary?: string; // Parsed contract text/key terms
      supplierMasterSummary?: string; // Supplier master key info
    }
  ) => {
    // Use the new structured opportunity-chat endpoint
    // Backend has full knowledge of opportunities, proof points, and builds comprehensive context
    return apiClient.post<{
      status: string;
      user_message: { content: string };
      assistant_message: {
        content: string;
        thinking_time: string;
      };
    }>("/chat/opportunity-chat", {
      question: question || "Give me a summary of this opportunity.",
      opportunity_type: opportunityType,
      category_name: categoryName,
      total_spend: totalSpend,
      suppliers: additionalContext?.suppliers || [],
      metrics: additionalContext?.metrics || {},
      proof_points: proofPoints.map(pp => ({
        id: pp.id,
        name: pp.name,
        isValidated: pp.isValidated,
        description: pp.description
      })),
      recommendations: additionalContext?.recommendations || [],
      goals: additionalContext?.goals || {},
      savings_percentage: additionalContext?.savingsPercentage,
      spend_data_sample: additionalContext?.spendDataSample || [],
      contract_summary: additionalContext?.contractSummary,
      supplier_master_summary: additionalContext?.supplierMasterSummary,
      history: additionalContext?.chatHistory?.slice(-6) || []
    }, { timeout: 90000 }); // 90 second timeout for LLM calls
  },

  /**
   * Generate specific LLM-powered recommendations for an opportunity
   * This sends all context data and gets back specific recommendations using actual data
   */
  getOpportunityRecommendations: async (params: {
    opportunityType: string;
    categoryName: string;
    locations?: string[];  // Geographic locations/regions for this category
    spendData: {
      totalSpend: number;
      breakdown?: Array<{ supplier: string; spend: number; category?: string }>;
    };
    supplierData: Array<{ name: string; spend: number; category?: string; location?: string }>;
    metrics: {
      priceVariance?: number;
      top3Concentration?: number;
      tailSpendPercentage?: number;
      supplierCount?: number;
      avgSpendPerSupplier?: number;
      [key: string]: number | string | undefined;
    };
    proofPoints: Array<{ id: string; name: string; isValidated: boolean; description?: string }>;
    playbookData?: Record<string, unknown>;
    contractData?: Record<string, unknown>;  // ✅ NEW: Contract data
    supplierMasterData?: Record<string, unknown>;  // ✅ NEW: Supplier master data
  }) => {
    return apiClient.post<{
      status: string;
      recommendations: Array<{ text: string; reason: string }>;
      model_used?: string;
      thinking_time?: string;
      error?: string;
    }>("/chat/recommendations", {
      opportunity_type: params.opportunityType,
      category_name: params.categoryName,
      locations: params.locations,
      spend_data: params.spendData,
      supplier_data: params.supplierData,
      metrics: params.metrics,
      proof_points: params.proofPoints,
      playbook_data: params.playbookData,
      contract_data: params.contractData,  // ✅ NEW: Pass contract data
      supplier_master_data: params.supplierMasterData,  // ✅ NEW: Pass supplier master data
    }, { timeout: 90000 });  // 90s timeout for LLM processing
  },

  /**
   * Evaluate proof points using LLM (Mistral/Llama)
   * Returns L/M/H ratings for each proof point and weighted confidence score
   * Formula: Score = (0.25 × L_count) + (0.625 × M_count) + (0.875 × H_count)
   */
  evaluateProofPoints: async (params: {
    opportunityType: string;
    categoryName: string;
    proofPointsData: Array<{
      id: string;
      name: string;
      value?: number;
      data?: Record<string, unknown>;
    }>;
    spendData: Record<string, unknown>;
    supplierData: Array<Record<string, unknown>>;
    metrics: Record<string, unknown>;
  }) => {
    return apiClient.post<{
      status: string;
      evaluations: Array<{
        id: string;
        impact: 'High' | 'Medium' | 'Low';
        reasoning: string;
        data_point: string;
      }>;
      summary: {
        high_count: number;
        medium_count: number;
        low_count: number;
        confidence_score: number;
      };
      confidence_score: number;
      model_used: string;
      thinking_time: string;
    }>("/chat/evaluate-proof-points", {
      opportunity_type: params.opportunityType,
      category_name: params.categoryName,
      proof_points_data: params.proofPointsData,
      spend_data: params.spendData,
      supplier_data: params.supplierData,
      metrics: params.metrics,
    }, { timeout: 90000 });  // 90s timeout for LLM processing
  },

  /**
   * Generate Leadership Brief docx for an accepted opportunity
   * Returns the docx file as a blob with comprehensive formatting
   */
  generateLeadershipBrief: async (params: {
    opportunityId: string;
    opportunityName: string;
    categoryName: string;
    locations: string[];
    totalSpend: number;
    recommendations: Array<{ text: string; reason: string }>;
    proofPoints: Array<{ id: string; name: string; isValidated: boolean }>;
    suppliers: Array<{ name: string; spend: number }>;
    metrics: {
      priceVariance?: number;
      top3Concentration?: number;
      tailSpendPercentage?: number;
      supplierCount?: number;
    };
    savingsLow?: number;
    savingsHigh?: number;
    confidenceScore?: number;
    spendByRegion?: Array<{ name: string; spend: number }>;
  }): Promise<ArrayBuffer> => {
    // Build spend by region - handle empty locations array
    let spendByRegion = params.spendByRegion;
    if (!spendByRegion || spendByRegion.length === 0) {
      if (params.locations && params.locations.length > 0) {
        spendByRegion = params.locations.map((loc) => ({
          name: loc,
          spend: params.totalSpend / params.locations.length
        }));
      } else {
        spendByRegion = [{ name: 'All Regions', spend: params.totalSpend }];
      }
    }

    const requestBody = {
      opportunity_id: params.opportunityId || 'unknown',
      opportunity_name: params.opportunityName || 'Opportunity',
      category_name: params.categoryName || 'Category',
      locations: params.locations || [],
      total_spend: params.totalSpend || 0,
      recommendations: params.recommendations || [],
      proof_points: params.proofPoints || [],
      suppliers: params.suppliers || [],
      metrics: params.metrics || {},
      savings_low: params.savingsLow || (params.totalSpend * 0.8) * 0.03,
      savings_high: params.savingsHigh || (params.totalSpend * 0.8) * 0.08,
      confidence_score: params.confidenceScore || 0,
      spend_by_region: spendByRegion,
    };

    // Log request for debugging
    console.log('[Leadership Brief] Request body:', JSON.stringify(requestBody, null, 2));

    // Use AbortController for 120s timeout (brief generation takes longer)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    const response = await fetch(`${API_BASE_URL}/chat/generate-brief`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Try to get more error details
      let errorDetails = response.statusText;
      try {
        const errorJson = await response.json();
        errorDetails = JSON.stringify(errorJson);
      } catch {
        // If response is not JSON, try to get text
        try {
          errorDetails = await response.text();
        } catch {
          // Keep original statusText
        }
      }
      console.error('[Leadership Brief] Error:', errorDetails);
      throw new Error(`Failed to generate brief: ${errorDetails}`);
    }

    return response.arrayBuffer();
  },

  // ==========================================================================
  // SUPPLIER INTELLIGENCE (PP8 - Real-time Supplier Risk Rating)
  // ==========================================================================

  /**
   * Evaluate a single supplier's risk profile using real-time web data.
   * Uses Tavily for web search + Llama 3.2 for analysis.
   */
  evaluateSupplier: async (params: {
    supplierName: string;
    category?: string;
    country?: string;
  }) => {
    return apiClient.post<{
      status: string;
      evaluation: {
        supplier: string;
        parameters: {
          financial_strength: { rating: string; score: number; reason: string };
          supply_reliability: { rating: string; score: number; reason: string };
          compliance_governance: { rating: string; score: number; reason: string };
          pricing_competitiveness: { rating: string; score: number; reason: string };
          volume_scalability: { rating: string; score: number; reason: string };
          geographic_diversification: { rating: string; score: number; reason: string };
        };
        overall_rating: 'GOOD' | 'MEDIUM' | 'HIGH_RISK';
        overall_score: number;
        procurement_role: 'ANCHOR' | 'CHALLENGER' | 'TAIL';
        max_allocation: string;
        key_risks: string[];
        recommendation: string;
        data_freshness: string;
        analysis_timestamp: string;
        model_used: string;
      };
    }>("/chat/supplier-intelligence/evaluate", {
      supplier_name: params.supplierName,
      category: params.category,
      country: params.country,
    }, { timeout: 90000 }); // 90s for web search + LLM
  },

  /**
   * Evaluate multiple suppliers for PP8 (Supplier Risk Rating) proof point.
   * Returns aggregated risk assessment with PP8 impact rating.
   */
  evaluateSuppliersForPP8: async (params: {
    suppliers: Array<{ name: string; spend: number; country?: string }>;
    category?: string;
    country?: string;
  }) => {
    return apiClient.post<{
      status: string;
      proof_point_id: string;
      impact: 'High' | 'Medium' | 'Low';
      reasoning: string;
      summary: {
        total_evaluated: number;
        good_count: number;
        medium_count: number;
        high_risk_count: number;
        good_percentage: number;
        high_risk_percentage: number;
      };
      recommendations: {
        anchor_candidates: string[];
        challenger_candidates: string[];
        tail_only: string[];
      };
      supplier_evaluations: Array<{
        supplier: string;
        overall_rating: string;
        overall_score: number;
        procurement_role: string;
        recommendation: string;
      }>;
      evaluated_at: string;
      model_used: string;
    }>("/chat/supplier-intelligence/evaluate-pp8", {
      suppliers: params.suppliers,
      category: params.category,
      country: params.country,
    }, { timeout: 180000 }); // 3 min for multiple suppliers
  },

  // ============================================================================
  // CLEAN SPEND DATA MANAGEMENT
  // New upload = Delete old completely, store fresh with pre-computed summary
  // ============================================================================

  /**
   * Upload spend data with CLEAN REPLACEMENT
   * - Deletes ALL previous spend data for this session
   * - Processes new file on backend (not frontend)
   * - Returns instant summary (no further processing needed)
   *
   * Frontend just displays the response - zero lag!
   */
  uploadSpendDataClean: async (params: {
    sessionId: string;
    categoryName: string;
    file: File;
  }) => {
    const formData = new FormData();
    formData.append("session_id", params.sessionId);
    formData.append("category_name", params.categoryName);
    formData.append("file", params.file);

    return apiClient.upload<{
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
      price_stats?: {
        min: number;
        max: number;
        avg: number;
        variance: number;
      };
      processed_at: string;
    }>("/data/spend/upload", formData, { timeout: 120000 });
  },

  /**
   * Get pre-computed spend summary for instant display
   * This is what frontend should call on page load
   * Returns INSTANT data - no processing, just database read
   */
  getSpendSummary: async (sessionId: string) => {
    return apiClient.get<{
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
      price_stats?: {
        min: number;
        max: number;
        avg: number;
        variance: number;
      };
      processed_at: string | null;
    }>(`/data/spend/summary/${sessionId}`);
  },

  /**
   * Delete all spend data for a session
   * Use this when user wants to clear their data completely
   */
  deleteSpendData: async (sessionId: string) => {
    return apiClient.delete<{
      success: boolean;
      message: string;
      rows_deleted: number;
    }>(`/data/spend/${sessionId}`);
  },
};

export default procurementApi;
