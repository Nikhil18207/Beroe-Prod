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

const IMPACT_FLAG_SCORES = {
  High: 3,
  Medium: 2,
  Low: 1,
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
 * Formula: percentage of spend with suppliers <$50K (or bottom 80% by count)
 */
export function calculateTailSpend(suppliers: SupplierProfile[], threshold = 50000): number {
  if (suppliers.length === 0) return 0;

  const totalSpend = suppliers.reduce((sum, s) => sum + s.spend, 0);
  if (totalSpend === 0) return 0;

  // Method 1: Suppliers below threshold
  const tailSpend = suppliers
    .filter(s => s.spend < threshold)
    .reduce((sum, s) => sum + s.spend, 0);

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
 * Calculate Price Variance
 * Formula: (max_price - min_price) / avg_price for same items
 */
export function calculatePriceVariance(records: SpendRecord[]): number {
  if (records.length === 0) return 0;

  const prices = records.filter(r => r.price && r.price > 0).map(r => r.price!);
  if (prices.length < 2) return 0;

  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

  if (avgPrice === 0) return 0;

  return Math.round(((maxPrice - minPrice) / avgPrice) * 100 * 100) / 100;
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
  let impactScore: number;
  if (totalTested > 0) {
    const rawScore = (lowCount * 1 + mediumCount * 2 + highCount * 3);
    impactScore = (rawScore / (totalTested * 3)) * 10;
  } else {
    impactScore = 5.0; // Default to medium
  }

  // Step 4: Determine Impact Bucket
  let impactBucket: 'High' | 'Medium' | 'Low';
  let bucketFactor: number;

  if (impactScore >= IMPACT_BUCKETS.High.min) {
    impactBucket = 'High';
    bucketFactor = 0.80;
  } else if (impactScore >= IMPACT_BUCKETS.Medium.min) {
    impactBucket = 'Medium';
    bucketFactor = 0.50;
  } else {
    impactBucket = 'Low';
    bucketFactor = 0.25;
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

  // Step 8: Calculate confidence score and bucket
  const testedCount = proofPoints.filter(pp => pp.isTested).length;
  const totalCount = proofPoints.length;
  const confidenceScore = totalCount > 0 ? testedCount / totalCount : 0;

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
};
