/**
 * Playbook Parser
 * Parses category playbook CSV data to generate dynamic opportunities
 *
 * Integrates with Beroe's 7-step savings calculation methodology from procurement-metrics.ts
 */

import {
  calculateOpportunitySavings,
  evaluateProofPoint,
  type ProofPointResult,
  type ImpactFlag,
} from './calculations/procurement-metrics';

export interface PlaybookEntry {
  category: string;
  strategy: string;
  marketTrend: string;
  riskFactor: string;
  recommendations: string[];
  riskLevel?: string;
  priority?: string;
  owner?: string;
}

export interface GeneratedOpportunity {
  id: string;
  category: string;
  title: string;
  description: string;
  type: "Savings" | "Resilience";
  impactLabel?: string;
  impact: "High" | "Medium" | "Low";
  effort: string;
  risk: string;
  esg: string;
  savings?: string;
  confidence: number;
  status: "Qualified" | "Potential";
  isNew: boolean;
  questionsToAnswer: number;
  savings_low: number;
  savings_high: number;
  marketContext: string;
  riskContext: string;
  strategyType: string;
}

// Map strategy types to opportunity categories
const STRATEGY_MAPPING: Record<string, { type: "Savings" | "Resilience"; baseImpact: "High" | "Medium" | "Low" }> = {
  "strategic sourcing": { type: "Savings", baseImpact: "High" },
  "volume bundling": { type: "Savings", baseImpact: "High" },
  "cost optimization": { type: "Savings", baseImpact: "High" },
  "target pricing": { type: "Savings", baseImpact: "Medium" },
  "risk mitigation": { type: "Resilience", baseImpact: "High" },
  "supply security": { type: "Resilience", baseImpact: "High" },
  "supplier consolidation": { type: "Savings", baseImpact: "Medium" },
  "market-based pricing": { type: "Savings", baseImpact: "Medium" },
  "partnership development": { type: "Resilience", baseImpact: "Medium" },
  "specification optimization": { type: "Savings", baseImpact: "Low" },
  "total cost reduction": { type: "Savings", baseImpact: "High" },
  "innovation partnership": { type: "Resilience", baseImpact: "Medium" },
  "service level optimization": { type: "Savings", baseImpact: "Medium" },
  "dual sourcing": { type: "Resilience", baseImpact: "High" },
  "regional optimization": { type: "Savings", baseImpact: "Medium" },
};

// Risk level to effort mapping
const EFFORT_MAPPING: Record<string, string> = {
  "high": "6-12 months",
  "medium": "3-6 months",
  "low": "1-3 months",
};

// Map playbook strategies to Beroe opportunity IDs for savings calculations
const STRATEGY_TO_OPPORTUNITY_ID: Record<string, string> = {
  "strategic sourcing": "volume-bundling",
  "volume bundling": "volume-bundling",
  "supplier consolidation": "volume-bundling",
  "dual sourcing": "risk-management",
  "risk mitigation": "risk-management",
  "supply security": "risk-management",
  "cost optimization": "target-pricing",
  "target pricing": "target-pricing",
  "market-based pricing": "target-pricing",
  "specification optimization": "respec-pack",
  "total cost reduction": "target-pricing",
  "innovation partnership": "risk-management",
  "service level optimization": "target-pricing",
  "regional optimization": "volume-bundling",
  "partnership development": "risk-management",
};

// Map recommendation keywords to opportunity IDs
const RECOMMENDATION_TO_OPPORTUNITY_ID: Record<string, string> = {
  "consolidat": "volume-bundling",
  "bundle": "volume-bundling",
  "volume": "volume-bundling",
  "negotiat": "target-pricing",
  "fixed-price": "target-pricing",
  "pricing": "target-pricing",
  "cost": "target-pricing",
  "target": "target-pricing",
  "diversif": "risk-management",
  "dual": "risk-management",
  "backup": "risk-management",
  "risk": "risk-management",
  "monitor": "risk-management",
  "compliance": "risk-management",
  "safety stock": "risk-management",
  "spec": "respec-pack",
  "standard": "respec-pack",
  "recyclable": "respec-pack",
};

// Parse recommendation text to extract actionable items
function parseRecommendations(recommendationText: string): string[] {
  if (!recommendationText) return [];

  // Split by semicolons or numbered items
  const items = recommendationText
    .split(/[;]|\d+\.\s*/)
    .map(item => item.trim())
    .filter(item => item.length > 10); // Filter out very short items

  return items;
}

// Detect opportunity type from strategy text
function detectStrategyType(strategy: string): { type: "Savings" | "Resilience"; baseImpact: "High" | "Medium" | "Low" } {
  const strategyLower = strategy.toLowerCase();

  for (const [key, value] of Object.entries(STRATEGY_MAPPING)) {
    if (strategyLower.includes(key)) {
      return value;
    }
  }

  // Default based on keywords
  if (strategyLower.includes("risk") || strategyLower.includes("security") || strategyLower.includes("resilience")) {
    return { type: "Resilience", baseImpact: "Medium" };
  }

  return { type: "Savings", baseImpact: "Medium" };
}

// Detect type from individual recommendation text (overrides strategy-based detection)
function detectRecommendationType(recommendation: string): { type: "Savings" | "Resilience"; impact: "High" | "Medium" | "Low" } | null {
  const recLower = recommendation.toLowerCase();

  // Savings indicators - cost/price focused actions
  const savingsKeywords = [
    'consolidate', 'negotiate', 'fixed-price', 'fixed price', 'pricing',
    'cost', 'reduce', 'optimize', 'savings', 'discount', 'bundle',
    'standardize', 'rationalize', 'efficiency', 'scorecard', 'performance'
  ];

  // Resilience indicators - risk/supply focused actions
  const resilienceKeywords = [
    'diversify', 'backup', 'alternative', 'dual', 'secondary',
    'risk', 'monitor', 'regulatory', 'compliance', 'contingency',
    'safety stock', 'buffer', 'tracking', 'traceability'
  ];

  let savingsScore = 0;
  let resilienceScore = 0;

  for (const keyword of savingsKeywords) {
    if (recLower.includes(keyword)) savingsScore++;
  }

  for (const keyword of resilienceKeywords) {
    if (recLower.includes(keyword)) resilienceScore++;
  }

  // Determine type based on which has more matches
  if (savingsScore > resilienceScore) {
    // Determine impact based on specific keywords
    if (recLower.includes('consolidate') || recLower.includes('negotiate') || recLower.includes('fixed-price')) {
      return { type: "Savings", impact: "High" };
    }
    if (recLower.includes('standardize') || recLower.includes('optimize') || recLower.includes('scorecard')) {
      return { type: "Savings", impact: "Medium" };
    }
    return { type: "Savings", impact: "Medium" };
  }

  if (resilienceScore > savingsScore) {
    // Determine impact based on specific keywords
    if (recLower.includes('diversify') || recLower.includes('dual') || recLower.includes('backup')) {
      return { type: "Resilience", impact: "High" };
    }
    if (recLower.includes('monitor') || recLower.includes('tracking') || recLower.includes('compliance')) {
      return { type: "Resilience", impact: "Medium" };
    }
    return { type: "Resilience", impact: "Medium" };
  }

  // No clear winner - return null to use strategy-based detection
  return null;
}

// Detect opportunity ID from recommendation text
function detectOpportunityId(recommendation: string, strategy: string): string {
  const recLower = recommendation.toLowerCase();
  const strategyLower = strategy.toLowerCase();

  // First check recommendation keywords
  for (const [keyword, oppId] of Object.entries(RECOMMENDATION_TO_OPPORTUNITY_ID)) {
    if (recLower.includes(keyword)) {
      return oppId;
    }
  }

  // Fall back to strategy mapping
  for (const [strategyKey, oppId] of Object.entries(STRATEGY_TO_OPPORTUNITY_ID)) {
    if (strategyLower.includes(strategyKey)) {
      return oppId;
    }
  }

  // Default to volume-bundling for savings, risk-management for resilience
  const typeDetection = detectRecommendationType(recommendation);
  if (typeDetection?.type === "Resilience") {
    return "risk-management";
  }
  return "volume-bundling";
}

// Define all proof points required for each opportunity type (Beroe methodology)
const OPPORTUNITY_PROOF_POINTS: Record<string, string[]> = {
  "volume-bundling": [
    "PP_REGIONAL_SPEND",
    "PP_TAIL_SPEND",
    "PP_VOLUME_LEVERAGE",
    "PP_PRICE_VARIANCE",
    "PP_AVG_SPEND_SUPPLIER",
    "PP_MARKET_CONSOLIDATION",
  ],
  "target-pricing": [
    "PP_PRICE_VARIANCE",
    "PP_TARIFF_RATE",
    "PP_COST_STRUCTURE",
    "PP_UNIT_PRICE",
  ],
  "risk-management": [
    "PP_SINGLE_SOURCING",
    "PP_SUPPLIER_CONCENTRATION",
    "PP_CATEGORY_RISK",
    "PP_SUPPLIER_RISK_RATING",
    "PP_GEO_POLITICAL",
    "PP_EXCHANGE_RATE",
  ],
  "respec-pack": [
    "PP_EXPORT_DATA",
    "PP_PRICE_VARIANCE",
    "PP_COST_STRUCTURE",
  ],
};

// Generate proof points from playbook - ALL marked as "Not Tested" until spend data is uploaded
// Playbook only provides recommendations, not actual metrics to validate proof points
function generateProofPointsFromPlaybook(
  entry: PlaybookEntry,
  recommendation: string,
  opportunityId: string
): ProofPointResult[] {
  const proofPoints: ProofPointResult[] = [];

  // IMPORTANT: Playbook CSV does NOT validate proof points
  // All proof points require ACTUAL SPEND DATA to be tested
  // Playbook only tells us WHAT to do, not validates IF we should do it

  if (opportunityId === "volume-bundling") {
    proofPoints.push({
      id: "PP_REGIONAL_SPEND",
      name: "Regional Spend",
      value: 0,
      impact: "Not Tested",
      insight: "Upload spend data to analyze regional concentration",
      isTested: false,
      threshold: { high: ">80%", medium: "50-80%", low: "<50%" },
    });

    proofPoints.push({
      id: "PP_TAIL_SPEND",
      name: "Tail Spend",
      value: 0,
      impact: "Not Tested",
      insight: "Upload spend data to analyze tail spend percentage",
      isTested: false,
      threshold: { high: ">30%", medium: "15-30%", low: "<15%" },
    });

    proofPoints.push({
      id: "PP_VOLUME_LEVERAGE",
      name: "Volume Leverage",
      value: 0,
      impact: "Not Tested",
      insight: "Upload spend data to analyze supplier fragmentation",
      isTested: false,
      threshold: { high: ">10 suppliers", medium: "5-10 suppliers", low: "<5 suppliers" },
    });

    proofPoints.push({
      id: "PP_PRICE_VARIANCE",
      name: "Price Variance",
      value: 0,
      impact: "Not Tested",
      insight: "Upload spend data with pricing to analyze variance",
      isTested: false,
      threshold: { high: ">25%", medium: "10-25%", low: "<10%" },
    });

    proofPoints.push({
      id: "PP_AVG_SPEND_SUPPLIER",
      name: "Avg Spend/Supplier",
      value: 0,
      impact: "Not Tested",
      insight: "Upload spend data to calculate average spend per supplier",
      isTested: false,
      threshold: { high: "<$100K", medium: "$100K-$500K", low: ">$500K" },
    });

    proofPoints.push({
      id: "PP_MARKET_CONSOLIDATION",
      name: "Market Consolidation",
      value: 0,
      impact: "Not Tested",
      insight: "Upload spend data to calculate HHI index",
      isTested: false,
      threshold: { high: "HHI <1500", medium: "HHI 1500-2500", low: "HHI >2500" },
    });
  }

  if (opportunityId === "target-pricing") {
    proofPoints.push({
      id: "PP_PRICE_VARIANCE",
      name: "Price Variance",
      value: 0,
      impact: "Not Tested",
      insight: "Upload spend data with pricing to analyze variance",
      isTested: false,
      threshold: { high: ">25%", medium: "10-25%", low: "<10%" },
    });

    proofPoints.push({
      id: "PP_TARIFF_RATE",
      name: "Tariff Rate",
      value: 0,
      impact: "Not Tested",
      insight: "Tariff analysis requires import/export data",
      isTested: false,
      threshold: { high: ">15%", medium: "5-15%", low: "<5%" },
    });

    proofPoints.push({
      id: "PP_COST_STRUCTURE",
      name: "Cost Structure",
      value: 0,
      impact: "Not Tested",
      insight: "Cost breakdown data needed",
      isTested: false,
      threshold: { high: ">60%", medium: "40-60%", low: "<40%" },
    });

    proofPoints.push({
      id: "PP_UNIT_PRICE",
      name: "Unit Price",
      value: 0,
      impact: "Not Tested",
      insight: "Upload spend data with unit pricing to benchmark",
      isTested: false,
      threshold: { high: ">15% above benchmark", medium: "5-15% above", low: "within 5%" },
    });
  }

  if (opportunityId === "risk-management") {
    proofPoints.push({
      id: "PP_SINGLE_SOURCING",
      name: "Single Sourcing",
      value: 0,
      impact: "Not Tested",
      insight: "Upload spend data to analyze supplier dependency",
      isTested: false,
      threshold: { high: ">50%", medium: "30-50%", low: "<30%" },
    });

    proofPoints.push({
      id: "PP_SUPPLIER_CONCENTRATION",
      name: "Supplier Concentration",
      value: 0,
      impact: "Not Tested",
      insight: "Upload spend data to analyze top supplier concentration",
      isTested: false,
      threshold: { high: ">80%", medium: "50-80%", low: "<50%" },
    });

    proofPoints.push({
      id: "PP_CATEGORY_RISK",
      name: "Category Risk",
      value: 0,
      impact: "Not Tested",
      insight: "Risk assessment data needed from supplier master",
      isTested: false,
      threshold: { high: "High risk", medium: "Medium risk", low: "Low risk" },
    });

    proofPoints.push({
      id: "PP_SUPPLIER_RISK_RATING",
      name: "Supplier Risk Rating",
      value: 0,
      impact: "Not Tested",
      insight: "Upload supplier master with risk ratings",
      isTested: false,
      threshold: { high: ">30%", medium: "10-30%", low: "<10%" },
    });

    proofPoints.push({
      id: "PP_GEO_POLITICAL",
      name: "Geo Political",
      value: 0,
      impact: "Not Tested",
      insight: "Upload spend data with country/region to analyze geographic risk",
      isTested: false,
      threshold: { high: ">40%", medium: "20-40%", low: "<20%" },
    });

    proofPoints.push({
      id: "PP_EXCHANGE_RATE",
      name: "Exchange Rate",
      value: 0,
      impact: "Not Tested",
      insight: "Currency exposure analysis requires spend by currency data",
      isTested: false,
      threshold: { high: ">50% volatile", medium: "20-50%", low: "<20%" },
    });
  }

  if (opportunityId === "respec-pack") {
    proofPoints.push({
      id: "PP_EXPORT_DATA",
      name: "Export Data",
      value: 0,
      impact: "Not Tested",
      insight: "Specification data needed for standardization analysis",
      isTested: false,
      threshold: { high: ">20%", medium: "10-20%", low: "<10%" },
    });

    proofPoints.push({
      id: "PP_PRICE_VARIANCE",
      name: "Price Variance",
      value: 0,
      impact: "Not Tested",
      insight: "Upload spend data with pricing to analyze spec-driven variance",
      isTested: false,
      threshold: { high: ">30%", medium: "15-30%", low: "<15%" },
    });

    proofPoints.push({
      id: "PP_COST_STRUCTURE",
      name: "Cost Structure",
      value: 0,
      impact: "Not Tested",
      insight: "Cost breakdown data needed for material optimization",
      isTested: false,
      threshold: { high: ">65%", medium: "45-65%", low: "<45%" },
    });
  }

  return proofPoints;
}

// Calculate effort based on recommendation complexity
function estimateEffort(recommendation: string, riskLevel?: string): string {
  if (riskLevel) {
    return EFFORT_MAPPING[riskLevel.toLowerCase()] || "3-6 months";
  }

  const recLower = recommendation.toLowerCase();

  // Long-term initiatives
  if (recLower.includes("transition") || recLower.includes("implement") || recLower.includes("develop") || recLower.includes("establish")) {
    return "6-12 months";
  }

  // Medium-term
  if (recLower.includes("negotiate") || recLower.includes("evaluate") || recLower.includes("review")) {
    return "3-6 months";
  }

  // Quick wins
  if (recLower.includes("consolidate") || recLower.includes("standardize") || recLower.includes("monitor")) {
    return "1-3 months";
  }

  return "3-6 months";
}

// Calculate risk score for display
function calculateRiskScore(riskFactor: string, riskLevel?: string): string {
  if (riskLevel) {
    switch (riskLevel.toLowerCase()) {
      case "high": return "-3";
      case "medium": return "-2";
      case "low": return "-1";
    }
  }

  const riskLower = riskFactor.toLowerCase();

  if (riskLower.includes("high") || riskLower.includes("critical") || riskLower.includes("severe")) {
    return "-3";
  }
  if (riskLower.includes("medium") || riskLower.includes("moderate")) {
    return "-2";
  }
  return "-1";
}

// Calculate ESG score based on recommendation
function calculateESGScore(recommendation: string): string {
  const recLower = recommendation.toLowerCase();

  if (recLower.includes("sustainability") || recLower.includes("recyclable") || recLower.includes("esg") || recLower.includes("green")) {
    return "+2";
  }
  if (recLower.includes("environment") || recLower.includes("carbon") || recLower.includes("ethical")) {
    return "+1";
  }
  if (recLower.includes("compliance") || recLower.includes("regulatory")) {
    return "0";
  }

  return "0";
}

// Parse playbook CSV data
export function parsePlaybookData(headers: string[], rows: Record<string, string>[]): PlaybookEntry[] {
  const entries: PlaybookEntry[] = [];

  // Detect column names flexibly
  const findColumn = (patterns: string[]): string | null => {
    for (const header of headers) {
      const headerLower = header.toLowerCase().replace(/[^a-z]/g, '');
      for (const pattern of patterns) {
        if (headerLower.includes(pattern)) {
          return header;
        }
      }
    }
    return null;
  };

  const categoryCol = findColumn(['category', 'cat']);
  const strategyCol = findColumn(['strategy', 'strat']);
  const marketTrendCol = findColumn(['market', 'trend']);
  const riskFactorCol = findColumn(['riskfactor', 'risk']);
  const recommendationsCol = findColumn(['recommendation', 'rec', 'action']);
  const riskLevelCol = findColumn(['risklevel', 'level']);
  const priorityCol = findColumn(['priority', 'prio']);
  const ownerCol = findColumn(['owner', 'responsible']);

  for (const row of rows) {
    const category = categoryCol ? row[categoryCol] : '';
    const strategy = strategyCol ? row[strategyCol] : '';
    const marketTrend = marketTrendCol ? row[marketTrendCol] : '';
    const riskFactor = riskFactorCol ? row[riskFactorCol] : '';
    const recommendationsText = recommendationsCol ? row[recommendationsCol] : '';
    const riskLevel = riskLevelCol ? row[riskLevelCol] : undefined;
    const priority = priorityCol ? row[priorityCol] : undefined;
    const owner = ownerCol ? row[ownerCol] : undefined;

    if (category && (strategy || recommendationsText)) {
      entries.push({
        category,
        strategy,
        marketTrend,
        riskFactor,
        recommendations: parseRecommendations(recommendationsText),
        riskLevel,
        priority,
        owner,
      });
    }
  }

  return entries;
}

// Generate opportunities from playbook entries using Beroe's 7-step methodology
export function generateOpportunitiesFromPlaybook(
  playbookEntries: PlaybookEntry[],
  totalSpend: number,
  targetCategory?: string,
  maturityScore: number = 2.5 // Default maturity score (1-4 scale)
): GeneratedOpportunity[] {
  const opportunities: GeneratedOpportunity[] = [];
  let oppIndex = 0;

  for (const entry of playbookEntries) {
    // Filter by category if specified
    if (targetCategory && entry.category.toLowerCase() !== targetCategory.toLowerCase()) {
      continue;
    }

    const strategyDetection = detectStrategyType(entry.strategy);

    // Generate opportunities from recommendations
    for (const recommendation of entry.recommendations) {
      // First try to detect type from the recommendation itself
      const recDetection = detectRecommendationType(recommendation);

      // Use recommendation-based detection if available, otherwise fall back to strategy
      const type = recDetection?.type ?? strategyDetection.type;
      const baseImpact = recDetection?.impact ?? strategyDetection.baseImpact;

      // Detect Beroe opportunity ID for savings calculations
      const opportunityId = detectOpportunityId(recommendation, entry.strategy);

      // Generate proof points from playbook data
      const proofPoints = generateProofPointsFromPlaybook(entry, recommendation, opportunityId);

      // Use Beroe's 7-step savings calculation methodology
      const savingsResult = calculateOpportunitySavings(
        opportunityId,
        proofPoints,
        totalSpend,
        maturityScore
      );

      // Debug logging
      const testedCount = proofPoints.filter(pp => pp.isTested).length;
      console.log(`[Playbook] "${recommendation.substring(0, 30)}..." -> ${opportunityId}: ${testedCount}/${proofPoints.length} tested (${Math.round(savingsResult.confidenceScore * 100)}%)`);

      const effort = estimateEffort(recommendation, entry.riskLevel);
      const riskScore = calculateRiskScore(entry.riskFactor, entry.riskLevel);
      const esgScore = calculateESGScore(recommendation);

      // Use Beroe methodology's impact bucket and confidence
      const impact = savingsResult.impactBucket;
      const confidence = Math.round(savingsResult.confidenceScore * 100);
      const status: "Qualified" | "Potential" = savingsResult.confidenceBucket === "High" ? "Qualified" : "Potential";

      opportunities.push({
        id: `playbook-opp-${oppIndex++}`,
        category: entry.category.toUpperCase(),
        title: recommendation,
        description: entry.strategy,
        type,
        impactLabel: type === "Resilience" ? "Risk Reduction" : "Savings Impact",
        impact,
        effort,
        risk: riskScore,
        esg: esgScore,
        savings: type === "Resilience" ? "Low" : undefined,
        confidence,
        status,
        isNew: true,
        questionsToAnswer: status === "Qualified" ? 2 : Math.max(2, 6 - Math.floor(confidence / 20)),
        savings_low: savingsResult.savingsLow,
        savings_high: savingsResult.savingsHigh,
        marketContext: entry.marketTrend,
        riskContext: entry.riskFactor,
        strategyType: entry.strategy,
      });
    }

    // If no recommendations were parsed, create one from the strategy
    if (entry.recommendations.length === 0 && entry.strategy) {
      const opportunityId = detectOpportunityId(entry.strategy, entry.strategy);

      // Generate minimal proof points from available data
      const proofPoints = generateProofPointsFromPlaybook(entry, entry.strategy, opportunityId);

      // Use Beroe's 7-step calculation
      const savingsResult = calculateOpportunitySavings(
        opportunityId,
        proofPoints,
        totalSpend,
        maturityScore
      );

      const effort = estimateEffort(entry.strategy, entry.riskLevel);
      const riskScore = calculateRiskScore(entry.riskFactor, entry.riskLevel);

      opportunities.push({
        id: `playbook-opp-${oppIndex++}`,
        category: entry.category.toUpperCase(),
        title: `Implement ${entry.strategy} strategy`,
        description: entry.strategy,
        type: strategyDetection.type,
        impactLabel: strategyDetection.type === "Resilience" ? "Risk Reduction" : "Savings Impact",
        impact: savingsResult.impactBucket,
        effort,
        risk: riskScore,
        esg: "0",
        savings: strategyDetection.type === "Resilience" ? "Low" : undefined,
        confidence: Math.round(savingsResult.confidenceScore * 100),
        status: savingsResult.confidenceBucket === "High" ? "Qualified" : "Potential",
        isNew: true,
        questionsToAnswer: savingsResult.confidenceBucket === "High" ? 2 : 4,
        savings_low: savingsResult.savingsLow,
        savings_high: savingsResult.savingsHigh,
        marketContext: entry.marketTrend,
        riskContext: entry.riskFactor,
        strategyType: entry.strategy,
      });
    }
  }

  return opportunities;
}

// Combine playbook opportunities with spend analysis insights using Beroe metrics
// This function calculates REAL proof point values from actual spend data
export function enrichOpportunitiesWithSpendData(
  opportunities: GeneratedOpportunity[],
  spendBySupplier: Record<string, number>,
  spendByRegion: Record<string, number>,
  totalSpend: number,
  maturityScore: number = 2.5,
  priceData?: { prices: number[]; avgPrice: number; priceVariance: number }
): GeneratedOpportunity[] {
  // Calculate concentration metrics from ACTUAL spend data
  const supplierValues = Object.values(spendBySupplier);
  const supplierCount = Object.keys(spendBySupplier).length;
  const topSupplierSpend = supplierValues.length > 0 ? Math.max(...supplierValues) : 0;
  const supplierConcentration = totalSpend > 0 ? (topSupplierSpend / totalSpend) * 100 : 0;

  // Calculate top 3 supplier concentration
  const sortedSuppliers = [...supplierValues].sort((a, b) => b - a);
  const top3Spend = sortedSuppliers.slice(0, 3).reduce((sum, v) => sum + v, 0);
  const top3Concentration = totalSpend > 0 ? (top3Spend / totalSpend) * 100 : 0;

  // Calculate tail spend (suppliers < 5% of total)
  const tailThreshold = totalSpend * 0.05;
  const tailSpend = supplierValues.filter(v => v < tailThreshold).reduce((sum, v) => sum + v, 0);
  const tailSpendPct = totalSpend > 0 ? (tailSpend / totalSpend) * 100 : 0;

  // Calculate average spend per supplier
  const avgSpendPerSupplier = supplierCount > 0 ? totalSpend / supplierCount : 0;

  // Region metrics
  const regionValues = Object.values(spendByRegion);
  const regionCount = Object.keys(spendByRegion).length;
  const topRegionSpend = regionValues.length > 0 ? Math.max(...regionValues) : 0;
  const regionConcentration = totalSpend > 0 ? (topRegionSpend / totalSpend) * 100 : 0;

  // Price variance (if price data provided)
  const priceVariancePct = priceData?.priceVariance || 0;

  // Log calculated metrics
  console.log(`[SpendData] Metrics calculated:
    - Suppliers: ${supplierCount}
    - Top supplier: ${supplierConcentration.toFixed(1)}%
    - Top 3: ${top3Concentration.toFixed(1)}%
    - Tail spend: ${tailSpendPct.toFixed(1)}%
    - Avg spend/supplier: $${avgSpendPerSupplier.toFixed(0)}
    - Regions: ${regionCount}
    - Top region: ${regionConcentration.toFixed(1)}%
    - Price variance: ${priceVariancePct.toFixed(1)}%`);

  return opportunities.map(opp => {
    const opportunityId = detectOpportunityId(opp.title, opp.strategyType);

    // Generate ALL proof points for this opportunity type with REAL values from spend data
    const proofPoints: ProofPointResult[] = [];

    if (opportunityId === "volume-bundling") {
      // PP_REGIONAL_SPEND - tested if we have region data
      const hasRegionData = regionCount > 0;
      proofPoints.push({
        id: "PP_REGIONAL_SPEND",
        name: "Regional Spend",
        value: hasRegionData ? regionConcentration : 0,
        impact: hasRegionData ? (regionConcentration > 80 ? "High" : regionConcentration >= 50 ? "Medium" : "Low") : "Not Tested",
        insight: hasRegionData ? `Regional concentration at ${regionConcentration.toFixed(1)}%` : "No region data in spend file",
        isTested: hasRegionData,
        threshold: { high: ">80%", medium: "50-80%", low: "<50%" },
      });

      // PP_TAIL_SPEND - tested if we have supplier data
      const hasSupplierData = supplierCount > 0;
      proofPoints.push({
        id: "PP_TAIL_SPEND",
        name: "Tail Spend",
        value: hasSupplierData ? tailSpendPct : 0,
        impact: hasSupplierData ? (tailSpendPct > 30 ? "High" : tailSpendPct >= 15 ? "Medium" : "Low") : "Not Tested",
        insight: hasSupplierData ? `Tail spend of ${tailSpendPct.toFixed(1)}%` : "No supplier data in spend file",
        isTested: hasSupplierData,
        threshold: { high: ">30%", medium: "15-30%", low: "<15%" },
      });

      // PP_VOLUME_LEVERAGE - tested if we have supplier data
      proofPoints.push({
        id: "PP_VOLUME_LEVERAGE",
        name: "Volume Leverage",
        value: hasSupplierData ? supplierCount : 0,
        impact: hasSupplierData ? (supplierCount > 10 ? "High" : supplierCount >= 5 ? "Medium" : "Low") : "Not Tested",
        insight: hasSupplierData ? `Spend across ${supplierCount} suppliers` : "No supplier data in spend file",
        isTested: hasSupplierData,
        threshold: { high: ">10 suppliers", medium: "5-10 suppliers", low: "<5 suppliers" },
      });

      // PP_PRICE_VARIANCE - tested if we have price data
      const hasPriceData = priceVariancePct > 0;
      proofPoints.push({
        id: "PP_PRICE_VARIANCE",
        name: "Price Variance",
        value: priceVariancePct,
        impact: hasPriceData ? (priceVariancePct > 25 ? "High" : priceVariancePct >= 10 ? "Medium" : "Low") : "Not Tested",
        insight: hasPriceData ? `Price variance of ${priceVariancePct.toFixed(1)}%` : "No price data in spend file",
        isTested: hasPriceData,
        threshold: { high: ">25%", medium: "10-25%", low: "<10%" },
      });

      // PP_AVG_SPEND_SUPPLIER - tested if we have supplier data
      proofPoints.push({
        id: "PP_AVG_SPEND_SUPPLIER",
        name: "Avg Spend/Supplier",
        value: avgSpendPerSupplier,
        impact: hasSupplierData ? (avgSpendPerSupplier < 100000 ? "High" : avgSpendPerSupplier < 500000 ? "Medium" : "Low") : "Not Tested",
        insight: hasSupplierData ? `Avg $${(avgSpendPerSupplier/1000).toFixed(0)}K per supplier` : "No supplier data in spend file",
        isTested: hasSupplierData,
        threshold: { high: "<$100K", medium: "$100K-$500K", low: ">$500K" },
      });

      // PP_MARKET_CONSOLIDATION (HHI) - tested if we have supplier data
      // HHI = sum of squared market shares
      let hhi = 0;
      if (hasSupplierData && totalSpend > 0) {
        supplierValues.forEach(spend => {
          const share = (spend / totalSpend) * 100;
          hhi += share * share;
        });
      }
      proofPoints.push({
        id: "PP_MARKET_CONSOLIDATION",
        name: "Market Consolidation",
        value: hhi,
        impact: hasSupplierData ? (hhi < 1500 ? "High" : hhi < 2500 ? "Medium" : "Low") : "Not Tested",
        insight: hasSupplierData ? `HHI index: ${hhi.toFixed(0)}` : "No supplier data to calculate HHI",
        isTested: hasSupplierData,
        threshold: { high: "HHI <1500", medium: "HHI 1500-2500", low: "HHI >2500" },
      });
    }

    if (opportunityId === "target-pricing") {
      const hasPriceData = priceVariancePct > 0;
      const hasSupplierData = supplierCount > 0;

      proofPoints.push({
        id: "PP_PRICE_VARIANCE",
        name: "Price Variance",
        value: priceVariancePct,
        impact: hasPriceData ? (priceVariancePct > 25 ? "High" : priceVariancePct >= 10 ? "Medium" : "Low") : "Not Tested",
        insight: hasPriceData ? `Price variance of ${priceVariancePct.toFixed(1)}%` : "No price data in spend file",
        isTested: hasPriceData,
        threshold: { high: ">25%", medium: "10-25%", low: "<10%" },
      });

      proofPoints.push({
        id: "PP_TARIFF_RATE",
        name: "Tariff Rate",
        value: 0,
        impact: "Not Tested",
        insight: "Tariff data requires import/export information",
        isTested: false,
        threshold: { high: ">15%", medium: "5-15%", low: "<5%" },
      });

      proofPoints.push({
        id: "PP_COST_STRUCTURE",
        name: "Cost Structure",
        value: 0,
        impact: "Not Tested",
        insight: "Cost breakdown data needed",
        isTested: false,
        threshold: { high: ">60%", medium: "40-60%", low: "<40%" },
      });

      proofPoints.push({
        id: "PP_UNIT_PRICE",
        name: "Unit Price",
        value: priceData?.avgPrice || 0,
        impact: hasPriceData ? "Medium" : "Not Tested",
        insight: hasPriceData ? `Avg unit price: $${(priceData?.avgPrice || 0).toFixed(2)}` : "No unit price data",
        isTested: hasPriceData,
        threshold: { high: ">15% above benchmark", medium: "5-15% above", low: "within 5%" },
      });
    }

    if (opportunityId === "risk-management") {
      const hasSupplierData = supplierCount > 0;
      const hasRegionData = regionCount > 0;

      proofPoints.push({
        id: "PP_SINGLE_SOURCING",
        name: "Single Sourcing",
        value: supplierConcentration,
        impact: hasSupplierData ? (supplierConcentration > 50 ? "High" : supplierConcentration >= 30 ? "Medium" : "Low") : "Not Tested",
        insight: hasSupplierData ? `Top supplier at ${supplierConcentration.toFixed(1)}%` : "No supplier data",
        isTested: hasSupplierData,
        threshold: { high: ">50%", medium: "30-50%", low: "<30%" },
      });

      proofPoints.push({
        id: "PP_SUPPLIER_CONCENTRATION",
        name: "Supplier Concentration",
        value: top3Concentration,
        impact: hasSupplierData ? (top3Concentration > 80 ? "High" : top3Concentration >= 50 ? "Medium" : "Low") : "Not Tested",
        insight: hasSupplierData ? `Top 3 suppliers: ${top3Concentration.toFixed(1)}%` : "No supplier data",
        isTested: hasSupplierData,
        threshold: { high: ">80%", medium: "50-80%", low: "<50%" },
      });

      proofPoints.push({
        id: "PP_CATEGORY_RISK",
        name: "Category Risk",
        value: 0,
        impact: "Not Tested",
        insight: "Risk assessment requires supplier risk ratings",
        isTested: false,
        threshold: { high: "High risk", medium: "Medium risk", low: "Low risk" },
      });

      proofPoints.push({
        id: "PP_SUPPLIER_RISK_RATING",
        name: "Supplier Risk Rating",
        value: 0,
        impact: "Not Tested",
        insight: "Upload supplier master with risk_rating column",
        isTested: false,
        threshold: { high: ">30%", medium: "10-30%", low: "<10%" },
      });

      proofPoints.push({
        id: "PP_GEO_POLITICAL",
        name: "Geo Political",
        value: regionConcentration,
        impact: hasRegionData ? (regionConcentration > 40 ? "High" : regionConcentration >= 20 ? "Medium" : "Low") : "Not Tested",
        insight: hasRegionData ? `Geographic concentration: ${regionConcentration.toFixed(1)}%` : "No region data",
        isTested: hasRegionData,
        threshold: { high: ">40%", medium: "20-40%", low: "<20%" },
      });

      proofPoints.push({
        id: "PP_EXCHANGE_RATE",
        name: "Exchange Rate",
        value: 0,
        impact: "Not Tested",
        insight: "Currency data needed for exchange rate analysis",
        isTested: false,
        threshold: { high: ">50% volatile", medium: "20-50%", low: "<20%" },
      });
    }

    if (opportunityId === "respec-pack") {
      const hasPriceData = priceVariancePct > 0;

      proofPoints.push({
        id: "PP_EXPORT_DATA",
        name: "Export Data",
        value: 0,
        impact: "Not Tested",
        insight: "Specification data needed",
        isTested: false,
        threshold: { high: ">20%", medium: "10-20%", low: "<10%" },
      });

      proofPoints.push({
        id: "PP_PRICE_VARIANCE",
        name: "Price Variance",
        value: priceVariancePct,
        impact: hasPriceData ? (priceVariancePct > 30 ? "High" : priceVariancePct >= 15 ? "Medium" : "Low") : "Not Tested",
        insight: hasPriceData ? `Price variance: ${priceVariancePct.toFixed(1)}%` : "No price data",
        isTested: hasPriceData,
        threshold: { high: ">30%", medium: "15-30%", low: "<15%" },
      });

      proofPoints.push({
        id: "PP_COST_STRUCTURE",
        name: "Cost Structure",
        value: 0,
        impact: "Not Tested",
        insight: "Cost breakdown data needed",
        isTested: false,
        threshold: { high: ">65%", medium: "45-65%", low: "<45%" },
      });
    }

    // Calculate savings with the proof points from spend data
    const savingsResult = calculateOpportunitySavings(
      opportunityId,
      proofPoints,
      totalSpend,
      maturityScore
    );

    const testedCount = proofPoints.filter(pp => pp.isTested).length;
    const adjustedConfidence = Math.round(savingsResult.confidenceScore * 100);

    console.log(`[SpendData] "${opp.title.substring(0, 30)}..." -> ${opportunityId}: ${testedCount}/${proofPoints.length} tested (${adjustedConfidence}%)`);

    return {
      ...opp,
      confidence: adjustedConfidence,
      status: savingsResult.confidenceBucket === "High" ? "Qualified" : "Potential",
      questionsToAnswer: savingsResult.confidenceBucket === "High" ? 2 : Math.max(2, 6 - Math.floor(adjustedConfidence / 20)),
      savings_low: savingsResult.savingsLow,
      savings_high: savingsResult.savingsHigh,
      impact: savingsResult.impactBucket,
    };
  });
}
