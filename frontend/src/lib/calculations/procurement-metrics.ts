/**
 * Procurement Metrics Calculation Service
 *
 * Implements the backend's calculation methodology for:
 * - HHI Index (Herfindahl-Hirschman Index)
 * - Tail Spend %
 * - Price Variance
 * - Supplier Concentration
 * - Risk Scoring
 * - Proof Point Evaluation with Thresholds
 * - 7-Step Savings Calculation with Maturity Adjustment
 *
 * Based on Beroe's Deep Dive Savings Calculation methodology.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface SpendRecord {
  supplier: string;
  spend: number;
  category?: string;
  country?: string;
  region?: string;
  price?: number;
  marketPrice?: number;  // Market benchmark price for comparison
  quantity?: number;
  riskRating?: number;
  qualityRating?: number;
}

export interface SupplierProfile {
  id: string;
  name: string;
  spend: number;
  spendPercentage: number;
  country?: string;
  region?: string;
  riskScore?: number;
  qualityRating?: number;
  isDiverse?: boolean;
  hasCertifications?: boolean;
}

export interface ContractInfo {
  id: string;
  supplierId: string;
  value: number;
  paymentTerms?: string;
  expiryDate?: Date;
  priceEscalationCap?: number;
  status: 'active' | 'expired' | 'pending';
}

export type ImpactFlag = 'High' | 'Medium' | 'Low' | 'Not Tested';

export interface ProofPointResult {
  id: string;
  name: string;
  value: number;
  impact: ImpactFlag;
  insight: string;
  isTested: boolean;
  threshold: {
    high: string;
    medium: string;
    low: string;
  };
}

export interface OpportunityMetrics {
  opportunityId: string;
  name: string;
  proofPoints: ProofPointResult[];
  impactScore: number;
  impactBucket: 'High' | 'Medium' | 'Low';
  savingsLow: number;
  savingsHigh: number;
  savingsEstimate: number;
  confidenceScore: number;
  confidenceBucket: 'High' | 'Medium' | 'Low';
  weightage: number;
}

export interface SavingsSummary {
  totalSavingsLow: number;
  totalSavingsHigh: number;
  confidenceScore: number;
  confidenceBucket: 'High' | 'Medium' | 'Low';
  addressableSpend: number;
  maturityScore: number;
  maturityAdjustedLow: number;
  maturityAdjustedHigh: number;
}

export interface ComputedMetrics {
  // Volume Bundling Metrics
  hhiIndex: number;
  top3Concentration: number;
  tailSpendPercentage: number;
  regionalConcentration: number;
  spotBuyPercentage: number;
  avgSpendPerSupplier: number;

  // Target Pricing Metrics
  priceVariance: number;
  contractCoverage: number;
  paymentTermAvg: number;
  priceEscalationExposure: number;

  // Risk Management Metrics
  supplierCount: number;
  singleSourceSpend: number;
  geoConcentrationRisk: number;
  avgSupplierQuality: number;
  highRiskSupplierSpend: number;
  contractsExpiring90Days: number;

  // Derived
  overallRiskScore: number;
}

// =============================================================================
// CONSTANTS (from backend proof_points.py and opportunity_orchestrator.py)
// =============================================================================

const SAVINGS_BENCHMARKS = {
  'volume-bundling': {
    High: 0.05,    // 5% for high impact
    Medium: 0.025, // 2.5% for medium impact
    Low: 0.01,     // 1% for low impact
  },
  'target-pricing': {
    High: 0.02,    // 2% for high impact
    Medium: 0.015, // 1.5% for medium impact
    Low: 0.01,     // 1% for low impact
  },
  'risk-management': {
    High: 0.03,    // 3% cost avoidance
    Medium: 0.02,  // 2% cost avoidance
    Low: 0.01,     // 1% cost avoidance
  },
  'respec-pack': {
    High: 0.03,    // 3% for high impact
    Medium: 0.025, // 2.5% for medium impact
    Low: 0.02,     // 2% for low impact
  },
};

const ADDRESSABLE_SPEND_PCT = {
  'volume-bundling': 0.80,   // 80% addressable
  'target-pricing': 0.80,    // 80% addressable
  'risk-management': 0.80,   // 80% addressable
  'respec-pack': 0.75,       // 75% addressable
};

/**
 * Impact Flag Multipliers from Excel methodology
 * Sheet: 3_Risk profile_v2, Column: Proof point impact flag
 * For calc.: High=0.875, Medium=0.625, Low=0.25
 */
const IMPACT_FLAG_MULTIPLIERS: Record<string, number> = {
  'High': 0.875,
  'Medium': 0.625,
  'Low': 0.25,
  'Not Tested': 0,
};

const IMPACT_BUCKETS = {
  High: { min: 7.0, max: 10.0 },
  Medium: { min: 4.0, max: 7.0 },
  Low: { min: 0.0, max: 4.0 },
};

const MATURITY_ADJUSTMENT: Record<number, number> = {
  1: 1.75,     // Score 1: highest potential
  2: 1.50,     // Score 2: high potential
  2.5: 1.375, // Score 2.5: from Excel example
  3: 1.25,     // Score 3: medium potential
  4: 1.0,      // Score 4: baseline (mature)
};

const CONFIDENCE_BUCKETS = {
  High: { minScore: 0.70, rangeFactor: 0.90 },
  Medium: { minScore: 0.40, rangeFactor: 0.75 },
  Low: { minScore: 0.0, rangeFactor: 0.60 },
};

// =============================================================================
// METRIC CALCULATIONS
// =============================================================================

/**
 * Calculate Herfindahl-Hirschman Index (HHI)
 * Formula: sum(spend_percentage^2) for all suppliers
 * Scale: 0-10000 (0 = perfect competition, 10000 = monopoly)
 */
export function calculateHHI(suppliers: SupplierProfile[]): number {
  if (suppliers.length === 0) return 0;

  const totalSpend = suppliers.reduce((sum, s) => sum + s.spend, 0);
  if (totalSpend === 0) return 0;

  const hhi = suppliers.reduce((sum, supplier) => {
    const marketShare = (supplier.spend / totalSpend) * 100;
    return sum + Math.pow(marketShare, 2);
  }, 0);

  return Math.round(hhi);
}

/**
 * Calculate Top 3 Supplier Concentration
 * Formula: sum of top 3 supplier percentages
 */
export function calculateTop3Concentration(suppliers: SupplierProfile[]): number {
  if (suppliers.length === 0) return 0;

  const totalSpend = suppliers.reduce((sum, s) => sum + s.spend, 0);
  if (totalSpend === 0) return 0;

  const sortedSuppliers = [...suppliers].sort((a, b) => b.spend - a.spend);
  const top3Spend = sortedSuppliers.slice(0, 3).reduce((sum, s) => sum + s.spend, 0);

  return Math.round((top3Spend / totalSpend) * 100 * 100) / 100;
}

/**
 * Calculate Tail Spend Percentage
 * Formula: (Bottom 20% Suppliers' Spend / Total Spend) × 100
 * Impact: HIGH (>30%), MEDIUM (15-30%), LOW (<15%)
 */
export function calculateTailSpend(suppliers: SupplierProfile[]): number {
  if (suppliers.length === 0) return 0;

  const totalSpend = suppliers.reduce((sum, s) => sum + s.spend, 0);
  if (totalSpend === 0) return 0;

  // Sort suppliers by spend (descending) and take bottom 20%
  const sortedSuppliers = [...suppliers].sort((a, b) => b.spend - a.spend);
  const bottom20PctCount = Math.max(1, Math.floor(suppliers.length * 0.2));
  const bottomSuppliers = sortedSuppliers.slice(-bottom20PctCount);
  const tailSpend = bottomSuppliers.reduce((sum, s) => sum + s.spend, 0);

  return Math.round((tailSpend / totalSpend) * 100 * 100) / 100;
}

/**
 * Calculate Regional Concentration
 * Formula: max regional spend percentage
 */
export function calculateRegionalConcentration(suppliers: SupplierProfile[]): number {
  if (suppliers.length === 0) return 0;

  const totalSpend = suppliers.reduce((sum, s) => sum + s.spend, 0);
  if (totalSpend === 0) return 0;

  const regionSpend: Record<string, number> = {};
  suppliers.forEach(s => {
    const region = s.region || s.country || 'Unknown';
    regionSpend[region] = (regionSpend[region] || 0) + s.spend;
  });

  const maxRegionSpend = Math.max(...Object.values(regionSpend));
  return Math.round((maxRegionSpend / totalSpend) * 100 * 100) / 100;
}

/**
 * Calculate Price Variance vs Market
 *
 * PRIMARY Formula (when market prices available):
 *   Monthly Deviation % = ((Supplier Price - Market Price) / Market Price) × 100
 *
 * FALLBACK Formula (no market prices - matches backend):
 *   Coefficient of Variation (CoV) = (Standard Deviation / Mean) × 100
 *
 * Thresholds (from methodology):
 *   HIGH: ≥3 months >+10% OR ≥5 months >+5% OR any >+20%
 *   MEDIUM: 1-2 months >+10%
 *   LOW: Majority ≤0% AND ≤1 month >+5%
 */
export function calculatePriceVariance(records: SpendRecord[]): number {
  if (records.length === 0) return 0;

  const validRecords = records.filter(r => r.price && r.price > 0);
  if (validRecords.length < 2) return 0;

  // Check if we have market prices
  const hasMarketPrices = validRecords.some(r => r.marketPrice && r.marketPrice > 0);

  if (hasMarketPrices) {
    // PRIMARY: Use actual market prices for comparison
    // Formula: ((Supplier Price - Market Price) / Market Price) × 100
    const deviations = validRecords
      .filter(r => r.marketPrice && r.marketPrice > 0)
      .map(r => ((r.price! - r.marketPrice!) / r.marketPrice!) * 100);

    if (deviations.length === 0) return 0;
    const avgDeviation = deviations.reduce((sum, d) => sum + d, 0) / deviations.length;
    return Math.round(avgDeviation * 100) / 100;
  } else {
    // FALLBACK: Use Coefficient of Variation (matches backend)
    // Formula: CoV = (std / mean) × 100
    const prices = validRecords.map(r => r.price!);
    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;

    if (mean === 0) return 0;

    // Calculate standard deviation
    const squaredDiffs = prices.map(p => Math.pow(p - mean, 2));
    const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / prices.length;
    const stdDev = Math.sqrt(variance);

    // CoV as percentage
    const cov = (stdDev / mean) * 100;

    return Math.round(cov * 100) / 100;
  }
}

/**
 * Calculate Average Spend per Supplier
 */
export function calculateAvgSpendPerSupplier(suppliers: SupplierProfile[]): number {
  if (suppliers.length === 0) return 0;

  const totalSpend = suppliers.reduce((sum, s) => sum + s.spend, 0);
  return Math.round(totalSpend / suppliers.length);
}

/**
 * Calculate Contract Coverage
 * Formula: contracted spend / total spend
 */
export function calculateContractCoverage(
  suppliers: SupplierProfile[],
  contracts: ContractInfo[]
): number {
  if (suppliers.length === 0) return 0;

  const totalSpend = suppliers.reduce((sum, s) => sum + s.spend, 0);
  if (totalSpend === 0) return 0;

  const contractedSupplierIds = new Set(
    contracts.filter(c => c.status === 'active').map(c => c.supplierId)
  );

  const contractedSpend = suppliers
    .filter(s => contractedSupplierIds.has(s.id))
    .reduce((sum, s) => sum + s.spend, 0);

  return Math.round((contractedSpend / totalSpend) * 100 * 100) / 100;
}

/**
 * Calculate Spot Buy Percentage (inverse of contract coverage)
 */
export function calculateSpotBuyPercentage(
  suppliers: SupplierProfile[],
  contracts: ContractInfo[]
): number {
  return 100 - calculateContractCoverage(suppliers, contracts);
}

/**
 * Calculate High Risk Supplier Spend
 * Formula: spend with suppliers risk > 70 / total spend
 */
export function calculateHighRiskSpend(suppliers: SupplierProfile[], riskThreshold = 70): number {
  if (suppliers.length === 0) return 0;

  const totalSpend = suppliers.reduce((sum, s) => sum + s.spend, 0);
  if (totalSpend === 0) return 0;

  const highRiskSpend = suppliers
    .filter(s => (s.riskScore || 0) > riskThreshold)
    .reduce((sum, s) => sum + s.spend, 0);

  return Math.round((highRiskSpend / totalSpend) * 100 * 100) / 100;
}

/**
 * Calculate Single Source Spend
 * Formula: spend with only one supplier per category
 */
export function calculateSingleSourceSpend(suppliers: SupplierProfile[]): number {
  if (suppliers.length === 0) return 0;

  const totalSpend = suppliers.reduce((sum, s) => sum + s.spend, 0);
  if (totalSpend === 0) return 0;

  // Find top supplier percentage
  const sortedSuppliers = [...suppliers].sort((a, b) => b.spend - a.spend);
  const topSupplierPct = (sortedSuppliers[0]?.spend || 0) / totalSpend * 100;

  // If top supplier > 50%, consider it single source risk
  return topSupplierPct > 50 ? Math.round(topSupplierPct * 100) / 100 : 0;
}

/**
 * Calculate Overall Risk Score
 * Formula: Weighted average of risk factors
 */
export function calculateOverallRiskScore(metrics: Partial<ComputedMetrics>): number {
  const weights = {
    singleSourceSpend: 0.20,
    geoConcentrationRisk: 0.15,
    top3Concentration: 0.15,
    highRiskSupplierSpend: 0.15,
    priceVariance: 0.10,
    spotBuyPercentage: 0.10,
    tailSpendPercentage: 0.05,
    hhiIndex: 0.10,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  // Single source risk
  if (metrics.singleSourceSpend !== undefined) {
    weightedSum += Math.min(metrics.singleSourceSpend, 100) * weights.singleSourceSpend;
    totalWeight += weights.singleSourceSpend;
  }

  // Geo concentration (high concentration = high risk)
  if (metrics.geoConcentrationRisk !== undefined) {
    weightedSum += Math.min(metrics.geoConcentrationRisk, 100) * weights.geoConcentrationRisk;
    totalWeight += weights.geoConcentrationRisk;
  }

  // Top 3 concentration (>80% = high risk)
  if (metrics.top3Concentration !== undefined) {
    const concentrationRisk = metrics.top3Concentration > 80 ? 80 :
      metrics.top3Concentration > 50 ? 50 : 20;
    weightedSum += concentrationRisk * weights.top3Concentration;
    totalWeight += weights.top3Concentration;
  }

  // High risk supplier spend
  if (metrics.highRiskSupplierSpend !== undefined) {
    weightedSum += Math.min(metrics.highRiskSupplierSpend, 100) * weights.highRiskSupplierSpend;
    totalWeight += weights.highRiskSupplierSpend;
  }

  // Price variance (high variance = some risk)
  if (metrics.priceVariance !== undefined) {
    weightedSum += Math.min(metrics.priceVariance / 2, 50) * weights.priceVariance;
    totalWeight += weights.priceVariance;
  }

  // Spot buy (high spot = higher risk)
  if (metrics.spotBuyPercentage !== undefined) {
    weightedSum += Math.min(metrics.spotBuyPercentage, 100) * weights.spotBuyPercentage;
    totalWeight += weights.spotBuyPercentage;
  }

  // Tail spend (high tail = some risk)
  if (metrics.tailSpendPercentage !== undefined) {
    weightedSum += Math.min(metrics.tailSpendPercentage, 100) * weights.tailSpendPercentage;
    totalWeight += weights.tailSpendPercentage;
  }

  // HHI (normalize from 0-10000 to 0-100)
  if (metrics.hhiIndex !== undefined) {
    const normalizedHHI = Math.min(metrics.hhiIndex / 100, 100);
    weightedSum += normalizedHHI * weights.hhiIndex;
    totalWeight += weights.hhiIndex;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight * 100) / 100 : 50;
}

// =============================================================================
// PROOF POINT EVALUATION
// =============================================================================

/**
 * Evaluate a proof point and assign impact flag based on thresholds
 * @param isValidated - Whether the proof point is actually validated by the user's data
 */
export function evaluateProofPoint(
  proofPointId: string,
  value: number,
  opportunityId: string,
  isValidated: boolean = true
): ProofPointResult {
  const thresholds = PROOF_POINT_THRESHOLDS[proofPointId];

  if (!thresholds) {
    return {
      id: proofPointId,
      name: proofPointId,
      value,
      impact: 'Not Tested',
      insight: 'No threshold defined for this proof point',
      isTested: false,
      threshold: { high: 'N/A', medium: 'N/A', low: 'N/A' },
    };
  }

  const context = thresholds.contexts[opportunityId] || thresholds.contexts['default'];
  if (!context) {
    return {
      id: proofPointId,
      name: thresholds.name,
      value,
      impact: 'Not Tested',
      insight: 'No context defined for this opportunity',
      isTested: false,
      threshold: { high: 'N/A', medium: 'N/A', low: 'N/A' },
    };
  }

  let impact: ImpactFlag;
  let insight: string;

  if (context.evaluate(value, 'high')) {
    impact = 'High';
    insight = context.highInsight.replace('{value}', value.toFixed(1));
  } else if (context.evaluate(value, 'medium')) {
    impact = 'Medium';
    insight = context.mediumInsight.replace('{value}', value.toFixed(1));
  } else {
    impact = 'Low';
    insight = context.lowInsight.replace('{value}', value.toFixed(1));
  }

  return {
    id: proofPointId,
    name: thresholds.name,
    value,
    impact,
    insight,
    isTested: isValidated, // Use actual validation status for confidence calculation
    threshold: {
      high: context.highThreshold,
      medium: context.mediumThreshold,
      low: context.lowThreshold,
    },
  };
}

// Proof Point Thresholds from backend proof_points.py
const PROOF_POINT_THRESHOLDS: Record<string, {
  name: string;
  contexts: Record<string, {
    highThreshold: string;
    mediumThreshold: string;
    lowThreshold: string;
    highInsight: string;
    mediumInsight: string;
    lowInsight: string;
    evaluate: (value: number, level: 'high' | 'medium' | 'low') => boolean;
  }>;
}> = {
  // Volume Bundling
  'PP_REGIONAL_SPEND': {
    name: 'Regional Spend',
    contexts: {
      'volume-bundling': {
        highThreshold: 'Top 3 regions >80% of spend',
        mediumThreshold: 'Top 3 regions 50-80% of spend',
        lowThreshold: 'Top 3 regions <50% of spend',
        highInsight: 'Regional concentration at {value}% enables cross-site volume consolidation',
        mediumInsight: 'Moderate regional concentration at {value}% - some bundling opportunity',
        lowInsight: 'Low regional concentration at {value}% - limited bundling potential',
        evaluate: (v, level) => level === 'high' ? v > 80 : level === 'medium' ? v >= 50 : v < 50,
      },
    },
  },
  'PP_TAIL_SPEND': {
    name: 'Tail Spend',
    contexts: {
      'volume-bundling': {
        highThreshold: 'Tail spend >30%',
        mediumThreshold: 'Tail spend 15-30%',
        lowThreshold: 'Tail spend <15%',
        highInsight: 'Tail spend of {value}% presents significant consolidation opportunity',
        mediumInsight: 'Moderate tail spend at {value}% - some consolidation possible',
        lowInsight: 'Already consolidated with only {value}% tail spend',
        evaluate: (v, level) => level === 'high' ? v > 30 : level === 'medium' ? v >= 15 : v < 15,
      },
    },
  },
  'PP_VOLUME_LEVERAGE': {
    name: 'Volume Leverage',
    contexts: {
      'volume-bundling': {
        highThreshold: '>10 suppliers, no single supplier >20%',
        mediumThreshold: '5-10 suppliers, top supplier 20-40%',
        lowThreshold: '<5 suppliers (already leveraged)',
        highInsight: 'Spend fragmented across {value} suppliers - bundling opportunity',
        mediumInsight: 'Moderate fragmentation across {value} suppliers',
        lowInsight: 'Already consolidated with {value} suppliers',
        evaluate: (v, level) => level === 'high' ? v > 10 : level === 'medium' ? v >= 5 : v < 5,
      },
    },
  },
  'PP_PRICE_VARIANCE': {
    name: 'Price Variance',
    contexts: {
      'volume-bundling': {
        highThreshold: 'Price variance >25%',
        mediumThreshold: 'Price variance 10-25%',
        lowThreshold: 'Price variance <10%',
        highInsight: 'Price variance of {value}% enables volume-based price harmonization',
        mediumInsight: 'Moderate price variance at {value}%',
        lowInsight: 'Prices already standardized with {value}% variance',
        evaluate: (v, level) => level === 'high' ? v > 25 : level === 'medium' ? v >= 10 : v < 10,
      },
      'target-pricing': {
        highThreshold: 'Price variance >25%',
        mediumThreshold: 'Price variance 10-25%',
        lowThreshold: 'Price variance <10%',
        highInsight: 'Best-in-class price is {value}% below average - use as negotiation target',
        mediumInsight: 'Moderate price variance at {value}% - some negotiation opportunity',
        lowInsight: 'Limited target pricing opportunity with {value}% variance',
        evaluate: (v, level) => level === 'high' ? v > 25 : level === 'medium' ? v >= 10 : v < 10,
      },
      'respec-pack': {
        highThreshold: 'Price variance >30%',
        mediumThreshold: 'Price variance 15-30%',
        lowThreshold: 'Price variance <15%',
        highInsight: 'Price variance of {value}% indicates spec standardization opportunity',
        mediumInsight: 'Moderate variance at {value}% - some spec optimization possible',
        lowInsight: 'Specs already standardized with {value}% variance',
        evaluate: (v, level) => level === 'high' ? v > 30 : level === 'medium' ? v >= 15 : v < 15,
      },
    },
  },
  'PP_AVG_SPEND_SUPPLIER': {
    name: 'Avg Spend/Supplier',
    contexts: {
      'volume-bundling': {
        highThreshold: 'Avg spend per supplier <$100K',
        mediumThreshold: 'Avg spend $100K-$500K',
        lowThreshold: 'Avg spend >$500K',
        highInsight: 'Average spend of ${value}K per supplier is below benchmark - consolidation recommended',
        mediumInsight: 'Average spend of ${value}K per supplier - moderate consolidation potential',
        lowInsight: 'Average spend of ${value}K per supplier - already consolidated',
        evaluate: (v, level) => level === 'high' ? v < 100000 : level === 'medium' ? v < 500000 : v >= 500000,
      },
    },
  },
  'PP_MARKET_CONSOLIDATION': {
    name: 'Market Consolidation',
    contexts: {
      'volume-bundling': {
        highThreshold: 'HHI <1500 (competitive market)',
        mediumThreshold: 'HHI 1500-2500 (moderately concentrated)',
        lowThreshold: 'HHI >2500 (highly concentrated)',
        highInsight: 'HHI of {value} indicates competitive market - good for bundling',
        mediumInsight: 'HHI of {value} indicates moderately concentrated market',
        lowInsight: 'HHI of {value} indicates concentrated market - limited leverage',
        evaluate: (v, level) => level === 'high' ? v < 1500 : level === 'medium' ? v < 2500 : v >= 2500,
      },
    },
  },
  'PP_SUPPLIER_LOCATION': {
    name: 'Supplier Location',
    contexts: {
      'volume-bundling': {
        highThreshold: '>70% suppliers in same region',
        mediumThreshold: '50-70% in same region',
        lowThreshold: '<50% in same region',
        highInsight: '{value}% of suppliers in same region enables logistics bundling',
        mediumInsight: '{value}% regional concentration - moderate bundling potential',
        lowInsight: 'Geographically dispersed suppliers at {value}%',
        evaluate: (v, level) => level === 'high' ? v > 70 : level === 'medium' ? v >= 50 : v < 50,
      },
    },
  },
  'PP_SUPPLIER_RISK_RATING': {
    name: 'Supplier Risk Rating',
    contexts: {
      'volume-bundling': {
        highThreshold: 'Top suppliers have low risk ratings',
        mediumThreshold: 'Mixed risk ratings among top suppliers',
        lowThreshold: 'High risk among top suppliers',
        highInsight: 'Top suppliers have {value}% low risk - safe for consolidation',
        mediumInsight: 'Mixed risk profile at {value}% - exercise caution',
        lowInsight: 'High risk at {value}% - bundling risky',
        evaluate: (v, level) => level === 'high' ? v < 30 : level === 'medium' ? v < 60 : v >= 60,
      },
      'risk-management': {
        highThreshold: '>30% spend with high-risk suppliers',
        mediumThreshold: '10-30% with high-risk suppliers',
        lowThreshold: '<10% with high-risk suppliers',
        highInsight: '{value}% of spend is with high-risk suppliers - mitigation needed',
        mediumInsight: 'Moderate high-risk exposure at {value}%',
        lowInsight: 'Low risk exposure at {value}%',
        evaluate: (v, level) => level === 'high' ? v > 30 : level === 'medium' ? v >= 10 : v < 10,
      },
    },
  },
  // Target Pricing
  'PP_TARIFF_RATE': {
    name: 'Tariff Rate',
    contexts: {
      'target-pricing': {
        highThreshold: 'Tariff differential >15%',
        mediumThreshold: 'Tariff differential 5-15%',
        lowThreshold: 'Tariff differential <5%',
        highInsight: 'Tariff differential of {value}% - optimize sourcing mix',
        mediumInsight: 'Moderate tariff impact at {value}%',
        lowInsight: 'Low tariff impact at {value}%',
        evaluate: (v, level) => level === 'high' ? v > 15 : level === 'medium' ? v >= 5 : v < 5,
      },
    },
  },
  'PP_COST_STRUCTURE': {
    name: 'Cost Structure',
    contexts: {
      'target-pricing': {
        highThreshold: 'Raw material >60% of cost',
        mediumThreshold: 'Raw material 40-60%',
        lowThreshold: 'Raw material <40%',
        highInsight: 'Commodity-driven cost at {value}% - index pricing possible',
        mediumInsight: 'Mixed cost structure at {value}% raw material',
        lowInsight: 'Value-added cost structure at {value}% - harder to benchmark',
        evaluate: (v, level) => level === 'high' ? v > 60 : level === 'medium' ? v >= 40 : v < 40,
      },
      'respec-pack': {
        highThreshold: 'Raw material >65%',
        mediumThreshold: 'Raw material 45-65%',
        lowThreshold: 'Raw material <45%',
        highInsight: 'Material-driven at {value}% - significant spec optimization opportunity',
        mediumInsight: 'Moderate material cost at {value}%',
        lowInsight: 'Process-driven at {value}% - harder to optimize via specs',
        evaluate: (v, level) => level === 'high' ? v > 65 : level === 'medium' ? v >= 45 : v < 45,
      },
    },
  },
  'PP_UNIT_PRICE': {
    name: 'Unit Price',
    contexts: {
      'target-pricing': {
        highThreshold: 'Unit prices >15% above benchmark',
        mediumThreshold: 'Unit prices 5-15% above benchmark',
        lowThreshold: 'Unit prices within 5% of benchmark',
        highInsight: 'Unit price {value}% above benchmark - negotiation opportunity',
        mediumInsight: 'Unit price {value}% above benchmark',
        lowInsight: 'Unit price within {value}% of benchmark - already optimized',
        evaluate: (v, level) => level === 'high' ? v > 15 : level === 'medium' ? v >= 5 : v < 5,
      },
    },
  },
  // Risk Management
  'PP_SINGLE_SOURCING': {
    name: 'Single Sourcing',
    contexts: {
      'risk-management': {
        highThreshold: 'Any supplier >50% of spend',
        mediumThreshold: 'Top supplier 30-50%',
        lowThreshold: 'No supplier >30%',
        highInsight: 'Single supplier at {value}% - critical dependency risk',
        mediumInsight: 'Moderate dependency at {value}%',
        lowInsight: 'Diversified at {value}% - low dependency risk',
        evaluate: (v, level) => level === 'high' ? v > 50 : level === 'medium' ? v >= 30 : v < 30,
      },
    },
  },
  'PP_SUPPLIER_CONCENTRATION': {
    name: 'Supplier Concentration',
    contexts: {
      'risk-management': {
        highThreshold: 'Top 3 suppliers >80% of spend',
        mediumThreshold: 'Top 3 suppliers 50-80%',
        lowThreshold: 'Top 3 suppliers <50%',
        highInsight: 'Top 3 suppliers control {value}% - high concentration risk',
        mediumInsight: 'Moderate concentration at {value}%',
        lowInsight: 'Diversified supply base at {value}%',
        evaluate: (v, level) => level === 'high' ? v > 80 : level === 'medium' ? v >= 50 : v < 50,
      },
    },
  },
  'PP_CATEGORY_RISK': {
    name: 'Category Risk',
    contexts: {
      'risk-management': {
        highThreshold: 'High risk category (volatile, scarce)',
        mediumThreshold: 'Medium risk category',
        lowThreshold: 'Low risk category (stable, abundant)',
        highInsight: 'Category risk at {value}% - proactive mitigation needed',
        mediumInsight: 'Moderate category risk at {value}%',
        lowInsight: 'Low category risk at {value}%',
        evaluate: (v, level) => level === 'high' ? v > 70 : level === 'medium' ? v >= 40 : v < 40,
      },
    },
  },
  'PP_INFLATION': {
    name: 'Inflation',
    contexts: {
      'risk-management': {
        highThreshold: 'Inflation >8% in sourcing regions',
        mediumThreshold: 'Inflation 4-8%',
        lowThreshold: 'Inflation <4%',
        highInsight: 'Inflation at {value}% impacts cost predictability',
        mediumInsight: 'Moderate inflation at {value}%',
        lowInsight: 'Low inflation at {value}%',
        evaluate: (v, level) => level === 'high' ? v > 8 : level === 'medium' ? v >= 4 : v < 4,
      },
    },
  },
  'PP_EXCHANGE_RATE': {
    name: 'Exchange Rate',
    contexts: {
      'risk-management': {
        highThreshold: '>50% spend in volatile currencies',
        mediumThreshold: '20-50% in volatile currencies',
        lowThreshold: '<20% in volatile currencies',
        highInsight: '{value}% exposed to currency risk',
        mediumInsight: 'Moderate currency exposure at {value}%',
        lowInsight: 'Low currency exposure at {value}%',
        evaluate: (v, level) => level === 'high' ? v > 50 : level === 'medium' ? v >= 20 : v < 20,
      },
    },
  },
  'PP_GEO_POLITICAL': {
    name: 'Geo Political',
    contexts: {
      'risk-management': {
        highThreshold: '>40% from high-risk regions',
        mediumThreshold: '20-40% from high-risk regions',
        lowThreshold: '<20% from high-risk regions',
        highInsight: '{value}% from geopolitically sensitive regions - high risk',
        mediumInsight: 'Moderate geo-political exposure at {value}%',
        lowInsight: 'Low geo-political exposure at {value}%',
        evaluate: (v, level) => level === 'high' ? v > 40 : level === 'medium' ? v >= 20 : v < 20,
      },
    },
  },
  // Re-specification Pack
  'PP_EXPORT_DATA': {
    name: 'Export Data',
    contexts: {
      'respec-pack': {
        highThreshold: 'Current specs >20% more expensive than export standards',
        mediumThreshold: 'Current specs 10-20% more expensive',
        lowThreshold: 'Current specs within 10% of export standards',
        highInsight: 'Export-standard packaging is {value}% cheaper - adoption opportunity',
        mediumInsight: 'Moderate spec difference at {value}%',
        lowInsight: 'Specs already aligned with export standards at {value}%',
        evaluate: (v, level) => level === 'high' ? v > 20 : level === 'medium' ? v >= 10 : v < 10,
      },
    },
  },
};

// =============================================================================
// 7-STEP SAVINGS CALCULATION
// =============================================================================

/**
 * Calculate savings for an opportunity using the 7-step methodology
 * Based on Beroe Excel Deep Dive Savings Calculation
 */
export function calculateOpportunitySavings(
  opportunityId: string,
  proofPoints: ProofPointResult[],
  totalSpend: number,
  maturityScore: number = 2.5
): {
  savingsLow: number;
  savingsHigh: number;
  savingsEstimate: number;
  impactScore: number;
  impactBucket: 'High' | 'Medium' | 'Low';
  confidenceScore: number;
  confidenceBucket: 'High' | 'Medium' | 'Low';
  weightage: number;
} {
  // Step 1: Get addressable spend
  const addressablePct = ADDRESSABLE_SPEND_PCT[opportunityId as keyof typeof ADDRESSABLE_SPEND_PCT] || 0.80;
  const addressableSpend = totalSpend * addressablePct;

  // Step 2: Count proof points by impact flag
  const lowCount = proofPoints.filter(pp => pp.impact === 'Low' && pp.isTested).length;
  const mediumCount = proofPoints.filter(pp => pp.impact === 'Medium' && pp.isTested).length;
  const highCount = proofPoints.filter(pp => pp.impact === 'High' && pp.isTested).length;
  const totalTested = lowCount + mediumCount + highCount;

  // Step 3: Calculate Initiative Impact Score (out of 10)
  // Using impact flag multipliers: Low=0.25, Medium=0.625, High=0.875
  const L_MULT = IMPACT_FLAG_MULTIPLIERS['Low'];
  const M_MULT = IMPACT_FLAG_MULTIPLIERS['Medium'];
  const H_MULT = IMPACT_FLAG_MULTIPLIERS['High'];

  let impactScore: number;
  if (totalTested > 0) {
    const rawScore = (lowCount * L_MULT + mediumCount * M_MULT + highCount * H_MULT);
    impactScore = (rawScore / (totalTested * H_MULT)) * 10;
  } else {
    impactScore = 5.0; // Default to medium
  }

  // Step 4: Determine Impact Bucket
  let impactBucket: 'High' | 'Medium' | 'Low';
  let bucketFactor: number;

  if (impactScore >= IMPACT_BUCKETS.High.min) {
    impactBucket = 'High';
    bucketFactor = H_MULT;
  } else if (impactScore >= IMPACT_BUCKETS.Medium.min) {
    impactBucket = 'Medium';
    bucketFactor = M_MULT;
  } else {
    impactBucket = 'Low';
    bucketFactor = L_MULT;
  }

  // Step 5: Get benchmark range
  const benchmarks = SAVINGS_BENCHMARKS[opportunityId as keyof typeof SAVINGS_BENCHMARKS] || {
    High: 0.05,
    Medium: 0.025,
    Low: 0.01,
  };
  const savingsLowPct = benchmarks.Low;
  const savingsHighPct = benchmarks.High;

  // Step 6: Calculate intermediate savings percentage
  const intermediatePct = savingsLowPct + (savingsHighPct - savingsLowPct) * bucketFactor;

  // Step 7: Apply maturity adjustment
  const maturityMultiplier = getMaturityMultiplier(maturityScore);
  const maturityAdjPct = intermediatePct * maturityMultiplier;

  // Step 8: Calculate confidence score using weighted impact multipliers
  // Formula: (0.25*L + 0.625*M + 0.875*H) / (totalCount * 0.875)
  // This weights confidence by proof point quality — High impact validated PPs
  // contribute more to confidence than Low impact ones
  const totalCount = proofPoints.length;
  const weightedTestedScore = lowCount * L_MULT + mediumCount * M_MULT + highCount * H_MULT;
  const maxPossibleScore = totalCount * H_MULT; // Best case: all proof points are High & tested
  const confidenceScore = maxPossibleScore > 0 ? weightedTestedScore / maxPossibleScore : 0;

  let confidenceBucket: 'High' | 'Medium' | 'Low';
  let rangeFactor: number;

  if (confidenceScore >= CONFIDENCE_BUCKETS.High.minScore) {
    confidenceBucket = 'High';
    rangeFactor = CONFIDENCE_BUCKETS.High.rangeFactor;
  } else if (confidenceScore >= CONFIDENCE_BUCKETS.Medium.minScore) {
    confidenceBucket = 'Medium';
    rangeFactor = CONFIDENCE_BUCKETS.Medium.rangeFactor;
  } else {
    confidenceBucket = 'Low';
    rangeFactor = CONFIDENCE_BUCKETS.Low.rangeFactor;
  }

  // Step 9: Apply confidence adjustment
  const finalSavingsPctLow = maturityAdjPct * rangeFactor;
  const finalSavingsPctHigh = maturityAdjPct * (2 - rangeFactor);
  const finalSavingsPct = (finalSavingsPctLow + finalSavingsPctHigh) / 2;

  // Ensure reasonable bounds (0.5% - 12%)
  const boundedSavingsPct = Math.max(0.005, Math.min(0.12, finalSavingsPct));

  // Step 10: Calculate estimated savings
  const savingsLow = addressableSpend * finalSavingsPctLow;
  const savingsHigh = addressableSpend * finalSavingsPctHigh;
  const savingsEstimate = addressableSpend * boundedSavingsPct;

  // Calculate weightage (intermediate / total)
  const weightage = intermediatePct;

  return {
    savingsLow: Math.round(savingsLow),
    savingsHigh: Math.round(savingsHigh),
    savingsEstimate: Math.round(savingsEstimate),
    impactScore: Math.round(impactScore * 10) / 10,
    impactBucket,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    confidenceBucket,
    weightage: Math.round(weightage * 10000) / 10000,
  };
}

/**
 * Get maturity multiplier based on score (1-4 scale)
 */
function getMaturityMultiplier(maturityScore: number): number {
  if (maturityScore <= 1) return MATURITY_ADJUSTMENT[1];
  if (maturityScore >= 4) return MATURITY_ADJUSTMENT[4];

  // Linear interpolation
  const lower = Math.floor(maturityScore);
  const upper = Math.ceil(maturityScore);
  const fraction = maturityScore - lower;

  const lowerMult = MATURITY_ADJUSTMENT[lower] || 1.25;
  const upperMult = MATURITY_ADJUSTMENT[upper] || 1.0;

  return lowerMult + (upperMult - lowerMult) * fraction;
}

/**
 * Calculate total savings summary across all opportunities
 */
export function calculateSavingsSummary(
  opportunities: OpportunityMetrics[],
  totalSpend: number,
  maturityScore: number = 2.5
): SavingsSummary {
  const addressablePct = 0.80; // Default 80% addressable
  const addressableSpend = totalSpend * addressablePct;

  const totalSavingsLow = opportunities.reduce((sum, opp) => sum + opp.savingsLow, 0);
  const totalSavingsHigh = opportunities.reduce((sum, opp) => sum + opp.savingsHigh, 0);

  // Calculate overall confidence
  const testedProofPoints = opportunities.reduce(
    (sum, opp) => sum + opp.proofPoints.filter(pp => pp.isTested).length,
    0
  );
  const totalProofPoints = opportunities.reduce(
    (sum, opp) => sum + opp.proofPoints.length,
    0
  );
  const confidenceScore = totalProofPoints > 0 ? testedProofPoints / totalProofPoints : 0;

  let confidenceBucket: 'High' | 'Medium' | 'Low';
  if (confidenceScore >= 0.70) {
    confidenceBucket = 'High';
  } else if (confidenceScore >= 0.40) {
    confidenceBucket = 'Medium';
  } else {
    confidenceBucket = 'Low';
  }

  // Apply maturity adjustment to totals
  const maturityMultiplier = getMaturityMultiplier(maturityScore);
  const maturityAdjustedLow = totalSavingsLow * maturityMultiplier;
  const maturityAdjustedHigh = totalSavingsHigh * maturityMultiplier;

  return {
    totalSavingsLow: Math.round(totalSavingsLow),
    totalSavingsHigh: Math.round(totalSavingsHigh),
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    confidenceBucket,
    addressableSpend: Math.round(addressableSpend),
    maturityScore,
    maturityAdjustedLow: Math.round(maturityAdjustedLow),
    maturityAdjustedHigh: Math.round(maturityAdjustedHigh),
  };
}

// =============================================================================
// MAIN COMPUTATION FUNCTION
// =============================================================================

/**
 * Compute all metrics from spend data
 */
export function computeAllMetrics(
  suppliers: SupplierProfile[],
  contracts: ContractInfo[] = [],
  spendRecords: SpendRecord[] = []
): ComputedMetrics {
  const hhiIndex = calculateHHI(suppliers);
  const top3Concentration = calculateTop3Concentration(suppliers);
  const tailSpendPercentage = calculateTailSpend(suppliers);
  const regionalConcentration = calculateRegionalConcentration(suppliers);
  const spotBuyPercentage = calculateSpotBuyPercentage(suppliers, contracts);
  const avgSpendPerSupplier = calculateAvgSpendPerSupplier(suppliers);
  const priceVariance = calculatePriceVariance(spendRecords);
  const contractCoverage = calculateContractCoverage(suppliers, contracts);
  const highRiskSupplierSpend = calculateHighRiskSpend(suppliers);
  const singleSourceSpend = calculateSingleSourceSpend(suppliers);

  const metrics: ComputedMetrics = {
    hhiIndex,
    top3Concentration,
    tailSpendPercentage,
    regionalConcentration,
    spotBuyPercentage,
    avgSpendPerSupplier,
    priceVariance,
    contractCoverage,
    paymentTermAvg: 30, // Default
    priceEscalationExposure: 0,
    supplierCount: suppliers.length,
    singleSourceSpend,
    geoConcentrationRisk: regionalConcentration,
    avgSupplierQuality: 3.5, // Default
    highRiskSupplierSpend,
    contractsExpiring90Days: contracts.filter(c => {
      if (!c.expiryDate) return false;
      const daysToExpiry = Math.floor((c.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysToExpiry > 0 && daysToExpiry <= 90;
    }).length,
    overallRiskScore: 0,
  };

  metrics.overallRiskScore = calculateOverallRiskScore(metrics);

  return metrics;
}

// =============================================================================
// RISK & ESG IMPACT CALCULATION
// Based on Overall methodology_Dec25.xlsx - 3_Risk profile_v2 sheet
// =============================================================================

/**
 * Risk Impact Configuration per Opportunity Type
 * Based on Overall methodology_Dec25.xlsx Risk Profile Sheet
 *
 * Risk themes and their weightages:
 * - Supplier Concentration Risk: 15%
 * - Supplier Financial Risk: 35%
 * - Supplier Geopolitical Risk: 25%
 * - Price Volatility Risk: 25%
 */
export interface RiskImpact {
  score: number;           // 0-10 scale (higher = more risk)
  normalizedScore: number; // 0-100 scale for display
  riskLevel: 'High' | 'Medium' | 'Low';
  label: string;           // Display label
  description: string;     // Explanation of risk impact
  breakdown: {
    concentrationRisk: { score: number; weighted: number; proofPoints: RiskProofPointResult[] };
    financialRisk: { score: number; weighted: number; proofPoints: RiskProofPointResult[] };
    geopoliticalRisk: { score: number; weighted: number; proofPoints: RiskProofPointResult[] };
    priceVolatilityRisk: { score: number; weighted: number; proofPoints: RiskProofPointResult[] };
  };
}

export interface RiskProofPointResult {
  id: string;
  name: string;
  weight: number;
  impactFlag: 'High' | 'Medium' | 'Low' | 'Not Tested';
  impactMultiplier: number;  // High=0.875, Medium=0.625, Low=0.25
  rawScore: number;          // 1-4 maturity score
  normalizedScore: number;   // Converted to 10-point scale
  weightedScore: number;     // Final contribution to risk theme
  riskType: 'Cost' | 'Volume' | 'Both';
}

export interface ESGImpact {
  score: number;           // 0-10 scale (higher = better ESG)
  normalizedScore: number; // 0-100 scale for display
  esgLevel: 'High' | 'Medium' | 'Low';
  label: string;           // Display label like "0", "+1"
  description: string;     // Explanation of ESG impact
  breakdown: {
    environmental: number;
    social: number;
    governance: number;
  };
}

/**
 * Risk Theme Weightages from Excel methodology
 * Sheet: 3_Risk profile_v2, Column: Risk theme Weightage (%)
 */
const RISK_THEME_WEIGHTAGES = {
  priceVolatilityRisk: 0.25,      // 25%
  concentrationRisk: 0.15,        // 15%
  financialRisk: 0.35,            // 35%
  geopoliticalRisk: 0.25,         // 25%
};

// IMPACT_FLAG_MULTIPLIERS moved to top of file (constants section)

/**
 * Risk Proof Points Configuration from Excel
 * Sheet: 3_Risk profile_v2
 *
 * Each proof point has:
 * - weight: Proof point weightage within its risk theme
 * - impactFlag: Default impact flag (High/Medium/Low)
 * - riskType: Whether it affects Cost (Price), Volume (Resilience), or Both
 */
const RISK_PROOF_POINTS: Record<string, {
  name: string;
  riskTheme: 'priceVolatilityRisk' | 'concentrationRisk' | 'financialRisk' | 'geopoliticalRisk';
  weight: number;
  defaultImpactFlag: 'High' | 'Medium' | 'Low';
  riskType: 'Cost' | 'Volume' | 'Both';
  hypothesis: string;
  thresholds: {
    high: string;  // Low maturity (1) = High risk
    medium: string;
    low: string;   // High maturity (4) = Low risk
  };
}> = {
  // ===== PRICE VOLATILITY RISK (25%) =====
  'price_variance': {
    name: 'Price Variance for Identical Items/SKUs',
    riskTheme: 'priceVolatilityRisk',
    weight: 0.15,
    defaultImpactFlag: 'High',
    riskType: 'Cost',
    hypothesis: 'Wide like-for-like price dispersion across geographies signals structural frictions',
    thresholds: {
      high: '>25% price variance',
      medium: '10-25% price variance',
      low: '<10% price variance',
    },
  },
  'net_supply': {
    name: 'Net Supply',
    riskTheme: 'priceVolatilityRisk',
    weight: 0.10,
    defaultImpactFlag: 'High',
    riskType: 'Both',
    hypothesis: 'Tight net supply raises clearing prices. Worsening balances should precede price increases',
    thresholds: {
      high: 'Supply shortage expected',
      medium: 'Balanced supply',
      low: 'Supply surplus expected',
    },
  },
  'net_capacity': {
    name: 'Net Capacity',
    riskTheme: 'priceVolatilityRisk',
    weight: 0.10,
    defaultImpactFlag: 'Medium',
    riskType: 'Both',
    hypothesis: 'High utilization or capacity constraints limit supply responsiveness and amplify shocks',
    thresholds: {
      high: '>90% capacity utilization',
      medium: '70-90% utilization',
      low: '<70% utilization',
    },
  },
  'net_demand': {
    name: 'Net Demand',
    riskTheme: 'priceVolatilityRisk',
    weight: 0.10,
    defaultImpactFlag: 'High',
    riskType: 'Cost',
    hypothesis: 'Strong or accelerating end-market demand outpacing supply pressures prices upward',
    thresholds: {
      high: 'Demand surge expected',
      medium: 'Stable demand',
      low: 'Demand decline expected',
    },
  },
  'tariff_rate': {
    name: 'Tariff Rate',
    riskTheme: 'priceVolatilityRisk',
    weight: 0.15,
    defaultImpactFlag: 'Medium',
    riskType: 'Cost',
    hypothesis: 'Increases or uncertainty in tariffs directly lift landed cost and volatility',
    thresholds: {
      high: '>15% tariff exposure',
      medium: '5-15% tariff exposure',
      low: '<5% tariff exposure',
    },
  },
  'other_trade_rate': {
    name: 'Other Trade Rate (Customs Duty)',
    riskTheme: 'priceVolatilityRisk',
    weight: 0.05,
    defaultImpactFlag: 'Medium',
    riskType: 'Cost',
    hypothesis: 'Customs duties/fees materially affect delivered cost and comparatives across geographies',
    thresholds: {
      high: 'Frequent duty changes',
      medium: 'Occasional changes',
      low: 'Stable duties',
    },
  },
  'cost_structure': {
    name: 'Cost Structure',
    riskTheme: 'priceVolatilityRisk',
    weight: 0.10,
    defaultImpactFlag: 'High',
    riskType: 'Cost',
    hypothesis: 'If supply-region cost structures are driven by volatile inputs, prices will track those indices',
    thresholds: {
      high: '>60% raw material cost',
      medium: '40-60% raw material',
      low: '<40% raw material',
    },
  },
  'inflation': {
    name: 'Inflation',
    riskTheme: 'priceVolatilityRisk',
    weight: 0.10,
    defaultImpactFlag: 'Medium',
    riskType: 'Cost',
    hypothesis: 'Elevated supply-region cost driver inflation increases the risk of price volatility',
    thresholds: {
      high: '>8% inflation',
      medium: '4-8% inflation',
      low: '<4% inflation',
    },
  },
  'exchange_rate': {
    name: 'Exchange Rate',
    riskTheme: 'priceVolatilityRisk',
    weight: 0.05,
    defaultImpactFlag: 'Medium',
    riskType: 'Cost',
    hypothesis: 'FX movements alter competitiveness and landed cost; high FX volatility increases pricing uncertainty',
    thresholds: {
      high: '>50% spend in volatile currencies',
      medium: '20-50% volatile currency exposure',
      low: '<20% volatile currency exposure',
    },
  },
  'pre_contracted_spend': {
    name: 'Pre-contracted Spend',
    riskTheme: 'priceVolatilityRisk',
    weight: 0.10,
    defaultImpactFlag: 'High',
    riskType: 'Both',
    hypothesis: 'Pre-contracted spend with fixed prices reduces risk of price volatility',
    thresholds: {
      high: '<30% contracted',
      medium: '30-70% contracted',
      low: '>70% contracted',
    },
  },

  // ===== SUPPLIER CONCENTRATION RISK (15%) =====
  'single_sourcing': {
    name: 'Single Sourcing / Supplier Dependency Risk',
    riskTheme: 'concentrationRisk',
    weight: 0.60,
    defaultImpactFlag: 'Low',
    riskType: 'Both',
    hypothesis: 'If large spend sits with one/few suppliers, bargaining power and continuity resilience are low',
    thresholds: {
      high: '>80% spend with single supplier',
      medium: 'Top 2-3 suppliers >80% spend',
      low: '5+ suppliers in top 80% spend',
    },
  },
  'market_consolidation': {
    name: 'Market Consolidation',
    riskTheme: 'concentrationRisk',
    weight: 0.20,
    defaultImpactFlag: 'Medium',
    riskType: 'Both',
    hypothesis: 'Concentrated supplier industry enables price discipline and limits switching options',
    thresholds: {
      high: 'HHI >2500 (concentrated)',
      medium: 'HHI 1500-2500',
      low: 'HHI <1500 (competitive)',
    },
  },
  'switching_cost': {
    name: 'Switching Cost',
    riskTheme: 'concentrationRisk',
    weight: 0.20,
    defaultImpactFlag: 'Low',
    riskType: 'Both',
    hypothesis: 'If switching cost is high, moving to a new supplier becomes difficult, exposing category to high risk',
    thresholds: {
      high: 'High switching costs (spec lock-in)',
      medium: 'Moderate switching costs',
      low: 'Low switching costs',
    },
  },

  // ===== SUPPLIER FINANCIAL RISK (35%) =====
  'supplier_risk_rating': {
    name: 'Supplier Risk Rating',
    riskTheme: 'financialRisk',
    weight: 1.0,  // Only proof point in this theme
    defaultImpactFlag: 'Medium',
    riskType: 'Volume',
    hypothesis: 'Weighted financial risk of top suppliers indicates probability of distress and delivery failure',
    thresholds: {
      high: '>75% spend with high-risk suppliers (score <30)',
      medium: '30-75% with high-risk suppliers',
      low: '<30% with high-risk suppliers',
    },
  },

  // ===== SUPPLIER GEOPOLITICAL RISK (25%) =====
  'geo_political_risk': {
    name: 'Geopolitical Risk',
    riskTheme: 'geopoliticalRisk',
    weight: 0.40,
    defaultImpactFlag: 'Medium',
    riskType: 'Volume',
    hypothesis: 'Periodic geopolitical risk scores indicate structural risks associated with top source regions',
    thresholds: {
      high: '>40% from high-risk regions',
      medium: '20-40% from high-risk regions',
      low: '<20% from high-risk regions',
    },
  },
  'regulatory_compliance': {
    name: 'Regulatory / Compliance / Policy',
    riskTheme: 'geopoliticalRisk',
    weight: 0.15,
    defaultImpactFlag: 'Medium',
    riskType: 'Both',
    hypothesis: 'Changes to regulatory requirements for top source regions affect costs and supply',
    thresholds: {
      high: 'Major regulatory changes expected',
      medium: 'Some regulatory uncertainty',
      low: 'Stable regulatory environment',
    },
  },
  'climate_risk': {
    name: 'Climate',
    riskTheme: 'geopoliticalRisk',
    weight: 0.15,
    defaultImpactFlag: 'High',
    riskType: 'Both',
    hypothesis: 'Significant climatic events in top supply regions could impact supplies',
    thresholds: {
      high: 'High climate vulnerability',
      medium: 'Moderate climate exposure',
      low: 'Low climate risk',
    },
  },
  'security_stability': {
    name: 'Security / Stability / Conflict',
    riskTheme: 'geopoliticalRisk',
    weight: 0.10,
    defaultImpactFlag: 'Medium',
    riskType: 'Volume',
    hypothesis: 'Political instability, armed conflict, piracy impact regional security infrastructure',
    thresholds: {
      high: 'Active conflicts/instability',
      medium: 'Some security concerns',
      low: 'Stable security environment',
    },
  },
  'infrastructure_logistics': {
    name: 'Infrastructure & Logistics',
    riskTheme: 'geopoliticalRisk',
    weight: 0.20,
    defaultImpactFlag: 'Medium',
    riskType: 'Volume',
    hypothesis: 'Quality and reliability of transportation, ports, energy sources affect supply continuity',
    thresholds: {
      high: 'Poor infrastructure',
      medium: 'Adequate infrastructure',
      low: 'Strong infrastructure',
    },
  },
};

/**
 * Evaluate a single risk proof point
 * Converts maturity score (1-4) to risk score (inverted: 1=high risk, 4=low risk)
 * Then applies impact flag multiplier
 */
function evaluateRiskProofPoint(
  proofPointId: string,
  maturityScore: number,  // 1-4 scale from user data
  customImpactFlag?: 'High' | 'Medium' | 'Low'
): RiskProofPointResult | null {
  const config = RISK_PROOF_POINTS[proofPointId];
  if (!config) return null;

  // Determine impact flag (use custom if provided, else default)
  const impactFlag = customImpactFlag || config.defaultImpactFlag;
  const impactMultiplier = IMPACT_FLAG_MULTIPLIERS[impactFlag];

  // Convert maturity to 10-point risk scale (inverse relationship)
  // Maturity 1 (low) = Risk 10 (high)
  // Maturity 4 (high) = Risk 2.5 (low)
  const normalizedScore = ((5 - maturityScore) / 4) * 10;

  // Calculate weighted score contribution
  const weightedScore = config.weight * impactMultiplier * normalizedScore;

  return {
    id: proofPointId,
    name: config.name,
    weight: config.weight,
    impactFlag,
    impactMultiplier,
    rawScore: maturityScore,
    normalizedScore: Math.round(normalizedScore * 100) / 100,
    weightedScore: Math.round(weightedScore * 1000) / 1000,
    riskType: config.riskType,
  };
}

/**
 * Calculate category-level risk profile from metrics
 * Based on Excel methodology: 3_Risk profile_v2
 *
 * This evaluates all risk proof points and calculates weighted risk scores
 * for each risk theme, then combines them using theme weightages.
 */
export function calculateCategoryRiskProfile(
  metrics?: Partial<ComputedMetrics>
): RiskImpact {
  // Initialize risk theme results
  const riskThemeResults: Record<string, {
    score: number;
    weighted: number;
    proofPoints: RiskProofPointResult[];
  }> = {
    priceVolatilityRisk: { score: 0, weighted: 0, proofPoints: [] },
    concentrationRisk: { score: 0, weighted: 0, proofPoints: [] },
    financialRisk: { score: 0, weighted: 0, proofPoints: [] },
    geopoliticalRisk: { score: 0, weighted: 0, proofPoints: [] },
  };

  // Evaluate each proof point based on available metrics
  Object.entries(RISK_PROOF_POINTS).forEach(([ppId, config]) => {
    let maturityScore = 2.5;  // Default middle score
    let impactFlag: 'High' | 'Medium' | 'Low' = config.defaultImpactFlag;

    // Map metrics to maturity scores (higher metric value often = lower maturity = higher risk)
    if (metrics) {
      switch (ppId) {
        case 'price_variance':
          if (metrics.priceVariance !== undefined) {
            // High variance = low maturity = high risk
            maturityScore = metrics.priceVariance > 25 ? 1 :
              metrics.priceVariance > 15 ? 2 :
                metrics.priceVariance > 5 ? 3 : 4;
            impactFlag = metrics.priceVariance > 25 ? 'High' : metrics.priceVariance > 10 ? 'Medium' : 'Low';
          }
          break;
        case 'single_sourcing':
          if (metrics.singleSourceSpend !== undefined) {
            // High concentration = low maturity
            maturityScore = metrics.singleSourceSpend > 80 ? 1 :
              metrics.singleSourceSpend > 50 ? 2 :
                metrics.singleSourceSpend > 30 ? 3 : 4;
            impactFlag = metrics.singleSourceSpend > 50 ? 'High' : metrics.singleSourceSpend > 30 ? 'Medium' : 'Low';
          }
          break;
        case 'market_consolidation':
          if (metrics.hhiIndex !== undefined) {
            // High HHI = concentrated market = higher risk
            maturityScore = metrics.hhiIndex > 2500 ? 1 :
              metrics.hhiIndex > 1500 ? 2 :
                metrics.hhiIndex > 1000 ? 3 : 4;
            impactFlag = metrics.hhiIndex > 2500 ? 'High' : metrics.hhiIndex > 1500 ? 'Medium' : 'Low';
          }
          break;
        case 'supplier_risk_rating':
          if (metrics.highRiskSupplierSpend !== undefined) {
            // High risk supplier spend = low maturity
            maturityScore = metrics.highRiskSupplierSpend > 75 ? 1 :
              metrics.highRiskSupplierSpend > 50 ? 2 :
                metrics.highRiskSupplierSpend > 30 ? 3 : 4;
            impactFlag = metrics.highRiskSupplierSpend > 50 ? 'High' : metrics.highRiskSupplierSpend > 20 ? 'Medium' : 'Low';
          }
          break;
        case 'geo_political_risk':
          if (metrics.geoConcentrationRisk !== undefined) {
            // High geographic concentration = higher geo risk
            maturityScore = metrics.geoConcentrationRisk > 80 ? 1.5 :
              metrics.geoConcentrationRisk > 60 ? 2.5 :
                metrics.geoConcentrationRisk > 40 ? 3 : 4;
            impactFlag = metrics.geoConcentrationRisk > 70 ? 'High' : metrics.geoConcentrationRisk > 40 ? 'Medium' : 'Low';
          }
          break;
        case 'pre_contracted_spend':
          if (metrics.contractCoverage !== undefined) {
            // High contract coverage = high maturity = low risk
            maturityScore = metrics.contractCoverage > 70 ? 4 :
              metrics.contractCoverage > 40 ? 3 :
                metrics.contractCoverage > 20 ? 2 : 1;
            impactFlag = metrics.contractCoverage < 30 ? 'High' : metrics.contractCoverage < 60 ? 'Medium' : 'Low';
          }
          break;
        // Default values for other proof points (would need market data)
        default:
          maturityScore = 2.5;
          break;
      }
    }

    // Evaluate the proof point
    const result = evaluateRiskProofPoint(ppId, maturityScore, impactFlag);
    if (result) {
      riskThemeResults[config.riskTheme].proofPoints.push(result);
    }
  });

  // Calculate risk theme scores (sum of weighted proof point scores)
  Object.keys(riskThemeResults).forEach(theme => {
    const themeData = riskThemeResults[theme];
    if (themeData.proofPoints.length > 0) {
      // Sum weighted scores from proof points
      themeData.score = themeData.proofPoints.reduce((sum, pp) => sum + pp.weightedScore, 0);
      // Apply theme weightage
      themeData.weighted = themeData.score * RISK_THEME_WEIGHTAGES[theme as keyof typeof RISK_THEME_WEIGHTAGES];
    }
  });

  // Calculate total risk score (weighted sum of theme scores)
  const totalRiskScore =
    riskThemeResults.priceVolatilityRisk.weighted +
    riskThemeResults.concentrationRisk.weighted +
    riskThemeResults.financialRisk.weighted +
    riskThemeResults.geopoliticalRisk.weighted;

  // Normalize to 0-10 scale
  const normalizedScore = Math.min(10, Math.max(0, totalRiskScore));

  // Determine risk level
  let riskLevel: 'High' | 'Medium' | 'Low';
  if (normalizedScore >= 6.5) {
    riskLevel = 'High';
  } else if (normalizedScore >= 4) {
    riskLevel = 'Medium';
  } else {
    riskLevel = 'Low';
  }

  return {
    score: Math.round(normalizedScore * 10) / 10,
    normalizedScore: Math.round(normalizedScore * 10),
    riskLevel,
    label: `${Math.round(normalizedScore * 10) / 10}/10`,
    description: getRiskDescription(riskLevel, riskThemeResults),
    breakdown: {
      concentrationRisk: {
        score: Math.round(riskThemeResults.concentrationRisk.score * 100) / 100,
        weighted: Math.round(riskThemeResults.concentrationRisk.weighted * 100) / 100,
        proofPoints: riskThemeResults.concentrationRisk.proofPoints,
      },
      financialRisk: {
        score: Math.round(riskThemeResults.financialRisk.score * 100) / 100,
        weighted: Math.round(riskThemeResults.financialRisk.weighted * 100) / 100,
        proofPoints: riskThemeResults.financialRisk.proofPoints,
      },
      geopoliticalRisk: {
        score: Math.round(riskThemeResults.geopoliticalRisk.score * 100) / 100,
        weighted: Math.round(riskThemeResults.geopoliticalRisk.weighted * 100) / 100,
        proofPoints: riskThemeResults.geopoliticalRisk.proofPoints,
      },
      priceVolatilityRisk: {
        score: Math.round(riskThemeResults.priceVolatilityRisk.score * 100) / 100,
        weighted: Math.round(riskThemeResults.priceVolatilityRisk.weighted * 100) / 100,
        proofPoints: riskThemeResults.priceVolatilityRisk.proofPoints,
      },
    },
  };
}

/**
 * Generate risk description based on highest risk themes
 */
function getRiskDescription(
  riskLevel: 'High' | 'Medium' | 'Low',
  themeResults: Record<string, { score: number; weighted: number; proofPoints: RiskProofPointResult[] }>
): string {
  // Find the highest contributing risk themes
  const sortedThemes = Object.entries(themeResults)
    .sort((a, b) => b[1].weighted - a[1].weighted)
    .slice(0, 2);

  const themeNames: Record<string, string> = {
    priceVolatilityRisk: 'price volatility',
    concentrationRisk: 'supplier concentration',
    financialRisk: 'supplier financial stability',
    geopoliticalRisk: 'geopolitical factors',
  };

  const topThemes = sortedThemes.map(([key]) => themeNames[key]).join(' and ');

  if (riskLevel === 'High') {
    return `High risk exposure primarily driven by ${topThemes}. Immediate mitigation recommended.`;
  } else if (riskLevel === 'Medium') {
    return `Moderate risk exposure with ${topThemes} being key factors. Monitor and develop contingency plans.`;
  } else {
    return `Low risk profile. Continue monitoring ${topThemes} for any changes.`;
  }
}

/**
 * Calculate Risk Impact for an opportunity
 * Based on Excel methodology: 3_Risk profile_v2
 *
 * AUTOMATICALLY calculates risk from:
 * 1. Category baseline risk (from metrics/proof points)
 * 2. Opportunity-specific risk mitigation potential
 *
 * Returns category risk profile + opportunity-specific risk reduction
 */
export function calculateOpportunityRiskImpact(
  opportunityId: string,
  proofPoints: ProofPointResult[],
  metrics?: Partial<ComputedMetrics>
): RiskImpact {
  // First calculate the baseline category risk profile from actual data
  const categoryRisk = calculateCategoryRiskProfile(metrics);

  // Get confidence multiplier based on validated proof points
  const validatedCount = proofPoints.filter(pp => pp.isTested).length;
  const totalCount = proofPoints.length;
  const confidenceMultiplier = totalCount > 0 ? 0.5 + (validatedCount / totalCount) * 0.5 : 0.5;

  // =========================================================================
  // AUTOMATIC RISK CALCULATION FROM METRICS
  // Each opportunity type addresses specific risk factors
  // The reduction is calculated based on how bad the current state is
  // =========================================================================

  // Extract current risk scores from category risk breakdown
  const currentConcentration = categoryRisk.breakdown.concentrationRisk.score;
  const currentFinancial = categoryRisk.breakdown.financialRisk.score;
  const currentGeopolitical = categoryRisk.breakdown.geopoliticalRisk.score;
  const currentPriceVolatility = categoryRisk.breakdown.priceVolatilityRisk.score;

  // Calculate opportunity-specific risk reductions based on metrics
  let reduction = {
    concentrationRisk: 0,
    financialRisk: 0,
    geopoliticalRisk: 0,
    priceVolatilityRisk: 0,
  };

  // Define which proof points each opportunity addresses and how much
  // Negative values = risk reduction (good)
  // Positive values = risk increase (bad)
  switch (opportunityId) {
    case 'volume-bundling':
      // Volume bundling: Improves price stability but may increase concentration
      // Price volatility reduction based on current price variance
      if (metrics?.priceVariance !== undefined) {
        // Higher variance = more opportunity to reduce through bundling
        reduction.priceVolatilityRisk = metrics.priceVariance > 25 ? -2.5 :
          metrics.priceVariance > 15 ? -1.8 :
            metrics.priceVariance > 5 ? -1.0 : -0.3;
      } else {
        reduction.priceVolatilityRisk = -currentPriceVolatility * 0.3; // 30% reduction default
      }

      // Concentration may INCREASE (fewer suppliers after consolidation)
      if (metrics?.top3Concentration !== undefined) {
        // If already concentrated, bundling increases risk slightly
        reduction.concentrationRisk = metrics.top3Concentration > 70 ? 0.8 :
          metrics.top3Concentration > 50 ? 0.4 : 0.1;
      } else {
        reduction.concentrationRisk = currentConcentration * 0.15; // 15% increase
      }

      // Financial risk improves with better supplier relationships
      reduction.financialRisk = -currentFinancial * 0.15; // 15% improvement
      break;

    case 'target-pricing':
      // Target pricing: Major price volatility reduction through index-based contracts
      if (metrics?.priceVariance !== undefined) {
        // Very effective at reducing price risk
        reduction.priceVolatilityRisk = metrics.priceVariance > 25 ? -3.5 :
          metrics.priceVariance > 15 ? -2.5 :
            metrics.priceVariance > 5 ? -1.5 : -0.5;
      } else {
        reduction.priceVolatilityRisk = -currentPriceVolatility * 0.5; // 50% reduction
      }

      // Financial risk improves with predictable costs
      reduction.financialRisk = -currentFinancial * 0.2; // 20% improvement

      // Neutral on concentration and geopolitical
      reduction.concentrationRisk = 0;
      reduction.geopoliticalRisk = 0;
      break;

    case 'risk-management':
      // Risk management: Addresses all risk types through diversification
      // Concentration reduction through supplier diversification
      if (metrics?.singleSourceSpend !== undefined) {
        reduction.concentrationRisk = metrics.singleSourceSpend > 70 ? -3.0 :
          metrics.singleSourceSpend > 50 ? -2.0 :
            metrics.singleSourceSpend > 30 ? -1.0 : -0.3;
      } else if (metrics?.top3Concentration !== undefined) {
        reduction.concentrationRisk = metrics.top3Concentration > 80 ? -2.5 :
          metrics.top3Concentration > 60 ? -1.5 : -0.5;
      } else {
        reduction.concentrationRisk = -currentConcentration * 0.4; // 40% reduction
      }

      // Financial risk reduction through supplier vetting
      if (metrics?.highRiskSupplierSpend !== undefined) {
        reduction.financialRisk = metrics.highRiskSupplierSpend > 50 ? -2.5 :
          metrics.highRiskSupplierSpend > 30 ? -1.5 :
            metrics.highRiskSupplierSpend > 10 ? -0.8 : -0.2;
      } else {
        reduction.financialRisk = -currentFinancial * 0.35; // 35% reduction
      }

      // Geopolitical risk reduction through geographic spread
      if (metrics?.geoConcentrationRisk !== undefined) {
        reduction.geopoliticalRisk = metrics.geoConcentrationRisk > 80 ? -2.0 :
          metrics.geoConcentrationRisk > 60 ? -1.2 :
            metrics.geoConcentrationRisk > 40 ? -0.6 : -0.2;
      } else {
        reduction.geopoliticalRisk = -currentGeopolitical * 0.3; // 30% reduction
      }

      // Some price stability through contingency planning
      reduction.priceVolatilityRisk = -currentPriceVolatility * 0.15; // 15% reduction
      break;

    case 'respec-pack':
      // Re-specification: Opens up supplier options, reduces concentration
      // Concentration reduction through standardized specs = more supplier options
      reduction.concentrationRisk = -currentConcentration * 0.25; // 25% reduction

      // Geopolitical improvement through supply base flexibility
      reduction.geopoliticalRisk = -currentGeopolitical * 0.2; // 20% reduction

      // Some price volatility reduction through standardization
      if (metrics?.priceVariance !== undefined) {
        reduction.priceVolatilityRisk = metrics.priceVariance > 30 ? -1.5 :
          metrics.priceVariance > 15 ? -0.8 : -0.3;
      } else {
        reduction.priceVolatilityRisk = -currentPriceVolatility * 0.2; // 20% reduction
      }

      // Neutral on financial
      reduction.financialRisk = 0;
      break;

    default:
      // Default: small improvements across the board
      reduction = {
        concentrationRisk: -currentConcentration * 0.1,
        financialRisk: -currentFinancial * 0.1,
        geopoliticalRisk: -currentGeopolitical * 0.1,
        priceVolatilityRisk: -currentPriceVolatility * 0.1,
      };
  }

  // Apply confidence multiplier to reductions
  reduction.concentrationRisk *= confidenceMultiplier;
  reduction.financialRisk *= confidenceMultiplier;
  reduction.geopoliticalRisk *= confidenceMultiplier;
  reduction.priceVolatilityRisk *= confidenceMultiplier;

  // Calculate total weighted risk change
  const riskChange =
    reduction.concentrationRisk * RISK_THEME_WEIGHTAGES.concentrationRisk +
    reduction.financialRisk * RISK_THEME_WEIGHTAGES.financialRisk +
    reduction.geopoliticalRisk * RISK_THEME_WEIGHTAGES.geopoliticalRisk +
    reduction.priceVolatilityRisk * RISK_THEME_WEIGHTAGES.priceVolatilityRisk;

  // Round to 1 decimal
  const impactScore = Math.round(riskChange * 10) / 10;

  // Determine impact level based on total risk change
  let riskLevel: 'High' | 'Medium' | 'Low';
  if (impactScore < -0.8) {
    riskLevel = 'Low';  // Big reduction = Low remaining risk
  } else if (impactScore < -0.3) {
    riskLevel = 'Medium';
  } else {
    riskLevel = 'High';  // Little/no reduction = stays High
  }

  // Generate label (negative = reduces risk)
  const label = impactScore >= 0 ? `+${impactScore.toFixed(1)}` : impactScore.toFixed(1);

  // Generate dynamic description based on biggest impact
  const getDescription = (): string => {
    const impacts = [
      { name: 'price volatility', value: Math.abs(reduction.priceVolatilityRisk) },
      { name: 'concentration', value: Math.abs(reduction.concentrationRisk) },
      { name: 'financial', value: Math.abs(reduction.financialRisk) },
      { name: 'geopolitical', value: Math.abs(reduction.geopoliticalRisk) },
    ].sort((a, b) => b.value - a.value);

    const topImpacts = impacts.filter(i => i.value > 0.3).slice(0, 2).map(i => i.name);

    if (impactScore < -1) {
      return `Significant risk reduction in ${topImpacts.join(' and ')}. Strong mitigation potential.`;
    } else if (impactScore < -0.3) {
      return `Moderate risk reduction, primarily in ${topImpacts[0] || 'overall risk profile'}.`;
    } else if (impactScore < 0) {
      return `Slight risk improvement. Consider combining with other initiatives.`;
    } else if (impactScore > 0.3) {
      return `May increase ${topImpacts[0] || 'risk'} slightly. Weigh against savings potential.`;
    } else {
      return `Minimal risk impact. Focus on cost savings and other benefits.`;
    }
  };

  // Build proof points for breakdown showing actual calculated values
  const buildThemeProofPoints = (themeReduction: number, themeName: string): RiskProofPointResult[] => {
    if (Math.abs(themeReduction) < 0.1) return [];
    return [{
      id: `${opportunityId}_${themeName}`,
      name: `Impact on ${themeName}`,
      weight: 1,
      impactFlag: themeReduction < -1.5 ? 'High' : themeReduction < -0.5 ? 'Medium' : 'Low',
      impactMultiplier: IMPACT_FLAG_MULTIPLIERS[themeReduction < -1.5 ? 'High' : themeReduction < -0.5 ? 'Medium' : 'Low'],
      rawScore: 0,
      normalizedScore: Math.abs(themeReduction),
      weightedScore: themeReduction,
      riskType: 'Both',
    }];
  };

  return {
    score: impactScore,
    normalizedScore: Math.round((5 - impactScore) * 10),  // Convert to 0-100 where lower is better
    riskLevel,
    label,
    description: getDescription(),
    breakdown: {
      concentrationRisk: {
        score: Math.round(reduction.concentrationRisk * 10) / 10,
        weighted: Math.round(reduction.concentrationRisk * RISK_THEME_WEIGHTAGES.concentrationRisk * 100) / 100,
        proofPoints: buildThemeProofPoints(reduction.concentrationRisk, 'concentration'),
      },
      financialRisk: {
        score: Math.round(reduction.financialRisk * 10) / 10,
        weighted: Math.round(reduction.financialRisk * RISK_THEME_WEIGHTAGES.financialRisk * 100) / 100,
        proofPoints: buildThemeProofPoints(reduction.financialRisk, 'financial'),
      },
      geopoliticalRisk: {
        score: Math.round(reduction.geopoliticalRisk * 10) / 10,
        weighted: Math.round(reduction.geopoliticalRisk * RISK_THEME_WEIGHTAGES.geopoliticalRisk * 100) / 100,
        proofPoints: buildThemeProofPoints(reduction.geopoliticalRisk, 'geopolitical'),
      },
      priceVolatilityRisk: {
        score: Math.round(reduction.priceVolatilityRisk * 10) / 10,
        weighted: Math.round(reduction.priceVolatilityRisk * RISK_THEME_WEIGHTAGES.priceVolatilityRisk * 100) / 100,
        proofPoints: buildThemeProofPoints(reduction.priceVolatilityRisk, 'priceVolatility'),
      },
    },
  };
}

/**
 * Calculate ESG Impact for an opportunity
 * Returns a score from -5 to +5 where positive means IMPROVES ESG
 */
export function calculateOpportunityESGImpact(
  opportunityId: string,
  proofPoints: ProofPointResult[],
  metrics?: Partial<ComputedMetrics>
): ESGImpact {
  // Base ESG impact per opportunity type
  const baseESGImpact: Record<string, {
    environmental: number;
    social: number;
    governance: number;
  }> = {
    'volume-bundling': {
      // Consolidation can improve efficiency (less transport, better utilization)
      environmental: 0.3,    // Slight improvement from logistics optimization
      social: 0,             // Neutral
      governance: 0.2,       // Better supplier oversight with fewer suppliers
    },
    'target-pricing': {
      // Transparent pricing supports governance
      environmental: 0,      // Neutral
      social: 0,             // Neutral
      governance: 0.3,       // Better cost transparency and accountability
    },
    'risk-management': {
      // Risk management often includes ESG risk assessment
      environmental: 0.3,    // ESG risk monitoring included
      social: 0.3,           // Social risk monitoring included
      governance: 0.5,       // Strong governance improvement
    },
    'respec-pack': {
      // Specification changes can include sustainability improvements
      environmental: 1.0,    // Opportunity for sustainable materials/packaging
      social: 0.2,           // Better labor standards with spec compliance
      governance: 0.3,       // Clearer specifications improve compliance
    },
  };

  const base = baseESGImpact[opportunityId] || {
    environmental: 0,
    social: 0,
    governance: 0,
  };

  // Get validation ratio for confidence
  const validatedCount = proofPoints.filter(pp => pp.isTested).length;
  const totalCount = proofPoints.length;
  const validationRatio = totalCount > 0 ? validatedCount / totalCount : 0.5;
  const confidenceMultiplier = 0.5 + (validationRatio * 0.5);

  // Apply confidence
  const adjustedBreakdown = {
    environmental: base.environmental * confidenceMultiplier,
    social: base.social * confidenceMultiplier,
    governance: base.governance * confidenceMultiplier,
  };

  // Calculate total (equal weights for E, S, G)
  const totalScore = (adjustedBreakdown.environmental + adjustedBreakdown.social + adjustedBreakdown.governance) / 3;
  const roundedScore = Math.round(totalScore);

  // Generate description
  const descriptions: Record<string, string> = {
    'volume-bundling': 'Consolidation improves logistics efficiency with minimal ESG impact',
    'target-pricing': 'Transparent pricing mechanisms support governance objectives',
    'risk-management': 'Includes ESG risk monitoring as part of supplier assessment',
    'respec-pack': 'Specification changes enable sustainable materials and improved compliance',
  };

  return {
    score: roundedScore,
    label: roundedScore > 0 ? `+${roundedScore}` : `${roundedScore}`,
    description: descriptions[opportunityId] || 'ESG impact varies based on implementation',
    breakdown: {
      environmental: Math.round(adjustedBreakdown.environmental * 10) / 10,
      social: Math.round(adjustedBreakdown.social * 10) / 10,
      governance: Math.round(adjustedBreakdown.governance * 10) / 10,
    },
  };
}

/**
 * Calculate weighted priority score for an opportunity based on user goals
 * @param goals - User's priority settings { cost: %, risk: %, esg: % }
 * @param savingsEstimate - Estimated savings amount
 * @param totalSpend - Total spend for normalization
 * @param riskImpact - Calculated risk impact
 * @param esgImpact - Calculated ESG impact
 */
export function calculateWeightedPriorityScore(
  goals: { cost: number; risk: number; esg: number },
  savingsEstimate: number,
  totalSpend: number,
  riskImpact: RiskImpact,
  esgImpact: ESGImpact
): {
  priorityScore: number;
  costContribution: number;
  riskContribution: number;
  esgContribution: number;
} {
  // Normalize goals to sum to 100
  const totalGoals = goals.cost + goals.risk + goals.esg;
  const normCost = goals.cost / totalGoals;
  const normRisk = goals.risk / totalGoals;
  const normESG = goals.esg / totalGoals;

  // Cost score: savings as percentage of spend (0-100 scale)
  const savingsPct = totalSpend > 0 ? (savingsEstimate / totalSpend) * 100 : 0;
  const costScore = Math.min(savingsPct * 10, 100); // Scale up, cap at 100

  // Risk score: negative risk impact is good (0-100 scale)
  // -5 = 100 (best), 0 = 50, +5 = 0 (worst)
  const riskScore = Math.max(0, Math.min(100, 50 - (riskImpact.score * 10)));

  // ESG score: positive ESG impact is good (0-100 scale)
  // -5 = 0 (worst), 0 = 50, +5 = 100 (best)
  const esgScore = Math.max(0, Math.min(100, 50 + (esgImpact.score * 10)));

  // Calculate weighted contributions
  const costContribution = costScore * normCost;
  const riskContribution = riskScore * normRisk;
  const esgContribution = esgScore * normESG;

  // Total priority score (0-100)
  const priorityScore = costContribution + riskContribution + esgContribution;

  return {
    priorityScore: Math.round(priorityScore * 10) / 10,
    costContribution: Math.round(costContribution * 10) / 10,
    riskContribution: Math.round(riskContribution * 10) / 10,
    esgContribution: Math.round(esgContribution * 10) / 10,
  };
}

/**
 * Get all opportunity impacts and priority scores
 */
export function calculateAllOpportunityImpacts(
  opportunities: Array<{
    id: string;
    proofPoints: ProofPointResult[];
    savingsEstimate: number;
  }>,
  totalSpend: number,
  goals: { cost: number; risk: number; esg: number },
  metrics?: Partial<ComputedMetrics>
): Array<{
  opportunityId: string;
  riskImpact: RiskImpact;
  esgImpact: ESGImpact;
  priorityScore: number;
  ranking: number;
}> {
  // Calculate impacts for each opportunity
  const results = opportunities.map(opp => {
    const riskImpact = calculateOpportunityRiskImpact(opp.id, opp.proofPoints, metrics);
    const esgImpact = calculateOpportunityESGImpact(opp.id, opp.proofPoints, metrics);
    const priority = calculateWeightedPriorityScore(
      goals,
      opp.savingsEstimate,
      totalSpend,
      riskImpact,
      esgImpact
    );

    return {
      opportunityId: opp.id,
      riskImpact,
      esgImpact,
      priorityScore: priority.priorityScore,
      ranking: 0, // Will be set after sorting
    };
  });

  // Sort by priority score (highest first) and assign rankings
  results.sort((a, b) => b.priorityScore - a.priorityScore);
  results.forEach((r, idx) => {
    r.ranking = idx + 1;
  });

  return results;
}

// =============================================================================
// DETERMINISTIC PROOF POINT EVALUATION
// =============================================================================

/**
 * Maps frontend proof point IDs (vb-pp-1) to backend IDs (PP_REGIONAL_SPEND)
 */
const FRONTEND_TO_BACKEND_PP_ID: Record<string, string> = {
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
  // Re-spec Pack
  'rp-pp-1': 'PP_PRICE_VARIANCE',
  'rp-pp-2': 'PP_EXPORT_DATA',
  'rp-pp-3': 'PP_COST_STRUCTURE',
};

/**
 * Proof point to metric mapping for each opportunity type.
 * Maps proof point IDs to the metric they should evaluate.
 */
const PROOF_POINT_METRIC_MAPPING: Record<string, Record<string, keyof ComputedMetrics | 'supplierCount'>> = {
  'volume-bundling': {
    'PP_REGIONAL_SPEND': 'regionalConcentration',
    'PP_TAIL_SPEND': 'tailSpendPercentage',
    'PP_VOLUME_LEVERAGE': 'supplierCount',
    'PP_PRICE_VARIANCE': 'priceVariance',
    'PP_AVG_SPEND_SUPPLIER': 'avgSpendPerSupplier',
    'PP_MARKET_CONSOLIDATION': 'hhiIndex',
    'PP_SUPPLIER_LOCATION': 'regionalConcentration',
    'PP_SUPPLIER_RISK_RATING': 'highRiskSupplierSpend',
  },
  'target-pricing': {
    'PP_PRICE_VARIANCE': 'priceVariance',
    'PP_TARIFF_RATE': 'priceVariance', // Use price variance as proxy
    'PP_COST_STRUCTURE': 'priceVariance', // Use price variance as proxy
    'PP_UNIT_PRICE': 'priceVariance',
  },
  'risk-management': {
    'PP_SINGLE_SOURCING': 'singleSourceSpend',
    'PP_SUPPLIER_CONCENTRATION': 'top3Concentration',
    'PP_CATEGORY_RISK': 'highRiskSupplierSpend',
    'PP_INFLATION': 'priceEscalationExposure',
    'PP_EXCHANGE_RATE': 'geoConcentrationRisk',
    'PP_GEO_POLITICAL': 'geoConcentrationRisk',
    'PP_SUPPLIER_RISK_RATING': 'highRiskSupplierSpend',
  },
  'respec-pack': {
    'PP_PRICE_VARIANCE': 'priceVariance',
    'PP_EXPORT_DATA': 'priceVariance', // Use price variance as proxy
    'PP_COST_STRUCTURE': 'priceVariance', // Use price variance as proxy
  },
};

/**
 * Evaluates all proof points for an opportunity deterministically using computed metrics.
 * This replaces LLM-based evaluation with threshold-based rules for consistent results.
 *
 * @param opportunityId - The opportunity type (volume-bundling, target-pricing, etc.)
 * @param proofPointIds - List of proof point IDs to evaluate
 * @param metrics - Computed metrics from spend data
 * @returns Array of evaluated proof points with deterministic impacts
 */
export function evaluateProofPointsDeterministic(
  opportunityId: string,
  proofPointIds: string[],
  metrics: Partial<ComputedMetrics>
): ProofPointResult[] {
  const mapping = PROOF_POINT_METRIC_MAPPING[opportunityId] || {};

  return proofPointIds.map(ppId => {
    // Convert frontend ID (vb-pp-1) to backend ID (PP_REGIONAL_SPEND)
    const backendPpId = FRONTEND_TO_BACKEND_PP_ID[ppId] || ppId;
    const metricKey = mapping[backendPpId];

    // If no metric mapping exists, return as Not Tested
    if (!metricKey || metrics[metricKey as keyof ComputedMetrics] === undefined) {
      return {
        id: ppId,
        name: ppId.replace('PP_', '').replace(/_/g, ' ').replace(/-pp-\d+/, ''),
        value: 0,
        impact: 'Not Tested' as ImpactFlag,
        insight: 'Insufficient data to evaluate',
        isTested: false,
        threshold: { high: 'N/A', medium: 'N/A', low: 'N/A' },
      };
    }

    const metricValue = metrics[metricKey as keyof ComputedMetrics] as number;

    // Use the existing evaluateProofPoint function with the BACKEND ID for threshold lookup
    const result = evaluateProofPoint(backendPpId, metricValue, opportunityId, true);
    // But keep the original frontend ID
    return { ...result, id: ppId };
  });
}

/**
 * Calculates a deterministic confidence score for an opportunity.
 * Uses computed metrics to evaluate proof points and calculate weighted confidence.
 *
 * Formula: (0.25*L + 0.625*M + 0.875*H) / (totalCount * 0.875) * 100
 *
 * @param opportunityId - The opportunity type
 * @param proofPointIds - List of proof point IDs for this opportunity
 * @param metrics - Computed metrics from spend data
 * @returns Confidence score (0-100) and evaluated proof points
 */
export function calculateDeterministicConfidence(
  opportunityId: string,
  proofPointIds: string[],
  metrics: Partial<ComputedMetrics>
): {
  confidenceScore: number;
  confidenceBucket: 'High' | 'Medium' | 'Low';
  evaluatedProofPoints: ProofPointResult[];
  summary: {
    highCount: number;
    mediumCount: number;
    lowCount: number;
    notTestedCount: number;
  };
} {
  // Evaluate all proof points deterministically
  const evaluatedProofPoints = evaluateProofPointsDeterministic(opportunityId, proofPointIds, metrics);

  // Count by impact
  const highCount = evaluatedProofPoints.filter(pp => pp.impact === 'High').length;
  const mediumCount = evaluatedProofPoints.filter(pp => pp.impact === 'Medium').length;
  const lowCount = evaluatedProofPoints.filter(pp => pp.impact === 'Low').length;
  const notTestedCount = evaluatedProofPoints.filter(pp => pp.impact === 'Not Tested').length;

  const testedCount = highCount + mediumCount + lowCount;
  const totalCount = proofPointIds.length;

  // Calculate weighted confidence score
  // Formula: (0.25*L + 0.625*M + 0.875*H) / (total * 0.875) * 100
  const L_MULT = IMPACT_FLAG_MULTIPLIERS['Low'];
  const M_MULT = IMPACT_FLAG_MULTIPLIERS['Medium'];
  const H_MULT = IMPACT_FLAG_MULTIPLIERS['High'];

  const weightedScore = lowCount * L_MULT + mediumCount * M_MULT + highCount * H_MULT;
  const maxPossibleScore = totalCount * H_MULT;

  const confidenceScore = maxPossibleScore > 0
    ? Math.round((weightedScore / maxPossibleScore) * 100)
    : 0;

  // Determine confidence bucket
  let confidenceBucket: 'High' | 'Medium' | 'Low';
  if (confidenceScore >= 70) {
    confidenceBucket = 'High';
  } else if (confidenceScore >= 40) {
    confidenceBucket = 'Medium';
  } else {
    confidenceBucket = 'Low';
  }

  return {
    confidenceScore,
    confidenceBucket,
    evaluatedProofPoints,
    summary: {
      highCount,
      mediumCount,
      lowCount,
      notTestedCount,
    },
  };
}

export default {
  calculateHHI,
  calculateTop3Concentration,
  calculateTailSpend,
  calculateRegionalConcentration,
  calculatePriceVariance,
  calculateAvgSpendPerSupplier,
  calculateContractCoverage,
  calculateSpotBuyPercentage,
  calculateHighRiskSpend,
  calculateSingleSourceSpend,
  calculateOverallRiskScore,
  evaluateProofPoint,
  calculateOpportunitySavings,
  calculateSavingsSummary,
  computeAllMetrics,
  // New Risk & ESG functions
  calculateOpportunityRiskImpact,
  calculateOpportunityESGImpact,
  calculateWeightedPriorityScore,
  calculateAllOpportunityImpacts,
  // Deterministic evaluation
  evaluateProofPointsDeterministic,
  calculateDeterministicConfidence,
};
