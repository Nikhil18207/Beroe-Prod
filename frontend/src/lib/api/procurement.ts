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
} from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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
    apiClient.post<AnalysisResponse>("/analyze/quick", categoryInput),

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
    }>("/chat/demo-message", { content: message });
  },

  /**
   * Generate opportunity insights using LLM
   * Sends context about the opportunity and gets AI recommendations
   */
  getOpportunityInsights: async (
    opportunityType: string,
    categoryName: string,
    totalSpend: number,
    proofPoints: Array<{ name: string; isValidated: boolean; id?: string; description?: string }>,
    question?: string
  ) => {
    const validatedPoints = proofPoints.filter(pp => pp.isValidated);
    const missingPoints = proofPoints.filter(pp => !pp.isValidated);
    const confidence = proofPoints.length > 0
      ? Math.round((validatedPoints.length / proofPoints.length) * 100)
      : 0;

    // Build detailed proof point status
    const proofPointStatus = proofPoints.map((pp, idx) =>
      `${idx + 1}. ${pp.name}: ${pp.isValidated ? '✓ VALIDATED' : '✗ NOT VALIDATED'}`
    ).join('\n');

    // Opportunity type descriptions for context
    const opportunityDescriptions: Record<string, string> = {
      'volume-bundling': 'Volume Bundling focuses on consolidating spend across regions/sites and leveraging aggregated volume for better pricing and discounts.',
      'target-pricing': 'Target Pricing uses cost models, market indices, and should-cost analysis to optimize pricing and negotiate better rates.',
      'risk-management': 'Risk Management focuses on supplier diversification, reducing concentration risk, and building supply chain resilience.',
      'respec-pack': 'Re-spec Pack involves standardizing specifications across regions and rationalizing SKUs to reduce complexity and costs.'
    };

    const oppDescription = opportunityDescriptions[opportunityType] || 'Procurement optimization opportunity.';

    const contextMessage = question
      ? `=== OPPORTUNITY CONTEXT ===
Category: ${categoryName}
Opportunity Type: ${opportunityType}
Description: ${oppDescription}
Total Spend: $${totalSpend.toLocaleString()}
Confidence Level: ${confidence}%
Total Proof Points: ${proofPoints.length}
Validated: ${validatedPoints.length}
Missing/Not Validated: ${missingPoints.length}

=== PROOF POINT STATUS ===
${proofPointStatus}

=== MISSING PROOF POINTS (Need Validation) ===
${missingPoints.length > 0 ? missingPoints.map(pp => `- ${pp.name}`).join('\n') : 'All proof points validated!'}

=== USER QUESTION ===
${question}`
      : `=== INITIAL ANALYSIS REQUEST ===
Category: ${categoryName}
Opportunity Type: ${opportunityType}
Description: ${oppDescription}
Total Spend: $${totalSpend.toLocaleString()}
Confidence Level: ${confidence}%

=== PROOF POINT STATUS ===
${proofPointStatus}

=== MISSING PROOF POINTS (Need Validation) ===
${missingPoints.length > 0 ? missingPoints.map(pp => `- ${pp.name}`).join('\n') : 'All proof points validated!'}

Please provide:
1. A brief summary of this ${opportunityType} opportunity for ${categoryName}
2. What the missing proof points mean and why they're important
3. Specific questions I should ask or data I should gather to validate the missing proof points
4. Priority recommendations based on the current validation status`;

    return apiClient.post<{
      status: string;
      user_message: { content: string };
      assistant_message: {
        content: string;
        thinking_time: string;
      };
    }>("/chat/demo-message", { content: contextMessage });
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
  }) => {
    return apiClient.post<{
      status: string;
      recommendations: string[];
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
    });
  },

  /**
   * Generate Leadership Brief docx for an accepted opportunity
   * Returns the docx file as a blob
   */
  generateLeadershipBrief: async (params: {
    opportunityId: string;
    opportunityName: string;
    categoryName: string;
    locations: string[];
    totalSpend: number;
    recommendations: string[];
    proofPoints: Array<{ id: string; name: string; isValidated: boolean }>;
    suppliers: Array<{ name: string; spend: number }>;
    metrics: {
      priceVariance?: number;
      top3Concentration?: number;
      tailSpendPercentage?: number;
      supplierCount?: number;
    };
    savingsEstimate: string;
  }): Promise<ArrayBuffer> => {
    const response = await fetch(`${API_BASE_URL}/chat/generate-brief`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        opportunity_id: params.opportunityId,
        opportunity_name: params.opportunityName,
        category_name: params.categoryName,
        locations: params.locations,
        total_spend: params.totalSpend,
        recommendations: params.recommendations,
        proof_points: params.proofPoints,
        suppliers: params.suppliers,
        metrics: params.metrics,
        savings_estimate: params.savingsEstimate,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate brief: ${response.statusText}`);
    }

    return response.arrayBuffer();
  },
};

export default procurementApi;
