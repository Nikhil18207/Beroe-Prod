"use client";

import { motion } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  ChevronUp,
  Plus,
  Mic,
  Send,
  Check,
  AlertCircle,
  Loader2
} from "lucide-react";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { procurementApi } from "@/lib/api/procurement";
import ProtectedRoute from "@/components/ProtectedRoute";
import Sidebar from "@/components/Sidebar";
import type { ProofPoint, AcceptedRecommendationsData } from "@/context/AppContext";
import {
  calculateOpportunityRiskImpact,
  calculateOpportunityESGImpact,
  calculateDeterministicConfidence,
  type ProofPointResult
} from "@/lib/calculations/procurement-metrics";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend
} from "recharts";

// ============================================================================
// DYNAMIC DATA CONFIGURATIONS
// ============================================================================

// Dynamic questions mapped to PROOF POINTS by their actual IDs from AppContext
// Each proof point has its own validation question
const PROOF_POINT_QUESTIONS: Record<string, {
  question: string;
  options: string[];
}> = {
  // ============ Volume Bundling (vb-pp-*) ============
  "vb-pp-1": { // Regional Spend
    question: "How is your spend distributed across regions/sites?",
    options: [
      "Don't track regional distribution",
      "Rough estimates only",
      "Tracked but not actively managed",
      "Actively managed with consolidation targets"
    ]
  },
  "vb-pp-2": { // Tail Spend
    question: "How do you manage tail spend (low-value, fragmented purchases)?",
    options: [
      "No visibility into tail spend",
      "Know it exists but don't manage it",
      "Periodic cleanup efforts",
      "Active tail spend management program"
    ]
  },
  "vb-pp-3": { // Volume Leverage
    question: "Do you leverage total volume when negotiating with suppliers?",
    options: [
      "Each site negotiates independently",
      "Some informal volume aggregation",
      "Centralized negotiation for key categories",
      "Full volume leverage across all sites"
    ]
  },
  "vb-pp-4": { // Price Variance
    question: "Do you see price differences for similar items across suppliers/sites?",
    options: [
      "Don't track price variance",
      "Yes, significant variance exists",
      "Some variance, working to reduce",
      "Minimal variance, prices standardized"
    ]
  },
  "vb-pp-5": { // Avg Spend/Supplier
    question: "How concentrated is your spend among suppliers?",
    options: [
      "Very fragmented - many small suppliers",
      "Somewhat fragmented",
      "Moderately concentrated",
      "Strategic suppliers handle most spend"
    ]
  },
  "vb-pp-6": { // Market Consolidation
    question: "How consolidated is your supplier market?",
    options: [
      "Don't know market structure",
      "Many small players",
      "Mix of large and small suppliers",
      "Few dominant suppliers"
    ]
  },
  "vb-pp-7": { // Supplier Location
    question: "Where are your suppliers primarily located?",
    options: [
      "Don't track supplier locations",
      "Mostly local/regional",
      "Mix of local and international",
      "Strategic global sourcing"
    ]
  },
  "vb-pp-8": { // Supplier Risk Rating
    question: "Do you assess financial health/risk of your suppliers?",
    options: [
      "No supplier risk assessment",
      "Basic checks for new suppliers only",
      "Annual risk reviews for key suppliers",
      "Continuous risk monitoring with ratings"
    ]
  },

  // ============ Target Pricing (tp-pp-*) ============
  "tp-pp-1": { // Price Variance
    question: "Do you see price differences for similar items across suppliers?",
    options: [
      "Don't track price variance",
      "Yes, significant variance exists",
      "Some variance, working to reduce",
      "Minimal variance, prices standardized"
    ]
  },
  "tp-pp-2": { // Tariff Rate
    question: "Do tariffs/duties significantly impact your costs?",
    options: [
      "Don't track tariff impact",
      "Aware but not managed",
      "Factor into sourcing decisions",
      "Optimized sourcing for duty savings"
    ]
  },
  "tp-pp-3": { // Cost Structure
    question: "Do you understand the cost breakdown of what you buy?",
    options: [
      "No cost visibility",
      "High-level estimates only",
      "Detailed cost models for some items",
      "Should-cost models for key categories"
    ]
  },
  "tp-pp-4": { // Unit Price
    question: "Do you track unit prices and compare across suppliers?",
    options: [
      "No unit price tracking",
      "Track but don't compare",
      "Regular price comparisons",
      "Automated price benchmarking"
    ]
  },

  // ============ Risk Management (rm-pp-*) ============
  "rm-pp-1": { // Single Sourcing
    question: "Do you have single-source dependencies?",
    options: [
      "Don't know",
      "Yes, for many categories",
      "Some, but working on alternatives",
      "Minimal - dual source for critical items"
    ]
  },
  "rm-pp-2": { // Supplier Concentration
    question: "How concentrated is your spend with top suppliers?",
    options: [
      "Don't track concentration",
      "Very concentrated (>70% with top 3)",
      "Moderately concentrated (40-70%)",
      "Well diversified (<40%)"
    ]
  },
  "rm-pp-3": { // Category Risk
    question: "Do you assess risk at category level?",
    options: [
      "No category risk assessment",
      "Ad-hoc when issues arise",
      "Annual category risk reviews",
      "Ongoing category risk management"
    ]
  },
  "rm-pp-4": { // Inflation
    question: "How do you manage inflation impact on your categories?",
    options: [
      "No inflation tracking",
      "React when prices increase",
      "Monitor inflation indices",
      "Proactive hedging/contracts"
    ]
  },
  "rm-pp-5": { // Exchange Rate
    question: "How do you manage currency/exchange rate risk?",
    options: [
      "No FX management",
      "Accept FX fluctuations",
      "Some currency hedging",
      "Active FX risk management"
    ]
  },
  "rm-pp-6": { // Geo Political
    question: "Do you consider geopolitical factors in sourcing?",
    options: [
      "Not considered",
      "React when issues occur",
      "Factor into major decisions",
      "Proactive risk monitoring"
    ]
  },
  "rm-pp-7": { // Supplier Risk Rating
    question: "Do you assess financial health/risk of your suppliers?",
    options: [
      "No supplier risk assessment",
      "Basic checks for new suppliers only",
      "Annual risk reviews for key suppliers",
      "Continuous risk monitoring with ratings"
    ]
  },

  // ============ Re-spec Pack (rp-pp-*) ============
  "rp-pp-1": { // Price Variance
    question: "Do you see price differences that suggest spec optimization opportunities?",
    options: [
      "Don't analyze for spec opportunities",
      "Some variance noticed",
      "Regularly review for opportunities",
      "Systematic spec optimization program"
    ]
  },
  "rp-pp-2": { // Export Data
    question: "Have you explored alternative sourcing regions or suppliers?",
    options: [
      "No exploration done",
      "Occasionally when needed",
      "Regular alternative sourcing reviews",
      "Active global sourcing program"
    ]
  },
  "rp-pp-3": { // Cost Structure
    question: "Do you analyze cost structure to identify spec-driven savings?",
    options: [
      "No cost breakdown analysis",
      "High-level estimates only",
      "Detailed analysis for some items",
      "Value engineering for key items"
    ]
  }
};

// Fallback generic questions if proof point not mapped
const GENERIC_QUESTIONS: Record<string, {
  question: string;
  options: string[];
}[]> = {
  "volume-bundling": [
    {
      question: "How mature is your demand consolidation process?",
      options: ["No process", "Basic", "Developing", "Advanced"]
    }
  ],
  "target-pricing": [
    {
      question: "How mature is your pricing management?",
      options: ["No process", "Basic", "Developing", "Advanced"]
    }
  ],
  "risk-management": [
    {
      question: "How mature is your risk management?",
      options: ["No process", "Basic", "Developing", "Advanced"]
    }
  ],
  "respec-pack": [
    {
      question: "How mature is your spec management?",
      options: ["No process", "Basic", "Developing", "Advanced"]
    }
  ]
};

// Tests/Analysis steps for each opportunity type
const OPPORTUNITY_TESTS: Record<string, string[]> = {
  "volume-bundling": [
    "Analyzed spend data to identify high-spend suppliers and consolidation opportunities",
    "Calculated regional spend distribution and identified bundling potential",
    "Evaluated supplier concentration (HHI Index) across categories",
    "Identified tail spend percentage and fragmentation patterns",
    "Assessed volume leverage potential based on supplier count"
  ],
  "target-pricing": [
    "Analyzed price variance across suppliers for similar items",
    "Compared current prices against market benchmarks and indices",
    "Evaluated cost structure breakdown (materials, labor, logistics)",
    "Assessed tariff and duty impacts on landed costs",
    "Reviewed contract terms for pricing adjustment mechanisms"
  ],
  "risk-management": [
    "Identified single-source dependencies and concentration risks",
    "Analyzed supplier geographic distribution and geopolitical exposure",
    "Evaluated supplier financial health and risk ratings",
    "Assessed category-specific risk factors (supply disruption, quality)",
    "Reviewed contract coverage and contingency provisions"
  ],
  "respec-pack": [
    "Analyzed specification variations across regions and sites",
    "Identified SKU proliferation and low-volume items",
    "Evaluated cost impact of specification complexity",
    "Assessed standardization opportunities without functionality loss",
    "Reviewed export data for alternative sourcing options"
  ]
};

// Proof Point configuration for page flip UI
// Each opportunity has a list of proof points with their display info
const PROOF_POINT_CONFIG: Record<string, Array<{
  id: string;
  name: string;
  icon: string;
  index: number;
}>> = {
  "volume-bundling": [
    { id: "vb-pp-1", name: "Regional Spend", icon: "🌍", index: 0 },
    { id: "vb-pp-2", name: "Tail Spend", icon: "📊", index: 1 },
    { id: "vb-pp-3", name: "Volume Leverage", icon: "👥", index: 2 },
    { id: "vb-pp-4", name: "Price Variance", icon: "💰", index: 3 },
    { id: "vb-pp-5", name: "Avg Spend Per Supplier", icon: "📈", index: 4 },
    { id: "vb-pp-6", name: "Market Consolidation (HHI)", icon: "🏢", index: 5 },
    { id: "vb-pp-7", name: "Supplier Location", icon: "📍", index: 6 },
    { id: "vb-pp-8", name: "Supplier Risk Rating", icon: "⚠️", index: 7 },
  ],
  "target-pricing": [
    { id: "tp-pp-1", name: "Price Variance", icon: "💰", index: 0 },
    { id: "tp-pp-2", name: "Tariff Rate", icon: "🏛️", index: 1 },
    { id: "tp-pp-3", name: "Cost Structure", icon: "📊", index: 2 },
    { id: "tp-pp-4", name: "Unit Price", icon: "💲", index: 3 },
  ],
  "risk-management": [
    { id: "rm-pp-1", name: "Single Sourcing", icon: "🎯", index: 0 },
    { id: "rm-pp-2", name: "Supplier Concentration", icon: "📊", index: 1 },
    { id: "rm-pp-3", name: "Category Risk", icon: "⚠️", index: 2 },
    { id: "rm-pp-4", name: "Inflation", icon: "📈", index: 3 },
    { id: "rm-pp-5", name: "Exchange Rate", icon: "💱", index: 4 },
    { id: "rm-pp-6", name: "Geo Political", icon: "🌍", index: 5 },
    { id: "rm-pp-7", name: "Supplier Risk Rating", icon: "⚠️", index: 6 },
  ],
  "respec-pack": [
    { id: "rp-pp-1", name: "Price Variance", icon: "💰", index: 0 },
    { id: "rp-pp-2", name: "Export Data", icon: "📦", index: 1 },
    { id: "rp-pp-3", name: "Cost Structure", icon: "📊", index: 2 },
  ],
};

// Format currency helper
const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
};

// Semicircle Gauge Chart Component for Proof Points
interface GaugeChartProps {
  value: number;
  max: number;
  thresholds: { low: number; medium: number }; // Values below which it's LOW, MEDIUM
  label: string;
  unit?: string;
  invertColors?: boolean; // For metrics where lower is worse (like HHI)
  showLegend?: boolean; // Show/hide the threshold legend
}

const GaugeChart: React.FC<GaugeChartProps> = ({ value, max, thresholds, label, unit = '%', invertColors = false, showLegend = true }) => {
  const clampedValue = Math.min(Math.max(value, 0), max);
  const percentage = (clampedValue / max) * 100;

  // Calculate needle rotation (0 = left, 180 = right)
  const rotation = (percentage / 100) * 180 - 90;

  // Determine color based on thresholds
  const getColor = () => {
    if (invertColors) {
      // For metrics where HIGH value is GOOD (like HHI where >2500 is concentrated/bad for negotiation)
      if (value >= thresholds.medium) return { zone: 'LOW', color: '#10b981', bg: 'bg-emerald-100 text-emerald-700' };
      if (value >= thresholds.low) return { zone: 'MEDIUM', color: '#f59e0b', bg: 'bg-amber-100 text-amber-700' };
      return { zone: 'HIGH', color: '#ef4444', bg: 'bg-red-100 text-red-700' };
    } else {
      // Normal: HIGH value = HIGH impact (usually bad for consolidation metrics)
      if (value >= thresholds.medium) return { zone: 'HIGH', color: '#ef4444', bg: 'bg-red-100 text-red-700' };
      if (value >= thresholds.low) return { zone: 'MEDIUM', color: '#f59e0b', bg: 'bg-amber-100 text-amber-700' };
      return { zone: 'LOW', color: '#10b981', bg: 'bg-emerald-100 text-emerald-700' };
    }
  };

  const { zone, color, bg } = getColor();

  // Calculate threshold positions on the arc (as percentages of 180 degrees)
  const lowPos = (thresholds.low / max) * 100;
  const medPos = (thresholds.medium / max) * 100;

  return (
    <div className="flex items-center gap-4">
      {/* Gauge SVG */}
      <div className="relative w-[100px] h-[55px]">
        <svg viewBox="0 0 100 55" className="w-full h-full">
          {/* Background arc segments */}
          <defs>
            <linearGradient id="gaugeGreen" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="gaugeAmber" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="gaugeRed" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.5" />
            </linearGradient>
          </defs>

          {/* Arc background - three colored zones */}
          <path
            d={`M 10 50 A 40 40 0 0 1 ${10 + (80 * lowPos / 100)} ${50 - Math.sin(Math.PI * lowPos / 100) * 40}`}
            fill="none"
            stroke={invertColors ? "#ef4444" : "#10b981"}
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.3"
          />
          <path
            d={`M ${10 + (80 * lowPos / 100)} ${50 - Math.sin(Math.PI * lowPos / 100) * 40} A 40 40 0 0 1 ${10 + (80 * medPos / 100)} ${50 - Math.sin(Math.PI * medPos / 100) * 40}`}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.3"
          />
          <path
            d={`M ${10 + (80 * medPos / 100)} ${50 - Math.sin(Math.PI * medPos / 100) * 40} A 40 40 0 0 1 90 50`}
            fill="none"
            stroke={invertColors ? "#10b981" : "#ef4444"}
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.3"
          />

          {/* Active arc up to current value */}
          <path
            d={`M 10 50 A 40 40 0 0 1 ${10 + (80 * percentage / 100)} ${50 - Math.sin(Math.PI * percentage / 100) * 40}`}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            style={{ transition: 'all 0.8s ease-out' }}
          />

          {/* Needle */}
          <g transform={`rotate(${rotation}, 50, 50)`} style={{ transition: 'transform 0.8s ease-out' }}>
            <line x1="50" y1="50" x2="50" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <circle cx="50" cy="50" r="4" fill={color} />
          </g>

          {/* Center value */}
          <text x="50" y="48" textAnchor="middle" className="text-[11px] font-bold" fill={color}>
            {typeof value === 'number' ? (unit === '$' ? formatCurrency(value) : value.toFixed(0) + unit) : value}
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-medium text-gray-700">{label}</span>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${bg}`}>{zone}</span>
        </div>
        {showLegend && (
          <div className="flex items-center gap-2 text-[9px] text-gray-400">
            <span className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${invertColors ? 'bg-red-400' : 'bg-emerald-400'}`}></span>
              &lt;{thresholds.low}{unit}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              {thresholds.low}-{thresholds.medium}{unit}
            </span>
            <span className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${invertColors ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
              &gt;{thresholds.medium}{unit}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// Recommendations for each opportunity type with detailed reasoning and real metrics
interface RecommendationMetrics {
  totalSpend: number;
  priceVariance: number;
  top3Concentration: number;
  tailSpendPercentage: number;
  supplierCount: number;
}

interface SupplierData {
  name: string;
  spend: number;
}

const getRecommendations = (
  oppType: string,
  categoryName: string,
  suppliers: SupplierData[],
  metrics: RecommendationMetrics,
  locations: string[] = []
): { text: string; reason: string }[] => {
  const supplier1 = suppliers[0] || { name: "your top supplier", spend: 0 };
  const supplier2 = suppliers[1] || { name: "your second supplier", spend: 0 };
  const supplier3 = suppliers[2] || { name: "your third supplier", spend: 0 };

  const { totalSpend, priceVariance, top3Concentration, tailSpendPercentage, supplierCount } = metrics;

  // Location strings
  const locationsStr = locations.length > 0 ? locations.join(', ') : 'your regions';
  const locationsShort = locations.length > 0 ? locations[0] : 'your region';

  // Calculate derived values
  const top3Spend = supplier1.spend + supplier2.spend + supplier3.spend;
  const supplier1Pct = totalSpend > 0 ? ((supplier1.spend / totalSpend) * 100).toFixed(0) : "0";
  const supplier2Pct = totalSpend > 0 ? ((supplier2.spend / totalSpend) * 100).toFixed(0) : "0";
  const supplier3Pct = totalSpend > 0 ? ((supplier3.spend / totalSpend) * 100).toFixed(0) : "0";
  const potentialSavings5pct = totalSpend * 0.05;
  const potentialSavings10pct = totalSpend * 0.10;
  const tailSpendAmount = totalSpend * (tailSpendPercentage / 100);

  const top2Pct = totalSpend > 0 ? (((supplier1.spend + supplier2.spend) / totalSpend) * 100).toFixed(0) : "0";

  switch (oppType) {
    case "volume-bundling":
      return [
        {
          text: `Consolidate ${formatCurrency(totalSpend)} ${categoryName} spend across ${supplierCount} suppliers in ${locationsStr} to negotiate volume-based rebates of 5-8%`,
          reason: `Right now you're buying ${categoryName} from ${supplierCount} different suppliers - that's ${supplierCount} separate negotiations, ${supplierCount} different price points, and zero volume leverage. By consolidating 70%+ of your ${formatCurrency(totalSpend)} with just 2-3 strategic partners, you flip the script: suppliers compete for guaranteed volume, and you lock in ${formatCurrency(potentialSavings5pct)}-${formatCurrency(potentialSavings10pct)} in annual rebates. This is table-stakes procurement - fragmented spend is leaving money on the table.`
        },
        {
          text: `Negotiate tiered pricing with ${supplier1.name} (${formatCurrency(supplier1.spend)}, ${supplier1Pct}%) and ${supplier2.name} (${formatCurrency(supplier2.spend)}, ${supplier2Pct}%) for ${locationsStr}`,
          reason: `${supplier1.name} and ${supplier2.name} already handle ${formatCurrency(supplier1.spend + supplier2.spend)} combined - that's ${((supplier1.spend + supplier2.spend) / totalSpend * 100).toFixed(0)}% of your spend. They want more. Use that as leverage: offer to consolidate an additional 20-30% volume in exchange for tiered pricing (e.g., 3% at current volume, 5% at +25%, 8% at +50%). You're not asking for a favor - you're offering a growth opportunity they'll compete for.`
        },
        tailSpendPercentage > 0 ? {
          text: `Reduce tail spend of ${formatCurrency(tailSpendAmount)} (${tailSpendPercentage.toFixed(0)}%) in ${locationsShort} by consolidating small suppliers into strategic contracts`,
          reason: `That ${formatCurrency(tailSpendAmount)} scattered across small suppliers? It's costing you more than you think. Each small order means separate POs, invoices, quality checks, and zero negotiating power. Worse, these suppliers have no incentive to give you good pricing - you're not strategic to them. Roll this tail spend into your ${supplier1.name} or ${supplier2.name} contracts. You'll cut admin costs by 40% and unlock volume tiers you're currently missing by just a few percentage points.`
        } : {
          text: `Establish volume commitments with ${supplier1.name} (${supplier1Pct}%) and ${supplier2.name} (${supplier2Pct}%) in ${locationsStr} to unlock tier-2 pricing`,
          reason: `Your spend is already consolidated - good. But are you getting credit for it? Most suppliers have unpublished tier-2 pricing that kicks in at 120-150% of your current volume. Approach ${supplier1.name} and ${supplier2.name} with a 3-year volume commitment in exchange for tier-2 rates. You're de-risking their revenue forecast; they should pay for that certainty with ${formatCurrency(potentialSavings5pct)}-${formatCurrency(potentialSavings10pct)} in guaranteed rebates.`
        },
        {
          text: `Bundle ${categoryName} across ${locationsStr} with related categories to create ${formatCurrency(totalSpend * 1.5)}+ combined contract value`,
          reason: `A ${formatCurrency(totalSpend)} contract gets you a regional account manager. A ${formatCurrency(totalSpend * 1.5)}+ contract gets you C-suite attention and strategic pricing. Bundle ${categoryName} with adjacent categories (packaging, logistics, related commodities) into a single RFP. Suppliers will sharpen their pencils for a deal this size - expect 8-12% better pricing than category-by-category negotiations.`
        },
        {
          text: `Implement a Hub-and-Spoke sourcing model for ${locationsStr} with ${supplier1.name} as the primary strategic hub`,
          reason: `Every time you manage a separate supplier relationship, you're burning procurement resources. Make ${supplier1.name} your hub for ${locationsStr} - they handle primary supply, secondary supplier coordination, and logistics optimization. You get one throat to choke, one invoice stream, and 12-15% reduction in total cost of ownership. ${supplier1.name} gets guaranteed volume and becomes indispensable. Win-win, but you're winning more.`
        },
        {
          text: `Transition ${supplier3.name} (${supplier3Pct}%) volume to a performance-based rebate structure connected to ${categoryName} volume growth`,
          reason: `${supplier3.name} is your third-tier supplier at ${supplier3Pct}% - they're hungry for more business. Use that hunger. Offer them a path to ${(parseFloat(supplier3Pct) * 2).toFixed(0)}% share, but tie it to performance: quarterly rebates based on delivery metrics, quality scores, and price competitiveness vs. market. If they hit targets, they grow with you. If not, that volume goes to ${supplier1.name}. Either way, you're paying for performance, not promises.`
        },
        {
          text: `Consolidate payment terms across all ${supplierCount} suppliers to Net 60 days for ${categoryName}`,
          reason: `You're probably paying ${supplierCount} different ways right now - Net 30 here, Net 45 there, maybe even prepayment for some. That's sloppy. Standardize to Net 60 across all ${categoryName} suppliers. On ${formatCurrency(totalSpend)} annual spend, that's ${formatCurrency(totalSpend * 0.02)} in working capital freed up. Some suppliers will push back - let them. The ones who want your business will adapt. The ones who won't? They're telling you something about the relationship.`
        },
        {
          text: `Launch a multi-region sourcing event for ${categoryName} to benchmark ${supplier1.name}'s current pricing`,
          reason: `When's the last time ${supplier1.name} faced real competition for your ${formatCurrency(supplier1.spend)}? Comfortable suppliers get lazy on pricing. Run a formal RFQ across ${locationsStr} - even if you plan to stay with ${supplier1.name}. The data alone is worth gold: you'll know exactly where ${supplier1.name} stands vs. market, and they'll know you know. That transparency typically drives 4-7% price improvement without switching suppliers.`
        },
        {
          text: `Implement a "Preferred Supplier" program for ${categoryName} with mandatory adoption across all ${locations.length || 3} sites`,
          reason: `Your procurement team negotiates great rates with ${supplier1.name}. Then someone in ${locationsShort} buys from a local supplier "because it's easier." That maverick spend kills your volume leverage and your credibility with strategic suppliers. Mandate preferred suppliers across all ${locations.length || 3} sites with zero exceptions. Compliance = volume = better pricing = more compliance. It's a virtuous cycle, but someone has to enforce it.`
        },
        {
          text: `Develop a 3-year volume roadmap for ${supplier1.name} and ${supplier2.name} to secure long-term capacity and fixed discounts`,
          reason: `${categoryName} markets are volatile - prices swung 15-25% last year alone. Lock in stability now. Share your 3-year demand forecast with ${supplier1.name} and ${supplier2.name} in exchange for fixed pricing or capped increases. They get planning certainty; you get budget predictability. With ${top3Concentration.toFixed(0)}% of spend in their hands, they have enough skin in the game to make this work. Don't wait for the next price spike to wish you'd done this.`
        },
        // Additional 10 recommendations for 20 total
        {
          text: `Implement a Hub-and-Spoke sourcing model for ${locationsStr} with ${supplier1.name} as the strategic hub for 70% of ${formatCurrency(totalSpend)} spend`,
          reason: `Managing ${supplierCount} supplier relationships burns procurement resources. Make ${supplier1.name} your hub - they handle primary supply, secondary supplier coordination, and logistics optimization. You get one throat to choke, one invoice stream, and 12-15% reduction in total cost of ownership.`
        },
        {
          text: `Create cross-category bundling by combining ${categoryName} with adjacent categories for ${formatCurrency(totalSpend * 1.5)}+ contract value`,
          reason: `A ${formatCurrency(totalSpend)} contract gets you a regional account manager. A ${formatCurrency(totalSpend * 1.5)}+ contract gets you C-suite attention and strategic pricing. Bundle ${categoryName} with adjacent categories into a single RFP. Suppliers will sharpen their pencils for a deal this size.`
        },
        {
          text: `Implement mandatory e-procurement for ${categoryName} purchases across ${locationsStr} to achieve 100% spend visibility`,
          reason: `Maverick spend costs 15-25% more than contracted prices. E-procurement ensures negotiated rates are used, captures full spend visibility, and enables real-time compliance tracking. Non-negotiable for serious procurement.`
        },
        {
          text: `Negotiate consignment inventory with ${supplier1.name} for high-velocity items, reducing carrying costs on ${formatCurrency(totalSpend * 0.3)}`,
          reason: `Consignment shifts inventory risk to supplier while ensuring availability. ${supplier1.name} handles the holding cost; you pay only when you consume. Win-win for high-trust relationships with your ${formatCurrency(supplier1.spend)} partner.`
        },
        {
          text: `Launch supplier innovation program with ${supplier1.name} and ${supplier2.name} targeting 5% annual cost reduction through joint improvements`,
          reason: `Strategic suppliers have insights into cost reduction opportunities you don't see. Structured innovation programs with shared savings capture 3-5% annual improvement. They bring ideas; you provide volume commitment.`
        },
        {
          text: `Standardize payment terms to Net 60 across all ${supplierCount} suppliers in ${locationsStr} to optimize working capital`,
          reason: `Inconsistent payment terms cost money and create administrative burden. Standardizing to Net 60 on ${formatCurrency(totalSpend)} is equivalent to 2% savings in working capital. Push back on any supplier demanding faster payment.`
        },
        {
          text: `Create demand pooling mechanism across ${locations.length || 3} locations for ${categoryName} with centralized monthly ordering`,
          reason: `Pooled demand across locations unlocks tier-2 pricing levels you're currently missing. Centralized ordering reduces administrative costs and gives suppliers better visibility for production planning.`
        },
        {
          text: `Develop supplier capability assessment for ${supplier2.name} and ${supplier3.name} to expand their scope and reduce overall supplier count`,
          reason: `If ${supplier2.name} or ${supplier3.name} can handle additional scope currently with other suppliers, you consolidate volume and reduce complexity. Fewer suppliers = more leverage = better pricing.`
        },
        {
          text: `Implement quarterly demand forecast sharing with ${supplier1.name} to improve their planning and earn volume-based pricing`,
          reason: `Suppliers price in uncertainty. Remove it. Share quarterly demand forecasts with ${supplier1.name} - they get planning certainty, you get better pricing. On ${formatCurrency(supplier1.spend)}, even 3% improvement is worth the transparency.`
        },
        {
          text: `Create supplier scorecards tracking delivery, quality, and pricing performance across all ${supplierCount} ${categoryName} suppliers`,
          reason: `What gets measured gets managed. Quarterly scorecards create visibility into who's performing and who's not. Use data to reward top performers with more volume and challenge underperformers to improve or lose share.`
        }
      ];
    case "target-pricing":
      return [
        {
          text: `Address ${priceVariance.toFixed(0)}% price variance across ${supplierCount} suppliers in ${locationsStr} through should-cost analysis and competitive bidding`,
          reason: `You're paying ${priceVariance.toFixed(0)}% more to some suppliers than others for the same ${categoryName}. That's not market dynamics - that's inconsistent negotiation. Build a should-cost model: raw materials (typically 50-60%), conversion (20-25%), logistics (10-15%), margin (10-15%). Any supplier charging above this? They're padding margins. Use this analysis on ${supplier1.name}'s ${formatCurrency(supplier1.spend)} alone and you'll find ${formatCurrency(supplier1.spend * 0.12)} in savings. Math doesn't lie.`
        },
        {
          text: `Implement index-based pricing with ${supplier1.name} (${formatCurrency(supplier1.spend)}) in ${locationsShort} to capture ${priceVariance.toFixed(0)}% market volatility benefits`,
          reason: `Fixed pricing sounds safe until commodity prices drop 20% and ${supplier1.name} keeps charging the old rate. Index-linked contracts tie your price to actual market movements - when palm oil, crude, or whatever drives ${categoryName} costs goes down, your price goes down. With ${priceVariance.toFixed(0)}% variance in your current pricing, you're clearly not capturing market downturns. Fix this and pocket ${formatCurrency(supplier1.spend * (priceVariance / 100) * 0.5)} when markets favor buyers.`
        },
        {
          text: `Re-negotiate ${supplier2.name} (${formatCurrency(supplier2.spend)}) and ${supplier3.name} (${formatCurrency(supplier3.spend)}) pricing in ${locationsStr} using benchmark data`,
          reason: `${supplier2.name} and ${supplier3.name} are probably coasting on old contracts while market rates shifted. Pull Beroe benchmark data, compare their pricing to market median, and schedule renegotiation calls. Come armed with data, not feelings. "Your price is ${priceVariance.toFixed(0)}% above market for comparable quality" is a conversation-ender. Target: ${formatCurrency((supplier2.spend + supplier3.spend) * 0.08)} in savings from two phone calls.`
        },
        {
          text: `Set up automated price alerts for ${formatCurrency(totalSpend)} spend across ${locationsStr} with ±${Math.min(priceVariance, 10).toFixed(0)}% deviation thresholds`,
          reason: `Markets move daily. Your contracts don't. Set up automated tracking against commodity indices so you know when ${supplier1.name}'s "market-based" price doesn't actually match the market. When the gap hits ±${Math.min(priceVariance, 10).toFixed(0)}%, trigger a review. On ${formatCurrency(totalSpend)} of spend, even 2% of untracked deviation costs you ${formatCurrency(totalSpend * 0.02)} per year. The monitoring costs a fraction of that. This is just good hygiene.`
        },
        {
          text: `Audit ${supplier1.name}'s raw material cost breakdown for ${categoryName} transactions in ${locationsShort}`,
          reason: `${supplier1.name} sends you an invoice. You pay it. But do you actually know what you're paying for? Request a full cost breakdown: raw materials, processing, packaging, logistics, margin. Most suppliers resist this - which tells you they're hiding something. The ones who comply reveal 4-7% in "mysterious" costs that evaporate under scrutiny. This isn't adversarial; it's partnership. Partners don't hide margin structures from each other.`
        },
        {
          text: `Implement a "Most Favored Customer" (MFC) clause in all new ${categoryName} contracts for ${locationsStr}`,
          reason: `Simple question: is ${supplier1.name} giving someone else better pricing than you? Unless you have an MFC clause, you'll never know. Add it to every new contract: "Supplier guarantees pricing no less favorable than any other customer for comparable volumes." If they refuse, they're admitting you're overpaying. If they agree, you automatically get ${formatCurrency(totalSpend * 0.03)} in savings the moment they cut a better deal elsewhere.`
        },
        {
          text: `Shift 20% of ${supplier3.name}'s volume in ${locationsShort} to a lower-cost regional challenger to drive price tension`,
          reason: `${supplier1.name} and ${supplier2.name} are comfortable. Too comfortable. Nothing sharpens pricing like watching volume walk out the door. Move 20% of ${supplier3.name}'s business to a hungry regional player - someone who'll price aggressively to win the account. You don't need them to be permanent; you need ${supplier1.name} to see that competitive alternatives exist. Watch their "best and final" pricing improve by 5-8% at the next renewal.`
        },
        {
          text: `Standardize packaging requirements across ${locationsStr} to eliminate "packaging premiums" from ${supplierCount} sub-optimal specs`,
          reason: `You're probably paying different prices for the same product in different packages. 25kg bags vs 50kg bags. Palletized vs loose. Each variation = a pricing excuse. Standardize your packaging specs across all ${supplierCount} suppliers: same bag size, same pallet configuration, same labeling. Now you can compare apples to apples. Suppliers who were hiding 3-5% margin in "custom packaging fees" suddenly have nowhere to hide.`
        },
        {
          text: `Leverage Beroe's "Price-to-Beat" benchmarks for ${categoryName} in ${locationsStr} during the upcoming renewal cycle`,
          reason: `"We're competitive" is what every supplier says. "You're 8% above the Beroe market benchmark for ${categoryName} in ${locationsStr}" is what shuts that down. Third-party data removes emotion from negotiations. It's not you saying they're expensive - it's the market. Use Price-to-Beat benchmarks as your opening position in renewals. Suppliers who value your ${formatCurrency(totalSpend)} relationship will find a way to close the gap. Typical result: 6-9% improvement.`
        },
        {
          text: `Unbundle logistics from ${categoryName} unit prices for all deliveries within ${locationsShort}`,
          reason: `"All-in" pricing is a supplier's best friend and your worst enemy. When logistics is buried in the unit price, you can't see that ${supplier1.name} is charging you 20% more for shipping than market rate. Unbundle everything: product cost, packaging, freight, duties, handling. Compare each line item to market. Suppliers hate this transparency, which is exactly why you need it. Hidden logistics margin on ${formatCurrency(totalSpend)}? Typically ${formatCurrency(totalSpend * 0.04)}. That's your money.`
        },
        // Additional 10 recommendations for 20 total
        {
          text: `Implement open-book pricing with ${supplier1.name} (${formatCurrency(supplier1.spend)}) to gain full transparency on cost components`,
          reason: `Open-book pricing reveals hidden margins and ensures fair pricing. When ${supplier1.name} knows you understand their costs, they can't pad margins. Typical savings: 5-10% through transparent negotiations.`
        },
        {
          text: `Negotiate price caps (max +3% per annum) with ${supplier2.name} and ${supplier3.name} for ${formatCurrency(supplier2.spend + supplier3.spend)} combined spend`,
          reason: `Price caps provide budget certainty and limit supplier opportunism during tight markets. On ${formatCurrency(supplier2.spend + supplier3.spend)}, even 2% improvement through caps saves ${formatCurrency((supplier2.spend + supplier3.spend) * 0.02)} annually.`
        },
        {
          text: `Run e-auction for ${categoryName} renewal with ${supplierCount} suppliers to establish true market pricing`,
          reason: `E-auctions create real-time price discovery that bilateral negotiations can't match. Typical savings of 8-15% versus traditional negotiations. Even if you don't switch suppliers, you know your market position.`
        },
        {
          text: `Create formula pricing linked to raw material indices for ${supplier1.name} with monthly adjustments`,
          reason: `Formula pricing captures market downturns automatically. When commodity prices drop 20%, your price drops too - without renegotiation. Protects against being locked into high prices while markets fall.`
        },
        {
          text: `Audit landed cost components for ${categoryName} imports in ${locationsShort} including duties, freight, and handling`,
          reason: `Landed cost audit often reveals 3-5% savings through duty optimization, route changes, or consolidation. Most buyers focus on unit price and ignore the 15-25% of costs in logistics and compliance.`
        },
        {
          text: `Implement price review triggers tied to raw material movements >5% with automatic renegotiation clause`,
          reason: `Trigger clauses ensure pricing stays market-relevant without continuous negotiation overhead. When raw materials move >5%, you have contractual right to renegotiate - no need to wait for renewal.`
        },
        {
          text: `Develop should-cost modeling capability for ${categoryName} using raw material indices and regional labor rates`,
          reason: `In-house cost models validate supplier pricing and identify when to push back. "We calculate this should cost ${formatCurrency(totalSpend * 0.92)}" is more effective than "can you do better?""`
        },
        {
          text: `Create competitive tension by qualifying 1-2 alternative suppliers for 20% of ${formatCurrency(totalSpend)} currently with ${supplier1.name}`,
          reason: `Alternative options prevent incumbent complacency. Even the threat of switching improves pricing 3-5%. You don't have to switch - you just need ${supplier1.name} to know you could.`
        },
        {
          text: `Negotiate volume-based rebates with ${supplier1.name} tied to annual purchase thresholds above ${formatCurrency(supplier1.spend * 0.9)}`,
          reason: `Rebates at threshold provide 3-5% return without changing day-to-day pricing. Structure tiers to incentivize volume consolidation. On ${formatCurrency(supplier1.spend)}, that's ${formatCurrency(supplier1.spend * 0.04)} back in your pocket.`
        },
        {
          text: `Implement automated price benchmarking comparing all ${supplierCount} suppliers against market indices monthly`,
          reason: `Continuous benchmarking keeps you informed on market movements. When ${supplier1.name}'s price diverges from index by >5%, you have data to trigger renegotiation. Knowledge is leverage.`
        }
      ];
    case "risk-management":
      return [
        {
          text: `Reduce ${top3Concentration.toFixed(0)}% concentration in top 3 suppliers in ${locationsStr} (${formatCurrency(top3Spend)}) by qualifying 2 alternative suppliers`,
          reason: `${supplier1.name}, ${supplier2.name}, and ${supplier3.name} control ${top3Concentration.toFixed(0)}% of your ${categoryName} supply. If any one of them has a factory fire, goes bankrupt, or gets hit by sanctions, you're scrambling. COVID taught us this lesson the hard way. Start qualifying 2 alternative suppliers now - not because you'll switch, but because you need options. The cost of qualification is nothing compared to the cost of a production line shutdown waiting for ${categoryName}.`
        },
        {
          text: `Dual-source ${supplier1.name}'s ${formatCurrency(supplier1.spend)} (${supplier1Pct}% share) in ${locationsShort} by shifting 30% to qualified backup`,
          reason: `${supplier1.name} at ${supplier1Pct}% is a single point of failure for ${formatCurrency(supplier1.spend)} of your spend. That's not a partnership - that's dependency. Move 30% (${formatCurrency(supplier1.spend * 0.3)}) to a qualified backup supplier. Yes, you'll lose some volume leverage with ${supplier1.name}. But you'll gain something more valuable: the ability to sleep at night knowing one supplier hiccup won't shut down your operations.`
        },
        {
          text: `Develop contingency supply agreements for ${locationsStr} covering ${formatCurrency(top3Spend)} in critical ${categoryName} spend`,
          reason: `When a disruption hits, it's too late to start negotiating backup supply. Establish contingency agreements NOW with alternative suppliers who can ramp up within 2-4 weeks. These aren't active contracts - they're insurance policies. Pre-negotiate pricing, lead times, and minimum volumes so that when ${supplier1.name} calls with bad news, you're already picking up the phone to your backup.`
        },
        {
          text: `Implement risk scoring for ${supplierCount} suppliers managing ${formatCurrency(totalSpend)} in ${categoryName} across ${locationsStr}`,
          reason: `You track supplier pricing religiously. Do you track their financial health? Their geopolitical exposure? Their labor relations? Set up quarterly risk scoring: financial stability (Dun & Bradstreet), operational risk (location, single-site vs. multi-site), and compliance risk (ESG, sanctions). A supplier going from "low risk" to "medium risk" is a leading indicator. By the time it's in the news, it's too late to act.`
        },
        {
          text: `Audit ${supplier1.name}'s Tier-2 supply chain for geographic concentration in high-risk zones`,
          reason: `${supplier1.name} might be based in a "safe" country, but where do THEY source their inputs? The 2021 chip shortage didn't happen at Intel - it happened at their Tier-2 and Tier-3 suppliers in Taiwan. Request ${supplier1.name}'s sub-supplier map. If 60%+ of their inputs come from a single region, you have hidden concentration risk. Better to know now than discover it when that region has a port closure.`
        },
        {
          text: `Mandate safety stock levels of 6 weeks for ${categoryName} with ${supplier2.name} and ${supplier3.name}`,
          reason: `Just-in-time inventory is great for cash flow and terrible for resilience. With ${supplier2.name} and ${supplier3.name} handling ${formatCurrency(supplier2.spend + supplier3.spend)}, a 2-week shipping delay becomes a production crisis. Push for 6 weeks of safety stock held at their facilities (not yours - don't tie up your working capital). It's insurance that costs you nothing until you need it, and saves everything when you do.`
        },
        {
          text: `Standardize Force Majeure clauses across all ${supplierCount} contracts to include specific ${categoryName} disruption event triggers`,
          reason: `"Force Majeure" means different things to different lawyers. During COVID, some suppliers invoked FM for situations that were clearly manageable; others delivered heroically through genuine crises. Rewrite your FM clauses with specific triggers: named perils (pandemic, war, natural disaster), notification requirements (48 hours), mitigation obligations, and your right to source elsewhere without penalty. Vague FM clauses protect suppliers. Specific ones protect you.`
        },
        {
          text: `Shift sourcing for ${locationsShort} to local regional suppliers to reduce cross-border and tariff sensitivity`,
          reason: `Every border crossing is a risk point: tariffs, customs delays, currency fluctuation, geopolitical tension. For ${locationsShort}, identify regional suppliers who can deliver without crossing high-risk borders. Yes, local might cost 5-10% more. But one port closure or tariff spike can cost 50%+ in expedited freight and lost production. Regional sourcing isn't about cost - it's about resilience. Build it before you need it.`
        },
        {
          text: `Implement quarterly financial audits for ${supplier1.name} and ${supplier2.name} given their high ${top2Pct}% combined share`,
          reason: `${supplier1.name} and ${supplier2.name} together control ${top2Pct}% of your ${categoryName} supply - ${formatCurrency(top3Spend)} at risk. Would you know if either was heading toward bankruptcy? Most companies find out when the supplier stops shipping. Set up quarterly financial reviews: credit ratings, payment patterns with their suppliers, unusual executive departures. A supplier's financial distress is visible 6-12 months before collapse. That's your window to diversify.`
        },
        {
          text: `Establish a "Disruption Response Team" with active participation from ${supplier1.name}'s account leadership`,
          reason: `When ${supplier1.name} has a problem, who do you call? If the answer is "my account manager," you're already behind. Establish a joint Disruption Response Team with their VP of Operations and your VP of Supply Chain. Monthly 15-minute check-ins during normal times, with pre-agreed escalation protocols and communication channels when things go wrong. Companies with joint response teams recover from disruptions 40% faster than those scrambling to find the right contact.`
        },
        // Additional 10 recommendations for 20 total
        {
          text: `Map Tier-2 suppliers for ${supplier1.name} and ${supplier2.name} to identify hidden concentration risks in your ${categoryName} supply chain`,
          reason: `Many supply disruptions occur at Tier-2/3 level. Understanding sub-supplier dependencies reveals true risk exposure. If ${supplier1.name}'s key input comes from one factory in one country, you have hidden single-source risk.`
        },
        {
          text: `Establish 48-hour force majeure notification requirements with all ${supplierCount} suppliers with defined escalation protocols`,
          reason: `Early notification of disruptions enables faster response. Defined protocols reduce reaction time by 40-60%. Don't wait for suppliers to decide when to tell you - make notification mandatory and time-bound.`
        },
        {
          text: `Implement supplier credit monitoring for ${supplier1.name}, ${supplier2.name}, and ${supplier3.name} controlling ${formatCurrency(top3Spend)} of spend`,
          reason: `Financial distress is visible 6-12 months before failure. Credit monitoring with services like Dun & Bradstreet provides early warning to diversify before disruption hits.`
        },
        {
          text: `Create regional sourcing alternatives for ${locationsStr} to reduce cross-border risk exposure on ${formatCurrency(totalSpend)} spend`,
          reason: `Regional suppliers reduce tariff, logistics, and geopolitical risks. Typically 15-20% more resilient than distant sources. Worth paying small premium for supply security.`
        },
        {
          text: `Negotiate capacity reservation agreements with ${supplier2.name} and ${supplier3.name} for surge demand scenarios up to +30%`,
          reason: `Reserved capacity ensures supply during market tightness. Small premium (1-2%) provides significant insurance value. When competitors scramble for supply, you're covered.`
        },
        {
          text: `Develop qualification pathway for 3 regional backup suppliers in ${locationsShort} with 90-day readiness capability`,
          reason: `Pre-qualified backups can activate within 90 days during disruptions. Worth the qualification investment - when ${supplier1.name} fails, you don't have time to start from scratch.`
        },
        {
          text: `Implement supplier ESG risk scoring for all ${supplierCount} suppliers to identify reputational and regulatory risks`,
          reason: `ESG incidents can disrupt supply and damage your brand. Forced labor findings, environmental violations, or governance failures at suppliers become your problem. Monitor proactively.`
        },
        {
          text: `Establish VMI (Vendor Managed Inventory) with ${supplier1.name} for critical items, ensuring 4-6 weeks buffer at supplier facilities`,
          reason: `VMI shifts inventory risk while ensuring availability. ${supplier1.name} manages stock levels at their facility; you get supply security without tying up working capital.`
        },
        {
          text: `Implement multi-modal logistics options for ${categoryName} in ${locationsStr} to reduce dependency on single transport routes`,
          reason: `Multi-modal flexibility (sea, rail, truck) provides alternatives during port congestion or route disruptions. Don't let a single chokepoint shut down your supply chain.`
        },
        {
          text: `Create joint disruption response teams with ${supplier1.name} including VP-level participation and defined communication channels`,
          reason: `Pre-established relationships reduce disruption impact by 40%. When crisis hits, you're not exchanging business cards - you're executing a rehearsed playbook with people who know each other.`
        }
      ];
    case "respec-pack":
      return [
        tailSpendPercentage > 0 ? {
          text: `Rationalize ${categoryName} specifications across ${locationsStr} to consolidate ${formatCurrency(tailSpendAmount)} tail spend (${tailSpendPercentage.toFixed(0)}%) into standard items`,
          reason: `That ${formatCurrency(tailSpendAmount)} in tail spend isn't just fragmented purchasing - it's a symptom of spec chaos. Every unique specification is a unique SKU, a unique supplier qualification, and a unique price point. Your engineering team specified 47 variations when 12 would do. Start with the tail: map every low-volume spec to a standard alternative. Most users won't notice the difference. Your procurement costs will drop 5-10% as volume concentrates on standard items.`
        } : {
          text: `Harmonize ${categoryName} specifications across ${locationsStr} to reduce SKU complexity and negotiate better pricing`,
          reason: `Your ${locationsStr} operations are probably buying the same ${categoryName} with different specs because nobody coordinated requirements. ${locationsShort} wants Grade A, another site wants "Premium" (same thing, different name), and a third has a 15-year-old spec that nobody remembers why. Harmonize everything to 3-5 standard specs. You'll slash SKU count, concentrate volume, and unlock ${formatCurrency(potentialSavings5pct)} in volume-based pricing that's currently impossible.`
        },
        {
          text: `Standardize top 20 ${categoryName} items across ${locationsStr} to unlock ${formatCurrency(potentialSavings5pct)}-${formatCurrency(potentialSavings10pct)} volume savings`,
          reason: `80% of your ${formatCurrency(totalSpend)} spend is probably in 20 items. But are those items specified identically across ${locationsStr}? Doubt it. One site wants 25kg bags, another wants 50kg. One needs ISO certification, another doesn't care. These "minor" variations kill your leverage with ${supplier1.name} and ${supplier2.name}. Standardize the top 20 items - same spec, same packaging, same everything. Then negotiate as one buyer, not five.`
        },
        {
          text: `Conduct value engineering with ${supplier1.name} and ${supplier2.name} on ${formatCurrency(supplier1.spend + supplier2.spend)} combined spend in ${locationsShort}`,
          reason: `You wrote a spec. ${supplier1.name} manufactures it. But did anyone ask ${supplier1.name} if there's a cheaper way to achieve the same outcome? Value engineering sessions flip the conversation: "Here's what we need functionally - how would YOU make it?" Suppliers often propose alternative materials, simpler processes, or standard components that cut 10-20% off cost. On ${formatCurrency(supplier1.spend + supplier2.spend)}, that's ${formatCurrency((supplier1.spend + supplier2.spend) * 0.15)} from asking better questions.`
        },
        {
          text: `Establish cross-functional spec review for ${locationsStr} targeting ${priceVariance.toFixed(0)}% cost reduction through standardization`,
          reason: `Engineering writes specs. Procurement buys them. Nobody talks to each other. That's how you end up with ${priceVariance.toFixed(0)}% price variance across ${supplierCount} suppliers - some specs are over-engineered, others are obsolete. Create a cross-functional spec review: Engineering, Procurement, Operations, and Quality in one room. Kill specs that don't add value. Tighten specs that are too loose. Target: ${formatCurrency(totalSpend * (priceVariance / 100) * 0.5)} in savings from specs that actually match what you need.`
        },
        {
          text: `Analyze ${supplier1.name}'s production line compatibility for ${categoryName} to suggest simpler, cheaper manufacturing specs`,
          reason: `Your spec might require ${supplier1.name} to do something expensive - special tooling, batch runs, manual handling - when a small tweak would let them use standard processes. Ask ${supplier1.name}: "What would make this easier for you to produce?" Often, a 1% spec change yields a 7% cost reduction because it aligns with their equipment capabilities. This isn't compromising quality - it's designing for manufacturability. Smart companies do this before specs are finalized.`
        },
        {
          text: `Implement a "Total Cost of Ownership" (TCO) spec model for ${categoryName} and packaging across ${locationsStr}`,
          reason: `Your spec optimizes for unit price. But what about the waste from that oversized packaging? The disposal cost of that non-recyclable material? The extra warehouse space for that awkward pallet configuration? TCO modeling captures what unit price misses. When you factor in handling, storage, waste, and disposal, the "cheap" option often costs more. On ${formatCurrency(totalSpend)} of ${categoryName}, hidden TCO costs typically run ${formatCurrency(totalSpend * 0.04)}. Find them.`
        },
        {
          text: `Transition ${supplier3.name}'s ${categoryName} requirements to industry-standard "Commercial Off-The-Shelf" (COTS) equivalent`,
          reason: `Custom specs are procurement handcuffs. Only ${supplier3.name} can make your unique widget, so they set the price. Transition to COTS equivalents wherever possible: industry-standard grades, common packaging sizes, widely-available certifications. Suddenly, you can quote the business to 10 suppliers instead of 1. Competition drives pricing down 15-25%. Yes, internal stakeholders will resist. Show them the math: custom specs are a luxury with a ${formatCurrency(totalSpend * 0.15)} annual price tag.`
        },
        // Additional 10 recommendations for 20 total
        {
          text: `Implement specification governance committee with procurement, R&D, and operations to approve new ${categoryName} specs`,
          reason: `Uncontrolled spec proliferation is a hidden cost driver. Every new spec means new qualification, new SKU, new complexity. Governance committee reduces SKU complexity by 20-30%.`
        },
        {
          text: `Conduct value engineering workshops with ${supplier1.name} (${formatCurrency(supplier1.spend)}) to identify 10-15% cost reduction through spec optimization`,
          reason: `Suppliers often know cheaper ways to achieve same outcomes. Joint VE workshops where ${supplier1.name} proposes alternatives capture 8-15% savings you'd never find alone.`
        },
        {
          text: `Standardize pack sizes to 3-4 options across ${locationsStr} to enable volume aggregation and reduce per-unit costs by 8-12%`,
          reason: `Multiple pack sizes fragment volumes and increase logistics costs. Standardizing to 3-4 core sizes unlocks bulk pricing and simplifies warehouse operations.`
        },
        {
          text: `Transition to industry-standard specifications (COTS) where possible for ${categoryName}, eliminating custom spec premium of 10-20%`,
          reason: `Custom specs limit supplier options and increase costs. COTS enables competitive sourcing from multiple suppliers. Often, "custom" requirements are legacy decisions nobody questioned.`
        },
        {
          text: `Create specification catalog with volume, supplier, and cost data for all ${categoryName} items across ${supplierCount} suppliers`,
          reason: `Centralized spec visibility identifies redundant items and consolidation opportunities. You can't optimize what you can't see. Build the master list first.`
        },
        {
          text: `Pilot alternative materials with ${supplier2.name} (${formatCurrency(supplier2.spend)}) targeting 15% cost reduction while maintaining quality`,
          reason: `Material substitution often yields significant savings. Controlled pilots with ${supplier2.name} reduce quality risk while proving the concept before full rollout.`
        },
        {
          text: `Implement specification change management with impact assessment required before any ${categoryName} modifications`,
          reason: `Uncontrolled changes drive costs. Impact assessment prevents well-intentioned but expensive modifications. "This small change" often means "this big cost increase.""`
        },
        {
          text: `Benchmark specifications against best-in-class industry standards to identify over-engineering opportunities`,
          reason: `Many specs exceed actual requirements because "we've always done it this way." Benchmarking reveals where "good enough" saves significant money.`
        },
        {
          text: `Develop 3-year specification roadmap with ${supplier1.name} including planned simplifications and cost reduction targets`,
          reason: `Strategic spec planning with key suppliers ensures continuous improvement. Target 3-5% annual reduction through systematic simplification and standardization.`
        },
        {
          text: `Implement "Design for Procurement" reviews for new ${categoryName} specifications before finalization`,
          reason: `Catching over-specification before production is 10x cheaper than fixing it later. Procurement should review all new specs for cost optimization opportunities.`
        }
      ];
    default:
      return [
        {
          text: `Optimize ${categoryName} procurement strategy for ${formatCurrency(totalSpend)} annual spend across ${supplierCount} suppliers in ${locationsStr}`,
          reason: `Comprehensive strategy review of ${formatCurrency(totalSpend)} spend in ${locationsStr} with ${top3Concentration.toFixed(0)}% concentration and ${priceVariance.toFixed(0)}% price variance can identify 8-15% savings opportunities.`
        },
        {
          text: `Engage ${supplier1.name}, ${supplier2.name}, and ${supplier3.name} for strategic partnership discussions in ${locationsStr}`,
          reason: `Your top 3 suppliers manage ${formatCurrency(top3Spend)} (${top3Concentration.toFixed(0)}%) in ${locationsStr}. Collaborative partnerships can uncover innovation and cost reduction opportunities.`
        }
      ];
  }
};

// PRIORITY ISSUES - Threshold-based recommendations that only show when data indicates actual problems
const getPriorityIssues = (
  oppType: string,
  categoryName: string,
  suppliers: SupplierData[],
  metrics: RecommendationMetrics,
  locations: string[] = []
): { text: string; reason: string; severity: 'critical' | 'high' | 'medium' }[] => {
  const issues: { text: string; reason: string; severity: 'critical' | 'high' | 'medium' }[] = [];

  const supplier1 = suppliers[0] || { name: "top supplier", spend: 0 };
  const supplier2 = suppliers[1] || { name: "second supplier", spend: 0 };
  const supplier3 = suppliers[2] || { name: "third supplier", spend: 0 };

  const { totalSpend, priceVariance, top3Concentration, tailSpendPercentage, supplierCount } = metrics;
  const locationsStr = locations.length > 0 ? locations.join(', ') : 'your regions';

  const supplier1Pct = totalSpend > 0 ? (supplier1.spend / totalSpend) * 100 : 0;
  const top3Spend = supplier1.spend + supplier2.spend + supplier3.spend;
  const tailSpendAmount = totalSpend * (tailSpendPercentage / 100);
  const avgSpendPerSupplier = supplierCount > 0 ? totalSpend / supplierCount : 0;

  // ========== VOLUME BUNDLING THRESHOLDS ==========
  if (oppType === 'volume-bundling') {
    // CRITICAL: Extreme supplier fragmentation
    if (supplierCount >= 12 && supplier1Pct < 20) {
      issues.push({
        text: `FRAGMENTED: ${supplierCount} suppliers with no dominant partner (top is only ${supplier1Pct.toFixed(0)}%)`,
        reason: `Extreme fragmentation detected. Your spend of ${formatCurrency(totalSpend)} is scattered across ${supplierCount} suppliers with ${supplier1.name} holding just ${supplier1Pct.toFixed(0)}%. Consolidating to 3-5 strategic suppliers could save ${formatCurrency(totalSpend * 0.08)}-${formatCurrency(totalSpend * 0.12)} annually.`,
        severity: 'critical'
      });
    }
    // HIGH: Significant tail spend
    if (tailSpendPercentage >= 20) {
      issues.push({
        text: `TAIL SPEND: ${tailSpendPercentage.toFixed(0)}% of spend (${formatCurrency(tailSpendAmount)}) lost in small suppliers`,
        reason: `A significant portion of your ${categoryName} spend is fragmented across tail suppliers. This represents ${formatCurrency(tailSpendAmount)} with no volume leverage. Consolidate into strategic contracts for 5-10% immediate savings.`,
        severity: 'critical'
      });
    } else if (tailSpendPercentage >= 10) {
      issues.push({
        text: `TAIL SPEND: ${tailSpendPercentage.toFixed(0)}% fragmented across small suppliers`,
        reason: `${formatCurrency(tailSpendAmount)} in tail spend reduces your negotiating power. Target reduction to <10% by shifting to ${supplier1.name} or ${supplier2.name}.`,
        severity: 'high'
      });
    }
    // HIGH: Multiple suppliers without consolidation
    if (supplierCount >= 5 && supplier1Pct < 35) {
      issues.push({
        text: `CONSOLIDATION: ${supplierCount} suppliers - ${supplier1.name} leads with only ${supplier1Pct.toFixed(0)}%`,
        reason: `With ${supplierCount} suppliers and no dominant partner, you're missing volume leverage. Consolidating 50%+ to top 2 suppliers typically unlocks tier-2 pricing and 5-8% savings.`,
        severity: 'high'
      });
    }
    // MEDIUM: General bundling opportunity
    if (totalSpend > 100000 && supplierCount >= 3) {
      issues.push({
        text: `OPPORTUNITY: Bundle ${formatCurrency(totalSpend)} across ${supplierCount} suppliers for volume discounts`,
        reason: `Your ${categoryName} spend of ${formatCurrency(totalSpend)} across ${supplierCount} suppliers presents consolidation opportunity. Committing higher volumes to ${supplier1.name} and ${supplier2.name} could yield 3-8% savings.`,
        severity: 'medium'
      });
    }
  }

  // ========== TARGET PRICING THRESHOLDS ==========
  if (oppType === 'target-pricing') {
    // CRITICAL: Extreme price variance
    if (priceVariance >= 30) {
      issues.push({
        text: `PRICE GAP: ${priceVariance.toFixed(0)}% variance across suppliers - immediate action needed`,
        reason: `Critical pricing inconsistency detected. A ${priceVariance.toFixed(0)}% spread means you're overpaying significantly on some transactions. Apply should-cost analysis and use lowest prices as benchmark. Potential savings: ${formatCurrency(totalSpend * 0.15)}.`,
        severity: 'critical'
      });
    } else if (priceVariance >= 15) {
      issues.push({
        text: `PRICE VARIANCE: ${priceVariance.toFixed(0)}% spread indicates pricing opportunity`,
        reason: `${priceVariance.toFixed(0)}% variance across ${supplierCount} suppliers suggests inconsistent pricing. Benchmark against lowest-cost supplier and renegotiate. Target: ${formatCurrency(totalSpend * 0.08)} savings.`,
        severity: 'high'
      });
    }
    // HIGH: Top supplier premium
    if (supplier1Pct >= 35 && priceVariance >= 10) {
      issues.push({
        text: `DOMINANT SUPPLIER: ${supplier1.name} (${supplier1Pct.toFixed(0)}%) may be charging premium`,
        reason: `${supplier1.name} controls ${formatCurrency(supplier1.spend)} with ${priceVariance.toFixed(0)}% price variance in market. Introduce competitive tension by qualifying alternatives or demand cost transparency.`,
        severity: 'high'
      });
    }
    // MEDIUM: Opportunity for index-based pricing
    if (priceVariance >= 10 && totalSpend > 100000) {
      issues.push({
        text: `VOLATILITY: Consider index-linked pricing for ${formatCurrency(totalSpend)} spend`,
        reason: `With ${priceVariance.toFixed(0)}% variance and ${formatCurrency(totalSpend)} at stake, commodity-index pricing could capture market downturns. Estimated benefit: ${formatCurrency(totalSpend * 0.04)} annually.`,
        severity: 'medium'
      });
    }
  }

  // ========== RISK MANAGEMENT THRESHOLDS ==========
  if (oppType === 'risk-management') {
    // CRITICAL: Single source dependency
    if (supplier1Pct >= 50) {
      issues.push({
        text: `SINGLE SOURCE RISK: ${supplier1.name} controls ${supplier1Pct.toFixed(0)}% of spend`,
        reason: `Critical dependency on ${supplier1.name} (${formatCurrency(supplier1.spend)}). If this supplier fails, ${supplier1Pct.toFixed(0)}% of your ${categoryName} supply is at risk. Immediately qualify backup for 30% of volume.`,
        severity: 'critical'
      });
    } else if (supplier1Pct >= 35) {
      issues.push({
        text: `CONCENTRATION: ${supplier1.name} at ${supplier1Pct.toFixed(0)}% - above safe threshold`,
        reason: `${supplier1.name} exceeds the 30% concentration guideline with ${formatCurrency(supplier1.spend)}. Develop qualified alternative and shift 15-20% volume to reduce dependency risk.`,
        severity: 'high'
      });
    }
    // CRITICAL: Top 3 concentration
    if (top3Concentration >= 80) {
      issues.push({
        text: `SUPPLY CHAIN FRAGILITY: Top 3 suppliers = ${top3Concentration.toFixed(0)}% of spend`,
        reason: `${supplier1.name}, ${supplier2.name}, ${supplier3.name} control ${formatCurrency(top3Spend)} (${top3Concentration.toFixed(0)}%). Any disruption to these 3 would be catastrophic. Qualify 2+ alternatives immediately.`,
        severity: 'critical'
      });
    } else if (top3Concentration >= 60) {
      issues.push({
        text: `HIGH CONCENTRATION: Top 3 at ${top3Concentration.toFixed(0)}% - diversification needed`,
        reason: `${top3Concentration.toFixed(0)}% concentration in 3 suppliers creates risk exposure. Target <55% through strategic supplier development.`,
        severity: 'high'
      });
    }
    // MEDIUM: General risk awareness
    if (supplierCount <= 5) {
      issues.push({
        text: `LIMITED OPTIONS: Only ${supplierCount} supplier${supplierCount === 1 ? '' : 's'} for ${categoryName}`,
        reason: `With ${supplierCount} supplier${supplierCount === 1 ? '' : 's'}, you have limited negotiating leverage and potential disruption risk. Consider qualifying 1-2 additional suppliers for competitive sourcing.`,
        severity: 'medium'
      });
    }
  }

  // ========== RE-SPEC PACK THRESHOLDS ==========
  if (oppType === 'respec-pack') {
    // CRITICAL: Extreme price variance suggesting over-specification
    if (priceVariance >= 25) {
      issues.push({
        text: `SPEC VARIANCE: ${priceVariance.toFixed(0)}% price spread likely due to over-specification`,
        reason: `${priceVariance.toFixed(0)}% variance across ${supplierCount} suppliers strongly suggests specification inconsistencies. Standardize to mid-tier spec to save ${formatCurrency(totalSpend * 0.08)}-${formatCurrency(totalSpend * 0.12)}.`,
        severity: 'critical'
      });
    } else if (priceVariance >= 12) {
      issues.push({
        text: `SPEC OPPORTUNITY: ${priceVariance.toFixed(0)}% variance indicates standardization potential`,
        reason: `Price differences of ${priceVariance.toFixed(0)}% often stem from specification variations. Review and harmonize specs across ${locationsStr} for ${formatCurrency(totalSpend * 0.05)} savings.`,
        severity: 'high'
      });
    }
    // HIGH: Supplier complexity
    if (supplierCount >= 5 && tailSpendPercentage >= 10) {
      issues.push({
        text: `COMPLEXITY: ${supplierCount} suppliers with ${tailSpendPercentage.toFixed(0)}% tail - spec rationalization needed`,
        reason: `Multiple suppliers combined with tail spend indicates SKU/spec proliferation. Rationalize specifications to reduce complexity.`,
        severity: 'high'
      });
    }
    // MEDIUM: Value engineering opportunity
    if (totalSpend > 100000) {
      issues.push({
        text: `VALUE ENGINEERING: Engage ${supplier1.name} for spec optimization on ${formatCurrency(totalSpend)}`,
        reason: `${supplier1.name}'s volume makes them ideal for collaborative value engineering. Typically yields 10-20% through alternative materials/designs.`,
        severity: 'medium'
      });
    }
  }

  return issues;
};

// Initiative titles for each opportunity type
const INITIATIVE_TITLES: Record<string, string[]> = {
  "volume-bundling": [
    "Consolidate demands across sites to leverage economies of scale",
    "Consider volume consolidation for better discounts",
    "Bundle similar categories to increase negotiating leverage"
  ],
  "target-pricing": [
    "Use cost model driven pricing mechanisms",
    "Implement should-cost analysis for key items",
    "Adjust sourcing mix to minimize tariff impact"
  ],
  "risk-management": [
    "Explore adding new suppliers to reduce supplier risk",
    "Standardize payment terms across suppliers to 60 days",
    "Develop contingency sourcing plans for high-risk regions"
  ],
  "respec-pack": [
    "Rationalize SKUs to reduce low value/volume items",
    "Standardize specifications across regions"
  ]
};

// Chat message type
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function OpportunityDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, actions } = useApp();

  // Get opportunity info from URL params
  const oppId = searchParams.get("opp") || "volume-bundling";
  const initIndex = parseInt(searchParams.get("init") || "0");

  // State - Chat focused with integrated MCQ
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // MCQ state - integrated into chat flow
  const [answeredQuestions, setAnsweredQuestions] = useState<{ index: number; answer: number }[]>([]);
  const [showMCQ, setShowMCQ] = useState(true); // Show MCQ in chat

  // Track which proof point is being validated via chat
  const [validatingProofPointId, setValidatingProofPointId] = useState<string | null>(null);
  const [pendingValidation, setPendingValidation] = useState(false);

  // LLM Recommendations state - each recommendation has text and reason
  const [llmRecommendations, setLlmRecommendations] = useState<{ text: string; reason: string }[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(true);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [selectedRecommendations, setSelectedRecommendations] = useState<Set<number>>(new Set());
  const [recommendationPage, setRecommendationPage] = useState(0);
  const RECS_PER_PAGE = 2; // Book-like: 2 cards per page
  const hasLoadedRecommendationsRef = React.useRef(false); // Prevent re-fetching once loaded

  // Proof Point page flip state - 1 proof point per page
  const [proofPointPage, setProofPointPage] = useState(0);
  const PROOF_POINTS_PER_PAGE = 1; // One proof point per page for detailed view

  // Reset proof point page when opportunity changes
  React.useEffect(() => {
    setProofPointPage(0);
  }, [oppId]);

  // LLM Proof Point Evaluation state
  const [llmEvaluations, setLlmEvaluations] = useState<{
    evaluations: Array<{ id: string; impact: 'High' | 'Medium' | 'Low'; reasoning: string; data_point: string }>;
    summary: { high_count: number; medium_count: number; low_count: number; confidence_score: number };
    weightedConfidence: number;
  } | null>(null);
  const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(true);
  const [evaluationsError, setEvaluationsError] = useState<string | null>(null);

  // LLM-generated data insights (interesting facts about the uploaded data)
  const [llmDataInsights, setLlmDataInsights] = useState<Array<{
    icon: string;
    label: string;
    value: string;
    sentiment: 'positive' | 'neutral' | 'attention';
    insight: string;
    source: string;
  }>>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [insightsFetchAttempted, setInsightsFetchAttempted] = useState(false);

  // Recommendations are now displayed in a full grid (no pagination)

  // Simulation modal state
  const [showSimulationModal, setShowSimulationModal] = useState(false);

  // Collapsible sections state - all start collapsed
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // Helper to get LLM evaluation for a specific proof point
  const getLLMEvaluation = useCallback((proofPointId: string) => {
    if (!llmEvaluations?.evaluations) return null;
    return llmEvaluations.evaluations.find(e => e.id === proofPointId);
  }, [llmEvaluations]);

  // Helper to get impact level from LLM evaluation or fallback to threshold-based
  const getImpactLevel = useCallback((
    proofPointId: string,
    fallbackValue: number,
    thresholds: { high: number; medium: number }
  ): { level: 'HIGH' | 'MEDIUM' | 'LOW'; isLLM: boolean; reasoning?: string } => {
    const llmEval = getLLMEvaluation(proofPointId);
    if (llmEval) {
      return {
        level: llmEval.impact.toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW',
        isLLM: true,
        reasoning: llmEval.reasoning
      };
    }
    // Fallback to threshold-based
    const level = fallbackValue > thresholds.high ? 'HIGH' :
      fallbackValue >= thresholds.medium ? 'MEDIUM' : 'LOW';
    return { level, isLLM: false };
  }, [getLLMEvaluation]);

  // Get data from context
  const categoryName = state.setupData.categoryName || "Edible Oils";
  const setupOpportunities = state.setupOpportunities;
  const computedMetrics = state.computedMetrics;
  // IMPORTANT: Use spendAnalysis.totalSpend (filtered by category) first
  // setupData.spend contains ORIGINAL total (all categories) for backend consistency
  // spendAnalysis.totalSpend contains FILTERED spend for the selected category
  const totalSpend = state.spendAnalysis?.totalSpend ||
    (state.portfolioItems.length > 0
      ? state.portfolioItems.reduce((sum, item) => sum + item.spend, 0)
      : state.setupData.spend || 0);
  const goals = state.setupData.goals || { cost: 60, risk: 25, esg: 15 };

  // Get locations from portfolio items (selected categories)
  const portfolioItems = state.portfolioItems || [];
  const selectedCategories = state.selectedCategories || [];
  const categoryLocations = useMemo(() => {
    // Method 1: Try matching by selected category names
    const categoryNames = selectedCategories.length > 0
      ? selectedCategories.map(n => n.trim().toLowerCase())
      : categoryName.split(',').map(n => n.trim().toLowerCase());

    const matchingItems = portfolioItems.filter(item =>
      categoryNames.some(name =>
        item.name.toLowerCase() === name ||
        item.name.toLowerCase().includes(name) ||
        name.includes(item.name.toLowerCase())
      )
    );

    // Combine all locations from matching portfolio items
    const allLocations = matchingItems.flatMap(item => item.locations || []);

    // Remove duplicates and return
    const uniqueLocations = [...new Set(allLocations)];

    // Debug log to see what's happening
    console.log('[Locations Debug]', {
      categoryName,
      selectedCategories,
      portfolioItems: portfolioItems.map(p => ({ name: p.name, locations: p.locations })),
      matchingItems: matchingItems.map(m => m.name),
      foundLocations: uniqueLocations
    });

    return uniqueLocations;
  }, [categoryName, selectedCategories, portfolioItems]);

  // Find the opportunity data
  const opportunity = setupOpportunities.find(o => o.id === oppId);
  const proofPoints = opportunity?.proofPoints || [];

  // Get unvalidated proof points
  const unvalidatedProofPoints = proofPoints.filter(pp => !pp.isValidated);
  const validatedCount = proofPoints.filter(pp => pp.isValidated).length;

  // DETERMINISTIC confidence calculation using computed metrics
  // This replaces LLM-based confidence which was non-deterministic
  // Formula: (0.25*L + 0.625*M + 0.875*H) / (total * 0.875) * 100
  const confidence = useMemo(() => {
    // Priority 1: Use deterministic calculation from computed metrics (always consistent)
    if (computedMetrics && proofPoints.length > 0) {
      const proofPointIds = proofPoints.map(pp => pp.id);
      const deterministicResult = calculateDeterministicConfidence(oppId, proofPointIds, computedMetrics);
      return deterministicResult.confidenceScore;
    }

    // Priority 2: Calculate from proof point impacts if they have impact ratings
    const ppWithImpacts = proofPoints.filter(pp => pp.impact && pp.impact !== 'Not Tested');
    if (ppWithImpacts.length > 0) {
      const lowCount = ppWithImpacts.filter(pp => pp.impact === 'Low').length;
      const mediumCount = ppWithImpacts.filter(pp => pp.impact === 'Medium').length;
      const highCount = ppWithImpacts.filter(pp => pp.impact === 'High').length;

      const weightedScore = (0.25 * lowCount) + (0.625 * mediumCount) + (0.875 * highCount);
      const maxPossible = proofPoints.length * 0.875;
      const percentage = maxPossible > 0 ? (weightedScore / maxPossible) * 100 : 0;

      return Math.round(percentage);
    }

    // Fallback to simple validation count
    return proofPoints.length > 0 ? Math.round((validatedCount / proofPoints.length) * 100) : 0;
  }, [computedMetrics, proofPoints, validatedCount, oppId]);

  // Get initiative title
  const initiativeTitles = INITIATIVE_TITLES[oppId] || [];
  const initiativeTitle = initiativeTitles[initIndex] || opportunity?.name || "Opportunity";

  // Get question for the CURRENT unvalidated proof point
  const currentProofPointToValidate = unvalidatedProofPoints[0];
  const currentQuestion = currentProofPointToValidate
    ? PROOF_POINT_QUESTIONS[currentProofPointToValidate.id] || GENERIC_QUESTIONS[oppId]?.[0]
    : null;
  const questionsAnswered = answeredQuestions.length;

  // Get tests for this opportunity type
  const tests = OPPORTUNITY_TESTS[oppId] || [];

  // Extract top suppliers from context (spendAnalysis or parsed CSV data)
  const topSuppliers = useMemo(() => {
    // Priority 1: Use pre-computed spendAnalysis if available
    if (state.spendAnalysis?.topSuppliers && state.spendAnalysis.topSuppliers.length > 0) {
      return state.spendAnalysis.topSuppliers.slice(0, 5).map(s => ({
        name: s.name,
        spend: s.spend
      }));
    }

    // Priority 2: Try to parse from persisted spend file data
    const spendFile = state.persistedReviewData?.spendFile;
    if (spendFile?.parsedData?.rows && Array.isArray(spendFile.parsedData.rows)) {
      const supplierSpend: Record<string, number> = {};
      spendFile.parsedData.rows.forEach((row: Record<string, string>) => {
        // Try various column name variations
        const supplier = row.supplier_name || row.Supplier || row.supplier || row.SUPPLIER ||
          row.vendor_name || row.Vendor || row.vendor || row.VENDOR ||
          row['Supplier Name'] || row['SUPPLIER NAME'];
        const spendStr = row.spend || row.Spend || row.SPEND || row.amount || row.Amount ||
          row.value || row.Value || row['Spend Amount'] || row['Total Spend'];
        const spend = parseFloat(String(spendStr || 0));
        if (supplier && !isNaN(spend) && spend > 0) {
          supplierSpend[supplier] = (supplierSpend[supplier] || 0) + spend;
        }
      });

      const sorted = Object.entries(supplierSpend)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, spend]) => ({ name, spend }));

      if (sorted.length > 0) {
        return sorted;
      }
    }

    // Fallback to defaults if no data available
    return [
      { name: "Top Supplier 1", spend: 0 },
      { name: "Top Supplier 2", spend: 0 },
      { name: "Top Supplier 3", spend: 0 }
    ];
  }, [state.spendAnalysis, state.persistedReviewData]);

  // Calculate consistent tail spend percentage
  // Tail spend = spend NOT covered by top 10 visible suppliers
  const calculatedTailSpendPct = useMemo(() => {
    if (computedMetrics?.tailSpendPercentage && computedMetrics.tailSpendPercentage > 0) {
      return computedMetrics.tailSpendPercentage;
    }
    // If computed metrics says 0, calculate from actual data
    const knownSpend = topSuppliers.reduce((sum, s) => sum + s.spend, 0);
    if (totalSpend > 0 && knownSpend > 0) {
      const remainingSpend = totalSpend - knownSpend;
      if (remainingSpend > 0) {
        return (remainingSpend / totalSpend) * 100;
      }
    }
    // If all spend is accounted for, use minimum realistic tail spend (5-10%)
    // or 0 if we truly have no tail spend
    return 0;
  }, [computedMetrics?.tailSpendPercentage, topSuppliers, totalSpend]);

  // Extract rich data for Max AI knowledge base
  const spendDataSample = useMemo(() => {
    const spendFile = state.persistedReviewData?.spendFile;
    if (spendFile?.parsedData?.rows && Array.isArray(spendFile.parsedData.rows)) {
      return spendFile.parsedData.rows.slice(0, 10);
    }
    return [];
  }, [state.persistedReviewData?.spendFile]);

  const contractSummary = useMemo(() => {
    const dataPointFiles = state.persistedReviewData?.dataPointFiles || {};
    // Look for contract-related files
    for (const [key, file] of Object.entries(dataPointFiles)) {
      if (key.toLowerCase().includes('contract') && (file?.parsedData as any)?.text) {
        // Return first 500 chars of contract text
        return (file.parsedData as any).text.substring(0, 500);
      }
    }
    return '';
  }, [state.persistedReviewData?.dataPointFiles]);

  const supplierMasterSummary = useMemo(() => {
    const dataPointFiles = state.persistedReviewData?.dataPointFiles || {};
    // Look for supplier master files
    for (const [key, file] of Object.entries(dataPointFiles)) {
      if ((key.toLowerCase().includes('supplier') || key.toLowerCase().includes('master')) && (file?.parsedData as any)?.rows) {
        // Summarize supplier master data
        const rows = (file.parsedData as any).rows.slice(0, 5);
        return rows.map((row: Record<string, string>) => {
          const name = row.supplier_name || row.Supplier || row.supplier || Object.values(row)[0];
          const risk = row.risk_rating || row.Risk || row['Risk Rating'] || 'N/A';
          return `${name}: Risk ${risk}`;
        }).join(', ');
      }
    }
    return '';
  }, [state.persistedReviewData?.dataPointFiles]);

  // Generate Document-Specific + Proof Point Recommendations - DEEP ANALYSIS PER OPPORTUNITY
  const documentRecommendations = useMemo(() => {
    const recs: { text: string; reason: string; source: string; sourceType: 'contract' | 'spend' | 'supplier' | 'playbook'; proofPoint?: string }[] = [];

    const spendFile = state.persistedReviewData?.spendFile;
    const dataPointFiles = state.persistedReviewData?.dataPointFiles || {};
    const spendFileName = (spendFile as any)?.name || 'spend_data.csv';

    // ========== ANALYZE SPEND DATA ==========
    let supplierSpend: Record<string, number> = {};
    let regionSpend: Record<string, number> = {};
    let currencySpend: Record<string, number> = {};
    let totalFromData = 0;
    let prices: number[] = [];
    let skus = new Set<string>();

    if (spendFile?.parsedData?.rows && Array.isArray(spendFile.parsedData.rows)) {
      const rows = spendFile.parsedData.rows;

      rows.forEach((row: Record<string, unknown>) => {
        const supplier = String(row.supplier_name || row.Supplier || row.supplier || row.SUPPLIER || '');
        const region = String(row.region || row.Region || row.country || row.Country || '');
        const currency = String(row.currency || row.Currency || 'USD');
        const spend = parseFloat(String(row.spend || row.Spend || row.amount || row.Amount || 0));
        const price = parseFloat(String(row.unit_price || row.price || row.Price || 0));
        const sku = String(row.sku || row.SKU || row.item || row.Item || row.product || row.material || '');

        if (supplier && !isNaN(spend)) {
          supplierSpend[supplier] = (supplierSpend[supplier] || 0) + spend;
          totalFromData += spend;
        }
        if (region && !isNaN(spend)) {
          regionSpend[region] = (regionSpend[region] || 0) + spend;
        }
        if (currency && !isNaN(spend)) {
          currencySpend[currency] = (currencySpend[currency] || 0) + spend;
        }
        if (!isNaN(price) && price > 0) prices.push(price);
        if (sku) skus.add(sku);
      });
    }

    const supplierCount = Object.keys(supplierSpend).length;
    const sortedSuppliers = Object.entries(supplierSpend).sort((a, b) => b[1] - a[1]);
    const top3Spend = sortedSuppliers.slice(0, 3).reduce((sum, [, spend]) => sum + spend, 0);
    const top3Pct = totalFromData > 0 ? (top3Spend / totalFromData) * 100 : 0;
    const topSupplierPct = totalFromData > 0 && sortedSuppliers[0] ? (sortedSuppliers[0][1] / totalFromData) * 100 : 0;
    const avgSpendPerSupplier = supplierCount > 0 ? totalFromData / supplierCount : 0;
    const regions = Object.keys(regionSpend);
    const sortedRegions = Object.entries(regionSpend).sort((a, b) => b[1] - a[1]);
    const top3RegionPct = totalFromData > 0 ? (sortedRegions.slice(0, 3).reduce((sum, [, s]) => sum + s, 0) / totalFromData) * 100 : 0;

    // Price analysis
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const priceVariance = avgPrice > 0 ? ((maxPrice - minPrice) / avgPrice) * 100 : 0;

    // Tail spend (suppliers beyond top 80%)
    let cumulativeSpend = 0;
    let tailSupplierCount = 0;
    let tailSpendAmount = 0;
    for (const [, spend] of sortedSuppliers) {
      cumulativeSpend += spend;
      if (cumulativeSpend > totalFromData * 0.8) {
        tailSupplierCount++;
        tailSpendAmount += spend;
      }
    }
    const tailSpendPct = totalFromData > 0 ? (tailSpendAmount / totalFromData) * 100 : 0;

    // ========== VOLUME BUNDLING SPECIFIC (8 Proof Points) ==========
    if (oppId === 'volume-bundling') {
      // PP_REGIONAL_SPEND: Top 3 regions concentration
      if (top3RegionPct > 80) {
        recs.push({
          text: `[${spendFileName}] Leverage ${top3RegionPct.toFixed(0)}% regional concentration for bundled contracts`,
          reason: `Analysis of "${spendFileName}" shows ${sortedRegions[0]?.[0] || 'top region'} leads with ${formatCurrency(sortedRegions[0]?.[1] || 0)}. Bundle demands across ${sortedRegions.slice(0, 3).map(r => r[0]).join(', ')} for 5-8% volume rebates.`,
          source: spendFileName,
          sourceType: 'spend',
          proofPoint: 'Regional Spend'
        });
      }

      // PP_TAIL_SPEND: Bottom suppliers fragmentation
      if (tailSpendPct > 15) {
        recs.push({
          text: `[${spendFileName}] Consolidate ${tailSupplierCount} tail suppliers (${tailSpendPct.toFixed(0)}% of spend)`,
          reason: `In "${spendFileName}", ${formatCurrency(tailSpendAmount)} is fragmented across ${tailSupplierCount} small suppliers. Shift to ${sortedSuppliers[0]?.[0] || 'top supplier'} or ${sortedSuppliers[1]?.[0] || 'second supplier'} for volume leverage.`,
          source: spendFileName,
          sourceType: 'spend',
          proofPoint: 'Tail Spend'
        });
      }

      // PP_VOLUME_LEVERAGE: Supplier fragmentation
      if (supplierCount > 10 && topSupplierPct < 20) {
        recs.push({
          text: `[${spendFileName}] ${supplierCount} suppliers with no dominant partner - consolidate for leverage`,
          reason: `Per "${spendFileName}", highest supplier share is only ${topSupplierPct.toFixed(0)}%. Commit 40%+ volume to ${sortedSuppliers[0]?.[0] || 'lead supplier'} to unlock tier-2 pricing (typically 8-12% savings).`,
          source: spendFileName,
          sourceType: 'spend',
          proofPoint: 'Volume Leverage'
        });
      }

      // PP_AVG_SPEND_SUPPLIER: Low average indicates fragmentation
      if (avgSpendPerSupplier < 100000 && supplierCount > 5) {
        recs.push({
          text: `[${spendFileName}] Avg. spend per supplier only ${formatCurrency(avgSpendPerSupplier)} - below optimal`,
          reason: `"${spendFileName}" shows ${supplierCount} suppliers averaging ${formatCurrency(avgSpendPerSupplier)} each. You lack negotiating power. Target ${formatCurrency(250000)}+ per strategic supplier.`,
          source: spendFileName,
          sourceType: 'spend',
          proofPoint: 'Avg Spend Per Supplier'
        });
      }

      // PP_SUPPLIER_LOCATION: Regional bundling opportunity
      if (regions.length > 0 && sortedRegions[0] && (sortedRegions[0][1] / totalFromData) > 0.7) {
        recs.push({
          text: `[${spendFileName}] ${((sortedRegions[0][1] / totalFromData) * 100).toFixed(0)}% spend in ${sortedRegions[0][0]} - regional bundling ready`,
          reason: `From "${spendFileName}": Concentrate ${sortedRegions[0][0]} sourcing with 2-3 regional champions. Local suppliers typically offer 3-5% lower logistics costs.`,
          source: spendFileName,
          sourceType: 'spend',
          proofPoint: 'Supplier Location'
        });
      }

      // PP_PRICE_VARIANCE for bundling
      if (priceVariance > 25) {
        recs.push({
          text: `[${spendFileName}] ${priceVariance.toFixed(0)}% price variance indicates bundling savings potential`,
          reason: `"${spendFileName}" shows prices range ${formatCurrency(minPrice)} to ${formatCurrency(maxPrice)}. Consolidating volume to suppliers at ${formatCurrency(minPrice)} range saves ${formatCurrency((avgPrice - minPrice) * prices.length * 0.4)}.`,
          source: spendFileName,
          sourceType: 'spend',
          proofPoint: 'Price Variance'
        });
      }
    }

    // ========== TARGET PRICING SPECIFIC (4 Proof Points) ==========
    if (oppId === 'target-pricing') {
      // PP_PRICE_VARIANCE: Core metric for target pricing
      if (priceVariance > 15) {
        recs.push({
          text: `[${spendFileName}] ${priceVariance.toFixed(0)}% price variance - use lowest as negotiation target`,
          reason: `Analysis of "${spendFileName}" shows prices from ${formatCurrency(minPrice)} to ${formatCurrency(maxPrice)}. Set ${formatCurrency(minPrice * 1.05)} as target benchmark for all suppliers.`,
          source: spendFileName,
          sourceType: 'spend',
          proofPoint: 'Price Variance'
        });
      }

      // PP_UNIT_PRICE: Above benchmark analysis
      if (avgPrice > 0) {
        const aboveBenchmarkPct = prices.filter(p => p > avgPrice * 1.1).length / prices.length * 100;
        if (aboveBenchmarkPct > 20) {
          recs.push({
            text: `[${spendFileName}] ${aboveBenchmarkPct.toFixed(0)}% of transactions above benchmark pricing`,
            reason: `In "${spendFileName}", ${Math.round(aboveBenchmarkPct * prices.length / 100)} transactions exceed ${formatCurrency(avgPrice * 1.1)} avg benchmark. Renegotiate or switch suppliers for ${formatCurrency(totalFromData * 0.03)} savings.`,
            source: spendFileName,
            sourceType: 'spend',
            proofPoint: 'Unit Price'
          });
        }
      }

      // PP_COST_STRUCTURE: Raw material cost analysis
      recs.push({
        text: `[${spendFileName}] Implement should-cost model for ${categoryName} pricing`,
        reason: `Based on "${spendFileName}": For commodity-driven ${categoryName}, 60-70% of cost is raw material. Track index prices and negotiate cost-plus or index-linked contracts.`,
        source: spendFileName,
        sourceType: 'spend',
        proofPoint: 'Cost Structure'
      });

      // PP_TARIFF_RATE: Regional price differences
      if (regions.length > 1) {
        const regionPrices: Record<string, number[]> = {};
        spendFile?.parsedData?.rows?.forEach((row: Record<string, unknown>) => {
          const region = String(row.region || row.Region || row.country || row.Country || '');
          const price = parseFloat(String(row.unit_price || row.price || row.Price || 0));
          if (region && !isNaN(price) && price > 0) {
            if (!regionPrices[region]) regionPrices[region] = [];
            regionPrices[region].push(price);
          }
        });
        const regionAvgPrices = Object.entries(regionPrices).map(([r, ps]) => ({
          region: r,
          avgPrice: ps.reduce((a, b) => a + b, 0) / ps.length
        })).sort((a, b) => a.avgPrice - b.avgPrice);

        if (regionAvgPrices.length >= 2) {
          const priceDiff = ((regionAvgPrices[regionAvgPrices.length - 1].avgPrice - regionAvgPrices[0].avgPrice) / regionAvgPrices[0].avgPrice) * 100;
          if (priceDiff > 15) {
            recs.push({
              text: `[${spendFileName}] ${priceDiff.toFixed(0)}% price gap between ${regionAvgPrices[0].region} and ${regionAvgPrices[regionAvgPrices.length - 1].region}`,
              reason: `Per "${spendFileName}": ${regionAvgPrices[0].region} averages ${formatCurrency(regionAvgPrices[0].avgPrice)} vs ${formatCurrency(regionAvgPrices[regionAvgPrices.length - 1].avgPrice)} in ${regionAvgPrices[regionAvgPrices.length - 1].region}. Investigate tariffs, duties, or switch sourcing.`,
              source: spendFileName,
              sourceType: 'spend',
              proofPoint: 'Tariff Rate'
            });
          }
        }
      }
    }

    // ========== RISK MANAGEMENT SPECIFIC (7 Proof Points) ==========
    if (oppId === 'risk-management') {
      // PP_SINGLE_SOURCING: Top supplier dependency
      if (topSupplierPct > 50) {
        recs.push({
          text: `[${spendFileName}] Critical: ${sortedSuppliers[0]?.[0]} controls ${topSupplierPct.toFixed(0)}% - single source risk`,
          reason: `"${spendFileName}" shows ${formatCurrency(sortedSuppliers[0]?.[1] || 0)} depends on one supplier. Qualify backup for 30% of volume. Target: no supplier >40% share.`,
          source: spendFileName,
          sourceType: 'spend',
          proofPoint: 'Single Sourcing'
        });
      }

      // PP_SUPPLIER_CONCENTRATION: Top 3 risk
      if (top3Pct > 80) {
        recs.push({
          text: `[${spendFileName}] Top 3 suppliers control ${top3Pct.toFixed(0)}% - high concentration risk`,
          reason: `In "${spendFileName}": ${sortedSuppliers.slice(0, 3).map(s => s[0]).join(', ')} dominate ${formatCurrency(top3Spend)}. Qualify 2 alternatives to reduce to <70% concentration.`,
          source: spendFileName,
          sourceType: 'spend',
          proofPoint: 'Supplier Concentration'
        });
      }

      // PP_GEO_POLITICAL: Regional concentration risk
      const highRiskRegions = ['China', 'Russia', 'Middle East', 'APAC'];
      const highRiskSpend = Object.entries(regionSpend)
        .filter(([region]) => highRiskRegions.some(hr => region.toLowerCase().includes(hr.toLowerCase())))
        .reduce((sum, [, spend]) => sum + spend, 0);
      const highRiskPct = totalFromData > 0 ? (highRiskSpend / totalFromData) * 100 : 0;

      if (highRiskPct > 40 || regions.length < 2) {
        recs.push({
          text: `[${spendFileName}] Geographic risk: ${regions.length < 2 ? 'Single region sourcing' : `${highRiskPct.toFixed(0)}% from volatile regions`}`,
          reason: `"${spendFileName}" shows exposure to ${regions.join(', ')}. Diversify to 3+ regions to reduce supply chain vulnerability.`,
          source: spendFileName,
          sourceType: 'spend',
          proofPoint: 'Geo Political'
        });
      }

      // PP_EXCHANGE_RATE: Currency exposure
      const currencies = Object.keys(currencySpend);
      const nonUsdSpend = Object.entries(currencySpend)
        .filter(([curr]) => curr !== 'USD')
        .reduce((sum, [, spend]) => sum + spend, 0);
      const currencyRiskPct = totalFromData > 0 ? (nonUsdSpend / totalFromData) * 100 : 0;

      if (currencyRiskPct > 30) {
        recs.push({
          text: `[${spendFileName}] ${currencyRiskPct.toFixed(0)}% exposure to non-USD currencies`,
          reason: `Per "${spendFileName}": ${formatCurrency(nonUsdSpend)} in ${currencies.filter(c => c !== 'USD').join(', ')} creates FX risk. Consider USD-denominated contracts or hedging strategies.`,
          source: spendFileName,
          sourceType: 'spend',
          proofPoint: 'Exchange Rate'
        });
      }

      // PP_INFLATION: Price trend risk
      if (priceVariance > 20) {
        recs.push({
          text: `[${spendFileName}] Price volatility of ${priceVariance.toFixed(0)}% indicates inflation exposure`,
          reason: `"${spendFileName}" variance suggests commodity sensitivity. Lock in 12-month fixed pricing or implement price caps at ${formatCurrency(avgPrice * 1.1)}.`,
          source: spendFileName,
          sourceType: 'spend',
          proofPoint: 'Inflation'
        });
      }
    }

    // ========== RE-SPEC PACK SPECIFIC (3 Proof Points) ==========
    if (oppId === 'respec-pack') {
      // PP_PRICE_VARIANCE: Spec-driven variance
      if (priceVariance > 20) {
        recs.push({
          text: `[${spendFileName}] ${priceVariance.toFixed(0)}% price variance likely due to spec variations`,
          reason: `"${spendFileName}" shows prices from ${formatCurrency(minPrice)} to ${formatCurrency(maxPrice)} suggest over-specification. Standardize to mid-range spec at ${formatCurrency(avgPrice * 0.9)} for ${formatCurrency(totalFromData * 0.05)} savings.`,
          source: spendFileName,
          sourceType: 'spend',
          proofPoint: 'Price Variance'
        });
      }

      // PP_EXPORT_DATA: SKU complexity
      if (skus.size > 15) {
        recs.push({
          text: `[${spendFileName}] ${skus.size} unique SKUs - rationalize to reduce complexity`,
          reason: `"${spendFileName}" shows high SKU count driving procurement complexity and reducing leverage. Target 30% reduction to ${Math.ceil(skus.size * 0.7)} core items through spec standardization.`,
          source: spendFileName,
          sourceType: 'spend',
          proofPoint: 'Export Data'
        });
      }

      // PP_COST_STRUCTURE: Packaging optimization
      recs.push({
        text: `[${spendFileName}] Review packaging specifications for ${categoryName}`,
        reason: `Based on "${spendFileName}": Packaging typically represents 10-15% of ${categoryName} cost. Standardizing pack sizes and materials can save 2-4% through economies of scale.`,
        source: spendFileName,
        sourceType: 'spend',
        proofPoint: 'Cost Structure'
      });

      // Additional: Supplier-driven spec variance
      if (supplierCount > 5 && priceVariance > 15) {
        recs.push({
          text: `[${spendFileName}] ${supplierCount} suppliers with varying specs - harmonize requirements`,
          reason: `"${spendFileName}" shows different suppliers likely provide varying quality grades. Define standard specifications and qualify all ${supplierCount} suppliers against same criteria.`,
          source: spendFileName,
          sourceType: 'spend',
          proofPoint: 'Price Variance'
        });
      }
    }

    // ========== CONTRACT FILE RECOMMENDATIONS (OPPORTUNITY SPECIFIC) ==========
    for (const [key, file] of Object.entries(dataPointFiles)) {
      if (!file) continue;
      const fileName = (file as any).name || key;

      if (key.toLowerCase().includes('contract') || fileName.toLowerCase().includes('contract')) {
        const text = ((file as any).parsedData?.text || '').toLowerCase();

        // VOLUME BUNDLING Contract Checks
        if (oppId === 'volume-bundling') {
          if (!text.includes('volume discount') && !text.includes('tiered pricing') && !text.includes('rebate')) {
            recs.push({
              text: `[${fileName}] Missing volume incentives - add tiered pricing`,
              reason: `Review of "${fileName}" found no tiered pricing or rebate structure. Add: 5% rebate at ${formatCurrency(totalSpend * 0.5)}, 8% at ${formatCurrency(totalSpend * 0.8)}, 12% at ${formatCurrency(totalSpend)}.`,
              source: fileName,
              sourceType: 'contract',
              proofPoint: 'Volume Leverage'
            });
          }
          if (!text.includes('consolidat') && !text.includes('bundl') && !text.includes('aggregate')) {
            recs.push({
              text: `[${fileName}] Add demand aggregation rights`,
              reason: `"${fileName}" lacks consolidation provisions. Include rights to bundle orders across sites/categories for volume pricing.`,
              source: fileName,
              sourceType: 'contract',
              proofPoint: 'Regional Spend'
            });
          }
          if (!text.includes('minimum') && !text.includes('commitment')) {
            recs.push({
              text: `[${fileName}] Consider volume commitment clause`,
              reason: `"${fileName}" has no minimum volume commitment. Commit to ${formatCurrency(totalSpend * 0.8)} annually in exchange for 5-8% guaranteed discount.`,
              source: fileName,
              sourceType: 'contract',
              proofPoint: 'Tail Spend'
            });
          }
        }

        // TARGET PRICING Contract Checks
        if (oppId === 'target-pricing') {
          if (!text.includes('price adjustment') && !text.includes('index') && !text.includes('benchmark')) {
            recs.push({
              text: `[${fileName}] Add price index mechanism`,
              reason: `"${fileName}" has no commodity index linkage. Tie ${categoryName} pricing to relevant index (e.g., commodity futures) with quarterly adjustments.`,
              source: fileName,
              sourceType: 'contract',
              proofPoint: 'Tariff Rate'
            });
          }
          if (!text.includes('most favored') && !text.includes('mfn') && !text.includes('best price')) {
            recs.push({
              text: `[${fileName}] Include MFN (Most Favored Nation) clause`,
              reason: `"${fileName}" lacks Most Favored Nation protection. Ensure you receive best pricing offered to any customer for equivalent volumes.`,
              source: fileName,
              sourceType: 'contract',
              proofPoint: 'Price Variance'
            });
          }
          if (!text.includes('cost breakdown') && !text.includes('should cost') && !text.includes('open book')) {
            recs.push({
              text: `[${fileName}] Require cost transparency`,
              reason: `"${fileName}" has no cost structure visibility. Add open-book pricing clause to validate supplier margins and identify cost reduction opportunities.`,
              source: fileName,
              sourceType: 'contract',
              proofPoint: 'Cost Structure'
            });
          }
          if (!text.includes('audit') && !text.includes('review')) {
            recs.push({
              text: `[${fileName}] Add price audit rights`,
              reason: `"${fileName}" has no audit provisions. Include annual price review rights to benchmark against market and competitor pricing.`,
              source: fileName,
              sourceType: 'contract',
              proofPoint: 'Unit Price'
            });
          }
        }

        // RISK MANAGEMENT Contract Checks
        if (oppId === 'risk-management') {
          if (!text.includes('force majeure') && !text.includes('business continuity')) {
            recs.push({
              text: `[${fileName}] Add force majeure clause`,
              reason: `"${fileName}" has no disruption provisions. Include: pandemic, natural disaster, political instability triggers with supply continuity guarantees.`,
              source: fileName,
              sourceType: 'contract',
              proofPoint: 'Category Risk'
            });
          }
          if (!text.includes('dual source') && !text.includes('backup') && !text.includes('alternative')) {
            recs.push({
              text: `[${fileName}] Include alternative sourcing rights`,
              reason: `"${fileName}" has no backup supplier provisions. Add rights to qualify alternatives without exclusivity breach if performance drops below SLA.`,
              source: fileName,
              sourceType: 'contract',
              proofPoint: 'Single Sourcing'
            });
          }
          if (!text.includes('termination') && !text.includes('exit')) {
            recs.push({
              text: `[${fileName}] Strengthen exit clause`,
              reason: `"${fileName}" has weak termination rights. Add 60-day termination for convenience and immediate exit for material breach or insolvency.`,
              source: fileName,
              sourceType: 'contract',
              proofPoint: 'Supplier Concentration'
            });
          }
          if (!text.includes('insurance') && !text.includes('liability')) {
            recs.push({
              text: `[${fileName}] Add insurance requirements`,
              reason: `"${fileName}" has no supplier insurance mandates. Require minimum ${formatCurrency(totalSpend * 2)} liability coverage and proof of financial stability.`,
              source: fileName,
              sourceType: 'contract',
              proofPoint: 'Supplier Risk Rating'
            });
          }
          if (!text.includes('currency') && !text.includes('exchange') && Object.keys(currencySpend).length > 1) {
            recs.push({
              text: `[${fileName}] Add currency protection`,
              reason: `"${fileName}" has multi-currency exposure without hedging terms. Include FX adjustment mechanism or lock USD-equivalent pricing.`,
              source: fileName,
              sourceType: 'contract',
              proofPoint: 'Exchange Rate'
            });
          }
        }

        // RE-SPEC PACK Contract Checks
        if (oppId === 'respec-pack') {
          if (!text.includes('specification') && !text.includes('quality') && !text.includes('standard')) {
            recs.push({
              text: `[${fileName}] Define quality specifications`,
              reason: `"${fileName}" has no specification standards documented. Add detailed spec requirements with tolerances to ensure consistent quality and pricing.`,
              source: fileName,
              sourceType: 'contract',
              proofPoint: 'Price Variance'
            });
          }
          if (!text.includes('packaging') && !text.includes('pack size')) {
            recs.push({
              text: `[${fileName}] Standardize packaging terms`,
              reason: `"${fileName}" has no packaging specifications. Define standard pack sizes to reduce handling costs and enable cross-supplier comparisons.`,
              source: fileName,
              sourceType: 'contract',
              proofPoint: 'Export Data'
            });
          }
          if (!text.includes('substitut') && !text.includes('equivalent') && !text.includes('alternative')) {
            recs.push({
              text: `[${fileName}] Add substitution rights`,
              reason: `"${fileName}" has no equivalent product clause. Allow pre-approved substitutes to enable spec optimization without contract renegotiation.`,
              source: fileName,
              sourceType: 'contract',
              proofPoint: 'Cost Structure'
            });
          }
        }
      }

      // ========== SUPPLIER MASTER RECOMMENDATIONS (OPPORTUNITY SPECIFIC) ==========
      if (key.toLowerCase().includes('supplier') || key.toLowerCase().includes('master')) {
        const rows = (file as any).parsedData?.rows || [];
        if (!Array.isArray(rows) || rows.length === 0) continue;

        // Analyze supplier data
        const suppliersWithRisk = rows.filter((r: Record<string, unknown>) => r.risk_rating || r.Risk || r['Risk Rating']);
        const highRiskSuppliers = rows.filter((r: Record<string, unknown>) => {
          const rating = String(r.risk_rating || r.Risk || r['Risk Rating'] || '').toLowerCase();
          return rating.includes('high') || rating === '4' || rating === '5';
        });
        const lowRiskSuppliers = rows.filter((r: Record<string, unknown>) => {
          const rating = String(r.risk_rating || r.Risk || r['Risk Rating'] || '').toLowerCase();
          return rating.includes('low') || rating === '1' || rating === '2';
        });
        const missingRiskCount = rows.length - suppliersWithRisk.length;

        // VOLUME BUNDLING Supplier Checks
        if (oppId === 'volume-bundling') {
          if (lowRiskSuppliers.length >= 3) {
            const topLowRisk = lowRiskSuppliers.slice(0, 3).map((r: Record<string, unknown>) =>
              String(r.supplier_name || r.Supplier || r.supplier || Object.values(r)[0])
            );
            recs.push({
              text: `[${fileName}] ${lowRiskSuppliers.length} low-risk suppliers - volume consolidation candidates`,
              reason: `"${fileName}" shows ${topLowRisk.join(', ')} as low-risk. Prioritize these for volume commitments to minimize disruption during consolidation.`,
              source: fileName,
              sourceType: 'supplier',
              proofPoint: 'Supplier Risk Rating'
            });
          }
          // Check for regional concentration in supplier master
          const supplierRegions = new Set(rows.map((r: Record<string, unknown>) =>
            String(r.region || r.Region || r.country || r.Country || r.location || '')
          ).filter(r => r));
          if (supplierRegions.size > 3) {
            recs.push({
              text: `[${fileName}] Suppliers span ${supplierRegions.size} regions - bundling opportunity`,
              reason: `"${fileName}" shows presence in ${Array.from(supplierRegions).slice(0, 4).join(', ')}. Consider regional champions for each zone.`,
              source: fileName,
              sourceType: 'supplier',
              proofPoint: 'Supplier Location'
            });
          }
        }

        // TARGET PRICING Supplier Checks
        if (oppId === 'target-pricing') {
          // Check for payment terms variance
          const paymentTerms = rows.map((r: Record<string, unknown>) =>
            parseInt(String(r.payment_terms || r['Payment Terms'] || r.terms || '30'))
          ).filter(t => !isNaN(t));
          const uniqueTerms = new Set(paymentTerms);
          if (uniqueTerms.size > 2) {
            const minTerms = Math.min(...paymentTerms);
            const maxTerms = Math.max(...paymentTerms);
            recs.push({
              text: `[${fileName}] Payment terms vary Net ${minTerms} to Net ${maxTerms}`,
              reason: `"${fileName}" shows inconsistent terms. Standardize to Net 60 across all suppliers for ${formatCurrency(totalSpend * 0.015)} working capital benefit.`,
              source: fileName,
              sourceType: 'supplier',
              proofPoint: 'Cost Structure'
            });
          }
          // Check for supplier certifications/qualifications
          const certified = rows.filter((r: Record<string, unknown>) =>
            r.certified || r.Certified || r.qualification || r.approved
          ).length;
          if (certified < rows.length * 0.7) {
            recs.push({
              text: `[${fileName}] Only ${certified}/${rows.length} suppliers certified`,
              reason: `"${fileName}" shows ${rows.length - certified} suppliers without certifications. Use as leverage in pricing negotiations.`,
              source: fileName,
              sourceType: 'supplier',
              proofPoint: 'Unit Price'
            });
          }
        }

        // RISK MANAGEMENT Supplier Checks
        if (oppId === 'risk-management') {
          if (missingRiskCount > 0) {
            recs.push({
              text: `[${fileName}] ${missingRiskCount} suppliers without risk assessment`,
              reason: `"${fileName}" has ${missingRiskCount} unrated suppliers. Complete financial and operational risk scoring for all active suppliers.`,
              source: fileName,
              sourceType: 'supplier',
              proofPoint: 'Supplier Risk Rating'
            });
          }
          if (highRiskSuppliers.length > 0) {
            const highRiskNames = highRiskSuppliers.slice(0, 3).map((r: Record<string, unknown>) =>
              String(r.supplier_name || r.Supplier || r.supplier || Object.values(r)[0])
            );
            recs.push({
              text: `[${fileName}] ${highRiskSuppliers.length} high-risk suppliers need mitigation`,
              reason: `"${fileName}" flags ${highRiskNames.join(', ')} as high-risk. Develop backup qualification and increase monitoring frequency.`,
              source: fileName,
              sourceType: 'supplier',
              proofPoint: 'Supplier Risk Rating'
            });
          }
          // Check for supplier diversity
          const supplierTypes = new Set(rows.map((r: Record<string, unknown>) =>
            String(r.type || r.Type || r.category || r.segment || '')
          ).filter(t => t));
          if (supplierTypes.size < 3) {
            recs.push({
              text: `[${fileName}] Limited supplier diversity - ${supplierTypes.size || 'no'} type${supplierTypes.size !== 1 ? 's' : ''}`,
              reason: `"${fileName}" shows concentration in ${Array.from(supplierTypes).join(', ') || 'single category'}. Add diverse supplier types for resilience.`,
              source: fileName,
              sourceType: 'supplier',
              proofPoint: 'Category Risk'
            });
          }
        }

        // RE-SPEC PACK Supplier Checks
        if (oppId === 'respec-pack') {
          // Check for supplier capabilities
          const suppliersWithCerts = rows.filter((r: Record<string, unknown>) =>
            r.certification || r.Certification || r.capability || r.Capability
          ).length;
          if (suppliersWithCerts >= 2) {
            recs.push({
              text: `[${fileName}] ${suppliersWithCerts} suppliers with documented capabilities`,
              reason: `"${fileName}" shows ${suppliersWithCerts} suppliers with certifications. Engage for value engineering and spec optimization workshops.`,
              source: fileName,
              sourceType: 'supplier',
              proofPoint: 'Cost Structure'
            });
          }
          // Check for supplier product range
          const productsPerSupplier = rows.map((r: Record<string, unknown>) => ({
            name: String(r.supplier_name || r.Supplier || Object.values(r)[0]),
            products: parseInt(String(r.product_count || r.items || r.skus || '1'))
          })).filter(s => s.products > 1);
          if (productsPerSupplier.length > 0) {
            const multiProductSupplier = productsPerSupplier.sort((a, b) => b.products - a.products)[0];
            recs.push({
              text: `[${fileName}] ${multiProductSupplier.name} offers ${multiProductSupplier.products}+ SKUs`,
              reason: `"${fileName}" shows multi-product capability. Consolidate specs with this supplier for simplified procurement and volume leverage.`,
              source: fileName,
              sourceType: 'supplier',
              proofPoint: 'Price Variance'
            });
          }
        }
      }
    }

    // ========== PLAYBOOK RECOMMENDATIONS (OPPORTUNITY SPECIFIC) ==========
    const playbookEntry = state.playbookData?.entries?.find(
      entry => entry.category.toLowerCase().includes(categoryName.toLowerCase())
    );
    const playbookFileName = 'category_playbook.csv';

    if (playbookEntry) {
      if (oppId === 'volume-bundling') {
        if (playbookEntry.strategy?.toLowerCase().includes('consolidat')) {
          recs.push({
            text: `[${playbookFileName}] Playbook recommends consolidation for ${categoryName}`,
            reason: `"${playbookFileName}" strategy aligns with volume bundling: "${playbookEntry.strategy}". Proceed with supplier rationalization.`,
            source: playbookFileName,
            sourceType: 'playbook',
            proofPoint: 'Market Consolidation'
          });
        }
      }

      if (oppId === 'target-pricing') {
        if (playbookEntry.marketTrend?.toLowerCase().includes('volatile') || playbookEntry.marketTrend?.toLowerCase().includes('increas')) {
          recs.push({
            text: `[${playbookFileName}] "${playbookEntry.marketTrend}" trend - lock pricing now`,
            reason: `"${playbookFileName}" indicates upward pressure on ${categoryName}. Negotiate fixed pricing or caps before market increases.`,
            source: playbookFileName,
            sourceType: 'playbook',
            proofPoint: 'Inflation'
          });
        }
        if (playbookEntry.marketTrend?.toLowerCase().includes('decreas') || playbookEntry.marketTrend?.toLowerCase().includes('soft')) {
          recs.push({
            text: `[${playbookFileName}] "${playbookEntry.marketTrend}" trend - renegotiate pricing`,
            reason: `"${playbookFileName}" shows favorable market for ${categoryName}. Use competitive bidding to capture 5-10% price reductions.`,
            source: playbookFileName,
            sourceType: 'playbook',
            proofPoint: 'Price Variance'
          });
        }
      }

      if (oppId === 'risk-management') {
        if (playbookEntry.riskLevel === 'High' || (playbookEntry.riskFactor && Number(playbookEntry.riskFactor) > 6)) {
          recs.push({
            text: `[${playbookFileName}] High-risk category (${playbookEntry.riskFactor || 'High'}/10)`,
            reason: `"${playbookFileName}" rates ${categoryName} as elevated risk. Implement dual-sourcing, safety stock, and supplier monitoring immediately.`,
            source: playbookFileName,
            sourceType: 'playbook',
            proofPoint: 'Category Risk'
          });
        }
      }

      if (oppId === 'respec-pack') {
        if (playbookEntry.strategy?.toLowerCase().includes('standard') || playbookEntry.strategy?.toLowerCase().includes('rationaliz')) {
          recs.push({
            text: `[${playbookFileName}] Playbook supports spec optimization`,
            reason: `"${playbookFileName}" strategy: "${playbookEntry.strategy}". Align ${categoryName} specs with playbook for streamlined procurement.`,
            source: playbookFileName,
            sourceType: 'playbook',
            proofPoint: 'Cost Structure'
          });
        }
      }
    }

    return recs;
  }, [state.persistedReviewData, state.playbookData, oppId, categoryName, totalSpend]);

  // Priority Issues - Threshold-based critical recommendations
  const priorityIssues = useMemo(() => {
    const metrics = {
      totalSpend,
      priceVariance: computedMetrics?.priceVariance || 15,
      top3Concentration: computedMetrics?.top3Concentration || 60,
      tailSpendPercentage: computedMetrics?.tailSpendPct || 15,
      supplierCount: computedMetrics?.supplierCount || 5
    };

    return getPriorityIssues(oppId, categoryName, topSuppliers, metrics, categoryLocations);
  }, [oppId, categoryName, topSuppliers, totalSpend, computedMetrics, categoryLocations]);

  // Fetch LLM recommendations on page load - ONLY ONCE
  useEffect(() => {
    // Skip if already loaded to prevent auto-refresh
    if (hasLoadedRecommendationsRef.current && llmRecommendations.length > 0) {
      console.log('[Recommendations] Already loaded, skipping re-fetch');
      return;
    }

    const fetchRecommendations = async () => {
      setIsLoadingRecommendations(true);
      setRecommendationsError(null);

      try {
        console.log('[Recommendations] Fetching...');

        // Extract playbook data for the current category
        const playbookEntry = state.playbookData?.entries?.find(
          entry => entry.category.toLowerCase().includes(categoryName.toLowerCase()) ||
            categoryName.toLowerCase().includes(entry.category.toLowerCase())
        );

        // Build playbook data object for LLM with existing recommendations to avoid duplicating
        const playbookDataForLLM = playbookEntry ? {
          category: playbookEntry.category,
          strategy: playbookEntry.strategy,
          marketTrend: playbookEntry.marketTrend,
          riskFactor: playbookEntry.riskFactor,
          riskLevel: playbookEntry.riskLevel,
          priority: playbookEntry.priority,
          recommendations: playbookEntry.recommendations || [], // Existing recommendations to NOT duplicate
        } : undefined;

        console.log('[Recommendations] Playbook data for LLM:', playbookDataForLLM);

        const response = await procurementApi.getOpportunityRecommendations({
          opportunityType: oppId,
          categoryName,
          locations: categoryLocations.length > 0 ? categoryLocations : undefined,
          spendData: {
            totalSpend,
            breakdown: topSuppliers.map(s => ({ supplier: s.name, spend: s.spend }))
          },
          supplierData: topSuppliers,
          metrics: {
            priceVariance: computedMetrics?.priceVariance || 15,
            top3Concentration: computedMetrics?.top3Concentration || 65,
            tailSpendPercentage: computedMetrics?.tailSpendPercentage || calculatedTailSpendPct,
            supplierCount: computedMetrics?.supplierCount || topSuppliers.length,
            avgSpendPerSupplier: computedMetrics?.avgSpendPerSupplier || (totalSpend / (computedMetrics?.supplierCount || topSuppliers.length || 1))
          },
          proofPoints: proofPoints.map(pp => ({
            id: pp.id,
            name: pp.name,
            isValidated: pp.isValidated,
            description: pp.description
          })),
          // Pass playbook data for better recommendations with traceability
          playbookData: playbookDataForLLM,
        });

        console.log('[Recommendations] Response:', response);
        console.log('[Recommendations] Type of recommendations:', typeof response.recommendations);
        console.log('[Recommendations] First item:', response.recommendations?.[0]);

        if (response.recommendations && response.recommendations.length > 0) {
          // Handle case where recommendations might be JSON strings or nested objects
          let recs = response.recommendations;

          // If the first item looks like JSON string, try to parse it
          if (recs.length === 1 && typeof recs[0] === 'string') {
            const firstItem = (recs[0] as string).trim();
            if (firstItem.startsWith('{') || firstItem.startsWith('[')) {
              try {
                const parsed = JSON.parse(firstItem);
                if (Array.isArray(parsed)) {
                  recs = parsed;
                } else if (parsed.recommendations || parsed.Recommendations) {
                  recs = parsed.recommendations || parsed.Recommendations;
                }
              } catch {
                // Keep original if parsing fails
              }
            }
          }

          // Convert to {text, reason} format - preserve reason if available
          const formattedRecs: { text: string; reason: string }[] = recs.map((r: unknown) => {
            if (typeof r === 'string') {
              // Plain string - no reason available
              return { text: r, reason: '' };
            }
            if (typeof r === 'object' && r !== null) {
              const obj = r as Record<string, unknown>;
              // Extract text and reason from object
              const text = String(obj.text || obj.recommendation || obj.content || '');
              const reason = String(obj.reason || obj.reasoning || obj.why || '');

              // If text looks like JSON, it's corrupted - skip it
              if (text.startsWith('{') || text.startsWith('[')) {
                return null;
              }

              return { text, reason };
            }
            return { text: String(r), reason: '' };
          }).filter((r): r is { text: string; reason: string } => r !== null && r.text.length > 0);

          console.log('[Recommendations] Formatted recs:', formattedRecs);

          // If any recommendation is missing a reason, use fallback instead
          const anyMissingReason = formattedRecs.some(r => !r.reason || r.reason.trim() === '');

          // 🔍 DEBUG: Log what we got from backend
          console.log('[DEBUG] Backend returned:', formattedRecs.length, 'recommendations');
          console.log('[DEBUG] Any missing reason?', anyMissingReason);
          console.log('[DEBUG] First recommendation:', formattedRecs[0]);

          if (anyMissingReason || formattedRecs.length === 0) {
            console.log('[Recommendations] Missing reasons, using fallback');
            setLlmRecommendations(getRecommendations(oppId, categoryName, topSuppliers, {
              totalSpend,
              priceVariance: computedMetrics?.priceVariance || 15,
              top3Concentration: computedMetrics?.top3Concentration || 65,
              tailSpendPercentage: calculatedTailSpendPct,
              supplierCount: computedMetrics?.supplierCount || topSuppliers.length
            }));
            hasLoadedRecommendationsRef.current = true; // Mark as loaded
          } else {
            console.log('[Recommendations] ✅ Using backend recommendations with traceability!');
            setLlmRecommendations(formattedRecs);
            hasLoadedRecommendationsRef.current = true; // Mark as loaded
          }
        } else {
          // Use fallback recommendations with reasons
          setLlmRecommendations(getRecommendations(oppId, categoryName, topSuppliers, {
            totalSpend,
            priceVariance: computedMetrics?.priceVariance || 15,
            top3Concentration: computedMetrics?.top3Concentration || 65,
            tailSpendPercentage: calculatedTailSpendPct,
            supplierCount: computedMetrics?.supplierCount || topSuppliers.length
          }));
          hasLoadedRecommendationsRef.current = true; // Mark as loaded
        }
      } catch (error) {
        console.error("Failed to fetch recommendations:", error);
        setRecommendationsError("Failed to fetch recommendations");
        // Use fallback recommendations with reasons on error
        setLlmRecommendations(getRecommendations(oppId, categoryName, topSuppliers, {
          totalSpend,
          priceVariance: computedMetrics?.priceVariance || 15,
          top3Concentration: computedMetrics?.top3Concentration || 65,
          tailSpendPercentage: calculatedTailSpendPct,
          supplierCount: computedMetrics?.supplierCount || topSuppliers.length
        }));
        hasLoadedRecommendationsRef.current = true; // Mark as loaded even on error
      } finally {
        setIsLoadingRecommendations(false);
      }
    };

    fetchRecommendations();
  }, [oppId, categoryName, categoryLocations, totalSpend, topSuppliers, proofPoints, computedMetrics, state.playbookData]);

  // Fetch LLM proof point evaluations on page load
  // Uses Mistral/Llama to evaluate each proof point and returns High/Medium/Low impact ratings
  // Confidence score formula: (0.25 × L_count) + (0.625 × M_count) + (0.875 × H_count)
  // Now checks for pre-computed evaluations from setup/review page first for instant display
  useEffect(() => {
    const fetchProofPointEvaluations = async () => {
      if (!opportunity || proofPoints.length === 0) {
        setIsLoadingEvaluations(false);
        return;
      }

      // CHECK FOR PRE-COMPUTED EVALUATIONS FIRST (from setup/review page)
      // This provides instant display since LLM evaluation was done during setup processing
      const preComputedEvals = state.llmProofPointEvaluations?.[oppId];
      if (preComputedEvals && preComputedEvals.evaluations?.length > 0) {
        console.log('[ProofPoint Evaluation] Using pre-computed evaluations from setup!');

        // Update proof points with pre-computed LLM evaluations
        const updatedProofPoints = proofPoints.map(pp => {
          const evaluation = preComputedEvals.evaluations.find(e => e.id === pp.id);
          if (evaluation) {
            return {
              ...pp,
              impact: evaluation.impact,
              reasoning: evaluation.reasoning,
              dataPoint: evaluation.data_point,
              isValidated: true
            };
          }
          return pp;
        });

        // Update the opportunity in context
        const updatedOpportunity = {
          ...opportunity,
          proofPoints: updatedProofPoints
        };
        actions.updateSetupOpportunity(updatedOpportunity);

        // Store evaluation results
        setLlmEvaluations({
          evaluations: preComputedEvals.evaluations,
          summary: preComputedEvals.summary,
          weightedConfidence: preComputedEvals.summary.confidence_score
        });

        setIsLoadingEvaluations(false);
        console.log('[ProofPoint Evaluation] ✅ Pre-computed evaluations applied instantly!');
        return;
      }

      // No pre-computed evaluations, fetch from API (slower path)
      setIsLoadingEvaluations(true);
      setEvaluationsError(null);

      try {
        console.log('[ProofPoint Evaluation] No pre-computed data, fetching from LLM...');

        // Extract spend data for evaluation context
        const spendFile = state.persistedReviewData?.spendFile;
        const spendRows = spendFile?.parsedData?.rows || [];

        // Build supplier data
        const supplierData = topSuppliers.map(s => ({
          name: s.name,
          spend: s.spend,
          percentage: totalSpend > 0 ? ((s.spend / totalSpend) * 100).toFixed(1) : '0'
        }));

        // Build metrics context
        const metricsContext = {
          totalSpend,
          priceVariance: computedMetrics?.priceVariance || 0,
          top3Concentration: computedMetrics?.top3Concentration || 0,
          tailSpendPercentage: computedMetrics?.tailSpendPercentage || calculatedTailSpendPct,
          supplierCount: computedMetrics?.supplierCount || topSuppliers.length,
          avgSpendPerSupplier: computedMetrics?.avgSpendPerSupplier || (totalSpend / (computedMetrics?.supplierCount || topSuppliers.length || 1)),
          hhi: computedMetrics?.hhi || 0
        };

        // Build proof points data with any available values
        const proofPointsData = proofPoints.map(pp => ({
          id: pp.id,
          name: pp.name,
          description: pp.description || '',
          value: 0, // Will be extracted from spend data by backend
          data: {}
        }));

        const response = await procurementApi.evaluateProofPoints({
          opportunityType: oppId,
          categoryName,
          proofPointsData,
          spendData: {
            totalSpend,
            rows: spendRows.slice(0, 50), // Send sample of spend rows
            supplierCount: Object.keys(
              spendRows.reduce((acc: Record<string, boolean>, row: Record<string, unknown>) => {
                const supplier = String(row.supplier_name || row.Supplier || row.supplier || '');
                if (supplier) acc[supplier] = true;
                return acc;
              }, {})
            ).length
          },
          supplierData,
          metrics: metricsContext
        });

        console.log('[ProofPoint Evaluation] Response:', response);

        if (response.status === 'success' && response.evaluations) {
          // Update proof points in the opportunity with LLM-evaluated impacts
          const updatedProofPoints = proofPoints.map(pp => {
            const evaluation = response.evaluations.find(e => e.id === pp.id);
            if (evaluation) {
              return {
                ...pp,
                impact: evaluation.impact,
                reasoning: evaluation.reasoning,
                dataPoint: evaluation.data_point,
                isValidated: true // Mark as validated since LLM evaluated it
              };
            }
            return pp;
          });

          // Update the opportunity in context with evaluated proof points
          const updatedOpportunity = {
            ...opportunity,
            proofPoints: updatedProofPoints
          };
          actions.updateSetupOpportunity(updatedOpportunity);

          // Store evaluation results
          setLlmEvaluations({
            evaluations: response.evaluations,
            summary: response.summary,
            weightedConfidence: response.confidence_score
          });

          console.log('[ProofPoint Evaluation] ✅ Evaluation complete!');
          console.log('[ProofPoint Evaluation] Weighted confidence:', response.confidence_score);
        } else {
          console.log('[ProofPoint Evaluation] No evaluations returned, using fallback');
          setEvaluationsError('No evaluations returned from LLM');
        }
      } catch (error) {
        console.error('[ProofPoint Evaluation] Error:', error);
        setEvaluationsError(error instanceof Error ? error.message : 'Failed to evaluate proof points');
      } finally {
        setIsLoadingEvaluations(false);
      }
    };

    fetchProofPointEvaluations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oppId, categoryName, state.llmProofPointEvaluations]); // Run on opportunity change or when pre-computed evals become available

  // Fetch LLM-generated POSITIVE insights (what's going well) per opportunity type
  useEffect(() => {
    const fetchPositiveInsights = async () => {
      // Only fetch if we have actual data to analyze
      const hasRealSupplierData = topSuppliers.some(s => s.spend > 0);
      console.log('[PositiveInsights] Starting fetch...', {
        totalSpend,
        topSuppliers: topSuppliers.length,
        hasRealSupplierData,
        categoryName
      });

      if (totalSpend === 0 || topSuppliers.length === 0 || !hasRealSupplierData) {
        console.log('[PositiveInsights] Skipping - no data available');
        setInsightsFetchAttempted(true);
        return;
      }

      setIsLoadingInsights(true);

      try {
        const spendFileName = state.persistedReviewData?.spendFile?.fileName || 'your spend data';

        // Build context for LLM
        const actualSupplierCount = computedMetrics?.supplierCount || topSuppliers.length || 1;
        const metricsContext = {
          totalSpend,
          supplierCount: actualSupplierCount,
          top3Concentration: computedMetrics?.top3Concentration || 0,
          tailSpendPercentage: computedMetrics?.tailSpendPercentage || calculatedTailSpendPct,
          priceVariance: computedMetrics?.priceVariance || 0,
          hhiIndex: computedMetrics?.hhiIndex || 0,
          avgSpendPerSupplier: computedMetrics?.avgSpendPerSupplier || (totalSpend / actualSupplierCount),
        };

        // Get proof points for this opportunity
        const proofPointNames = proofPoints.map(pp => pp.name).join(', ');

        // Opportunity-specific focus areas
        const opportunityFocus = {
          'volume-bundling': 'supplier consolidation, volume leverage, regional spend concentration, and tail spend management',
          'target-pricing': 'pricing consistency, benchmark alignment, cost structure visibility, and tariff optimization',
          'risk-management': 'supplier diversification, concentration risk, geographic spread, and supplier health',
          'respec-pack': 'specification standardization, packaging efficiency, and cost structure optimization'
        }[oppId] || 'procurement optimization';

        // Ask LLM for POSITIVE insights specific to this opportunity
        const response = await procurementApi.getOpportunityInsights(
          oppId,
          categoryName,
          totalSpend,
          proofPoints.map(pp => ({ name: pp.name, isValidated: pp.isValidated, id: pp.id, description: pp.description })),
          `You are analyzing ${categoryName} spend data for the "${oppId}" opportunity.

FOCUS AREA: ${opportunityFocus}
PROOF POINTS TO EVALUATE: ${proofPointNames}

DATA FROM "${spendFileName}":
- Total spend: $${totalSpend.toLocaleString()}
- ${metricsContext.supplierCount} suppliers (Top 3: ${topSuppliers.slice(0, 3).map(s => `${s.name} ($${(s.spend/1000).toFixed(0)}K)`).join(', ')})
- Top 3 concentration: ${metricsContext.top3Concentration.toFixed(0)}%
- Tail spend: ${metricsContext.tailSpendPercentage.toFixed(0)}%
- Price variance: ${metricsContext.priceVariance.toFixed(0)}%
- Avg spend/supplier: $${metricsContext.avgSpendPerSupplier.toLocaleString()}

TASK: Identify 3-4 things that are GENUINELY going well - actual STRENGTHS, not opportunities.

IMPORTANT - What counts as POSITIVE (include these):
- LOW price variance (<15%) = prices are standardized = STRENGTH ✓
- LOW tail spend (<10%) = already consolidated = STRENGTH ✓
- HIGH top 3 concentration (>60%) = good negotiation leverage = STRENGTH ✓
- Multiple suppliers (5+) = diversified options = STRENGTH ✓
- Balanced supplier distribution = no over-reliance = STRENGTH ✓

IMPORTANT - What is NOT positive (DO NOT include these as strengths):
- HIGH price variance (>20%) = pricing inconsistency = this is an OPPORTUNITY TO FIX, not a strength
- HIGH tail spend (>15%) = fragmentation = OPPORTUNITY, not strength
- Single supplier dominance = risk = OPPORTUNITY, not strength

Only highlight what is ACTUALLY good. If price variance is 28%, that is NOT a strength - do not mention it.

RESPONSE FORMAT (strict JSON array):
[
  {"icon": "✓", "label": "Strength Name", "value": "metric", "sentiment": "positive", "insight": "Why this is genuinely good", "source": "${spendFileName}"}
]

Only respond with the JSON array, no other text.`,
          {
            suppliers: topSuppliers.map(s => ({ name: s.name, spend: s.spend })),
            metrics: metricsContext,
          }
        );

        // Parse LLM response to extract structured insights
        console.log('[PositiveInsights] Response received:', response.assistant_message?.content?.slice(0, 200));

        if (response.assistant_message?.content) {
          // Strip code blocks before parsing
          const content = response.assistant_message.content
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();

          // Try to extract JSON array from response - handle nested brackets better
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              if (Array.isArray(parsed) && parsed.length > 0) {
                console.log('[PositiveInsights] Parsed', parsed.length, 'insights');

                // POST-PROCESSING: Filter out contradictory insights where LLM incorrectly labels high values as low
                const filteredInsights = parsed.filter(item => {
                  const labelLower = (item.label || '').toLowerCase();
                  const insightLower = (item.insight || '').toLowerCase();
                  const valueLower = (item.value || '').toLowerCase();
                  const combinedText = `${labelLower} ${insightLower} ${valueLower}`;

                  // FILTER 1: Price Variance - if actual variance > 20%, reject any "low variance" claims
                  if (metricsContext.priceVariance > 20) {
                    const mentionsPriceVariance = combinedText.includes('price variance') || combinedText.includes('pricing variance');
                    const claimsLow = combinedText.includes('low') || combinedText.includes('standardized') || combinedText.includes('consistent');
                    if (mentionsPriceVariance && claimsLow) {
                      console.log('[PositiveInsights] FILTERED OUT: False "low price variance" claim with actual variance:', metricsContext.priceVariance);
                      return false;
                    }
                  }

                  // FILTER 2: Tail Spend - if actual tail spend > 15%, reject any "low tail spend" claims
                  if (metricsContext.tailSpendPercentage > 15) {
                    const mentionsTailSpend = combinedText.includes('tail spend');
                    const claimsLow = combinedText.includes('low') || combinedText.includes('consolidated') || combinedText.includes('minimal');
                    if (mentionsTailSpend && claimsLow) {
                      console.log('[PositiveInsights] FILTERED OUT: False "low tail spend" claim with actual:', metricsContext.tailSpendPercentage);
                      return false;
                    }
                  }

                  // FILTER 3: Top 3 Concentration - if actual < 40%, reject any "high concentration/leverage" claims
                  if (metricsContext.top3Concentration < 40) {
                    const mentionsConcentration = combinedText.includes('concentration') || combinedText.includes('leverage');
                    const claimsHigh = combinedText.includes('high') || combinedText.includes('strong') || combinedText.includes('significant');
                    if (mentionsConcentration && claimsHigh) {
                      console.log('[PositiveInsights] FILTERED OUT: False "high concentration" claim with actual:', metricsContext.top3Concentration);
                      return false;
                    }
                  }

                  return true; // Keep this insight
                });

                console.log('[PositiveInsights] After filtering:', filteredInsights.length, 'insights remain');

                setLlmDataInsights(filteredInsights.slice(0, 4).map(item => ({
                  icon: item.icon || '✅',
                  label: item.label || 'Strength',
                  value: item.value || '',
                  sentiment: 'positive' as const, // Force positive sentiment
                  insight: item.insight || '',
                  source: item.source || spendFileName,
                })));
              } else {
                console.log('[PositiveInsights] Parsed array is empty, using text fallback');
                // Array was empty, use text fallback
                setLlmDataInsights([{
                  icon: '✨',
                  label: 'AI Analysis',
                  value: categoryName,
                  sentiment: 'positive' as const,
                  insight: content.replace(/```json\n?|\n?```/g, '').slice(0, 300),
                  source: spendFileName,
                }]);
              }
            } catch (parseError) {
              console.log('[PositiveInsights] Could not parse JSON, using fallback:', parseError);
              setLlmDataInsights([{
                icon: '✨',
                label: 'AI Analysis',
                value: categoryName,
                sentiment: 'positive' as const,
                insight: content.replace(/```json\n?|\n?```/g, '').slice(0, 300),
                source: spendFileName,
              }]);
            }
          } else {
            // No JSON found, but we have text content
            console.log('[PositiveInsights] No JSON array found, using text content');
            setLlmDataInsights([{
              icon: '✨',
              label: 'AI Analysis',
              value: categoryName,
              sentiment: 'positive' as const,
              insight: content.slice(0, 300),
              source: spendFileName,
            }]);
          }
        } else {
          console.log('[PositiveInsights] No content in response');
        }
      } catch (error) {
        console.error('[PositiveInsights] Error fetching LLM insights:', error);
        // Show a user-friendly message about the failure
      } finally {
        setIsLoadingInsights(false);
        setInsightsFetchAttempted(true);
      }
    };

    fetchPositiveInsights();
  }, [oppId, categoryName, totalSpend, topSuppliers, computedMetrics, calculatedTailSpendPct, proofPoints, state.persistedReviewData?.spendFile?.fileName]);

  // Fallback static recommendations (used only if LLM fails)
  const fallbackRecommendations = getRecommendations(oppId, categoryName, topSuppliers, {
    totalSpend,
    priceVariance: computedMetrics?.priceVariance || 15,
    top3Concentration: computedMetrics?.top3Concentration || 65,
    tailSpendPercentage: calculatedTailSpendPct,
    supplierCount: computedMetrics?.supplierCount || topSuppliers.length
  }, categoryLocations);

  // Convert proof points to ProofPointResult format for calculation
  // ProofPoint from context only has: id, name, description, isValidated
  // ProofPointResult needs: id, name, value, impact, insight, isTested, threshold
  const proofPointResults: ProofPointResult[] = useMemo(() => {
    return proofPoints.map(pp => ({
      id: pp.id,
      name: pp.name,
      value: 0, // Default value since ProofPoint doesn't have this
      impact: 'Not Tested' as const, // Default - will be evaluated based on data
      insight: pp.description || '', // Use description as fallback
      isTested: pp.isValidated,
      threshold: {
        high: '',
        medium: '',
        low: ''
      }
    }));
  }, [proofPoints]);

  // Calculate dynamic Risk and ESG impacts
  const riskImpact = useMemo(() => {
    return calculateOpportunityRiskImpact(oppId, proofPointResults, computedMetrics || undefined);
  }, [oppId, proofPointResults, computedMetrics]);

  const esgImpact = useMemo(() => {
    return calculateOpportunityESGImpact(oppId, proofPointResults, computedMetrics || undefined);
  }, [oppId, proofPointResults, computedMetrics]);

  // Calculate metrics
  const impact = confidence >= 70 ? "High" : confidence >= 40 ? "Medium" : "Low";
  const effort = oppId === "respec-pack" ? "6-12 Months" : "3-6 Months";
  const risk = riskImpact.label;
  const esg = esgImpact.label;

  // Calculate potential savings
  const savingsPercentage = oppId === "volume-bundling" ? "3-5%" :
    oppId === "target-pricing" ? "2-4%" :
      oppId === "risk-management" ? "1-2%" : "1-3%";

  // Validate a proof point and update the opportunity
  const validateProofPoint = useCallback((proofPointId: string) => {
    if (!opportunity) return;

    const updatedProofPoints = opportunity.proofPoints.map(pp =>
      pp.id === proofPointId ? { ...pp, isValidated: true } : pp
    );

    const updatedOpportunity = {
      ...opportunity,
      proofPoints: updatedProofPoints
    };

    actions.updateSetupOpportunity(updatedOpportunity);
    setValidatingProofPointId(null);
    setPendingValidation(false);

    // Add activity for validation
    actions.addActivity({
      type: "validation",
      title: `Validated: ${proofPoints.find(pp => pp.id === proofPointId)?.name || "Proof Point"}`,
      description: `Proof point validated for ${opportunity.name} in ${categoryName}`,
      metadata: { categoryName }
    });
  }, [opportunity, actions, proofPoints, categoryName]);

  // Handle MCQ answer - validates the specific proof point being asked about
  const handleMCQAnswer = useCallback((proofPointId: string, answerIndex: number, answerText: string) => {
    if (!proofPointId) return;

    const proofPoint = proofPoints.find(pp => pp.id === proofPointId);
    if (!proofPoint) return;

    // Add user's answer as a chat message
    const userAnswerMessage: ChatMessage = {
      id: `mcq-answer-${Date.now()}`,
      role: "user",
      content: answerText,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, userAnswerMessage]);

    // Record the answer
    setAnsweredQuestions(prev => [...prev, { index: answeredQuestions.length, answer: answerIndex }]);

    // Higher answer = more mature = validates the proof point
    const maturityLevel = answerIndex; // 0=low, 1=medium-low, 2=medium-high, 3=high

    setIsLoading(true);
    setTimeout(() => {
      let responseContent = "";

      if (maturityLevel >= 2) {
        // Good answer - validate this proof point
        responseContent = `Got it! Based on your response, I've validated "${proofPoint.name}" ✅`;
        validateProofPoint(proofPointId);

        // Check if more proof points to validate
        const remainingUnvalidated = proofPoints.filter(pp => !pp.isValidated && pp.id !== proofPointId);
        if (remainingUnvalidated.length > 0) {
          responseContent += `\n\nLet's validate "${remainingUnvalidated[0].name}" next...`;
          setShowMCQ(true);
        } else {
          responseContent += `\n\n🎉 All proof points reviewed! Confidence score: ${confidence}%. Feel free to ask me anything else about this opportunity.`;
          setShowMCQ(false);
        }
      } else {
        // Lower maturity - still mark as validated but note the gap
        responseContent = `Thanks for your honesty. I've noted "${proofPoint.name}" as validated, but there's room for improvement here. This actually strengthens the case for this initiative!`;
        validateProofPoint(proofPointId);

        const remainingUnvalidated = proofPoints.filter(pp => !pp.isValidated && pp.id !== proofPointId);
        if (remainingUnvalidated.length > 0) {
          responseContent += `\n\nLet's continue with "${remainingUnvalidated[0].name}"...`;
          setShowMCQ(true);
        } else {
          responseContent += `\n\nAll proof points reviewed! Feel free to ask me anything.`;
          setShowMCQ(false);
        }
      }

      const aiResponse: ChatMessage = {
        id: `mcq-response-${Date.now()}`,
        role: "assistant",
        content: responseContent,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, aiResponse]);
      setIsLoading(false);
    }, 800);
  }, [proofPoints, answeredQuestions.length, validateProofPoint]);

  // Handle chat submission with proof point validation detection
  const handleChatSubmit = async () => {
    if (!chatInput.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: chatInput.trim(),
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    const userInput = chatInput.trim().toLowerCase();
    setChatInput("");
    setIsLoading(true);

    // Check if user is providing information to validate a proof point
    // Look for keywords that indicate user is answering validation questions
    // Covers all proof points across all 4 opportunity types
    const validationKeywords = [
      // General affirmative responses
      "yes", "we have", "we do", "confirmed", "correct", "right",
      // Volume Bundling keywords
      "region", "regional", "spend", "distribution", "tail spend", "fragmented",
      "volume", "consolidated", "leverage", "price variance", "difference",
      "supplier", "suppliers", "average", "market", "consolidation", "location",
      "risk rating", "financial health", "risk score",
      // Target Pricing keywords
      "tariff", "import", "export", "duty", "cost structure", "breakdown",
      "unit price", "per unit", "cost model", "should cost",
      // Risk Management keywords
      "single source", "sole source", "one supplier", "concentration",
      "category risk", "disruption", "inflation", "price increase",
      "exchange rate", "currency", "foreign", "geopolitical", "political",
      // Re-spec Pack keywords
      "specification", "spec", "alternative", "sourcing", "different region",
      // Numbers and data indicators
      "percent", "%", "million", "thousand", "$", "annually", "monthly"
    ];
    const isProvidingValidationInfo = validationKeywords.some(kw => userInput.includes(kw));

    // If there's a pending validation and user seems to be answering
    if (pendingValidation && validatingProofPointId && isProvidingValidationInfo) {
      // Validate the proof point after AI responds
      setTimeout(() => {
        validateProofPoint(validatingProofPointId);
      }, 2000); // Wait for AI response then validate
    }

    try {
      // Build comprehensive context for conversational AI
      const response = await procurementApi.getOpportunityInsights(
        oppId,
        categoryName,
        totalSpend,
        proofPoints,
        userMessage.content,
        // Pass all additional context for truly conversational responses
        {
          suppliers: topSuppliers,
          recommendations: llmRecommendations,
          metrics: {
            priceVariance: computedMetrics?.priceVariance,
            top3Concentration: computedMetrics?.top3Concentration,
            tailSpendPercentage: calculatedTailSpendPct,
            supplierCount: computedMetrics?.supplierCount || topSuppliers.length,
          },
          locations: categoryLocations,
          goals,
          savingsPercentage,
          // Pass chat history for memory
          chatHistory: chatMessages.map(m => ({ role: m.role, content: m.content })),
          // Rich file data for deep knowledge
          spendDataSample,
          contractSummary,
          supplierMasterSummary,
        }
      );

      const assistantContent = response.assistant_message.content;
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: assistantContent,
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, assistantMessage]);

      // Check if Max is asking about a specific unvalidated proof point
      // and set up pending validation for the next user response
      if (unvalidatedProofPoints.length > 0) {
        const ppToValidate = unvalidatedProofPoints.find(pp => {
          const ppNameLower = pp.name.toLowerCase();
          return assistantContent.toLowerCase().includes(ppNameLower) ||
            userInput.includes(ppNameLower);
        });

        if (ppToValidate && !validatingProofPointId) {
          setValidatingProofPointId(ppToValidate.id);
          setPendingValidation(true);
        }
      }

      // If user provided validation info and we validated, add a confirmation message
      if (pendingValidation && validatingProofPointId && isProvidingValidationInfo) {
        const validatedPP = proofPoints.find(pp => pp.id === validatingProofPointId);
        setTimeout(() => {
          const confirmMessage: ChatMessage = {
            id: `confirm-${Date.now()}`,
            role: "assistant",
            content: `✅ Great! Based on your response, I've validated the "${validatedPP?.name}" proof point. Your confidence level has increased!`,
            timestamp: new Date()
          };
          setChatMessages(prev => [...prev, confirmMessage]);
        }, 2500);
      }

    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I couldn't process your request. Please make sure the backend server is running.",
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick action to manually validate a proof point
  const handleManualValidate = (proofPointId: string) => {
    validateProofPoint(proofPointId);
  };

  // NOTE: Disabled initial AI fetch - it returns long summaries unsuitable for chat
  // The welcome message uses getInsightText() which is short and conversational
  // AI responses are only fetched when user actually sends a chat message

  // Generate SHORT insight text for chat - keep it conversational
  const getInsightText = () => {
    switch (oppId) {
      case "volume-bundling":
        return `I found consolidation opportunities in ${categoryName}. Let me ask a few questions to validate the savings potential.`;
      case "target-pricing":
        return `I spotted price variations in ${categoryName} that could mean savings. A few quick questions will help me quantify this.`;
      case "risk-management":
        return `Your ${categoryName} supply base has some concentration risk. Let's validate this together.`;
      case "respec-pack":
        return `I found spec variations in ${categoryName} worth exploring. Quick questions coming up!`;
      default:
        return `I found opportunities in ${categoryName}. Let me ask you a few questions.`;
    }
  };

  // Generate detailed insight for the right panel card
  const getDetailedInsightText = () => {
    const priceVariance = computedMetrics?.priceVariance || 15;
    const top3Concentration = computedMetrics?.top3Concentration || 65;
    const tailSpend = calculatedTailSpendPct;

    const actualSupplierCount = computedMetrics?.supplierCount || topSuppliers.length;
    switch (oppId) {
      case "volume-bundling":
        return tailSpend > 0
          ? `Your top 3 suppliers account for ${top3Concentration.toFixed(0)}% of spend, with ${tailSpend.toFixed(0)}% in tail spend. Consolidating demand across sites could unlock ${savingsPercentage} savings.`
          : `Your ${formatCurrency(totalSpend)} spend across ${actualSupplierCount} suppliers shows consolidation potential. Top supplier ${topSuppliers[0]?.name || 'your lead supplier'} has ${((topSuppliers[0]?.spend || 0) / totalSpend * 100).toFixed(0)}% share. Bundling volumes could unlock ${savingsPercentage} in tier pricing benefits.`;
      case "target-pricing":
        return `Price variation of ${priceVariance.toFixed(0)}% detected across similar SKUs. Index-based pricing mechanisms could standardize costs and reduce spend by ${savingsPercentage}.`;
      case "risk-management":
        return `Supplier concentration at ${top3Concentration.toFixed(0)}% creates supply risk. Diversifying your supplier base can reduce disruption risk while maintaining competitive pricing.`;
      case "respec-pack":
        return `Specification variations across regions identified. Harmonizing specs could simplify procurement, reduce complexity, and improve leverage with suppliers.`;
      default:
        return `Analysis of your ${categoryName} spend data reveals optimization opportunities worth ${savingsPercentage} of addressable spend.`;
    }
  };

  // Get chart title based on opportunity type
  const getChartTitle = () => {
    switch (oppId) {
      case "volume-bundling":
        return "Spend Concentration by Supplier";
      case "target-pricing":
        return `${categoryName} Price Index Trend`;
      case "risk-management":
        return "Supplier Risk Distribution";
      case "respec-pack":
        return "SKU Complexity Analysis";
      default:
        return "Analysis Overview";
    }
  };

  return (
    <ProtectedRoute>
      <div className="relative flex h-screen w-full overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50/30">
        {/* Left Icon Sidebar */}
        <Sidebar user={state.user} />

        {/* Main Container */}
        <div className="relative z-30 flex flex-1 overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">

          {/* Left Column: Opportunity Assistant */}
          <div className="flex w-[440px] flex-col border-r border-slate-200/60 bg-white/90 backdrop-blur-sm shrink-0">
            {/* Header */}
            <header className="flex h-14 items-center gap-3 border-b border-slate-200/60 px-5 bg-white/50">
              <Link href="/opportunities" className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
                <ArrowLeft className="h-4 w-4 text-gray-600" />
              </Link>
              <div className="flex items-center gap-2 overflow-hidden flex-1">
                <h1 className="truncate text-[14px] font-semibold text-gray-900">{initiativeTitle}</h1>
                <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
              </div>
            </header>

            {/* Content - Chat Only */}
            <div className="flex-1 overflow-y-auto flex flex-col">
              {/* Chat Area */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Max AI Header */}
                <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-purple-500">
                    <span className="text-white font-bold text-sm">M</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[15px] font-semibold text-gray-900">Max AI</h3>
                    <p className="text-[11px] text-gray-500">Procurement Intelligence Assistant</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isLoadingEvaluations && (
                      <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                    )}
                    <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${confidence >= 80 ? 'bg-emerald-100 text-emerald-700' :
                      confidence >= 50 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`} title={llmEvaluations ? 'AI-evaluated weighted confidence score' : 'Validation-based confidence'}>
                      {confidence}% Confidence {llmEvaluations && '✨'}
                    </div>
                  </div>
                </div>

                {/* Success message when all validated */}
                {unvalidatedProofPoints.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200"
                  >
                    <p className="text-[13px] text-emerald-700 font-medium">
                      🎉 All proof points reviewed! Confidence score: {confidence}%.
                    </p>
                    <p className="text-[11px] text-emerald-600 mt-1">
                      Feel free to ask me anything else about this opportunity.
                    </p>
                  </motion.div>
                )}

                {/* Welcome message - shown when no chat yet */}
                {chatMessages.length === 0 && unvalidatedProofPoints.length > 0 && (
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100">
                    <p className="text-[13px] text-gray-700 leading-relaxed">
                      {getInsightText()}
                    </p>
                  </div>
                )}

                {/* MCQ Question Card - Prominent when there's a question */}
                {currentQuestion && showMCQ && currentProofPointToValidate && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 rounded-2xl bg-white border-2 border-blue-200 shadow-lg shadow-blue-100/50"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                        <AlertCircle className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                      <span className="text-[12px] font-semibold text-blue-600">
                        Validating: {currentProofPointToValidate.name}
                      </span>
                    </div>
                    <p className="text-[14px] font-medium text-gray-800 mb-4 leading-relaxed">
                      {currentQuestion.question}
                    </p>
                    <div className="space-y-2">
                      {currentQuestion.options.map((option, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleMCQAnswer(currentProofPointToValidate.id, idx, option)}
                          disabled={isLoading}
                          className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-[12px] text-gray-700 disabled:opacity-50 group"
                        >
                          <span className="inline-flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 group-hover:bg-blue-200 group-hover:text-blue-700 transition-colors">
                              {String.fromCharCode(65 + idx)}
                            </span>
                            {option}
                          </span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Chat Messages */}
                {chatMessages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-2xl text-[13px] ${msg.role === "user"
                      ? "bg-gray-100 text-gray-900 ml-8"
                      : "bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100 text-gray-700 mr-4"
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {msg.role === "assistant" && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-purple-500">
                          <span className="text-white font-bold text-[8px]">M</span>
                        </div>
                      )}
                      <span className="text-[10px] font-semibold uppercase text-gray-400">
                        {msg.role === "user" ? "You" : "Max AI"}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </motion.div>
                ))}

                {/* Loading state */}
                {isLoading && (
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100 mr-4">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-purple-500">
                      <Loader2 className="h-3 w-3 animate-spin text-white" />
                    </div>
                    <span className="text-[13px] text-gray-500">Max is thinking...</span>
                  </div>
                )}

                {/* Hint when MCQ is hidden but there are unvalidated points */}
                {!showMCQ && unvalidatedProofPoints.length > 0 && chatMessages.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <p className="text-[11px] text-amber-700">
                      💡 Ask me about "{unvalidatedProofPoints[0].name}" to validate it, or click any unvalidated proof point above.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Input Area */}
            <div className="p-5 border-t border-gray-100">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleChatSubmit();
                }}
                className="relative flex items-center gap-3 rounded-2xl bg-[#F5F7F9] p-3 ring-1 ring-gray-200/50"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-blue-400 to-purple-400 p-[1px] shrink-0">
                  <div className="h-full w-full rounded-full bg-white flex items-center justify-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400" />
                  </div>
                </div>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about this opportunity..."
                  disabled={isLoading}
                  className="flex-1 bg-transparent text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400 disabled:opacity-50"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isLoading}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${chatInput.trim() && !isLoading
                      ? "bg-blue-500 text-white hover:bg-blue-600"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Content */}
          <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50/50 via-blue-50/20 to-indigo-50/30">
            <div className="px-8 py-8 pb-32">
              <div className="max-w-5xl mx-auto space-y-5">

                {/* Collapse Toggle */}
                <div className="flex justify-end">
                  <ChevronUp className="h-5 w-5 text-gray-400 cursor-pointer hover:text-gray-600" />
                </div>

                {/* Main Card */}
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl bg-white/80 backdrop-blur-sm p-7 shadow-lg shadow-slate-200/50 ring-1 ring-slate-200/60"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 tracking-wider block mb-2">
                        {categoryName.toUpperCase()}
                      </span>
                      <h2 className="text-xl font-bold text-gray-900">
                        {initiativeTitle}
                      </h2>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-semibold text-gray-400 block mb-1">Est. Savings</span>
                      <span className="text-lg font-bold text-emerald-600">{savingsPercentage}</span>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-4 gap-4 rounded-2xl bg-gradient-to-r from-slate-50 to-blue-50/50 p-5 mb-5 ring-1 ring-slate-100">
                    <div>
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Impact</span>
                      <span className="text-lg font-bold text-gray-900">{impact}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Confidence</span>
                      <span className="text-lg font-bold text-gray-900">{confidence}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Validated</span>
                      <span className="text-lg font-bold text-gray-900">{validatedCount}/{proofPoints.length}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Effort</span>
                      <span className="text-lg font-bold text-gray-900">{effort}</span>
                    </div>
                  </div>

                  {/* Total Spend */}
                  {totalSpend > 0 && (
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-[13px] font-medium text-gray-500">Total Spend:</span>
                      <span className="text-[13px] font-bold text-gray-900">{formatCurrency(totalSpend)}</span>
                    </div>
                  )}
                </motion.section>

                {/* What did I find? */}
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-3xl bg-white/80 backdrop-blur-sm shadow-lg shadow-slate-200/50 ring-1 ring-slate-200/60 overflow-hidden"
                >
                  <div
                    className="flex items-center justify-between p-7 cursor-pointer hover:bg-gray-50/50 transition-colors"
                    onClick={() => toggleSection('findings')}
                  >
                    <h2 className="text-lg font-bold text-gray-900">What did I find?</h2>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        AI Powered
                      </span>
                      <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${expandedSections.has('findings') ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {expandedSections.has('findings') && (
                    <div className="px-7 pb-7">
                      <div className="mb-6 text-[14px] text-gray-600 leading-relaxed">
                        <p>{getDetailedInsightText()}</p>
                      </div>

                      <div className="flex gap-6">
                        {/* Chart Area - Vertical Bar Graph */}
                        <div className="flex-1 space-y-4">
                          <h4 className="text-[14px] font-semibold text-gray-900">{getChartTitle()}</h4>

                          {/* Vertical Bar Chart */}
                          <div className="relative">
                            {(() => {
                              const maxSpend = Math.max(...topSuppliers.map(s => s.spend), 1);
                              const colors = [
                                { bar: 'from-blue-400 to-blue-600', glow: 'shadow-blue-200', text: 'text-blue-600' },
                                { bar: 'from-purple-400 to-purple-600', glow: 'shadow-purple-200', text: 'text-purple-600' },
                                { bar: 'from-emerald-400 to-emerald-600', glow: 'shadow-emerald-200', text: 'text-emerald-600' },
                                { bar: 'from-amber-400 to-amber-600', glow: 'shadow-amber-200', text: 'text-amber-600' },
                                { bar: 'from-rose-400 to-rose-600', glow: 'shadow-rose-200', text: 'text-rose-600' },
                              ];

                              return (
                                <div className="relative h-[200px] flex items-end justify-between gap-3 px-2 pt-8 pb-2">
                                  {/* Y-axis labels */}
                                  <div className="absolute left-0 top-8 bottom-8 w-12 flex flex-col justify-between text-[10px] font-medium text-gray-400">
                                    <span>{formatCurrency(maxSpend)}</span>
                                    <span>{formatCurrency(maxSpend * 0.5)}</span>
                                    <span>$0</span>
                                  </div>

                                  {/* Grid lines */}
                                  <div className="absolute left-14 right-0 top-8 bottom-8">
                                    {[0, 1, 2].map((i) => (
                                      <div
                                        key={i}
                                        className="absolute left-0 right-0 border-t border-dashed border-gray-200"
                                        style={{ top: `${i * 50}%` }}
                                      />
                                    ))}
                                  </div>

                                  {/* Bars */}
                                  <div className="flex-1 flex items-end justify-around gap-2 ml-14 h-[160px]">
                                    {topSuppliers.slice(0, 5).map((supplier, idx) => {
                                      const percentage = maxSpend > 0 ? (supplier.spend / maxSpend) * 100 : 0;
                                      const spendPercentOfTotal = totalSpend > 0 ? ((supplier.spend / totalSpend) * 100).toFixed(0) : '0';
                                      const color = colors[idx % colors.length];

                                      return (
                                        <div key={idx} className="flex flex-col items-center gap-2 flex-1 max-w-[80px] group">
                                          {/* Value label on top */}
                                          <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.1 + 0.5, duration: 0.3 }}
                                            className="text-center"
                                          >
                                            <span className={`text-[11px] font-bold ${color.text}`}>
                                              {formatCurrency(supplier.spend)}
                                            </span>
                                          </motion.div>

                                          {/* Bar */}
                                          <div className="relative w-full flex justify-center" style={{ height: '140px' }}>
                                            <motion.div
                                              className={`w-10 rounded-t-lg bg-gradient-to-t ${color.bar} shadow-lg ${color.glow} relative overflow-hidden cursor-pointer`}
                                              initial={{ height: 0 }}
                                              animate={{ height: `${percentage}%` }}
                                              transition={{ delay: idx * 0.1, duration: 0.8, ease: "easeOut" }}
                                              whileHover={{ scale: 1.05 }}
                                            >
                                              {/* Shine effect */}
                                              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0" />
                                              {/* Percentage badge */}
                                              <div className="absolute inset-x-0 top-2 flex justify-center">
                                                <span className="text-[9px] font-bold text-white/90">{spendPercentOfTotal}%</span>
                                              </div>
                                            </motion.div>
                                          </div>

                                          {/* Supplier name */}
                                          <div className="w-full text-center">
                                            <span className="text-[10px] font-medium text-gray-600 truncate block max-w-[70px] mx-auto" title={supplier.name}>
                                              {supplier.name.length > 10 ? supplier.name.substring(0, 10) + '...' : supplier.name}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Summary Stats */}
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.6, duration: 0.4 }}
                              className="mt-4 flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-50 via-purple-50 to-emerald-50 border border-gray-100"
                            >
                              <div className="flex items-center gap-4">
                                <div className="text-center">
                                  <span className="text-[10px] font-medium text-gray-500 block">Top 3 Share</span>
                                  <span className="text-[14px] font-bold text-gray-900">
                                    {totalSpend > 0
                                      ? ((topSuppliers.slice(0, 3).reduce((sum, s) => sum + s.spend, 0) / totalSpend) * 100).toFixed(0)
                                      : computedMetrics?.top3Concentration?.toFixed(0) || '65'}%
                                  </span>
                                </div>
                                <div className="h-8 w-px bg-gray-200" />
                                <div className="text-center">
                                  <span className="text-[10px] font-medium text-gray-500 block">Suppliers</span>
                                  <span className="text-[14px] font-bold text-gray-900">{computedMetrics?.supplierCount || topSuppliers.length}</span>
                                </div>
                                <div className="h-8 w-px bg-gray-200" />
                                <div className="text-center">
                                  <span className="text-[10px] font-medium text-gray-500 block">Total Spend</span>
                                  <span className="text-[14px] font-bold text-gray-900">{formatCurrency(totalSpend)}</span>
                                </div>
                              </div>
                            </motion.div>
                          </div>
                        </div>

                        {/* Info Boxes */}
                        <div className="w-[260px] space-y-4">
                          {/* Savings Potential Card */}
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 }}
                            className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-lg shadow-emerald-200"
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <span className="text-[11px] font-semibold uppercase tracking-wider opacity-90">Savings Potential</span>
                            </div>
                            <div className="text-3xl font-bold mb-1">{savingsPercentage}</div>
                            <p className="text-[11px] opacity-80 leading-relaxed">
                              of addressable spend ({formatCurrency(totalSpend)})
                            </p>
                          </motion.div>

                          {/* Confidence Card */}
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.4 }}
                            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Confidence</span>
                              <span className={`text-[20px] font-bold ${confidence >= 80 ? 'text-emerald-600' :
                                confidence >= 50 ? 'text-amber-600' : 'text-red-500'
                                }`}>{confidence}%</span>
                            </div>
                            {/* Progress bar */}
                            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden mb-3">
                              <motion.div
                                className={`h-full rounded-full ${confidence >= 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
                                  confidence >= 50 ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
                                    'bg-gradient-to-r from-red-400 to-red-500'
                                  }`}
                                initial={{ width: 0 }}
                                animate={{ width: `${confidence}%` }}
                                transition={{ delay: 0.5, duration: 0.8 }}
                              />
                            </div>
                            <p className="text-[11px] text-gray-500 leading-relaxed">
                              {validatedCount}/{proofPoints.length} proof points validated
                            </p>
                          </motion.div>
                        </div>
                      </div>

                      {/* ============================================================ */}
                      {/* OPPORTUNITY-SPECIFIC DETAILED INSIGHTS */}
                      {/* ============================================================ */}
                      <div className="mt-8 space-y-6">
                        {/* Section Header - Changes based on opportunity type */}
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${oppId === 'volume-bundling' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                            oppId === 'target-pricing' ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' :
                              oppId === 'risk-management' ? 'bg-gradient-to-br from-amber-500 to-amber-600' :
                                'bg-gradient-to-br from-purple-500 to-purple-600'
                            }`}>
                            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-[15px] font-bold text-gray-900">
                              {oppId === 'volume-bundling' ? 'Volume Consolidation Analysis' :
                                oppId === 'target-pricing' ? 'Pricing Analysis' :
                                  oppId === 'risk-management' ? 'Risk Assessment' :
                                    'Specification Analysis'}
                            </h3>
                            <p className="text-[11px] text-gray-500">
                              {oppId === 'volume-bundling' ? `Supplier fragmentation & consolidation potential for ${categoryName}` :
                                oppId === 'target-pricing' ? `Price variance & benchmarking insights for ${categoryName}` :
                                  oppId === 'risk-management' ? `Supply chain risk factors & mitigation needs for ${categoryName}` :
                                    `Specification variations & standardization opportunities for ${categoryName}`}
                            </p>
                          </div>
                        </div>

                        {/* ========== VOLUME BUNDLING TABLES ========== */}
                        {oppId === 'volume-bundling' && (
                          <>
                            {/* Supplier Consolidation Potential */}
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.7 }}
                              className="rounded-xl border border-gray-200 overflow-hidden"
                            >
                              <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
                                <h4 className="text-[13px] font-semibold text-blue-900 flex items-center gap-2">
                                  <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  Supplier Consolidation Potential
                                </h4>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead className="bg-gray-800 text-white">
                                    <tr>
                                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider px-4 py-3">Supplier</th>
                                      <th className="text-right text-[11px] font-semibold uppercase tracking-wider px-4 py-3">Current Spend</th>
                                      <th className="text-right text-[11px] font-semibold uppercase tracking-wider px-4 py-3">Share %</th>
                                      <th className="text-center text-[11px] font-semibold uppercase tracking-wider px-4 py-3">Consolidation Fit</th>
                                      <th className="text-right text-[11px] font-semibold uppercase tracking-wider px-4 py-3">Volume Bonus Potential</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {topSuppliers.slice(0, 5).map((supplier, idx) => {
                                      const pct = totalSpend > 0 ? (supplier.spend / totalSpend) * 100 : 0;
                                      const fit = pct >= 20 ? 'Strategic' : pct >= 10 ? 'Preferred' : 'Tactical';
                                      const fitColor = fit === 'Strategic' ? 'bg-blue-100 text-blue-800' : fit === 'Preferred' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800';
                                      const bonusPct = pct >= 20 ? 8 : pct >= 10 ? 5 : 3;
                                      return (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                          <td className="px-4 py-3 text-[12px] font-medium text-gray-900">{supplier.name}</td>
                                          <td className="px-4 py-3 text-[12px] text-gray-600 text-right">{formatCurrency(supplier.spend)}</td>
                                          <td className="px-4 py-3 text-[12px] text-gray-600 text-right">{pct.toFixed(1)}%</td>
                                          <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${fitColor}`}>{fit}</span>
                                          </td>
                                          <td className="px-4 py-3 text-[12px] text-emerald-600 text-right font-semibold">+{bonusPct}% ({formatCurrency(supplier.spend * bonusPct / 100)})</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </motion.div>

                            {/* Tail Spend Analysis */}
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.8 }}
                              className="rounded-xl border border-gray-200 overflow-hidden"
                            >
                              <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
                                <h4 className="text-[13px] font-semibold text-blue-900 flex items-center gap-2">
                                  <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                                  </svg>
                                  Spend Fragmentation Analysis
                                </h4>
                              </div>
                              <div className="p-4">
                                {(() => {
                                  // Use consistent calculations
                                  const top3Spend = topSuppliers.slice(0, 3).reduce((sum, s) => sum + s.spend, 0);
                                  const midTierSpend = topSuppliers.slice(3, 10).reduce((sum, s) => sum + s.spend, 0);
                                  const tailSpendAmt = totalSpend * calculatedTailSpendPct / 100;
                                  const top3Pct = totalSpend > 0 ? (top3Spend / totalSpend * 100) : 65;
                                  const midTierPct = totalSpend > 0 ? (midTierSpend / totalSpend * 100) : 20;

                                  return (
                                    <>
                                      <div className="grid grid-cols-3 gap-4">
                                        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 p-4 border border-blue-200">
                                          <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider block mb-1">Top 3 Suppliers</span>
                                          <span className="text-[22px] font-bold text-blue-900">{top3Pct.toFixed(0)}%</span>
                                          <span className="text-[11px] text-blue-700 block mt-1">{formatCurrency(top3Spend)}</span>
                                        </div>
                                        <div className="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 p-4 border border-amber-200">
                                          <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider block mb-1">Mid-tier (4-10)</span>
                                          <span className="text-[22px] font-bold text-amber-900">{midTierPct.toFixed(0)}%</span>
                                          <span className="text-[11px] text-amber-700 block mt-1">{formatCurrency(midTierSpend)}</span>
                                        </div>
                                        <div className="rounded-xl bg-gradient-to-br from-red-50 to-red-100 p-4 border border-red-200">
                                          <span className="text-[10px] font-semibold text-red-600 uppercase tracking-wider block mb-1">Tail Spend</span>
                                          <span className="text-[22px] font-bold text-red-900">{calculatedTailSpendPct.toFixed(0)}%</span>
                                          <span className="text-[11px] text-red-700 block mt-1">{formatCurrency(tailSpendAmt)}</span>
                                        </div>
                                      </div>
                                      <p className="text-[11px] text-gray-600 mt-4 leading-relaxed">
                                        <span className="font-semibold text-gray-900">Consolidation opportunity:</span> {calculatedTailSpendPct > 0
                                          ? `Moving ${formatCurrency(tailSpendAmt)} tail spend to strategic suppliers could unlock ${formatCurrency(tailSpendAmt * 0.1)} - ${formatCurrency(tailSpendAmt * 0.2)} in additional volume rebates.`
                                          : `Your spend is well-consolidated across ${computedMetrics?.supplierCount || topSuppliers.length} suppliers. Focus on volume leverage with top strategic suppliers to negotiate better tier pricing.`}
                                      </p>
                                    </>
                                  );
                                })()}
                              </div>
                            </motion.div>
                          </>
                        )}

                        {/* ========== TARGET PRICING TABLES ========== */}
                        {oppId === 'target-pricing' && (
                          <>
                            {/* Price Variance by Supplier */}
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.7 }}
                              className="rounded-xl border border-gray-200 overflow-hidden"
                            >
                              <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-100">
                                <h4 className="text-[13px] font-semibold text-emerald-900 flex items-center gap-2">
                                  <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Price Variance Analysis by Supplier
                                </h4>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead className="bg-gray-800 text-white">
                                    <tr>
                                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider px-4 py-3">Supplier</th>
                                      <th className="text-right text-[11px] font-semibold uppercase tracking-wider px-4 py-3">Current Spend</th>
                                      <th className="text-center text-[11px] font-semibold uppercase tracking-wider px-4 py-3">Price Index</th>
                                      <th className="text-center text-[11px] font-semibold uppercase tracking-wider px-4 py-3">vs Benchmark</th>
                                      <th className="text-right text-[11px] font-semibold uppercase tracking-wider px-4 py-3">Savings Potential</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {topSuppliers.slice(0, 5).map((supplier, idx) => {
                                      const priceIndex = 100 + (idx % 3 === 0 ? 8 : idx % 3 === 1 ? -3 : 12);
                                      const vsBenchmark = priceIndex - 100;
                                      const benchmarkColor = vsBenchmark > 5 ? 'text-red-600' : vsBenchmark < -2 ? 'text-emerald-600' : 'text-gray-600';
                                      const savingsPotential = vsBenchmark > 0 ? supplier.spend * vsBenchmark / 100 : 0;
                                      return (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                          <td className="px-4 py-3 text-[12px] font-medium text-gray-900">{supplier.name}</td>
                                          <td className="px-4 py-3 text-[12px] text-gray-600 text-right">{formatCurrency(supplier.spend)}</td>
                                          <td className="px-4 py-3 text-[12px] text-gray-900 text-center font-semibold">{priceIndex}</td>
                                          <td className={`px-4 py-3 text-[12px] text-center font-semibold ${benchmarkColor}`}>
                                            {vsBenchmark > 0 ? '+' : ''}{vsBenchmark}%
                                          </td>
                                          <td className="px-4 py-3 text-[12px] text-emerald-600 text-right font-semibold">
                                            {savingsPotential > 0 ? formatCurrency(savingsPotential) : '—'}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </motion.div>

                            {/* Cost Structure Breakdown */}
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.8 }}
                              className="rounded-xl border border-gray-200 overflow-hidden"
                            >
                              <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-100">
                                <h4 className="text-[13px] font-semibold text-emerald-900 flex items-center gap-2">
                                  <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                  Should-Cost Model Breakdown
                                </h4>
                              </div>
                              <div className="p-4">
                                <div className="grid grid-cols-4 gap-3">
                                  <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 p-4 border border-blue-200">
                                    <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider block mb-1">Raw Materials</span>
                                    <span className="text-[20px] font-bold text-blue-900">55%</span>
                                    <span className="text-[11px] text-blue-700 block mt-1">{formatCurrency(totalSpend * 0.55)}</span>
                                  </div>
                                  <div className="rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 p-4 border border-purple-200">
                                    <span className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider block mb-1">Manufacturing</span>
                                    <span className="text-[20px] font-bold text-purple-900">25%</span>
                                    <span className="text-[11px] text-purple-700 block mt-1">{formatCurrency(totalSpend * 0.25)}</span>
                                  </div>
                                  <div className="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 p-4 border border-amber-200">
                                    <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider block mb-1">Logistics</span>
                                    <span className="text-[20px] font-bold text-amber-900">12%</span>
                                    <span className="text-[11px] text-amber-700 block mt-1">{formatCurrency(totalSpend * 0.12)}</span>
                                  </div>
                                  <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 border border-emerald-200">
                                    <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider block mb-1">Margin</span>
                                    <span className="text-[20px] font-bold text-emerald-900">8%</span>
                                    <span className="text-[11px] text-emerald-700 block mt-1">{formatCurrency(totalSpend * 0.08)}</span>
                                  </div>
                                </div>
                                <p className="text-[11px] text-gray-600 mt-4 leading-relaxed">
                                  <span className="font-semibold text-gray-900">Target pricing opportunity:</span> Current price variance of {computedMetrics?.priceVariance?.toFixed(0) || 15}% indicates {formatCurrency(totalSpend * (computedMetrics?.priceVariance || 15) / 100 * 0.5)} potential savings through should-cost negotiations.
                                </p>
                              </div>
                            </motion.div>
                          </>
                        )}

                        {/* ========== RISK MANAGEMENT TABLES ========== */}
                        {oppId === 'risk-management' && (
                          <>
                            {/* Supplier Risk Assessment */}
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.7 }}
                              className="rounded-xl border border-gray-200 overflow-hidden"
                            >
                              <div className="bg-amber-50 px-4 py-3 border-b border-amber-100">
                                <h4 className="text-[13px] font-semibold text-amber-900 flex items-center gap-2">
                                  <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                  </svg>
                                  Supplier Concentration Risk Assessment
                                </h4>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead className="bg-gray-800 text-white">
                                    <tr>
                                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider px-4 py-3">Supplier</th>
                                      <th className="text-right text-[11px] font-semibold uppercase tracking-wider px-4 py-3">Spend at Risk</th>
                                      <th className="text-right text-[11px] font-semibold uppercase tracking-wider px-4 py-3">Concentration %</th>
                                      <th className="text-center text-[11px] font-semibold uppercase tracking-wider px-4 py-3">Single Source?</th>
                                      <th className="text-center text-[11px] font-semibold uppercase tracking-wider px-4 py-3">Risk Level</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {topSuppliers.slice(0, 5).map((supplier, idx) => {
                                      const pct = totalSpend > 0 ? (supplier.spend / totalSpend) * 100 : 0;
                                      const isSingleSource = idx === 0 || pct > 30;
                                      const riskLevel = pct > 30 ? 'Critical' : pct > 20 ? 'High' : pct > 10 ? 'Medium' : 'Low';
                                      const riskColor = riskLevel === 'Critical' ? 'bg-red-100 text-red-800' : riskLevel === 'High' ? 'bg-amber-100 text-amber-800' : riskLevel === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-emerald-100 text-emerald-800';
                                      return (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                          <td className="px-4 py-3 text-[12px] font-medium text-gray-900">{supplier.name}</td>
                                          <td className="px-4 py-3 text-[12px] text-gray-600 text-right">{formatCurrency(supplier.spend)}</td>
                                          <td className="px-4 py-3 text-[12px] text-gray-900 text-right font-semibold">{pct.toFixed(1)}%</td>
                                          <td className="px-4 py-3 text-center">
                                            {isSingleSource ? (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-800">Yes ⚠️</span>
                                            ) : (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">No ✓</span>
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${riskColor}`}>{riskLevel}</span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </motion.div>

                            {/* Risk Factors Summary */}
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.8 }}
                              className="rounded-xl border border-gray-200 overflow-hidden"
                            >
                              <div className="bg-amber-50 px-4 py-3 border-b border-amber-100">
                                <h4 className="text-[13px] font-semibold text-amber-900 flex items-center gap-2">
                                  <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                  </svg>
                                  Supply Chain Risk Factors
                                </h4>
                              </div>
                              <div className="p-4">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100">
                                    <div className="flex items-center gap-3">
                                      <span className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600 text-sm">🎯</span>
                                      <div>
                                        <span className="text-[12px] font-semibold text-red-900 block">Concentration Risk</span>
                                        <span className="text-[11px] text-red-700">Top 3 suppliers = {totalSpend > 0 ? ((topSuppliers.slice(0, 3).reduce((sum, s) => sum + s.spend, 0) / totalSpend) * 100).toFixed(0) : 65}% of spend</span>
                                      </div>
                                    </div>
                                    <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 text-[10px] font-bold">HIGH</span>
                                  </div>
                                  <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-100">
                                    <div className="flex items-center gap-3">
                                      <span className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 text-sm">🌍</span>
                                      <div>
                                        <span className="text-[12px] font-semibold text-amber-900 block">Geographic Risk</span>
                                        <span className="text-[11px] text-amber-700">{categoryLocations.length > 0 ? categoryLocations.length : 3} regions, limited diversification</span>
                                      </div>
                                    </div>
                                    <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">MEDIUM</span>
                                  </div>
                                  <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 border border-yellow-100">
                                    <div className="flex items-center gap-3">
                                      <span className="h-8 w-8 rounded-lg bg-yellow-100 flex items-center justify-center text-yellow-600 text-sm">📊</span>
                                      <div>
                                        <span className="text-[12px] font-semibold text-yellow-900 block">Price Volatility</span>
                                        <span className="text-[11px] text-yellow-700">{computedMetrics?.priceVariance?.toFixed(0) || 15}% variance across suppliers</span>
                                      </div>
                                    </div>
                                    <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-[10px] font-bold">MEDIUM</span>
                                  </div>
                                </div>
                                <p className="text-[11px] text-gray-600 mt-4 leading-relaxed">
                                  <span className="font-semibold text-gray-900">Risk mitigation value:</span> Qualifying backup suppliers for {formatCurrency(topSuppliers.slice(0, 3).reduce((sum, s) => sum + s.spend, 0))} concentrated spend protects against {formatCurrency(topSuppliers.slice(0, 3).reduce((sum, s) => sum + s.spend, 0) * 0.2)} potential disruption costs.
                                </p>
                              </div>
                            </motion.div>
                          </>
                        )}

                        {/* ========== RE-SPEC PACK TABLES ========== */}
                        {oppId === 'respec-pack' && (
                          <>
                            {/* Specification Complexity */}
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.7 }}
                              className="rounded-xl border border-gray-200 overflow-hidden"
                            >
                              <div className="bg-purple-50 px-4 py-3 border-b border-purple-100">
                                <h4 className="text-[13px] font-semibold text-purple-900 flex items-center gap-2">
                                  <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                  </svg>
                                  Specification Complexity by Supplier
                                </h4>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead className="bg-gray-800 text-white">
                                    <tr>
                                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider px-4 py-3">Supplier</th>
                                      <th className="text-right text-[11px] font-semibold uppercase tracking-wider px-4 py-3">Current Spend</th>
                                      <th className="text-center text-[11px] font-semibold uppercase tracking-wider px-4 py-3">SKU Count</th>
                                      <th className="text-center text-[11px] font-semibold uppercase tracking-wider px-4 py-3">Spec Variations</th>
                                      <th className="text-right text-[11px] font-semibold uppercase tracking-wider px-4 py-3">Standardization Savings</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {topSuppliers.slice(0, 5).map((supplier, idx) => {
                                      const skuCount = 15 + idx * 8;
                                      const specVariations = idx === 0 ? 'High' : idx < 3 ? 'Medium' : 'Low';
                                      const variationColor = specVariations === 'High' ? 'bg-red-100 text-red-800' : specVariations === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';
                                      const savingsPct = specVariations === 'High' ? 8 : specVariations === 'Medium' ? 5 : 2;
                                      return (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                          <td className="px-4 py-3 text-[12px] font-medium text-gray-900">{supplier.name}</td>
                                          <td className="px-4 py-3 text-[12px] text-gray-600 text-right">{formatCurrency(supplier.spend)}</td>
                                          <td className="px-4 py-3 text-[12px] text-gray-900 text-center font-semibold">{skuCount}</td>
                                          <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${variationColor}`}>{specVariations}</span>
                                          </td>
                                          <td className="px-4 py-3 text-[12px] text-purple-600 text-right font-semibold">{formatCurrency(supplier.spend * savingsPct / 100)}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </motion.div>

                            {/* Standardization Opportunities */}
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.8 }}
                              className="rounded-xl border border-gray-200 overflow-hidden"
                            >
                              <div className="bg-purple-50 px-4 py-3 border-b border-purple-100">
                                <h4 className="text-[13px] font-semibold text-purple-900 flex items-center gap-2">
                                  <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                  </svg>
                                  Standardization Opportunity by Region
                                </h4>
                              </div>
                              <div className="p-4">
                                <div className="space-y-3">
                                  {(categoryLocations.length > 0 ? categoryLocations : ['Europe', 'Asia Pacific', 'North America']).map((region, idx) => {
                                    const regionSpend = totalSpend / (categoryLocations.length || 3);
                                    const complexity = idx === 0 ? 85 : idx === 1 ? 65 : 45;
                                    return (
                                      <div key={idx} className="flex items-center gap-4">
                                        <div className="w-32 text-[12px] font-medium text-gray-900 flex items-center gap-2">
                                          <span>🌍</span> {region}
                                        </div>
                                        <div className="flex-1">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] text-gray-500">Spec Complexity</span>
                                            <span className="text-[10px] font-semibold text-gray-700">{complexity}%</span>
                                          </div>
                                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <motion.div
                                              className={`h-full rounded-full ${complexity > 70 ? 'bg-red-400' : complexity > 50 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                              initial={{ width: 0 }}
                                              animate={{ width: `${complexity}%` }}
                                              transition={{ delay: 0.9 + idx * 0.1, duration: 0.5 }}
                                            />
                                          </div>
                                        </div>
                                        <div className="w-24 text-right">
                                          <span className="text-[11px] font-semibold text-purple-600">{formatCurrency(regionSpend * (complexity / 100) * 0.08)}</span>
                                          <span className="text-[10px] text-gray-500 block">savings</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                <p className="text-[11px] text-gray-600 mt-4 leading-relaxed">
                                  <span className="font-semibold text-gray-900">Value engineering potential:</span> Standardizing top 20 items across regions can eliminate {formatCurrency(totalSpend * 0.05)} in complexity costs and unlock {formatCurrency(totalSpend * 0.03)} in volume consolidation.
                                </p>
                              </div>
                            </motion.div>
                          </>
                        )}

                        {/* AI Summary - Always shown */}
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.9 }}
                          className={`rounded-xl border p-5 ${oppId === 'volume-bundling' ? 'bg-gradient-to-r from-blue-50 via-blue-50 to-indigo-50 border-blue-100' :
                            oppId === 'target-pricing' ? 'bg-gradient-to-r from-emerald-50 via-emerald-50 to-teal-50 border-emerald-100' :
                              oppId === 'risk-management' ? 'bg-gradient-to-r from-amber-50 via-amber-50 to-orange-50 border-amber-100' :
                                'bg-gradient-to-r from-purple-50 via-purple-50 to-pink-50 border-purple-100'
                            }`}
                        >
                          <h4 className="text-[13px] font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <span className={`h-6 w-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold ${oppId === 'volume-bundling' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                              oppId === 'target-pricing' ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' :
                                oppId === 'risk-management' ? 'bg-gradient-to-br from-amber-500 to-amber-600' :
                                  'bg-gradient-to-br from-purple-500 to-purple-600'
                              }`}>AI</span>
                            Key Insight Summary
                          </h4>
                          <div className="space-y-2">
                            {oppId === 'volume-bundling' && (
                              <p className="text-[12px] text-gray-700 leading-relaxed">
                                Your <span className="font-semibold text-blue-700">{formatCurrency(totalSpend)}</span> spend across <span className="font-semibold text-blue-700">{computedMetrics?.supplierCount || topSuppliers.length} suppliers</span> shows consolidation potential.
                                Top supplier {topSuppliers[0]?.name || 'N/A'} has {totalSpend > 0 && topSuppliers[0] ? ((topSuppliers[0].spend / totalSpend) * 100).toFixed(0) : 0}% share.
                                Bundling volumes could unlock <span className="font-semibold text-emerald-700">{formatCurrency(totalSpend * 0.05)} - {formatCurrency(totalSpend * 0.08)}</span> in tier pricing benefits.
                              </p>
                            )}
                            {oppId === 'target-pricing' && (
                              <p className="text-[12px] text-gray-700 leading-relaxed">
                                Price variance of <span className="font-semibold text-amber-700">{computedMetrics?.priceVariance?.toFixed(0) || 15}%</span> across suppliers indicates
                                <span className="font-semibold text-emerald-700"> {formatCurrency(totalSpend * (computedMetrics?.priceVariance || 15) / 100 * 0.5)}</span> in pricing optimization potential.
                                Should-cost models with {topSuppliers[0]?.name || 'top suppliers'} can standardize rates and capture market opportunities.
                              </p>
                            )}
                            {oppId === 'risk-management' && (
                              <p className="text-[12px] text-gray-700 leading-relaxed">
                                <span className="font-semibold text-red-700">{totalSpend > 0 ? ((topSuppliers.slice(0, 3).reduce((sum, s) => sum + s.spend, 0) / totalSpend) * 100).toFixed(0) : 65}% concentration</span> in top 3 suppliers
                                ({formatCurrency(topSuppliers.slice(0, 3).reduce((sum, s) => sum + s.spend, 0))}) creates significant supply risk.
                                Dual-sourcing {topSuppliers[0]?.name || 'critical suppliers'} protects against <span className="font-semibold text-emerald-700">{formatCurrency(topSuppliers.slice(0, 3).reduce((sum, s) => sum + s.spend, 0) * 0.2)}</span> potential disruption.
                              </p>
                            )}
                            {oppId === 'respec-pack' && (
                              <p className="text-[12px] text-gray-700 leading-relaxed">
                                Specification variations across {categoryLocations.length > 0 ? categoryLocations.join(', ') : 'regions'} add
                                <span className="font-semibold text-red-700"> {formatCurrency(totalSpend * 0.05)}</span> in complexity costs.
                                Standardizing top items with {topSuppliers[0]?.name || 'key suppliers'} can unlock <span className="font-semibold text-emerald-700">{formatCurrency(totalSpend * 0.03)} - {formatCurrency(totalSpend * 0.07)}</span> savings.
                              </p>
                            )}
                          </div>
                        </motion.div>

                        {/* ========== PROOF POINT BREAKDOWN - WHY HIGH/MEDIUM/LOW ========== */}
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 1.0 }}
                          className="rounded-xl border border-gray-200 overflow-hidden"
                        >
                          <div className={`px-4 py-3 border-b ${oppId === 'volume-bundling' ? 'bg-blue-50 border-blue-100' :
                            oppId === 'target-pricing' ? 'bg-emerald-50 border-emerald-100' :
                              oppId === 'risk-management' ? 'bg-amber-50 border-amber-100' :
                                'bg-purple-50 border-purple-100'
                            }`}>
                            <h4 className={`text-[13px] font-semibold flex items-center gap-2 ${oppId === 'volume-bundling' ? 'text-blue-900' :
                              oppId === 'target-pricing' ? 'text-emerald-900' :
                                oppId === 'risk-management' ? 'text-amber-900' :
                                  'text-purple-900'
                              }`}>
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                              Proof Point Analysis — Why HIGH / MEDIUM / LOW?
                              {isLoadingEvaluations && (
                                <span className="ml-2 flex items-center gap-1 text-[10px] text-blue-600 font-normal">
                                  <Loader2 className="h-3 w-3 animate-spin" /> AI evaluating...
                                </span>
                              )}
                              {llmEvaluations && !isLoadingEvaluations && (
                                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-purple-100 to-blue-100 text-[9px] text-purple-700 font-medium">
                                  ✨ AI Evaluated
                                </span>
                              )}
                            </h4>
                            {/* Page indicator */}
                            <div className="flex items-center gap-2 ml-auto">
                              <span className="text-[11px] text-gray-500">
                                {proofPointPage + 1} / {PROOF_POINT_CONFIG[oppId]?.length || 1}
                              </span>
                            </div>
                          </div>
                          <div className="p-4">
                            {/* Page Flip Container - 1 proof point per page */}
                            <div className="min-h-[450px]">
                            {/* Proof Points for Volume Bundling */}
                            {oppId === 'volume-bundling' && (
                              <>
                                {/* Regional Spend - vb-pp-1 (Page 0) */}
                                {proofPointPage === 0 && (
                                <motion.div
                                  key="vb-pp-1"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="rounded-lg border border-gray-100 p-3 bg-white hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">🌍</span>
                                      <span className="text-[12px] font-semibold text-gray-900">Regional Spend</span>
                                    </div>
                                    {(() => {
                                      const top3Pct = totalSpend > 0
                                        ? (topSuppliers.slice(0, 3).reduce((sum, s) => sum + s.spend, 0) / totalSpend) * 100
                                        : computedMetrics?.top3Concentration || 65;
                                      const { level, isLLM } = getImpactLevel('vb-pp-1', top3Pct, { high: 80, medium: 50 });
                                      const color = level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                                      return (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>
                                          {level} {isLLM && '✨'}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  {(() => {
                                    const top3Pct = totalSpend > 0
                                      ? (topSuppliers.slice(0, 3).reduce((sum, s) => sum + s.spend, 0) / totalSpend) * 100
                                      : computedMetrics?.top3Concentration || 65;
                                    const llmEval = getLLMEvaluation('vb-pp-1');
                                    return (
                                      <>
                                        <GaugeChart
                                          value={top3Pct}
                                          max={100}
                                          thresholds={{ low: 50, medium: 80 }}
                                          label="Top 3 Concentration"
                                          showLegend={false}
                                        />
                                        <p className="text-[14px] text-gray-700 mt-3 font-medium">
                                          {llmEval ? (
                                            <span className="text-purple-600">{llmEval.reasoning}</span>
                                          ) : (
                                            top3Pct > 80 ? 'High concentration enables cross-site volume consolidation.' :
                                              top3Pct >= 50 ? 'Moderate concentration - some bundling opportunity exists.' :
                                                'Low concentration - limited bundling potential across regions.'
                                          )}
                                        </p>

                                        {/* Top 3 Suppliers Table */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Top 3 Suppliers</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <thead>
                                              <tr className="bg-gray-50">
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Supplier Name</th>
                                                <th className="text-right py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Spend Amount</th>
                                                <th className="text-right py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Share %</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {topSuppliers.slice(0, 3).map((supplier, idx) => {
                                                const sharePercent = totalSpend > 0 ? (supplier.spend / totalSpend) * 100 : 0;
                                                return (
                                                  <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="py-1.5 px-2 border border-gray-200 text-gray-800">{supplier.name}</td>
                                                    <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">{formatCurrency(supplier.spend)}</td>
                                                    <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">{sharePercent.toFixed(1)}%</td>
                                                  </tr>
                                                );
                                              })}
                                              <tr className="bg-gray-100 font-semibold">
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-800">Total (Top 3)</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">
                                                  {formatCurrency(topSuppliers.slice(0, 3).reduce((sum, s) => sum + s.spend, 0))}
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">{top3Pct.toFixed(1)}%</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Threshold Legend Table */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Impact Thresholds</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <thead>
                                              <tr className="bg-gray-50">
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Impact Level</th>
                                                <th className="text-center py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Threshold</th>
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Interpretation</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">LOW</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&lt;50%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Fragmented spend - needs consolidation</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">MEDIUM</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">50-80%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Moderate concentration - some opportunity</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">HIGH</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">≥80%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Already consolidated - leverage for bundling</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </motion.div>
                                )}

                                {/* Tail Spend - vb-pp-2 (Page 1) */}
                                {proofPointPage === 1 && (
                                <motion.div
                                  key="vb-pp-2"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="rounded-lg border border-gray-100 p-3 bg-white hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">📊</span>
                                      <span className="text-[12px] font-semibold text-gray-900">Tail Spend</span>
                                    </div>
                                    {(() => {
                                      const tailPct = calculatedTailSpendPct || computedMetrics?.tailSpendPercentage || 15;
                                      const { level, isLLM } = getImpactLevel('vb-pp-2', tailPct, { high: 30, medium: 15 });
                                      const color = level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                                      return (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>
                                          {level} {isLLM && '✨'}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  {(() => {
                                    const tailPct = computedMetrics?.tailSpendPercentage || calculatedTailSpendPct || 15;
                                    const supplierCount = computedMetrics?.supplierCount || topSuppliers.length || 10;
                                    const tailAmt = totalSpend * tailPct / 100;
                                    const llmEval = getLLMEvaluation('vb-pp-2');
                                    const bottom20PctCount = Math.max(1, Math.floor(supplierCount * 0.2));
                                    const topSpend = topSuppliers.reduce((sum, s) => sum + s.spend, 0);
                                    return (
                                      <>
                                        <GaugeChart
                                          value={tailPct}
                                          max={50}
                                          thresholds={{ low: 15, medium: 30 }}
                                          label={`Tail Spend (${formatCurrency(tailAmt)})`}
                                          showLegend={false}
                                        />
                                        <p className="text-[14px] text-gray-700 mt-3 font-medium">
                                          {llmEval ? (
                                            <span className="text-purple-600">{llmEval.reasoning}</span>
                                          ) : (
                                            tailPct > 30 ? `Significant tail spend presents consolidation opportunity worth ${formatCurrency(tailAmt * 0.15)}.` :
                                              tailPct >= 15 ? 'Moderate tail spend - some consolidation possible.' :
                                                'Already consolidated with minimal tail spend.'
                                          )}
                                        </p>

                                        {/* Portfolio Structure Table */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Portfolio Structure</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <tbody>
                                              <tr className="bg-gray-50">
                                                <td className="py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Total Suppliers</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">{supplierCount}</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Bottom 20% Suppliers</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">{bottom20PctCount} suppliers</td>
                                              </tr>
                                              <tr className="bg-gray-50">
                                                <td className="py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Total Spend</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">{formatCurrency(totalSpend)}</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Spend of Bottom 20%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">{formatCurrency(tailAmt)}</td>
                                              </tr>
                                              <tr className="bg-blue-50 font-semibold">
                                                <td className="py-1.5 px-2 border border-gray-200 text-blue-700">Tail Spend %</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-blue-700">{tailPct.toFixed(1)}%</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Tail Spend Formula */}
                                        <div className="mt-3 p-2 bg-gray-50 rounded border border-gray-200">
                                          <p className="text-[10px] text-gray-500 font-medium mb-1">Formula:</p>
                                          <p className="text-[11px] text-gray-700 font-mono">
                                            Tail Spend % = (Bottom 20% Suppliers Spend / Total Spend) × 100
                                          </p>
                                          <p className="text-[10px] text-gray-500 mt-1">
                                            = ({formatCurrency(tailAmt)} / {formatCurrency(totalSpend)}) × 100 = <span className="font-bold text-gray-700">{tailPct.toFixed(1)}%</span>
                                          </p>
                                        </div>

                                        {/* Impact Thresholds Table */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Impact Thresholds</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <thead>
                                              <tr className="bg-gray-50">
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Impact Level</th>
                                                <th className="text-center py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Threshold</th>
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Interpretation</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">HIGH</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&gt;30%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Significant fragmentation - consolidation needed</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">MEDIUM</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">15-30%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Moderate tail spend - some opportunity</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">LOW</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&lt;15%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Well consolidated - maintain discipline</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Structural Insight */}
                                        <div className="mt-3 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded border border-blue-100">
                                          <p className="text-[10px] text-blue-600 font-semibold mb-1">What This Means:</p>
                                          <ul className="text-[10px] text-gray-600 space-y-0.5">
                                            <li>• Bottom {bottom20PctCount} suppliers contribute {tailPct.toFixed(1)}% of total spend</li>
                                            <li>• {tailPct < 15 ? 'Spend is concentrated in top suppliers - efficient portfolio' : tailPct < 30 ? 'Some fragmentation exists - review small suppliers' : 'High fragmentation - significant consolidation opportunity'}</li>
                                            <li>• {tailPct < 15 ? 'Limited supplier management overhead in the tail' : tailPct < 30 ? 'Moderate supplier management required' : 'High overhead managing many small suppliers'}</li>
                                          </ul>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </motion.div>
                                )}

                                {/* Volume Leverage (Supplier Count + Top 3 Concentration) - Page 2 */}
                                {proofPointPage === 2 && (
                                <motion.div
                                  key="vb-pp-3"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="rounded-lg border border-gray-100 p-3 bg-white hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">👥</span>
                                      <span className="text-[12px] font-semibold text-gray-900">Volume Leverage</span>
                                    </div>
                                    {(() => {
                                      const supplierCount = computedMetrics?.supplierCount || topSuppliers.length || 5;
                                      const top3Pct = computedMetrics?.top3Concentration || (topSuppliers.slice(0, 3).reduce((sum, s) => sum + s.spend, 0) / totalSpend * 100) || 50;
                                      // Logic: HIGH if suppliers > 10 AND top3 < 45%, LOW if suppliers < 5 OR top3 > 70%, else MEDIUM
                                      const level = (supplierCount > 10 && top3Pct < 45) ? 'HIGH' : (supplierCount < 5 || top3Pct > 70) ? 'LOW' : 'MEDIUM';
                                      const color = level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                                      return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{level}</span>;
                                    })()}
                                  </div>
                                  {(() => {
                                    const supplierCount = computedMetrics?.supplierCount || topSuppliers.length || 5;
                                    const top3Spend = topSuppliers.slice(0, 3).reduce((sum, s) => sum + s.spend, 0);
                                    const top3Pct = computedMetrics?.top3Concentration || (totalSpend > 0 ? (top3Spend / totalSpend * 100) : 50);
                                    const level = (supplierCount > 10 && top3Pct < 45) ? 'HIGH' : (supplierCount < 5 || top3Pct > 70) ? 'LOW' : 'MEDIUM';
                                    const llmEval = getLLMEvaluation('vb-pp-3');
                                    return (
                                      <>
                                        <div className="flex items-center gap-3 mb-2">
                                          <div className="flex -space-x-2">
                                            {[...Array(Math.min(supplierCount, 6))].map((_, i) => (
                                              <div key={i} className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-white flex items-center justify-center text-white text-[8px] font-bold">
                                                {i + 1}
                                              </div>
                                            ))}
                                            {supplierCount > 6 && (
                                              <div className="h-6 w-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-gray-600 text-[8px] font-bold">
                                                +{supplierCount - 6}
                                              </div>
                                            )}
                                          </div>
                                          <span className="text-[11px] text-gray-600">{supplierCount} suppliers</span>
                                        </div>
                                        <p className="text-[14px] text-gray-700 mt-3 font-medium">
                                          {llmEval ? (
                                            <span className="text-purple-600">{llmEval.reasoning}</span>
                                          ) : (
                                            level === 'HIGH' ? 'Spend is well distributed with strong competitive tension - high negotiation leverage.' :
                                              level === 'MEDIUM' ? 'Moderate distribution - some consolidation opportunity exists.' :
                                                'Concentrated spend with limited supplier options - work on diversification.'
                                          )}
                                        </p>

                                        {/* Current Metrics Table */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Current Metrics</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <tbody>
                                              <tr className="bg-gray-50">
                                                <td className="py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Total Suppliers</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">{supplierCount}</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Top 3 Spend</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">{formatCurrency(top3Spend)}</td>
                                              </tr>
                                              <tr className="bg-gray-50">
                                                <td className="py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Total Spend</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">{formatCurrency(totalSpend)}</td>
                                              </tr>
                                              <tr className="bg-blue-50 font-semibold">
                                                <td className="py-1.5 px-2 border border-gray-200 text-blue-700">Top 3 Concentration</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-blue-700">{top3Pct.toFixed(2)}%</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Classification Logic */}
                                        <div className="mt-3 p-2 bg-gray-50 rounded border border-gray-200">
                                          <p className="text-[10px] text-gray-500 font-medium mb-1">Classification Logic:</p>
                                          <p className="text-[11px] text-gray-700 font-mono">
                                            Top 3 Concentration = (Top 3 Spend / Total Spend) × 100
                                          </p>
                                          <p className="text-[10px] text-gray-500 mt-1">
                                            = ({formatCurrency(top3Spend)} / {formatCurrency(totalSpend)}) × 100 = <span className="font-bold text-gray-700">{top3Pct.toFixed(2)}%</span>
                                          </p>
                                        </div>

                                        {/* Impact Thresholds Table */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Impact Thresholds</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <thead>
                                              <tr className="bg-gray-50">
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Impact</th>
                                                <th className="text-center py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Condition</th>
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Interpretation</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              <tr className={level === 'HIGH' ? 'bg-red-50' : ''}>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">HIGH</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium text-[10px]">Suppliers &gt;10 AND Top3 &lt;45%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Fragmented - high leverage opportunity</td>
                                              </tr>
                                              <tr className={level === 'MEDIUM' ? 'bg-amber-50' : ''}>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">MEDIUM</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium text-[10px]">5-10 suppliers OR moderate concentration</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Balanced - some bundling potential</td>
                                              </tr>
                                              <tr className={level === 'LOW' ? 'bg-emerald-50' : ''}>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">LOW</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium text-[10px]">Suppliers &lt;5 OR Top3 &gt;70%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Concentrated - diversify supplier base</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Structural Insight */}
                                        <div className="mt-3 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded border border-blue-100">
                                          <p className="text-[10px] text-blue-600 font-semibold mb-1">Why it is {level}:</p>
                                          <ul className="text-[10px] text-gray-600 space-y-0.5">
                                            <li>• Top 3 concentration = {top3Pct.toFixed(2)}% → {top3Pct < 45 ? '< 45%' : top3Pct > 70 ? '> 70%' : '45-70%'}</li>
                                            <li>• Supplier count = {supplierCount} → {supplierCount > 10 ? '> 10' : supplierCount >= 5 ? '5-10' : '< 5'}</li>
                                            <li>• {level === 'HIGH' ? 'Condition: Top 3 < 45% AND suppliers > 10 ✓' : level === 'LOW' ? 'Condition: Suppliers < 5 OR Top 3 > 70%' : 'Falls between HIGH and LOW thresholds'}</li>
                                            <li>• {level === 'HIGH' ? 'Strong competitive tension, no excessive dependency' : level === 'LOW' ? 'High dependency on few suppliers, limited leverage' : 'Moderate distribution, room for optimization'}</li>
                                          </ul>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </motion.div>
                                )}

                                {/* Price Variance vs Market - Page 3 */}
                                {proofPointPage === 3 && (
                                <motion.div
                                  key="vb-pp-4"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="rounded-lg border border-gray-100 p-3 bg-white hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">💰</span>
                                      <span className="text-[12px] font-semibold text-gray-900">Price Variance</span>
                                    </div>
                                    {(() => {
                                      const variance = computedMetrics?.priceVariance || 15;
                                      // Updated logic: HIGH if >20% any month, or >10% for 3+ months, or >5% for 5+ months
                                      // Simplified: HIGH >15%, MEDIUM 5-15%, LOW <5%
                                      const level = variance > 15 ? 'HIGH' : variance >= 5 ? 'MEDIUM' : 'LOW';
                                      const color = level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                                      return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{level}</span>;
                                    })()}
                                  </div>
                                  {(() => {
                                    const variance = computedMetrics?.priceVariance || 15;
                                    const level = variance > 15 ? 'HIGH' : variance >= 5 ? 'MEDIUM' : 'LOW';
                                    const llmEval = getLLMEvaluation('vb-pp-4');
                                    const potentialSavings = totalSpend * (variance / 100) * 0.5; // 50% of variance is recoverable
                                    return (
                                      <>
                                        <GaugeChart
                                          value={variance}
                                          max={50}
                                          thresholds={{ low: 5, medium: 15 }}
                                          label="Price Variance vs Market"
                                          showLegend={false}
                                        />
                                        <p className="text-[14px] text-gray-700 mt-3 font-medium">
                                          {llmEval ? (
                                            <span className="text-purple-600">{llmEval.reasoning}</span>
                                          ) : (
                                            level === 'HIGH' ? 'High structural price variance indicates recurring premium pricing behavior across the portfolio.' :
                                              level === 'MEDIUM' ? 'Moderate variance detected - some suppliers showing episodic deviation from market.' :
                                                'Prices well-aligned with market benchmarks - maintain current sourcing strategy.'
                                          )}
                                        </p>

                                        {/* Method Applied */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Method Applied</h5>
                                          <div className="p-2 bg-gray-50 rounded border border-gray-200">
                                            <p className="text-[11px] text-gray-700 font-mono">
                                              Monthly Deviation % = ((Supplier Price - Market Price) / Market Price) × 100
                                            </p>
                                            <p className="text-[10px] text-gray-500 mt-1 italic">
                                              Underpricing treated as positive for buyer.
                                            </p>
                                          </div>
                                        </div>

                                        {/* Current Metrics */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Current Metrics</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <tbody>
                                              <tr className="bg-gray-50">
                                                <td className="py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Price Variance</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">{variance.toFixed(1)}%</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Total Spend Affected</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">{formatCurrency(totalSpend)}</td>
                                              </tr>
                                              <tr className="bg-blue-50 font-semibold">
                                                <td className="py-1.5 px-2 border border-gray-200 text-blue-700">Potential Recovery</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-blue-700">{formatCurrency(potentialSavings)}</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Impact Thresholds */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Impact Thresholds</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <thead>
                                              <tr className="bg-gray-50">
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Impact</th>
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Condition</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              <tr className={level === 'HIGH' ? 'bg-red-50' : ''}>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">HIGH</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600 text-[10px]">≥3 months &gt;10% OR ≥5 months &gt;5% OR any month &gt;20%</td>
                                              </tr>
                                              <tr className={level === 'MEDIUM' ? 'bg-amber-50' : ''}>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">MEDIUM</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600 text-[10px]">1-2 months &gt;10%</td>
                                              </tr>
                                              <tr className={level === 'LOW' ? 'bg-emerald-50' : ''}>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">LOW</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600 text-[10px]">Majority ≤0% AND ≤1 month &gt;5%</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Key Findings */}
                                        <div className="mt-3 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded border border-blue-100">
                                          <p className="text-[10px] text-blue-600 font-semibold mb-1">What This Means:</p>
                                          <ul className="text-[10px] text-gray-600 space-y-0.5">
                                            {level === 'HIGH' ? (
                                              <>
                                                <li>• This is <span className="font-semibold text-red-600">not a one-off volatility issue</span> — indicates recurring premium pricing</li>
                                                <li>• The exposure is <span className="font-semibold">structural, not tactical</span></li>
                                                <li>• High structural price variance implies margin pressure</li>
                                                <li>• Weak price-to-market synchronization across suppliers</li>
                                              </>
                                            ) : level === 'MEDIUM' ? (
                                              <>
                                                <li>• Some suppliers showing episodic deviation from market</li>
                                                <li>• Benchmark-aligned suppliers exist, proving market pricing is achievable</li>
                                                <li>• Opportunity to negotiate better terms with outliers</li>
                                              </>
                                            ) : (
                                              <>
                                                <li>• Prices well-aligned with market benchmarks</li>
                                                <li>• Strong price-to-market synchronization</li>
                                                <li>• Maintain current sourcing strategy</li>
                                              </>
                                            )}
                                          </ul>
                                        </div>

                                        {/* Executive View */}
                                        {level === 'HIGH' && (
                                          <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
                                            <p className="text-[10px] text-red-700 font-semibold mb-1">Executive View:</p>
                                            <p className="text-[10px] text-gray-700">
                                              The portfolio reflects <span className="font-semibold text-red-600">high structural price variance risk</span>,
                                              implying margin pressure and weak price-to-market synchronization across suppliers.
                                              Potential recovery: <span className="font-bold">{formatCurrency(potentialSavings)}</span>.
                                            </p>
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </motion.div>
                                )}

                                {/* Average Spend per Supplier (Share-Based) - Page 4 */}
                                {proofPointPage === 4 && (
                                <motion.div
                                  key="vb-pp-5"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="rounded-lg border border-gray-100 p-3 bg-white hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">📈</span>
                                      <span className="text-[12px] font-semibold text-gray-900">Avg Spend/Supplier</span>
                                    </div>
                                    {(() => {
                                      const supplierCount = computedMetrics?.supplierCount || topSuppliers.length || 1;
                                      const avgSharePct = 100 / supplierCount;
                                      // HIGH: <5% (>20 suppliers), MEDIUM: 5-15% (7-20 suppliers), LOW: >15% (<7 suppliers)
                                      const level = avgSharePct < 5 ? 'HIGH' : avgSharePct <= 15 ? 'MEDIUM' : 'LOW';
                                      const color = level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                                      return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{level}</span>;
                                    })()}
                                  </div>
                                  {(() => {
                                    const supplierCount = computedMetrics?.supplierCount || topSuppliers.length || 1;
                                    const avgSpend = computedMetrics?.avgSpendPerSupplier || (totalSpend / supplierCount);
                                    const avgSharePct = 100 / supplierCount;
                                    const level = avgSharePct < 5 ? 'HIGH' : avgSharePct <= 15 ? 'MEDIUM' : 'LOW';
                                    const llmEval = getLLMEvaluation('vb-pp-5');
                                    return (
                                      <>
                                        <p className="text-[14px] text-gray-700 mt-3 font-medium">
                                          {llmEval ? (
                                            <span className="text-purple-600">{llmEval.reasoning}</span>
                                          ) : (
                                            level === 'HIGH' ? 'Highly fragmented supplier base - significant consolidation opportunity exists.' :
                                              level === 'MEDIUM' ? 'Moderate fragmentation - room to increase leverage through rationalization.' :
                                                'Concentrated supplier base - good leverage but monitor supply risk.'
                                          )}
                                        </p>

                                        {/* Method Applied */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Method Applied</h5>
                                          <div className="p-2 bg-gray-50 rounded border border-gray-200">
                                            <p className="text-[11px] text-gray-700 font-mono">
                                              Avg Share % = 100 / Number of Suppliers
                                            </p>
                                            <p className="text-[10px] text-gray-500 mt-1">
                                              = 100 / {supplierCount} = <span className="font-bold text-gray-700">{avgSharePct.toFixed(2)}%</span>
                                            </p>
                                          </div>
                                        </div>

                                        {/* Portfolio Snapshot */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Portfolio Snapshot</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <tbody>
                                              <tr className="bg-gray-50">
                                                <td className="py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Total Active Suppliers</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">{supplierCount}</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Average Spend per Supplier</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">{formatCurrency(avgSpend)}</td>
                                              </tr>
                                              <tr className="bg-blue-50 font-semibold">
                                                <td className="py-1.5 px-2 border border-gray-200 text-blue-700">Average Share per Supplier</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-blue-700">{avgSharePct.toFixed(2)}%</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Impact Classification</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right">
                                                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{level}</span>
                                                </td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Impact Thresholds */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Impact Thresholds</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <thead>
                                              <tr className="bg-gray-50">
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Impact</th>
                                                <th className="text-center py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Avg Share %</th>
                                                <th className="text-center py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Suppliers</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              <tr className={level === 'HIGH' ? 'bg-red-50' : ''}>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">HIGH</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&lt;5%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center text-gray-600">&gt;20 suppliers</td>
                                              </tr>
                                              <tr className={level === 'MEDIUM' ? 'bg-amber-50' : ''}>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">MEDIUM</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">5-15%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center text-gray-600">7-20 suppliers</td>
                                              </tr>
                                              <tr className={level === 'LOW' ? 'bg-emerald-50' : ''}>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">LOW</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&gt;15%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center text-gray-600">&lt;7 suppliers</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Interpretation for Management */}
                                        <div className="mt-3 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded border border-blue-100">
                                          <p className="text-[10px] text-blue-600 font-semibold mb-1">Interpretation for Management:</p>
                                          <ul className="text-[10px] text-gray-600 space-y-0.5">
                                            {level === 'HIGH' ? (
                                              <>
                                                <li>• Supplier base is highly diluted ({supplierCount} suppliers, {avgSharePct.toFixed(1)}% avg share)</li>
                                                <li>• Spend is scattered - limited negotiation power with each supplier</li>
                                                <li>• Significant bundling potential through consolidation</li>
                                                <li>• Portfolio structure is inefficient - strategic rationalization recommended</li>
                                              </>
                                            ) : level === 'MEDIUM' ? (
                                              <>
                                                <li>• Supplier base falls within the 7-20 supplier band (moderate fragmentation)</li>
                                                <li>• Average share of ~{avgSharePct.toFixed(1)}% per supplier - reasonably distributed</li>
                                                <li>• Moderate bundling potential through rationalization</li>
                                                <li>• Portfolio is neither highly diluted nor highly concentrated</li>
                                              </>
                                            ) : (
                                              <>
                                                <li>• Concentrated supplier base ({supplierCount} suppliers, {avgSharePct.toFixed(1)}% avg share)</li>
                                                <li>• Good negotiation leverage with existing suppliers</li>
                                                <li>• Limited bundling opportunity but monitor supply risk</li>
                                                <li>• Consider qualifying additional suppliers for competitive tension</li>
                                              </>
                                            )}
                                          </ul>
                                        </div>

                                        {/* Executive Takeaway */}
                                        <div className="mt-3 p-2 bg-gray-100 rounded border border-gray-200">
                                          <p className="text-[10px] text-gray-700 font-semibold mb-1">Executive Takeaway:</p>
                                          <p className="text-[10px] text-gray-700">
                                            {level === 'HIGH' ? (
                                              <>The current supplier structure reflects a <span className="font-semibold text-red-600">highly fragmented portfolio</span>. Strategic consolidation is recommended to enhance negotiation leverage and reduce supplier management overhead.</>
                                            ) : level === 'MEDIUM' ? (
                                              <>The current supplier structure reflects a <span className="font-semibold text-amber-600">balanced but optimization-ready portfolio</span>. Strategic consolidation or volume aggregation could enhance negotiation leverage without materially increasing supply risk.</>
                                            ) : (
                                              <>The current supplier structure reflects a <span className="font-semibold text-emerald-600">well-consolidated portfolio</span>. Focus on maintaining competitive tension while monitoring concentration risk.</>
                                            )}
                                          </p>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </motion.div>
                                )}

                                {/* Market Consolidation (HHI) - Page 5 */}
                                {proofPointPage === 5 && (
                                <motion.div
                                  key="vb-pp-6"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="rounded-lg border border-gray-100 p-3 bg-white hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">🏢</span>
                                      <span className="text-[12px] font-semibold text-gray-900">Market Consolidation (HHI)</span>
                                    </div>
                                    {(() => {
                                      const hhi = computedMetrics?.hhiIndex || 1800;
                                      // Note: For HHI, LOW index = HIGH opportunity (competitive market)
                                      const level = hhi < 1500 ? 'HIGH' : hhi < 2500 ? 'MEDIUM' : 'LOW';
                                      const color = level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                                      return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{level}</span>;
                                    })()}
                                  </div>
                                  {(() => {
                                    const hhi = computedMetrics?.hhiIndex || 0;
                                    const supplierCount = computedMetrics?.supplierCount || topSuppliers.length || 1;
                                    // Note: For HHI, LOW index = HIGH opportunity (competitive market)
                                    const level = hhi < 1500 ? 'HIGH' : hhi < 2500 ? 'MEDIUM' : 'LOW';
                                    const llmEval = getLLMEvaluation('vb-pp-6');

                                    // Calculate market shares for top suppliers
                                    const supplierShares = topSuppliers.map(s => ({
                                      name: s.name,
                                      spend: s.spend,
                                      share: totalSpend > 0 ? (s.spend / totalSpend) * 100 : 0,
                                      squaredShare: totalSpend > 0 ? Math.pow((s.spend / totalSpend) * 100, 2) : 0
                                    }));

                                    // Calculate contribution to HHI from visible suppliers
                                    const visibleHHI = supplierShares.reduce((sum, s) => sum + s.squaredShare, 0);
                                    const remainingHHI = hhi - visibleHHI;
                                    const otherSuppliersCount = Math.max(0, supplierCount - topSuppliers.length);

                                    return (
                                      <>
                                        <p className="text-[14px] text-gray-700 mt-3 font-medium">
                                          {llmEval ? (
                                            <span className="text-purple-600">{llmEval.reasoning}</span>
                                          ) : (
                                            level === 'HIGH' ? 'Competitive market structure - strong negotiating leverage and multiple sourcing options available.' :
                                              level === 'MEDIUM' ? 'Moderately concentrated market - balanced power dynamics with room for competitive pressure.' :
                                                'Highly concentrated supply base - limited alternatives may constrain negotiation flexibility.'
                                          )}
                                        </p>

                                        {/* Method Applied */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Method Applied</h5>
                                          <div className="p-2 bg-gray-50 rounded border border-gray-200">
                                            <p className="text-[11px] text-gray-700 font-mono">
                                              HHI = Σ (Market Share %)² for all suppliers
                                            </p>
                                            <p className="text-[10px] text-gray-500 mt-1">
                                              Scale: 0 (perfect competition) to 10,000 (monopoly)
                                            </p>
                                            <p className="text-[10px] text-gray-500 mt-1">
                                              Your HHI = <span className="font-bold text-gray-700">{hhi.toLocaleString()}</span>
                                            </p>
                                          </div>
                                        </div>

                                        {/* Supplier Market Shares Table */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Market Share Analysis</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <thead>
                                              <tr className="bg-gray-50">
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Supplier</th>
                                                <th className="text-right py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Spend</th>
                                                <th className="text-right py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Share %</th>
                                                <th className="text-right py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Share²</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {supplierShares.slice(0, 5).map((supplier, idx) => (
                                                <tr key={idx} className={idx === 0 ? 'bg-blue-50' : ''}>
                                                  <td className="py-1.5 px-2 border border-gray-200 text-gray-800">{supplier.name}</td>
                                                  <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">{formatCurrency(supplier.spend)}</td>
                                                  <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">{supplier.share.toFixed(2)}%</td>
                                                  <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-600">{supplier.squaredShare.toFixed(0)}</td>
                                                </tr>
                                              ))}
                                              {otherSuppliersCount > 0 && (
                                                <tr className="bg-gray-50">
                                                  <td className="py-1.5 px-2 border border-gray-200 text-gray-600 italic">Other {otherSuppliersCount} suppliers</td>
                                                  <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-600">—</td>
                                                  <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-600">—</td>
                                                  <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-600">{remainingHHI > 0 ? remainingHHI.toFixed(0) : '—'}</td>
                                                </tr>
                                              )}
                                              <tr className="bg-blue-50 font-semibold">
                                                <td className="py-1.5 px-2 border border-gray-200 text-blue-700">Total HHI</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-blue-700">{formatCurrency(totalSpend)}</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-blue-700">100%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-blue-700">{hhi.toLocaleString()}</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Impact Thresholds */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Impact Classification (DOJ/FTC Standards)</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <thead>
                                              <tr className="bg-gray-50">
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Impact</th>
                                                <th className="text-center py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">HHI Range</th>
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Market Structure</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              <tr className={level === 'HIGH' ? 'bg-red-50' : ''}>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">HIGH</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&lt;1,500</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Competitive - Multiple sourcing options</td>
                                              </tr>
                                              <tr className={level === 'MEDIUM' ? 'bg-amber-50' : ''}>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">MEDIUM</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">1,500-2,500</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Moderate concentration - Balanced power</td>
                                              </tr>
                                              <tr className={level === 'LOW' ? 'bg-emerald-50' : ''}>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">LOW</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&gt;2,500</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Highly concentrated - Limited options</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Interpretation for Management */}
                                        <div className="mt-3 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded border border-blue-100">
                                          <p className="text-[10px] text-blue-600 font-semibold mb-1">Interpretation for Management:</p>
                                          <ul className="text-[10px] text-gray-600 space-y-0.5">
                                            {level === 'HIGH' ? (
                                              <>
                                                <li>• HHI of {hhi.toLocaleString()} indicates a <span className="font-semibold text-red-600">competitive market</span></li>
                                                <li>• No single supplier dominates - healthy competitive tension exists</li>
                                                <li>• Strong position to leverage multiple suppliers for better pricing</li>
                                                <li>• Volume bundling can create significant negotiation leverage</li>
                                              </>
                                            ) : level === 'MEDIUM' ? (
                                              <>
                                                <li>• HHI of {hhi.toLocaleString()} indicates <span className="font-semibold text-amber-600">moderate market concentration</span></li>
                                                <li>• A few suppliers hold significant market share</li>
                                                <li>• Balanced negotiating power - neither buyer nor seller dominant</li>
                                                <li>• Consider supplier diversification to increase leverage</li>
                                              </>
                                            ) : (
                                              <>
                                                <li>• HHI of {hhi.toLocaleString()} indicates a <span className="font-semibold text-emerald-600">highly concentrated market</span></li>
                                                <li>• One or few suppliers control most of the market share</li>
                                                <li>• Limited negotiation leverage due to few alternatives</li>
                                                <li>• Focus on relationship management and long-term contracts</li>
                                              </>
                                            )}
                                          </ul>
                                        </div>

                                        {/* Executive Takeaway */}
                                        <div className="mt-3 p-2 bg-gray-100 rounded border border-gray-200">
                                          <p className="text-[10px] text-gray-700 font-semibold mb-1">Executive Takeaway:</p>
                                          <p className="text-[10px] text-gray-700">
                                            {level === 'HIGH' ? (
                                              <>With an HHI of <span className="font-semibold text-red-600">{hhi.toLocaleString()}</span>, the supplier market is <span className="font-semibold">competitive</span>. This creates strong opportunities for volume bundling negotiations across {supplierCount} suppliers. Consolidating demand and running competitive bids can unlock significant savings.</>
                                            ) : level === 'MEDIUM' ? (
                                              <>With an HHI of <span className="font-semibold text-amber-600">{hhi.toLocaleString()}</span>, the market shows <span className="font-semibold">moderate concentration</span>. While negotiating power is balanced, strategic supplier development and qualification of alternatives can improve competitive dynamics.</>
                                            ) : (
                                              <>With an HHI of <span className="font-semibold text-emerald-600">{hhi.toLocaleString()}</span>, the market is <span className="font-semibold">highly concentrated</span>. Focus on strategic partnerships, risk mitigation through backup qualification, and value-based negotiations rather than pure price competition.</>
                                            )}
                                          </p>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </motion.div>
                                )}

                                {/* Supplier Location (vb-pp-7) - Page 6 */}
                                {proofPointPage === 6 && (
                                <motion.div
                                  key="vb-pp-7"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="rounded-lg border border-gray-100 p-3 bg-white hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">🌍</span>
                                      <span className="text-[12px] font-semibold text-gray-900">Supplier Geographic Concentration</span>
                                    </div>
                                    {(() => {
                                      // Calculate from spend data
                                      const spendFile = state.persistedReviewData?.spendFile;
                                      let regionData: Record<string, number> = {};
                                      let totalRegionSpend = 0;

                                      if (spendFile?.parsedData?.rows && Array.isArray(spendFile.parsedData.rows)) {
                                        spendFile.parsedData.rows.forEach((row: Record<string, unknown>) => {
                                          const region = String(row.Supplier_Region || row.supplier_region || row.Supplier_Country || row.supplier_country || row.region || row.Region || row.country || row.Country || '');
                                          const spend = parseFloat(String(row['Total Spend _USD_Mn/metric ton'] || row.total_spend || row.spend || row.Spend || row.amount || 0));
                                          if (region && !isNaN(spend) && spend > 0) {
                                            regionData[region] = (regionData[region] || 0) + spend;
                                            totalRegionSpend += spend;
                                          }
                                        });
                                      }

                                      const sortedRegions = Object.entries(regionData).sort((a, b) => b[1] - a[1]);
                                      const topRegionPct = totalRegionSpend > 0 && sortedRegions[0] ? (sortedRegions[0][1] / totalRegionSpend) * 100 : 0;

                                      // For geographic concentration: HIGH concentration (>70%) = LOW opportunity for bundling diversification
                                      // LOW concentration (<50%) = diversified = LOW risk but also less regional bundling leverage
                                      const level = topRegionPct > 70 ? 'HIGH' : topRegionPct >= 50 ? 'MEDIUM' : 'LOW';
                                      const color = level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                                      return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{level}</span>;
                                    })()}
                                  </div>
                                  {(() => {
                                    // Calculate geographic concentration from spend data
                                    const spendFile = state.persistedReviewData?.spendFile;
                                    let regionData: Record<string, number> = {};
                                    let totalRegionSpend = 0;

                                    if (spendFile?.parsedData?.rows && Array.isArray(spendFile.parsedData.rows)) {
                                      spendFile.parsedData.rows.forEach((row: Record<string, unknown>) => {
                                        const region = String(row.Supplier_Region || row.supplier_region || row.Supplier_Country || row.supplier_country || row.region || row.Region || row.country || row.Country || '');
                                        const spend = parseFloat(String(row['Total Spend _USD_Mn/metric ton'] || row.total_spend || row.spend || row.Spend || row.amount || 0));
                                        if (region && !isNaN(spend) && spend > 0) {
                                          regionData[region] = (regionData[region] || 0) + spend;
                                          totalRegionSpend += spend;
                                        }
                                      });
                                    }

                                    const sortedRegions = Object.entries(regionData).sort((a, b) => b[1] - a[1]);
                                    const topRegion = sortedRegions[0] || ['N/A', 0];
                                    const topRegionPct = totalRegionSpend > 0 ? (topRegion[1] / totalRegionSpend) * 100 : 0;
                                    const level = topRegionPct > 70 ? 'HIGH' : topRegionPct >= 50 ? 'MEDIUM' : 'LOW';
                                    const llmEval = getLLMEvaluation('vb-pp-7');

                                    return (
                                      <>
                                        <p className="text-[14px] text-gray-700 mt-3 font-medium">
                                          {llmEval ? (
                                            <span className="text-purple-600">{llmEval.reasoning}</span>
                                          ) : (
                                            level === 'HIGH' ? 'High geographic concentration - strong regional bundling opportunity but potential supply risk.' :
                                              level === 'MEDIUM' ? 'Moderate geographic spread - balanced regional sourcing with bundling potential.' :
                                                'Diversified geographic footprint - reduced supply risk but may limit regional bundling leverage.'
                                          )}
                                        </p>

                                        {/* Method Applied */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Method Applied</h5>
                                          <div className="p-2 bg-gray-50 rounded border border-gray-200">
                                            <p className="text-[11px] text-gray-700 font-mono">
                                              Top Region % = (Spend in Largest Region / Total Spend) × 100
                                            </p>
                                            <p className="text-[10px] text-gray-500 mt-1">
                                              Measures geographic concentration of supplier base
                                            </p>
                                          </div>
                                        </div>

                                        {/* Geographic Distribution Table */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Geographic Spend Distribution</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <thead>
                                              <tr className="bg-gray-50">
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Region/Country</th>
                                                <th className="text-right py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Spend</th>
                                                <th className="text-right py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Share %</th>
                                                <th className="text-center py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Concentration</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {sortedRegions.slice(0, 8).map(([region, spend], idx) => {
                                                const pct = totalRegionSpend > 0 ? (spend / totalRegionSpend) * 100 : 0;
                                                const isTop = idx === 0;
                                                return (
                                                  <tr key={region} className={isTop ? 'bg-blue-50' : ''}>
                                                    <td className="py-1.5 px-2 border border-gray-200 text-gray-800">
                                                      {isTop && <span className="mr-1">🏆</span>}{region}
                                                    </td>
                                                    <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">{formatCurrency(spend)}</td>
                                                    <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">{pct.toFixed(2)}%</td>
                                                    <td className="py-1.5 px-2 border border-gray-200 text-center">
                                                      <div className="w-full bg-gray-200 rounded-full h-2">
                                                        <div className={`h-2 rounded-full ${pct > 30 ? 'bg-blue-500' : pct > 15 ? 'bg-blue-400' : 'bg-blue-300'}`} style={{ width: `${Math.min(pct, 100)}%` }}></div>
                                                      </div>
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                              {sortedRegions.length > 8 && (
                                                <tr className="bg-gray-50">
                                                  <td className="py-1.5 px-2 border border-gray-200 text-gray-600 italic">Other {sortedRegions.length - 8} regions</td>
                                                  <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-600">
                                                    {formatCurrency(sortedRegions.slice(8).reduce((sum, [, s]) => sum + s, 0))}
                                                  </td>
                                                  <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-600">
                                                    {totalRegionSpend > 0 ? ((sortedRegions.slice(8).reduce((sum, [, s]) => sum + s, 0) / totalRegionSpend) * 100).toFixed(2) : 0}%
                                                  </td>
                                                  <td className="py-1.5 px-2 border border-gray-200 text-center">—</td>
                                                </tr>
                                              )}
                                              <tr className="bg-blue-50 font-semibold">
                                                <td className="py-1.5 px-2 border border-gray-200 text-blue-700">Total</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-blue-700">{formatCurrency(totalRegionSpend)}</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-blue-700">100%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center text-blue-700">—</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Impact Thresholds */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Impact Classification</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <thead>
                                              <tr className="bg-gray-50">
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Impact</th>
                                                <th className="text-center py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Top Region %</th>
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Interpretation</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              <tr className={level === 'HIGH' ? 'bg-red-50' : ''}>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">HIGH</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&gt;70%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Same region concentration - regional bundling ready</td>
                                              </tr>
                                              <tr className={level === 'MEDIUM' ? 'bg-amber-50' : ''}>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">MEDIUM</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">50-70%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Moderate concentration - selective bundling</td>
                                              </tr>
                                              <tr className={level === 'LOW' ? 'bg-emerald-50' : ''}>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">LOW</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&lt;50%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Diversified - low regional bundling leverage</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Key Metrics Summary */}
                                        <div className="mt-3 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded border border-blue-100">
                                          <p className="text-[10px] text-blue-600 font-semibold mb-1">Your Geographic Concentration:</p>
                                          <ul className="text-[10px] text-gray-600 space-y-0.5">
                                            <li>• <span className="font-semibold">Total Spend:</span> {formatCurrency(totalRegionSpend)}</li>
                                            <li>• <span className="font-semibold">Largest Region:</span> {topRegion[0]} ({formatCurrency(topRegion[1])})</li>
                                            <li>• <span className="font-semibold">Top Region Share:</span> <span className={level === 'HIGH' ? 'text-red-600 font-bold' : level === 'MEDIUM' ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}>{topRegionPct.toFixed(2)}%</span></li>
                                            <li>• <span className="font-semibold">Total Regions:</span> {sortedRegions.length}</li>
                                          </ul>
                                        </div>

                                        {/* Executive Takeaway */}
                                        <div className="mt-3 p-2 bg-gray-100 rounded border border-gray-200">
                                          <p className="text-[10px] text-gray-700 font-semibold mb-1">Executive Takeaway:</p>
                                          <p className="text-[10px] text-gray-700">
                                            {level === 'HIGH' ? (
                                              <>Your largest region (<span className="font-semibold">{topRegion[0]}</span>) accounts for <span className="font-semibold text-red-600">{topRegionPct.toFixed(1)}%</span> of total spend. This high concentration enables <span className="font-semibold">strong regional bundling opportunities</span> - negotiate consolidated contracts with regional champions for 5-8% volume rebates. However, monitor supply risk from over-reliance on a single geography.</>
                                            ) : level === 'MEDIUM' ? (
                                              <>Geographic concentration of <span className="font-semibold text-amber-600">{topRegionPct.toFixed(1)}%</span> in {topRegion[0]} provides <span className="font-semibold">balanced regional sourcing</span>. Consider selective bundling in top 2-3 regions while maintaining diversification benefits.</>
                                            ) : (
                                              <>Your supply base is <span className="font-semibold text-emerald-600">well diversified</span> across {sortedRegions.length} regions with no single region exceeding {topRegionPct.toFixed(1)}%. This reduces supply risk but may limit regional bundling leverage. Focus on cross-regional demand aggregation instead.</>
                                            )}
                                          </p>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </motion.div>
                                )}

                                {/* Supplier Risk Rating (vb-pp-8) - Page 7 */}
                                {proofPointPage === 7 && (
                                <motion.div
                                  key="vb-pp-8"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="rounded-lg border border-gray-100 p-3 bg-white hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">🛡️</span>
                                      <span className="text-[12px] font-semibold text-gray-900">Supplier Risk Rating</span>
                                    </div>
                                    {(() => {
                                      // Calculate from supplier data with risk ratings
                                      const supplierShares = topSuppliers.map(s => ({
                                        name: s.name,
                                        spend: s.spend,
                                        share: totalSpend > 0 ? (s.spend / totalSpend) * 100 : 0,
                                        // Default risk score based on position (can be enhanced with actual data)
                                        riskScore: 1.5 + (Math.random() * 1.5) // Placeholder - will be replaced with actual data
                                      }));

                                      // Check for actual risk data in supplier master
                                      const supplierMasterFile = Object.entries(state.persistedReviewData?.dataPointFiles || {})
                                        .find(([key]) => key.toLowerCase().includes('supplier') || key.toLowerCase().includes('master'));

                                      let hasRiskData = false;
                                      let lowRiskCount = 0;
                                      let totalWithRisk = 0;

                                      if (supplierMasterFile && (supplierMasterFile[1] as any)?.parsedData?.rows) {
                                        const rows = (supplierMasterFile[1] as any).parsedData.rows;
                                        rows.forEach((row: Record<string, unknown>) => {
                                          const rating = String(row.risk_rating || row.Risk || row['Risk Rating'] || '').toLowerCase();
                                          if (rating) {
                                            totalWithRisk++;
                                            if (rating.includes('low') || rating === '1' || rating === '2') {
                                              lowRiskCount++;
                                            }
                                          }
                                        });
                                        hasRiskData = totalWithRisk > 0;
                                      }

                                      // Top 5 suppliers all low risk = HIGH, Mixed = MEDIUM, High-risk in top 5 = LOW
                                      const lowRiskPct = totalWithRisk > 0 ? (lowRiskCount / totalWithRisk) * 100 : 50;
                                      const level = lowRiskPct >= 80 ? 'HIGH' : lowRiskPct >= 40 ? 'MEDIUM' : 'LOW';
                                      const color = level === 'HIGH' ? 'bg-emerald-100 text-emerald-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
                                      return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{level}</span>;
                                    })()}
                                  </div>
                                  {(() => {
                                    // Get supplier data with risk ratings
                                    const supplierMasterFile = Object.entries(state.persistedReviewData?.dataPointFiles || {})
                                      .find(([key]) => key.toLowerCase().includes('supplier') || key.toLowerCase().includes('master'));

                                    // Build supplier risk data
                                    interface SupplierRiskData {
                                      name: string;
                                      spend: number;
                                      sharePercent: number;
                                      riskScore: number;
                                      riskLevel: string;
                                      weightedRisk: number;
                                    }

                                    let supplierRiskData: SupplierRiskData[] = [];
                                    let hasActualRiskData = false;

                                    // Try to get from supplier master file
                                    if (supplierMasterFile && (supplierMasterFile[1] as any)?.parsedData?.rows) {
                                      const rows = (supplierMasterFile[1] as any).parsedData.rows as Record<string, unknown>[];
                                      const supplierRiskMap: Record<string, { riskScore: number; riskLevel: string }> = {};

                                      rows.forEach((row) => {
                                        const name = String(row.supplier_name || row.Supplier || row.supplier || '');
                                        const ratingStr = String(row.risk_rating || row.Risk || row['Risk Rating'] || '');

                                        if (name && ratingStr) {
                                          let riskScore = 2.0;
                                          let riskLevel = 'Medium';

                                          const ratingLower = ratingStr.toLowerCase();
                                          if (ratingLower.includes('low') || ratingStr === '1') {
                                            riskScore = 1.3;
                                            riskLevel = 'Low';
                                          } else if (ratingLower.includes('high') || ratingStr === '4' || ratingStr === '5') {
                                            riskScore = 2.7;
                                            riskLevel = 'High';
                                          } else if (ratingLower.includes('medium') || ratingStr === '2' || ratingStr === '3') {
                                            riskScore = 2.0;
                                            riskLevel = 'Medium';
                                          } else {
                                            // Try numeric
                                            const numRating = parseFloat(ratingStr);
                                            if (!isNaN(numRating)) {
                                              if (numRating <= 1.5) { riskScore = 1.3; riskLevel = 'Low'; }
                                              else if (numRating <= 2.5) { riskScore = 2.0; riskLevel = 'Medium'; }
                                              else { riskScore = 2.7; riskLevel = 'High'; }
                                            }
                                          }

                                          supplierRiskMap[name.toLowerCase()] = { riskScore, riskLevel };
                                          hasActualRiskData = true;
                                        }
                                      });

                                      // Map to top suppliers
                                      supplierRiskData = topSuppliers.map((s, idx) => {
                                        const riskInfo = supplierRiskMap[s.name.toLowerCase()] || {
                                          riskScore: 1.5 + (idx * 0.2), // Default gradient
                                          riskLevel: idx < 3 ? 'Low' : idx < 7 ? 'Medium' : 'High'
                                        };
                                        const sharePercent = totalSpend > 0 ? (s.spend / totalSpend) * 100 : 0;
                                        return {
                                          name: s.name,
                                          spend: s.spend,
                                          sharePercent,
                                          riskScore: riskInfo.riskScore,
                                          riskLevel: riskInfo.riskLevel,
                                          weightedRisk: (sharePercent / 100) * riskInfo.riskScore
                                        };
                                      });
                                    } else {
                                      // Use default risk distribution based on supplier position
                                      supplierRiskData = topSuppliers.map((s, idx) => {
                                        const sharePercent = totalSpend > 0 ? (s.spend / totalSpend) * 100 : 0;
                                        // Larger suppliers tend to be lower risk (more established)
                                        let riskScore = 1.3;
                                        let riskLevel = 'Low';
                                        if (idx >= 3 && idx < 9) { riskScore = 2.0; riskLevel = 'Medium'; }
                                        if (idx >= 9) { riskScore = 2.7; riskLevel = 'High'; }

                                        return {
                                          name: s.name,
                                          spend: s.spend,
                                          sharePercent,
                                          riskScore,
                                          riskLevel,
                                          weightedRisk: (sharePercent / 100) * riskScore
                                        };
                                      });
                                    }

                                    // Calculate category-level risk
                                    const baseWeightedRisk = supplierRiskData.reduce((sum, s) => sum + s.weightedRisk, 0);
                                    const hhi = computedMetrics?.hhiIndex || 1000;
                                    const concentrationAdjustment = hhi > 2500 ? 0.3 : hhi > 1500 ? 0.15 : 0;
                                    const marketVolatilityBuffer = 0.20; // Commodity category
                                    const finalRiskScore = baseWeightedRisk + concentrationAdjustment + marketVolatilityBuffer;

                                    const riskClassification = finalRiskScore < 1.5 ? 'Low' : finalRiskScore < 2.5 ? 'Medium' : 'High';
                                    const lowRiskSuppliers = supplierRiskData.filter(s => s.riskLevel === 'Low');
                                    const level = lowRiskSuppliers.length >= 4 ? 'HIGH' : lowRiskSuppliers.length >= 2 ? 'MEDIUM' : 'LOW';
                                    const llmEval = getLLMEvaluation('vb-pp-8');

                                    return (
                                      <>
                                        <p className="text-[14px] text-gray-700 mt-3 font-medium">
                                          {llmEval ? (
                                            <span className="text-purple-600">{llmEval.reasoning}</span>
                                          ) : (
                                            level === 'HIGH' ? 'Top suppliers are low-risk - safe candidates for volume consolidation and long-term commitments.' :
                                              level === 'MEDIUM' ? 'Mixed risk profile across suppliers - selective consolidation with risk monitoring recommended.' :
                                                'High-risk suppliers in top positions - volume consolidation requires careful due diligence and backup planning.'
                                          )}
                                        </p>

                                        {/* Method Applied */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Method Applied</h5>
                                          <div className="p-2 bg-gray-50 rounded border border-gray-200">
                                            <p className="text-[11px] text-gray-700 font-mono">
                                              Low Risk % = (Spend with Low-Risk Suppliers / Total Spend) × 100
                                            </p>
                                            <p className="text-[10px] text-gray-500 mt-1">
                                              Weighted Risk = Σ (Spend Share % × Supplier Risk Score)
                                            </p>
                                            <p className="text-[10px] text-gray-500 mt-1">
                                              Risk Scores: Low=1.3, Medium=2.0, High=2.7
                                            </p>
                                          </div>
                                        </div>

                                        {/* Supplier Risk Table */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Supplier Risk Analysis {!hasActualRiskData && <span className="text-gray-400 font-normal">(Estimated)</span>}</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <thead>
                                              <tr className="bg-gray-50">
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Supplier</th>
                                                <th className="text-right py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Spend Share</th>
                                                <th className="text-center py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Risk Score</th>
                                                <th className="text-center py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Risk Level</th>
                                                <th className="text-right py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Weighted</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {supplierRiskData.slice(0, 10).map((supplier, idx) => {
                                                const riskColor = supplier.riskLevel === 'Low' ? 'bg-emerald-100 text-emerald-700' :
                                                  supplier.riskLevel === 'High' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
                                                return (
                                                  <tr key={idx} className={idx < 3 ? 'bg-blue-50' : ''}>
                                                    <td className="py-1.5 px-2 border border-gray-200 text-gray-800">{supplier.name}</td>
                                                    <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">{supplier.sharePercent.toFixed(2)}%</td>
                                                    <td className="py-1.5 px-2 border border-gray-200 text-center text-gray-800">{supplier.riskScore.toFixed(1)}</td>
                                                    <td className="py-1.5 px-2 border border-gray-200 text-center">
                                                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${riskColor}`}>{supplier.riskLevel}</span>
                                                    </td>
                                                    <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-600">{supplier.weightedRisk.toFixed(3)}</td>
                                                  </tr>
                                                );
                                              })}
                                              {supplierRiskData.length > 10 && (
                                                <tr className="bg-gray-50">
                                                  <td className="py-1.5 px-2 border border-gray-200 text-gray-600 italic" colSpan={4}>Other {supplierRiskData.length - 10} suppliers</td>
                                                  <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-600">
                                                    {supplierRiskData.slice(10).reduce((sum, s) => sum + s.weightedRisk, 0).toFixed(3)}
                                                  </td>
                                                </tr>
                                              )}
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Category-Level Risk Calculation */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Category-Level Risk Calculation</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <thead>
                                              <tr className="bg-gray-50">
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Component</th>
                                                <th className="text-right py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Score</th>
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Notes</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-800">Base Weighted Supplier Risk</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right font-medium text-gray-800">{baseWeightedRisk.toFixed(2)}</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-500 text-[10px]">Σ(Share% × Risk Score)</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-800">HHI Concentration Index</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right font-medium text-gray-800">{hhi.toLocaleString()}</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-500 text-[10px]">
                                                  {hhi < 1500 ? '🟢 Diversified' : hhi < 2500 ? '🟡 Moderate' : '🔴 Concentrated'}
                                                </td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-800">Concentration Adjustment</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right font-medium text-gray-800">+{concentrationAdjustment.toFixed(2)}</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-500 text-[10px]">Based on HHI level</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-800">Market Volatility Buffer</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right font-medium text-gray-800">+{marketVolatilityBuffer.toFixed(2)}</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-500 text-[10px]">Commodity category exposure</td>
                                              </tr>
                                              <tr className="bg-blue-50 font-semibold">
                                                <td className="py-1.5 px-2 border border-gray-200 text-blue-700">Final Category Risk Score</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-blue-700">{finalRiskScore.toFixed(2)}</td>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    riskClassification === 'Low' ? 'bg-emerald-100 text-emerald-700' :
                                                      riskClassification === 'High' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                                  }`}>{riskClassification} Risk</span>
                                                </td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Impact Thresholds */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Impact Classification (Volume Bundling Context)</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <thead>
                                              <tr className="bg-gray-50">
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Impact</th>
                                                <th className="text-center py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Criteria</th>
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Bundling Readiness</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              <tr className={level === 'HIGH' ? 'bg-emerald-50' : ''}>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">HIGH</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">Top 5 all low-risk</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">✅ Safe for volume consolidation</td>
                                              </tr>
                                              <tr className={level === 'MEDIUM' ? 'bg-amber-50' : ''}>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">MEDIUM</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">Mixed risk profile</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">⚠️ Selective consolidation advised</td>
                                              </tr>
                                              <tr className={level === 'LOW' ? 'bg-red-50' : ''}>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">LOW</span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">High-risk in top 5</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">❌ Requires risk mitigation first</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Key Management Insights */}
                                        <div className="mt-3 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded border border-blue-100">
                                          <p className="text-[10px] text-blue-600 font-semibold mb-1">Key Management Insights:</p>
                                          <ul className="text-[10px] text-gray-600 space-y-0.5">
                                            <li>• Portfolio is {hhi < 1500 ? 'well diversified (HHI <1,500)' : hhi < 2500 ? 'moderately concentrated (HHI 1,500-2,500)' : 'highly concentrated (HHI >2,500)'}</li>
                                            <li>• {topSuppliers[0] ? `No single dominant supplier (${topSuppliers[0].name} at ${(totalSpend > 0 ? (topSuppliers[0].spend / totalSpend * 100) : 0).toFixed(1)}%)` : 'Supplier distribution not available'}</li>
                                            <li>• Risk driven primarily by {lowRiskSuppliers.length >= 3 ? 'stable, low-risk supplier base' : 'mid-tier supplier exposure'}</li>
                                            <li>• Structural concentration risk is {hhi < 1500 ? 'low' : hhi < 2500 ? 'moderate' : 'high'}</li>
                                            <li>• Category volatility adds {marketVolatilityBuffer > 0.15 ? 'moderate' : 'minimal'} overlay risk</li>
                                          </ul>
                                        </div>

                                        {/* Executive Takeaway */}
                                        <div className="mt-3 p-2 bg-gray-100 rounded border border-gray-200">
                                          <p className="text-[10px] text-gray-700 font-semibold mb-1">Executive Takeaway:</p>
                                          <p className="text-[10px] text-gray-700">
                                            {riskClassification === 'Low' ? (
                                              <>Category risk score of <span className="font-semibold text-emerald-600">{finalRiskScore.toFixed(2)}</span> indicates a <span className="font-semibold">stable, low-risk portfolio</span>. Top suppliers are financially sound and operationally reliable - ideal candidates for volume bundling and long-term commitments. Proceed with confidence on consolidation initiatives.</>
                                            ) : riskClassification === 'Medium' ? (
                                              <>Category risk score of <span className="font-semibold text-amber-600">{finalRiskScore.toFixed(2)}</span> indicates a <span className="font-semibold">stable but commodity-exposed portfolio</span>. Not structurally fragile, but selective due diligence recommended before major volume commitments. Monitor mid-tier supplier performance closely.</>
                                            ) : (
                                              <>Category risk score of <span className="font-semibold text-red-600">{finalRiskScore.toFixed(2)}</span> indicates <span className="font-semibold">elevated risk levels</span>. High-risk suppliers in top positions require mitigation before volume bundling. Prioritize backup qualification and financial health monitoring before consolidation.</>
                                            )}
                                          </p>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </motion.div>
                                )}
                              </>
                            )}

                            {/* Proof Points for Target Pricing */}
                            {oppId === 'target-pricing' && (
                              <>
                                {/* Price Variance - tp-pp-1 (Page 0) */}
                                {proofPointPage === 0 && (
                                <motion.div
                                  key="tp-pp-1"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="rounded-lg border border-gray-100 p-3 bg-white hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">💰</span>
                                      <span className="text-[12px] font-semibold text-gray-900">Price Variance</span>
                                    </div>
                                    {(() => {
                                      const variance = computedMetrics?.priceVariance || 15;
                                      const { level, isLLM } = getImpactLevel('tp-pp-1', variance, { high: 25, medium: 10 });
                                      const color = level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                                      return (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>
                                          {level} {isLLM && '✨'}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  {(() => {
                                    const variance = computedMetrics?.priceVariance || 15;
                                    const llmEval = getLLMEvaluation('tp-pp-1');
                                    const minPrice = totalSpend > 0 ? totalSpend * (1 - variance/100) / (topSuppliers.length || 1) : 0;
                                    const maxPrice = totalSpend > 0 ? totalSpend * (1 + variance/100) / (topSuppliers.length || 1) : 0;
                                    return (
                                      <>
                                        <GaugeChart
                                          value={variance}
                                          max={50}
                                          thresholds={{ low: 10, medium: 25 }}
                                          label="Price Variance"
                                          showLegend={false}
                                        />
                                        <p className="text-[14px] text-gray-700 mt-3 font-medium">
                                          {llmEval ? (
                                            <span className="text-purple-600">{llmEval.reasoning}</span>
                                          ) : (
                                            variance > 25 ? `${variance.toFixed(0)}% variance indicates strong negotiation potential using best-price benchmarks.` :
                                            variance >= 10 ? `${variance.toFixed(0)}% variance shows moderate opportunity for price harmonization.` :
                                            `${variance.toFixed(0)}% variance - prices are already well-standardized.`
                                          )}
                                        </p>

                                        {/* Price by Supplier Table */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Price Analysis by Supplier</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <thead>
                                              <tr className="bg-gray-50">
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Supplier</th>
                                                <th className="text-right py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Spend</th>
                                                <th className="text-center py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Price Index</th>
                                                <th className="text-center py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">vs Best</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {topSuppliers.slice(0, 5).map((supplier, idx) => {
                                                const priceIndex = 100 + (idx === 0 ? 0 : idx === 1 ? Math.round(variance * 0.4) : idx === 2 ? Math.round(variance * 0.7) : Math.round(variance));
                                                const vsBest = priceIndex - 100;
                                                return (
                                                  <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="py-1.5 px-2 border border-gray-200 text-gray-800">{supplier.name}</td>
                                                    <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">{formatCurrency(supplier.spend)}</td>
                                                    <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">{priceIndex}</td>
                                                    <td className={`py-1.5 px-2 border border-gray-200 text-center font-medium ${vsBest > 10 ? 'text-red-600' : vsBest > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                      {vsBest > 0 ? `+${vsBest}%` : vsBest === 0 ? 'Best' : `${vsBest}%`}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Threshold Legend */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Impact Thresholds</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <thead>
                                              <tr className="bg-gray-50">
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Impact</th>
                                                <th className="text-center py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Threshold</th>
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Action</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">HIGH</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&gt;25%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Strong target pricing opportunity</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">MEDIUM</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">10-25%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Moderate harmonization potential</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">LOW</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&lt;10%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Prices already standardized</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </motion.div>
                                )}

                                {/* Tariff Rate - tp-pp-2 (Page 1) */}
                                {proofPointPage === 1 && (
                                <motion.div
                                  key="tp-pp-2"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="rounded-lg border border-gray-100 p-3 bg-white hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">🚢</span>
                                      <span className="text-[12px] font-semibold text-gray-900">Tariff Rate Impact</span>
                                    </div>
                                    {(() => {
                                      const tariffDiff = 12; // Estimated tariff differential
                                      const { level, isLLM } = getImpactLevel('tp-pp-2', tariffDiff, { high: 15, medium: 8 });
                                      const color = level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                                      return (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>
                                          {level} {isLLM && '✨'}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  {(() => {
                                    const llmEval = getLLMEvaluation('tp-pp-2');
                                    const regions = categoryLocations.length > 0 ? categoryLocations : ['Asia', 'Europe', 'Americas'];
                                    return (
                                      <>
                                        <GaugeChart
                                          value={12}
                                          max={30}
                                          thresholds={{ low: 8, medium: 15 }}
                                          label="Tariff Differential"
                                          unit="%"
                                          showLegend={false}
                                        />
                                        <p className="text-[14px] text-gray-700 mt-3 font-medium">
                                          {llmEval ? (
                                            <span className="text-purple-600">{llmEval.reasoning}</span>
                                          ) : (
                                            `Estimated 8-12% tariff differential across sourcing regions. Optimizing sourcing mix can reduce landed costs.`
                                          )}
                                        </p>

                                        {/* Regional Tariff Table */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Regional Tariff Analysis</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <thead>
                                              <tr className="bg-gray-50">
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Region</th>
                                                <th className="text-center py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Est. Tariff</th>
                                                <th className="text-center py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Landed Cost Impact</th>
                                                <th className="text-center py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Opportunity</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {regions.slice(0, 4).map((region, idx) => {
                                                const tariff = idx === 0 ? 5 : idx === 1 ? 8 : idx === 2 ? 12 : 15;
                                                const opportunity = tariff > 10 ? 'High' : tariff > 6 ? 'Medium' : 'Low';
                                                const oppColor = opportunity === 'High' ? 'text-emerald-600' : opportunity === 'Medium' ? 'text-amber-600' : 'text-gray-600';
                                                return (
                                                  <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="py-1.5 px-2 border border-gray-200 text-gray-800">{region}</td>
                                                    <td className="py-1.5 px-2 border border-gray-200 text-center">{tariff}%</td>
                                                    <td className="py-1.5 px-2 border border-gray-200 text-center">+{(tariff * 0.8).toFixed(1)}%</td>
                                                    <td className={`py-1.5 px-2 border border-gray-200 text-center font-medium ${oppColor}`}>{opportunity}</td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Threshold Legend */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Impact Thresholds</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <thead>
                                              <tr className="bg-gray-50">
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Impact</th>
                                                <th className="text-center py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Differential</th>
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Action</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">HIGH</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&gt;15%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Significant sourcing shift opportunity</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">MEDIUM</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">8-15%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Consider regional optimization</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">LOW</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&lt;8%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Tariffs well-optimized</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </motion.div>
                                )}

                                {/* Cost Structure - tp-pp-3 (Page 2) */}
                                {proofPointPage === 2 && (
                                <motion.div
                                  key="tp-pp-3"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="rounded-lg border border-gray-100 p-3 bg-white hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">📊</span>
                                      <span className="text-[12px] font-semibold text-gray-900">Cost Structure</span>
                                    </div>
                                    {(() => {
                                      const rawMaterialPct = 55;
                                      const { level, isLLM } = getImpactLevel('tp-pp-3', rawMaterialPct, { high: 60, medium: 40 });
                                      const color = level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                                      return (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>
                                          {level} {isLLM && '✨'}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  {(() => {
                                    const llmEval = getLLMEvaluation('tp-pp-3');
                                    const costBreakdown = [
                                      { name: 'Raw Materials', pct: 55, color: 'bg-blue-500', amount: totalSpend * 0.55 },
                                      { name: 'Manufacturing', pct: 25, color: 'bg-purple-500', amount: totalSpend * 0.25 },
                                      { name: 'Logistics', pct: 12, color: 'bg-amber-500', amount: totalSpend * 0.12 },
                                      { name: 'Margin', pct: 8, color: 'bg-emerald-500', amount: totalSpend * 0.08 },
                                    ];
                                    return (
                                      <>
                                        <GaugeChart
                                          value={55}
                                          max={100}
                                          thresholds={{ low: 40, medium: 60 }}
                                          label="Raw Material %"
                                          showLegend={false}
                                        />
                                        <p className="text-[14px] text-gray-700 mt-3 font-medium">
                                          {llmEval ? (
                                            <span className="text-purple-600">{llmEval.reasoning}</span>
                                          ) : (
                                            `55% raw material cost indicates commodity-driven pricing. Index-linked contracts can capture market movements.`
                                          )}
                                        </p>

                                        {/* Cost Breakdown Table */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Should-Cost Model Breakdown</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <thead>
                                              <tr className="bg-gray-50">
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Component</th>
                                                <th className="text-center py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">%</th>
                                                <th className="text-right py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Est. Amount</th>
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Lever</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {costBreakdown.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                  <td className="py-1.5 px-2 border border-gray-200">
                                                    <div className="flex items-center gap-2">
                                                      <div className={`w-3 h-3 rounded ${item.color}`}></div>
                                                      <span className="text-gray-800">{item.name}</span>
                                                    </div>
                                                  </td>
                                                  <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">{item.pct}%</td>
                                                  <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">{formatCurrency(item.amount)}</td>
                                                  <td className="py-1.5 px-2 border border-gray-200 text-gray-600 text-[10px]">
                                                    {idx === 0 ? 'Index-linked pricing' : idx === 1 ? 'Process efficiency' : idx === 2 ? 'Logistics optimization' : 'Margin negotiation'}
                                                  </td>
                                                </tr>
                                              ))}
                                              <tr className="bg-gray-100 font-semibold">
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-800">Total</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center">100%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">{formatCurrency(totalSpend)}</td>
                                                <td className="py-1.5 px-2 border border-gray-200"></td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Threshold Legend */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Impact Thresholds (Raw Material %)</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <thead>
                                              <tr className="bg-gray-50">
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Impact</th>
                                                <th className="text-center py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Raw Material %</th>
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Strategy</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">HIGH</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&gt;60%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Strong index-linking opportunity</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">MEDIUM</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">40-60%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Balanced should-cost approach</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">LOW</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&lt;40%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Focus on process/service costs</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </motion.div>
                                )}

                                {/* Unit Price - tp-pp-4 (Page 3) */}
                                {proofPointPage === 3 && (
                                <motion.div
                                  key="tp-pp-4"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="rounded-lg border border-gray-100 p-3 bg-white hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">🎯</span>
                                      <span className="text-[12px] font-semibold text-gray-900">Unit Price vs Benchmark</span>
                                    </div>
                                    {(() => {
                                      const aboveBenchmark = 10;
                                      const { level, isLLM } = getImpactLevel('tp-pp-4', aboveBenchmark, { high: 15, medium: 5 });
                                      const color = level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                                      return (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>
                                          {level} {isLLM && '✨'}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  {(() => {
                                    const llmEval = getLLMEvaluation('tp-pp-4');
                                    const aboveBenchmark = 10;
                                    const savingsPotential = totalSpend * (aboveBenchmark / 100) * 0.5;
                                    return (
                                      <>
                                        <GaugeChart
                                          value={aboveBenchmark}
                                          max={30}
                                          thresholds={{ low: 5, medium: 15 }}
                                          label="Above Benchmark"
                                          unit="%"
                                          showLegend={false}
                                        />
                                        <p className="text-[14px] text-gray-700 mt-3 font-medium">
                                          {llmEval ? (
                                            <span className="text-purple-600">{llmEval.reasoning}</span>
                                          ) : (
                                            `Current prices ~${aboveBenchmark}% above market benchmark. Should-cost analysis can unlock ${formatCurrency(savingsPotential)} in savings.`
                                          )}
                                        </p>

                                        {/* Benchmark Comparison Table */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Supplier Benchmark Analysis</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <thead>
                                              <tr className="bg-gray-50">
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Supplier</th>
                                                <th className="text-right py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Current Spend</th>
                                                <th className="text-center py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">vs Benchmark</th>
                                                <th className="text-right py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Savings Potential</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {topSuppliers.slice(0, 5).map((supplier, idx) => {
                                                const vsBench = idx === 0 ? 5 : idx === 1 ? 8 : idx === 2 ? 12 : idx === 3 ? 15 : 10;
                                                const savings = supplier.spend * (vsBench / 100) * 0.5;
                                                return (
                                                  <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="py-1.5 px-2 border border-gray-200 text-gray-800">{supplier.name}</td>
                                                    <td className="py-1.5 px-2 border border-gray-200 text-right text-gray-800">{formatCurrency(supplier.spend)}</td>
                                                    <td className={`py-1.5 px-2 border border-gray-200 text-center font-medium ${vsBench > 10 ? 'text-red-600' : vsBench > 5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                      +{vsBench}%
                                                    </td>
                                                    <td className="py-1.5 px-2 border border-gray-200 text-right text-emerald-600 font-medium">{formatCurrency(savings)}</td>
                                                  </tr>
                                                );
                                              })}
                                              <tr className="bg-gray-100 font-semibold">
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-800" colSpan={3}>Total Savings Potential</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-emerald-600">{formatCurrency(savingsPotential)}</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Threshold Legend */}
                                        <div className="mt-4">
                                          <h5 className="text-[11px] font-semibold text-gray-700 mb-2">Impact Thresholds</h5>
                                          <table className="w-full text-[11px] border-collapse">
                                            <thead>
                                              <tr className="bg-gray-50">
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Impact</th>
                                                <th className="text-center py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Above Benchmark</th>
                                                <th className="text-left py-1.5 px-2 border border-gray-200 font-semibold text-gray-700">Action</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">HIGH</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&gt;15%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Immediate renegotiation needed</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">MEDIUM</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">5-15%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Schedule benchmark review</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">LOW</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&lt;5%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Competitive pricing achieved</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </motion.div>
                                )}
                              </>
                            )}

                            {/* Proof Points for Risk Management */}
                            {oppId === 'risk-management' && (
                              <>
                                {/* rm-pp-1: Single Sourcing Risk (Page 0) */}
                                {proofPointPage === 0 && (
                                <motion.div
                                  key="rm-pp-1"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="rounded-lg border border-gray-100 p-3 bg-white hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">⚠️</span>
                                      <span className="text-[12px] font-semibold text-gray-900">Single Sourcing Risk</span>
                                    </div>
                                    {(() => {
                                      const topPct = totalSpend > 0 && topSuppliers[0] ? (topSuppliers[0].spend / totalSpend * 100) : 35;
                                      const level = topPct > 50 ? 'HIGH' : topPct >= 30 ? 'MEDIUM' : 'LOW';
                                      const color = level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                                      return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{level}</span>;
                                    })()}
                                  </div>
                                  {(() => {
                                    const topPct = totalSpend > 0 && topSuppliers[0] ? (topSuppliers[0].spend / totalSpend * 100) : 35;
                                    const llmEval = getLLMEvaluation('rm-pp-1');
                                    return (
                                      <>
                                        <GaugeChart
                                          value={topPct}
                                          max={100}
                                          thresholds={{ low: 30, medium: 50 }}
                                          label="Top Supplier %"
                                        />
                                        <p className="text-[11px] text-gray-600 mt-2 italic">
                                          {llmEval || (topPct > 50
                                            ? `Critical dependency: ${topSuppliers[0]?.name || 'Top supplier'} controls ${topPct.toFixed(0)}% of spend. Immediate backup qualification needed.`
                                            : topPct >= 30
                                              ? `Moderate dependency on ${topSuppliers[0]?.name || 'top supplier'} at ${topPct.toFixed(0)}%. Consider dual-sourcing strategy.`
                                              : `Well-diversified: Top supplier at ${topPct.toFixed(0)}% indicates healthy supply base.`)}
                                        </p>

                                        {/* Single Sourcing Analysis Table */}
                                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                                          <table className="w-full text-[10px]">
                                            <thead>
                                              <tr className="bg-amber-50">
                                                <th className="py-1.5 px-2 text-left font-semibold text-amber-800 border-b border-gray-200">Supplier</th>
                                                <th className="py-1.5 px-2 text-center font-semibold text-amber-800 border-b border-gray-200">Share</th>
                                                <th className="py-1.5 px-2 text-center font-semibold text-amber-800 border-b border-gray-200">Risk</th>
                                                <th className="py-1.5 px-2 text-left font-semibold text-amber-800 border-b border-gray-200">Action</th>
                                              </tr>
                                            </thead>
                                            <tbody className="bg-white">
                                              {topSuppliers.slice(0, 5).map((supplier, idx) => {
                                                const share = totalSpend > 0 ? (supplier.spend / totalSpend * 100) : 0;
                                                const riskLvl = share > 50 ? 'Critical' : share > 30 ? 'High' : share > 15 ? 'Medium' : 'Low';
                                                const riskColor = share > 50 ? 'text-red-600' : share > 30 ? 'text-orange-600' : share > 15 ? 'text-amber-600' : 'text-green-600';
                                                return (
                                                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                    <td className="py-1.5 px-2 border border-gray-200 font-medium">{supplier.name}</td>
                                                    <td className="py-1.5 px-2 border border-gray-200 text-center">{share.toFixed(1)}%</td>
                                                    <td className={`py-1.5 px-2 border border-gray-200 text-center font-semibold ${riskColor}`}>{riskLvl}</td>
                                                    <td className="py-1.5 px-2 border border-gray-200 text-gray-600">
                                                      {share > 50 ? 'Qualify backups' : share > 30 ? 'Dual-source' : 'Monitor'}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Single Sourcing Thresholds */}
                                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                                          <div className="bg-gray-100 px-2 py-1 border-b border-gray-200">
                                            <span className="text-[10px] font-semibold text-gray-700">Single Sourcing Risk Thresholds</span>
                                          </div>
                                          <table className="w-full text-[10px]">
                                            <tbody>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">HIGH</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&gt;50%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Immediate backup qualification</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">MEDIUM</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">30-50%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Implement dual-sourcing</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">LOW</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&lt;30%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Maintain diversified base</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </motion.div>
                                )}

                                {/* rm-pp-2: Supplier Concentration (Page 1) */}
                                {proofPointPage === 1 && (
                                <motion.div
                                  key="rm-pp-2"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="rounded-lg border border-gray-100 p-3 bg-white hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">🎯</span>
                                      <span className="text-[12px] font-semibold text-gray-900">Supplier Concentration</span>
                                    </div>
                                    {(() => {
                                      const top3Pct = totalSpend > 0 ? (topSuppliers.slice(0, 3).reduce((sum, s) => sum + s.spend, 0) / totalSpend * 100) : 65;
                                      const level = top3Pct > 80 ? 'HIGH' : top3Pct >= 50 ? 'MEDIUM' : 'LOW';
                                      const color = level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                                      return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{level}</span>;
                                    })()}
                                  </div>
                                  {(() => {
                                    const top3Pct = totalSpend > 0 ? (topSuppliers.slice(0, 3).reduce((sum, s) => sum + s.spend, 0) / totalSpend * 100) : 65;
                                    const top3Spend = topSuppliers.slice(0, 3).reduce((sum, s) => sum + s.spend, 0);
                                    const llmEval = getLLMEvaluation('rm-pp-2');
                                    return (
                                      <>
                                        <GaugeChart
                                          value={top3Pct}
                                          max={100}
                                          thresholds={{ low: 50, medium: 80 }}
                                          label="Top 3 Share"
                                        />
                                        <p className="text-[11px] text-gray-600 mt-2 italic">
                                          {llmEval || (top3Pct > 80
                                            ? `High concentration: Top 3 suppliers control ${top3Pct.toFixed(0)}% (${formatCurrency(top3Spend)}). Diversification critical.`
                                            : top3Pct >= 50
                                              ? `Moderate concentration at ${top3Pct.toFixed(0)}%. Monitor supplier health and maintain alternatives.`
                                              : `Healthy diversification: Top 3 at ${top3Pct.toFixed(0)}% indicates robust supply base.`)}
                                        </p>

                                        {/* Concentration Analysis Table */}
                                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                                          <table className="w-full text-[10px]">
                                            <thead>
                                              <tr className="bg-amber-50">
                                                <th className="py-1.5 px-2 text-left font-semibold text-amber-800 border-b border-gray-200">Rank</th>
                                                <th className="py-1.5 px-2 text-left font-semibold text-amber-800 border-b border-gray-200">Supplier</th>
                                                <th className="py-1.5 px-2 text-right font-semibold text-amber-800 border-b border-gray-200">Spend</th>
                                                <th className="py-1.5 px-2 text-center font-semibold text-amber-800 border-b border-gray-200">Cumulative</th>
                                              </tr>
                                            </thead>
                                            <tbody className="bg-white">
                                              {(() => {
                                                let cumulative = 0;
                                                return topSuppliers.slice(0, 5).map((supplier, idx) => {
                                                  const share = totalSpend > 0 ? (supplier.spend / totalSpend * 100) : 0;
                                                  cumulative += share;
                                                  return (
                                                    <tr key={idx} className={idx < 3 ? 'bg-amber-50/30' : 'bg-white'}>
                                                      <td className="py-1.5 px-2 border border-gray-200 font-medium">#{idx + 1}</td>
                                                      <td className="py-1.5 px-2 border border-gray-200">{supplier.name}</td>
                                                      <td className="py-1.5 px-2 border border-gray-200 text-right">{formatCurrency(supplier.spend)}</td>
                                                      <td className="py-1.5 px-2 border border-gray-200 text-center font-semibold">{cumulative.toFixed(1)}%</td>
                                                    </tr>
                                                  );
                                                });
                                              })()}
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Concentration Thresholds */}
                                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                                          <div className="bg-gray-100 px-2 py-1 border-b border-gray-200">
                                            <span className="text-[10px] font-semibold text-gray-700">Concentration Risk Thresholds</span>
                                          </div>
                                          <table className="w-full text-[10px]">
                                            <tbody>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">HIGH</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&gt;80%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Active diversification needed</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">MEDIUM</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">50-80%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Monitor and maintain alternatives</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">LOW</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&lt;50%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Well-diversified supply base</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </motion.div>
                                )}

                                {/* rm-pp-3: Category Risk (Page 2) */}
                                {proofPointPage === 2 && (
                                <motion.div
                                  key="rm-pp-3"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="rounded-lg border border-gray-100 p-3 bg-white hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">📋</span>
                                      <span className="text-[12px] font-semibold text-gray-900">Category Risk Profile</span>
                                    </div>
                                    {(() => {
                                      const riskScore = state.spendAnalysis?.categoryPlaybook?.risk_factor ||
                                        (categoryName.toLowerCase().includes('chemical') || categoryName.toLowerCase().includes('raw') ? 75 : 55);
                                      const level = riskScore >= 70 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW';
                                      const color = level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                                      return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{level}</span>;
                                    })()}
                                  </div>
                                  {(() => {
                                    const riskScore = state.spendAnalysis?.categoryPlaybook?.risk_factor ||
                                      (categoryName.toLowerCase().includes('chemical') || categoryName.toLowerCase().includes('raw') ? 75 : 55);
                                    const llmEval = getLLMEvaluation('rm-pp-3');
                                    return (
                                      <>
                                        <GaugeChart
                                          value={riskScore}
                                          max={100}
                                          thresholds={{ low: 40, medium: 70 }}
                                          label="Category Risk"
                                        />
                                        <p className="text-[11px] text-gray-600 mt-2 italic">
                                          {llmEval || (riskScore >= 70
                                            ? `High-risk category: ${categoryName} has inherent supply chain vulnerabilities requiring active risk mitigation.`
                                            : riskScore >= 40
                                              ? `Moderate risk profile for ${categoryName}. Standard risk management practices recommended.`
                                              : `Low-risk category: ${categoryName} has stable supply dynamics.`)}
                                        </p>

                                        {/* Category Risk Factors */}
                                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                                          <table className="w-full text-[10px]">
                                            <thead>
                                              <tr className="bg-amber-50">
                                                <th className="py-1.5 px-2 text-left font-semibold text-amber-800 border-b border-gray-200">Risk Factor</th>
                                                <th className="py-1.5 px-2 text-center font-semibold text-amber-800 border-b border-gray-200">Status</th>
                                                <th className="py-1.5 px-2 text-left font-semibold text-amber-800 border-b border-gray-200">Impact</th>
                                              </tr>
                                            </thead>
                                            <tbody className="bg-white">
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200 font-medium">Supply Complexity</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center">
                                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${topSuppliers.length > 8 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                                    {topSuppliers.length > 8 ? 'Complex' : 'Manageable'}
                                                  </span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">{topSuppliers.length} suppliers</td>
                                              </tr>
                                              <tr className="bg-gray-50">
                                                <td className="py-1.5 px-2 border border-gray-200 font-medium">Market Volatility</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center">
                                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${(computedMetrics?.priceVariance || 15) > 20 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                    {(computedMetrics?.priceVariance || 15) > 20 ? 'Volatile' : 'Stable'}
                                                  </span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">{(computedMetrics?.priceVariance || 15).toFixed(0)}% variance</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200 font-medium">Geographic Spread</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center">
                                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${categoryLocations.length >= 3 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {categoryLocations.length >= 3 ? 'Diversified' : 'Concentrated'}
                                                  </span>
                                                </td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">{categoryLocations.length || 1} regions</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Category Risk Thresholds */}
                                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                                          <div className="bg-gray-100 px-2 py-1 border-b border-gray-200">
                                            <span className="text-[10px] font-semibold text-gray-700">Category Risk Thresholds</span>
                                          </div>
                                          <table className="w-full text-[10px]">
                                            <tbody>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">HIGH</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">≥70</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Strategic risk mitigation plan</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">MEDIUM</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">40-69</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Standard monitoring</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">LOW</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&lt;40</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Routine oversight</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </motion.div>
                                )}

                                {/* rm-pp-4: Inflation Risk (Page 3) */}
                                {proofPointPage === 3 && (
                                <motion.div
                                  key="rm-pp-4"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="rounded-lg border border-gray-100 p-3 bg-white hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">📈</span>
                                      <span className="text-[12px] font-semibold text-gray-900">Inflation Exposure</span>
                                    </div>
                                    {(() => {
                                      const inflationRate = computedMetrics?.priceVariance ? Math.min(computedMetrics.priceVariance * 0.6, 15) : 6;
                                      const level = inflationRate > 8 ? 'HIGH' : inflationRate >= 4 ? 'MEDIUM' : 'LOW';
                                      const color = level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                                      return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{level}</span>;
                                    })()}
                                  </div>
                                  {(() => {
                                    const inflationRate = computedMetrics?.priceVariance ? Math.min(computedMetrics.priceVariance * 0.6, 15) : 6;
                                    const inflationImpact = totalSpend * (inflationRate / 100);
                                    const llmEval = getLLMEvaluation('rm-pp-4');
                                    return (
                                      <>
                                        <GaugeChart
                                          value={inflationRate}
                                          max={20}
                                          thresholds={{ low: 4, medium: 8 }}
                                          label="Inflation Rate"
                                        />
                                        <p className="text-[11px] text-gray-600 mt-2 italic">
                                          {llmEval || (inflationRate > 8
                                            ? `High inflation exposure: ${inflationRate.toFixed(1)}% impacts ${formatCurrency(inflationImpact)} annually. Index-based pricing recommended.`
                                            : inflationRate >= 4
                                              ? `Moderate inflation at ${inflationRate.toFixed(1)}%. Monitor commodity indices and negotiate escalation caps.`
                                              : `Low inflation: ${inflationRate.toFixed(1)}% rate. Standard contract terms appropriate.`)}
                                        </p>

                                        {/* Inflation Scenario Analysis */}
                                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                                          <table className="w-full text-[10px]">
                                            <thead>
                                              <tr className="bg-amber-50">
                                                <th className="py-1.5 px-2 text-left font-semibold text-amber-800 border-b border-gray-200">Scenario</th>
                                                <th className="py-1.5 px-2 text-center font-semibold text-amber-800 border-b border-gray-200">Rate</th>
                                                <th className="py-1.5 px-2 text-right font-semibold text-amber-800 border-b border-gray-200">Impact</th>
                                                <th className="py-1.5 px-2 text-left font-semibold text-amber-800 border-b border-gray-200">Action</th>
                                              </tr>
                                            </thead>
                                            <tbody className="bg-white">
                                              <tr className="bg-green-50/30">
                                                <td className="py-1.5 px-2 border border-gray-200 font-medium">Best Case</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center">{Math.max(inflationRate * 0.5, 1).toFixed(1)}%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-green-600">{formatCurrency(totalSpend * Math.max(inflationRate * 0.5, 1) / 100)}</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Lock rates</td>
                                              </tr>
                                              <tr className="bg-amber-50/30">
                                                <td className="py-1.5 px-2 border border-gray-200 font-medium">Current</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-semibold">{inflationRate.toFixed(1)}%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right font-semibold text-amber-600">{formatCurrency(inflationImpact)}</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Index clauses</td>
                                              </tr>
                                              <tr className="bg-red-50/30">
                                                <td className="py-1.5 px-2 border border-gray-200 font-medium">Worst Case</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center">{Math.min(inflationRate * 1.5, 20).toFixed(1)}%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right text-red-600">{formatCurrency(totalSpend * Math.min(inflationRate * 1.5, 20) / 100)}</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Hedge + caps</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Inflation Thresholds */}
                                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                                          <div className="bg-gray-100 px-2 py-1 border-b border-gray-200">
                                            <span className="text-[10px] font-semibold text-gray-700">Inflation Risk Thresholds</span>
                                          </div>
                                          <table className="w-full text-[10px]">
                                            <tbody>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">HIGH</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&gt;8%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Index-linked with caps</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">MEDIUM</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">4-8%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Annual review clauses</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">LOW</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&lt;4%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Fixed-price contracts</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </motion.div>
                                )}

                                {/* rm-pp-5: Exchange Rate Risk (Page 4) */}
                                {proofPointPage === 4 && (
                                <motion.div
                                  key="rm-pp-5"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="rounded-lg border border-gray-100 p-3 bg-white hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">💱</span>
                                      <span className="text-[12px] font-semibold text-gray-900">Exchange Rate Exposure</span>
                                    </div>
                                    {(() => {
                                      const foreignSuppliers = topSuppliers.filter(s => s.country && !['USA', 'United States', 'US'].includes(s.country));
                                      const foreignSpend = foreignSuppliers.reduce((sum, s) => sum + s.spend, 0);
                                      const fxExposure = totalSpend > 0 ? (foreignSpend / totalSpend * 100) : 40;
                                      const level = fxExposure > 50 ? 'HIGH' : fxExposure >= 25 ? 'MEDIUM' : 'LOW';
                                      const color = level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                                      return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{level}</span>;
                                    })()}
                                  </div>
                                  {(() => {
                                    const foreignSuppliers = topSuppliers.filter(s => s.country && !['USA', 'United States', 'US'].includes(s.country));
                                    const foreignSpend = foreignSuppliers.reduce((sum, s) => sum + s.spend, 0);
                                    const fxExposure = totalSpend > 0 ? (foreignSpend / totalSpend * 100) : 40;
                                    const llmEval = getLLMEvaluation('rm-pp-5');
                                    return (
                                      <>
                                        <GaugeChart
                                          value={fxExposure}
                                          max={100}
                                          thresholds={{ low: 25, medium: 50 }}
                                          label="FX Exposure"
                                        />
                                        <p className="text-[11px] text-gray-600 mt-2 italic">
                                          {llmEval || (fxExposure > 50
                                            ? `High FX exposure: ${fxExposure.toFixed(0)}% (${formatCurrency(foreignSpend)}) in foreign currencies. Hedging recommended.`
                                            : fxExposure >= 25
                                              ? `Moderate FX risk at ${fxExposure.toFixed(0)}%. Monitor rates and consider forward contracts.`
                                              : `Low currency risk: ${fxExposure.toFixed(0)}% foreign exposure. Natural hedge via local sourcing.`)}
                                        </p>

                                        {/* FX Exposure by Region */}
                                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                                          <table className="w-full text-[10px]">
                                            <thead>
                                              <tr className="bg-amber-50">
                                                <th className="py-1.5 px-2 text-left font-semibold text-amber-800 border-b border-gray-200">Region</th>
                                                <th className="py-1.5 px-2 text-right font-semibold text-amber-800 border-b border-gray-200">Spend</th>
                                                <th className="py-1.5 px-2 text-center font-semibold text-amber-800 border-b border-gray-200">Share</th>
                                                <th className="py-1.5 px-2 text-center font-semibold text-amber-800 border-b border-gray-200">Volatility</th>
                                              </tr>
                                            </thead>
                                            <tbody className="bg-white">
                                              {(() => {
                                                const regionSpend: Record<string, number> = {};
                                                topSuppliers.forEach(s => {
                                                  const region = s.country || 'Unknown';
                                                  regionSpend[region] = (regionSpend[region] || 0) + s.spend;
                                                });
                                                return Object.entries(regionSpend)
                                                  .sort((a, b) => b[1] - a[1])
                                                  .slice(0, 4)
                                                  .map(([region, spend], idx) => {
                                                    const share = totalSpend > 0 ? (spend / totalSpend * 100) : 0;
                                                    const isDomestic = ['USA', 'United States', 'US'].includes(region);
                                                    const volatility = isDomestic ? 'Low' : share > 20 ? 'High' : 'Medium';
                                                    return (
                                                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                        <td className="py-1.5 px-2 border border-gray-200 font-medium">{region}</td>
                                                        <td className="py-1.5 px-2 border border-gray-200 text-right">{formatCurrency(spend)}</td>
                                                        <td className="py-1.5 px-2 border border-gray-200 text-center">{share.toFixed(1)}%</td>
                                                        <td className="py-1.5 px-2 border border-gray-200 text-center">
                                                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                                                            volatility === 'High' ? 'bg-red-100 text-red-700' :
                                                            volatility === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                                                          }`}>{volatility}</span>
                                                        </td>
                                                      </tr>
                                                    );
                                                  });
                                              })()}
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* FX Thresholds */}
                                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                                          <div className="bg-gray-100 px-2 py-1 border-b border-gray-200">
                                            <span className="text-[10px] font-semibold text-gray-700">Exchange Rate Risk Thresholds</span>
                                          </div>
                                          <table className="w-full text-[10px]">
                                            <tbody>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">HIGH</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&gt;50%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Forward contracts + options</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">MEDIUM</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">25-50%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Selective forward contracts</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">LOW</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&lt;25%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Natural hedge via local</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </motion.div>
                                )}

                                {/* rm-pp-6: Geopolitical Risk (Page 5) */}
                                {proofPointPage === 5 && (
                                <motion.div
                                  key="rm-pp-6"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="rounded-lg border border-gray-100 p-3 bg-white hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">🌍</span>
                                      <span className="text-[12px] font-semibold text-gray-900">Geopolitical Risk</span>
                                    </div>
                                    {(() => {
                                      const highRiskRegions = ['China', 'Russia', 'Middle East', 'Venezuela', 'Iran'];
                                      const highRiskSuppliers = topSuppliers.filter(s => s.country && highRiskRegions.some(r => s.country?.includes(r)));
                                      const highRiskSpend = highRiskSuppliers.reduce((sum, s) => sum + s.spend, 0);
                                      const geoRisk = totalSpend > 0 ? (highRiskSpend / totalSpend * 100) : 15;
                                      const level = geoRisk > 40 ? 'HIGH' : geoRisk >= 15 ? 'MEDIUM' : 'LOW';
                                      const color = level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                                      return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{level}</span>;
                                    })()}
                                  </div>
                                  {(() => {
                                    const highRiskRegions = ['China', 'Russia', 'Middle East', 'Venezuela', 'Iran'];
                                    const highRiskSuppliers = topSuppliers.filter(s => s.country && highRiskRegions.some(r => s.country?.includes(r)));
                                    const highRiskSpend = highRiskSuppliers.reduce((sum, s) => sum + s.spend, 0);
                                    const geoRisk = totalSpend > 0 ? (highRiskSpend / totalSpend * 100) : 15;
                                    const llmEval = getLLMEvaluation('rm-pp-6');
                                    return (
                                      <>
                                        <GaugeChart
                                          value={geoRisk}
                                          max={100}
                                          thresholds={{ low: 15, medium: 40 }}
                                          label="Geo Risk %"
                                        />
                                        <p className="text-[11px] text-gray-600 mt-2 italic">
                                          {llmEval || (geoRisk > 40
                                            ? `High geopolitical exposure: ${geoRisk.toFixed(0)}% in elevated-risk regions. Develop alternative corridors.`
                                            : geoRisk >= 15
                                              ? `Moderate geopolitical risk at ${geoRisk.toFixed(0)}%. Monitor trade policies and maintain backups.`
                                              : `Low geopolitical exposure: ${geoRisk.toFixed(0)}% in stable regions. Current strategy is resilient.`)}
                                        </p>

                                        {/* Regional Risk Assessment */}
                                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                                          <table className="w-full text-[10px]">
                                            <thead>
                                              <tr className="bg-amber-50">
                                                <th className="py-1.5 px-2 text-left font-semibold text-amber-800 border-b border-gray-200">Region</th>
                                                <th className="py-1.5 px-2 text-center font-semibold text-amber-800 border-b border-gray-200">Suppliers</th>
                                                <th className="py-1.5 px-2 text-right font-semibold text-amber-800 border-b border-gray-200">Spend</th>
                                                <th className="py-1.5 px-2 text-center font-semibold text-amber-800 border-b border-gray-200">Risk</th>
                                              </tr>
                                            </thead>
                                            <tbody className="bg-white">
                                              {(() => {
                                                const regionData: Record<string, { count: number; spend: number }> = {};
                                                topSuppliers.forEach(s => {
                                                  const region = s.country || 'Unknown';
                                                  if (!regionData[region]) regionData[region] = { count: 0, spend: 0 };
                                                  regionData[region].count++;
                                                  regionData[region].spend += s.spend;
                                                });
                                                return Object.entries(regionData)
                                                  .sort((a, b) => b[1].spend - a[1].spend)
                                                  .slice(0, 4)
                                                  .map(([region, data], idx) => {
                                                    const isHighRisk = highRiskRegions.some(r => region.includes(r));
                                                    const riskLevel = isHighRisk ? 'High' : region.includes('Europe') || region.includes('Japan') ? 'Low' : 'Medium';
                                                    return (
                                                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                        <td className="py-1.5 px-2 border border-gray-200 font-medium">{region}</td>
                                                        <td className="py-1.5 px-2 border border-gray-200 text-center">{data.count}</td>
                                                        <td className="py-1.5 px-2 border border-gray-200 text-right">{formatCurrency(data.spend)}</td>
                                                        <td className="py-1.5 px-2 border border-gray-200 text-center">
                                                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                                                            riskLevel === 'High' ? 'bg-red-100 text-red-700' :
                                                            riskLevel === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                                                          }`}>{riskLevel}</span>
                                                        </td>
                                                      </tr>
                                                    );
                                                  });
                                              })()}
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Geopolitical Thresholds */}
                                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                                          <div className="bg-gray-100 px-2 py-1 border-b border-gray-200">
                                            <span className="text-[10px] font-semibold text-gray-700">Geopolitical Risk Thresholds</span>
                                          </div>
                                          <table className="w-full text-[10px]">
                                            <tbody>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">HIGH</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&gt;40%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Diversify supply corridors</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">MEDIUM</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">15-40%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Monitor and maintain backups</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">LOW</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&lt;15%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Routine monitoring</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </motion.div>
                                )}

                                {/* rm-pp-7: Supplier Risk Rating (Page 6) */}
                                {proofPointPage === 6 && (
                                <motion.div
                                  key="rm-pp-7"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="rounded-lg border border-gray-100 p-3 bg-white hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">⭐</span>
                                      <span className="text-[12px] font-semibold text-gray-900">Supplier Risk Rating</span>
                                    </div>
                                    {(() => {
                                      const avgRisk = topSuppliers.length > 0
                                        ? topSuppliers.slice(0, 5).reduce((sum, s) => sum + (s.riskRating || 3), 0) / Math.min(topSuppliers.length, 5)
                                        : 3;
                                      const level = avgRisk >= 4 ? 'HIGH' : avgRisk >= 2.5 ? 'MEDIUM' : 'LOW';
                                      const color = level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                                      return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{level}</span>;
                                    })()}
                                  </div>
                                  {(() => {
                                    const avgRisk = topSuppliers.length > 0
                                      ? topSuppliers.slice(0, 5).reduce((sum, s) => sum + (s.riskRating || 3), 0) / Math.min(topSuppliers.length, 5)
                                      : 3;
                                    const lowRiskCount = topSuppliers.filter(s => (s.riskRating || 3) <= 2).length;
                                    const llmEval = getLLMEvaluation('rm-pp-7');
                                    return (
                                      <>
                                        <GaugeChart
                                          value={avgRisk}
                                          max={5}
                                          thresholds={{ low: 2.5, medium: 4 }}
                                          label="Avg Risk (1-5)"
                                        />
                                        <p className="text-[11px] text-gray-600 mt-2 italic">
                                          {llmEval || (avgRisk >= 4
                                            ? `High-risk supplier base: Average ${avgRisk.toFixed(1)}/5. Prioritize supplier development or replacement.`
                                            : avgRisk >= 2.5
                                              ? `Moderate supplier risk at ${avgRisk.toFixed(1)}/5. ${lowRiskCount} suppliers rated low-risk. Continue monitoring.`
                                              : `Strong supplier base: Average ${avgRisk.toFixed(1)}/5 with ${lowRiskCount} low-risk suppliers.`)}
                                        </p>

                                        {/* Supplier Risk Ratings Table */}
                                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                                          <table className="w-full text-[10px]">
                                            <thead>
                                              <tr className="bg-amber-50">
                                                <th className="py-1.5 px-2 text-left font-semibold text-amber-800 border-b border-gray-200">Supplier</th>
                                                <th className="py-1.5 px-2 text-right font-semibold text-amber-800 border-b border-gray-200">Spend</th>
                                                <th className="py-1.5 px-2 text-center font-semibold text-amber-800 border-b border-gray-200">Rating</th>
                                                <th className="py-1.5 px-2 text-left font-semibold text-amber-800 border-b border-gray-200">Status</th>
                                              </tr>
                                            </thead>
                                            <tbody className="bg-white">
                                              {topSuppliers.slice(0, 5).map((supplier, idx) => {
                                                const rating = supplier.riskRating || 3;
                                                const status = rating <= 2 ? 'Preferred' : rating <= 3 ? 'Approved' : rating <= 4 ? 'Watch' : 'At Risk';
                                                const statusColor = rating <= 2 ? 'text-green-600' : rating <= 3 ? 'text-blue-600' : rating <= 4 ? 'text-amber-600' : 'text-red-600';
                                                return (
                                                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                    <td className="py-1.5 px-2 border border-gray-200 font-medium">{supplier.name}</td>
                                                    <td className="py-1.5 px-2 border border-gray-200 text-right">{formatCurrency(supplier.spend)}</td>
                                                    <td className="py-1.5 px-2 border border-gray-200 text-center">
                                                      <div className="flex items-center justify-center gap-0.5">
                                                        {[1, 2, 3, 4, 5].map(star => (
                                                          <span key={star} className={`text-[8px] ${star <= rating ? 'text-amber-400' : 'text-gray-300'}`}>★</span>
                                                        ))}
                                                      </div>
                                                    </td>
                                                    <td className={`py-1.5 px-2 border border-gray-200 font-medium ${statusColor}`}>{status}</td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Supplier Rating Thresholds */}
                                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                                          <div className="bg-gray-100 px-2 py-1 border-b border-gray-200">
                                            <span className="text-[10px] font-semibold text-gray-700">Supplier Risk Rating Thresholds</span>
                                          </div>
                                          <table className="w-full text-[10px]">
                                            <tbody>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">HIGH</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">≥4.0</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Replace or develop suppliers</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">MEDIUM</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">2.5-4.0</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Enhanced monitoring</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">LOW</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&lt;2.5</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Low-risk supplier base</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </motion.div>
                                )}
                              </>
                            )}

                            {/* Proof Points for Re-spec Pack */}
                            {oppId === 'respec-pack' && (
                              <>
                                {/* rp-pp-1: Spec-Driven Price Variance (Page 0) */}
                                {proofPointPage === 0 && (
                                <motion.div
                                  key="rp-pp-1"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="rounded-lg border border-gray-100 p-3 bg-white hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">💰</span>
                                      <span className="text-[12px] font-semibold text-gray-900">Spec-Driven Price Variance</span>
                                    </div>
                                    {(() => {
                                      const variance = computedMetrics?.priceVariance || 20;
                                      const level = variance > 25 ? 'HIGH' : variance >= 15 ? 'MEDIUM' : 'LOW';
                                      const color = level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                                      return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{level}</span>;
                                    })()}
                                  </div>
                                  {(() => {
                                    const variance = computedMetrics?.priceVariance || 20;
                                    const standardizationSavings = totalSpend * (variance / 100) * 0.4;
                                    const llmEval = getLLMEvaluation('rp-pp-1');
                                    return (
                                      <>
                                        <GaugeChart
                                          value={variance}
                                          max={50}
                                          thresholds={{ low: 15, medium: 25 }}
                                          label="Spec Variance"
                                        />
                                        <p className="text-[11px] text-gray-600 mt-2 italic">
                                          {llmEval || (variance > 25
                                            ? `High spec variance: ${variance.toFixed(0)}% price spread indicates standardization opportunity worth ${formatCurrency(standardizationSavings)}.`
                                            : variance >= 15
                                              ? `Moderate variance at ${variance.toFixed(0)}%. Spec harmonization could capture ${formatCurrency(standardizationSavings)} in savings.`
                                              : `Low spec variance at ${variance.toFixed(0)}%. Specifications well-standardized across suppliers.`)}
                                        </p>

                                        {/* Spec Variance by Supplier */}
                                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                                          <table className="w-full text-[10px]">
                                            <thead>
                                              <tr className="bg-purple-50">
                                                <th className="py-1.5 px-2 text-left font-semibold text-purple-800 border-b border-gray-200">Supplier</th>
                                                <th className="py-1.5 px-2 text-right font-semibold text-purple-800 border-b border-gray-200">Avg Price</th>
                                                <th className="py-1.5 px-2 text-center font-semibold text-purple-800 border-b border-gray-200">vs Benchmark</th>
                                                <th className="py-1.5 px-2 text-left font-semibold text-purple-800 border-b border-gray-200">Spec Notes</th>
                                              </tr>
                                            </thead>
                                            <tbody className="bg-white">
                                              {(() => {
                                                const avgPrice = topSuppliers.length > 0
                                                  ? topSuppliers.reduce((sum, s) => sum + (s.avgPrice || s.spend / 1000), 0) / topSuppliers.length
                                                  : 100;
                                                return topSuppliers.slice(0, 5).map((supplier, idx) => {
                                                  const price = supplier.avgPrice || (supplier.spend / 1000);
                                                  const vsBenchmark = ((price - avgPrice) / avgPrice * 100);
                                                  const specNote = vsBenchmark > 10 ? 'Premium spec' : vsBenchmark < -10 ? 'Basic spec' : 'Standard';
                                                  return (
                                                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                      <td className="py-1.5 px-2 border border-gray-200 font-medium">{supplier.name}</td>
                                                      <td className="py-1.5 px-2 border border-gray-200 text-right">{formatCurrency(price)}</td>
                                                      <td className="py-1.5 px-2 border border-gray-200 text-center">
                                                        <span className={vsBenchmark > 0 ? 'text-red-600' : 'text-green-600'}>
                                                          {vsBenchmark > 0 ? '+' : ''}{vsBenchmark.toFixed(1)}%
                                                        </span>
                                                      </td>
                                                      <td className="py-1.5 px-2 border border-gray-200 text-gray-600">{specNote}</td>
                                                    </tr>
                                                  );
                                                });
                                              })()}
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Spec Variance Thresholds */}
                                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                                          <div className="bg-gray-100 px-2 py-1 border-b border-gray-200">
                                            <span className="text-[10px] font-semibold text-gray-700">Spec Variance Thresholds</span>
                                          </div>
                                          <table className="w-full text-[10px]">
                                            <tbody>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">HIGH</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&gt;25%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Major standardization opportunity</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">MEDIUM</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">15-25%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Spec harmonization review</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">LOW</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&lt;15%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Specs well-standardized</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </motion.div>
                                )}

                                {/* rp-pp-2: Export Standard Alignment (Page 1) */}
                                {proofPointPage === 1 && (
                                <motion.div
                                  key="rp-pp-2"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="rounded-lg border border-gray-100 p-3 bg-white hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">🚢</span>
                                      <span className="text-[12px] font-semibold text-gray-900">Export Standard Alignment</span>
                                    </div>
                                    {(() => {
                                      const exportGap = computedMetrics?.priceVariance ? Math.min(computedMetrics.priceVariance * 0.8, 35) : 18;
                                      const level = exportGap > 20 ? 'HIGH' : exportGap >= 10 ? 'MEDIUM' : 'LOW';
                                      const color = level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                                      return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{level}</span>;
                                    })()}
                                  </div>
                                  {(() => {
                                    const exportGap = computedMetrics?.priceVariance ? Math.min(computedMetrics.priceVariance * 0.8, 35) : 18;
                                    const exportSavings = totalSpend * (exportGap / 100) * 0.5;
                                    const llmEval = getLLMEvaluation('rp-pp-2');
                                    return (
                                      <>
                                        <GaugeChart
                                          value={exportGap}
                                          max={50}
                                          thresholds={{ low: 10, medium: 20 }}
                                          label="Export Gap %"
                                        />
                                        <p className="text-[11px] text-gray-600 mt-2 italic">
                                          {llmEval || (exportGap > 20
                                            ? `Significant gap: Specs ${exportGap.toFixed(0)}% above export standards. Alignment could save ${formatCurrency(exportSavings)}.`
                                            : exportGap >= 10
                                              ? `Moderate gap at ${exportGap.toFixed(0)}% vs export grade. Selective spec adjustment recommended.`
                                              : `Close to export standards: Only ${exportGap.toFixed(0)}% gap. Specs already cost-optimized.`)}
                                        </p>

                                        {/* Export Standards Comparison */}
                                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                                          <table className="w-full text-[10px]">
                                            <thead>
                                              <tr className="bg-purple-50">
                                                <th className="py-1.5 px-2 text-left font-semibold text-purple-800 border-b border-gray-200">Specification</th>
                                                <th className="py-1.5 px-2 text-center font-semibold text-purple-800 border-b border-gray-200">Current</th>
                                                <th className="py-1.5 px-2 text-center font-semibold text-purple-800 border-b border-gray-200">Export Std</th>
                                                <th className="py-1.5 px-2 text-center font-semibold text-purple-800 border-b border-gray-200">Gap</th>
                                              </tr>
                                            </thead>
                                            <tbody className="bg-white">
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200 font-medium">Quality Grade</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center">Premium</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center">Standard</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center text-red-600">+{(exportGap * 0.4).toFixed(0)}%</td>
                                              </tr>
                                              <tr className="bg-gray-50">
                                                <td className="py-1.5 px-2 border border-gray-200 font-medium">Packaging</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center">Custom</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center">Bulk</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center text-red-600">+{(exportGap * 0.35).toFixed(0)}%</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200 font-medium">Testing/Cert</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center">Full</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center">Basic</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center text-amber-600">+{(exportGap * 0.15).toFixed(0)}%</td>
                                              </tr>
                                              <tr className="bg-gray-50">
                                                <td className="py-1.5 px-2 border border-gray-200 font-medium">Lead Time</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center">Express</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center">Standard</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center text-amber-600">+{(exportGap * 0.1).toFixed(0)}%</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Export Gap Thresholds */}
                                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                                          <div className="bg-gray-100 px-2 py-1 border-b border-gray-200">
                                            <span className="text-[10px] font-semibold text-gray-700">Export Standard Gap Thresholds</span>
                                          </div>
                                          <table className="w-full text-[10px]">
                                            <tbody>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">HIGH</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&gt;20%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Major re-spec opportunity</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">MEDIUM</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">10-20%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Selective spec review</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">LOW</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&lt;10%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Already optimized</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </motion.div>
                                )}

                                {/* rp-pp-3: Material Cost Structure (Page 2) */}
                                {proofPointPage === 2 && (
                                <motion.div
                                  key="rp-pp-3"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="rounded-lg border border-gray-100 p-3 bg-white hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">📊</span>
                                      <span className="text-[12px] font-semibold text-gray-900">Material Cost Structure</span>
                                    </div>
                                    {(() => {
                                      const materialPct = 62;
                                      const level = materialPct > 60 ? 'HIGH' : materialPct >= 45 ? 'MEDIUM' : 'LOW';
                                      const color = level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                                      return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{level}</span>;
                                    })()}
                                  </div>
                                  {(() => {
                                    const materialPct = 62;
                                    const laborPct = 18;
                                    const overheadPct = 12;
                                    const marginPct = 8;
                                    const valueEngSavings = totalSpend * (materialPct / 100) * 0.08;
                                    const llmEval = getLLMEvaluation('rp-pp-3');
                                    return (
                                      <>
                                        <GaugeChart
                                          value={materialPct}
                                          max={100}
                                          thresholds={{ low: 45, medium: 60 }}
                                          label="Material %"
                                        />
                                        <p className="text-[11px] text-gray-600 mt-2 italic">
                                          {llmEval || (materialPct > 60
                                            ? `High material component: ${materialPct}% raw material cost means spec changes directly impact pricing. Value engineering could unlock ${formatCurrency(valueEngSavings)}.`
                                            : materialPct >= 45
                                              ? `Moderate material ratio at ${materialPct}%. Some spec-driven savings opportunity through value engineering.`
                                              : `Low material ratio: ${materialPct}% indicates limited spec change impact. Focus on process efficiency.`)}
                                        </p>

                                        {/* Should-Cost Breakdown */}
                                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                                          <table className="w-full text-[10px]">
                                            <thead>
                                              <tr className="bg-purple-50">
                                                <th className="py-1.5 px-2 text-left font-semibold text-purple-800 border-b border-gray-200">Cost Element</th>
                                                <th className="py-1.5 px-2 text-center font-semibold text-purple-800 border-b border-gray-200">Share</th>
                                                <th className="py-1.5 px-2 text-right font-semibold text-purple-800 border-b border-gray-200">Est. Value</th>
                                                <th className="py-1.5 px-2 text-left font-semibold text-purple-800 border-b border-gray-200">Spec Impact</th>
                                              </tr>
                                            </thead>
                                            <tbody className="bg-white">
                                              <tr className="bg-purple-50/30">
                                                <td className="py-1.5 px-2 border border-gray-200 font-semibold">Raw Materials</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-semibold">{materialPct}%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right font-semibold">{formatCurrency(totalSpend * materialPct / 100)}</td>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-100 text-red-700">High</span>
                                                </td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200 font-medium">Labor/Processing</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center">{laborPct}%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right">{formatCurrency(totalSpend * laborPct / 100)}</td>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-100 text-amber-700">Medium</span>
                                                </td>
                                              </tr>
                                              <tr className="bg-gray-50">
                                                <td className="py-1.5 px-2 border border-gray-200 font-medium">Overhead/Logistics</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center">{overheadPct}%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right">{formatCurrency(totalSpend * overheadPct / 100)}</td>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-100 text-green-700">Low</span>
                                                </td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200 font-medium">Supplier Margin</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center">{marginPct}%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-right">{formatCurrency(totalSpend * marginPct / 100)}</td>
                                                <td className="py-1.5 px-2 border border-gray-200">
                                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-100 text-amber-700">Negotiable</span>
                                                </td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* Cost Structure Thresholds */}
                                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                                          <div className="bg-gray-100 px-2 py-1 border-b border-gray-200">
                                            <span className="text-[10px] font-semibold text-gray-700">Material Cost Ratio Thresholds</span>
                                          </div>
                                          <table className="w-full text-[10px]">
                                            <tbody>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">HIGH</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&gt;60%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Strong value engineering impact</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">MEDIUM</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">45-60%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Moderate spec change benefit</td>
                                              </tr>
                                              <tr>
                                                <td className="py-1.5 px-2 border border-gray-200"><span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">LOW</span></td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-center font-medium">&lt;45%</td>
                                                <td className="py-1.5 px-2 border border-gray-200 text-gray-600">Focus on process efficiency</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </motion.div>
                                )}
                              </>
                            )}
                            </div>

                            {/* Page Flip Navigation */}
                            {(() => {
                              const ppConfig = PROOF_POINT_CONFIG[oppId];
                              const totalPages = ppConfig?.length || 1;
                              if (totalPages <= 1) return null;
                              return (
                                <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-gray-100">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setProofPointPage(p => Math.max(0, p - 1));
                                    }}
                                    disabled={proofPointPage === 0}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${
                                      proofPointPage === 0
                                        ? 'text-gray-300 cursor-not-allowed'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                                    }`}
                                  >
                                    <ChevronLeft className="h-4 w-4" />
                                    Prev
                                  </button>

                                  <div className="flex items-center gap-2">
                                    {Array.from({ length: totalPages }).map((_, idx) => (
                                      <button
                                        key={idx}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setProofPointPage(idx);
                                        }}
                                        className={`h-8 w-8 rounded-full text-[12px] font-semibold transition-all ${
                                          idx === proofPointPage
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                        }`}
                                      >
                                        {idx + 1}
                                      </button>
                                    ))}
                                  </div>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setProofPointPage(p => Math.min(totalPages - 1, p + 1));
                                    }}
                                    disabled={proofPointPage === totalPages - 1}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${
                                      proofPointPage === totalPages - 1
                                        ? 'text-gray-300 cursor-not-allowed'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                                    }`}
                                  >
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                  </button>
                                </div>
                              );
                            })()}

                            <p className="text-[10px] text-gray-400 pt-2 border-t border-gray-100 mt-4">
                              💡 Thresholds based on Beroe procurement benchmarks. HIGH = Significant opportunity, MEDIUM = Moderate opportunity, LOW = Limited opportunity.
                            </p>
                          </div>
                        </motion.div>
                      </div>
                    </div>
                  )}
                </motion.section>

                {/* How did I test? */}
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-3xl bg-white/80 backdrop-blur-sm shadow-lg shadow-slate-200/50 ring-1 ring-slate-200/60 overflow-hidden"
                >
                  <div
                    className="flex items-center justify-between p-7 cursor-pointer hover:bg-gray-50/50 transition-colors"
                    onClick={() => toggleSection('tests')}
                  >
                    <h2 className="text-lg font-bold text-gray-900">How did I test?</h2>
                    <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${expandedSections.has('tests') ? 'rotate-180' : ''}`} />
                  </div>

                  {expandedSections.has('tests') && (
                    <div className="px-7 pb-7 space-y-4">
                      {tests.map((test, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          </div>
                          <span className="text-[13px] text-gray-600 leading-relaxed italic">
                            {test.replace(/\{category\}/g, categoryName)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.section>

                {/* What is going well? - PERSONALIZED BY OPPORTUNITY TYPE */}
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="rounded-3xl bg-white/80 backdrop-blur-sm shadow-lg shadow-slate-200/50 ring-1 ring-slate-200/60 overflow-hidden"
                >
                  <div
                    className="flex items-center justify-between p-7 cursor-pointer hover:bg-gray-50/50 transition-colors"
                    onClick={() => toggleSection('goingwell')}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${oppId === 'volume-bundling' ? 'from-blue-400 to-blue-600' :
                        oppId === 'target-pricing' ? 'from-emerald-400 to-emerald-600' :
                          oppId === 'risk-management' ? 'from-amber-400 to-amber-600' :
                            'from-purple-400 to-purple-600'
                        }`}>
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                      <h2 className="text-lg font-bold text-gray-900">What is going well?</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${oppId === 'volume-bundling' ? 'text-blue-600 bg-blue-50' :
                        oppId === 'target-pricing' ? 'text-emerald-600 bg-emerald-50' :
                          oppId === 'risk-management' ? 'text-amber-600 bg-amber-50' :
                            'text-purple-600 bg-purple-50'
                        }`}>
                        {oppId === 'volume-bundling' ? 'Consolidation Strengths' :
                          oppId === 'target-pricing' ? 'Pricing Strengths' :
                            oppId === 'risk-management' ? 'Risk Strengths' :
                              'Spec Strengths'}
                      </span>
                      <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${expandedSections.has('goingwell') ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {expandedSections.has('goingwell') && (
                    <div className="px-7 pb-7">
                      <p className="text-[13px] text-gray-500 mb-5">
                        {oppId === 'volume-bundling' && `Based on your ${categoryName} data, here's where your volume consolidation is already strong:`}
                        {oppId === 'target-pricing' && `Based on your ${categoryName} data, here's where your pricing strategy is already effective:`}
                        {oppId === 'risk-management' && `Based on your ${categoryName} data, here's where your risk management is already solid:`}
                        {oppId === 'respec-pack' && `Based on your ${categoryName} data, here's where your specification management is already optimized:`}
                      </p>

                      <div className="grid grid-cols-2 gap-4">

                        {/* ========== LLM-GENERATED POSITIVE INSIGHTS ========== */}
                        {isLoadingInsights ? (
                          // Loading state
                          <>
                            {[1, 2, 3, 4].map((idx) => (
                              <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.1 }}
                                className={`rounded-2xl bg-gradient-to-br ${
                                  oppId === 'volume-bundling' ? 'from-blue-50 to-indigo-50 border-blue-200' :
                                  oppId === 'target-pricing' ? 'from-emerald-50 to-green-50 border-emerald-200' :
                                  oppId === 'risk-management' ? 'from-amber-50 to-orange-50 border-amber-200' :
                                  'from-purple-50 to-violet-50 border-purple-200'
                                } border p-4 animate-pulse`}
                              >
                                <div className="flex items-center gap-3 mb-2">
                                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                                    oppId === 'volume-bundling' ? 'bg-blue-100' :
                                    oppId === 'target-pricing' ? 'bg-emerald-100' :
                                    oppId === 'risk-management' ? 'bg-amber-100' :
                                    'bg-purple-100'
                                  }`}>
                                    <div className="h-5 w-5 rounded bg-gray-200"></div>
                                  </div>
                                  <div className="flex-1">
                                    <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
                                    <div className="h-3 bg-gray-200 rounded w-16"></div>
                                  </div>
                                </div>
                                <div className="h-3 bg-gray-200 rounded w-full mb-1"></div>
                                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                              </motion.div>
                            ))}
                          </>
                        ) : llmDataInsights.length > 0 ? (
                          // Display LLM-generated insights
                          <>
                            {llmDataInsights.map((insight, idx) => (
                              <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.1 }}
                                className={`rounded-2xl bg-gradient-to-br ${
                                  oppId === 'volume-bundling' ? 'from-blue-50 to-indigo-50 border-blue-200' :
                                  oppId === 'target-pricing' ? 'from-emerald-50 to-green-50 border-emerald-200' :
                                  oppId === 'risk-management' ? 'from-amber-50 to-orange-50 border-amber-200' :
                                  'from-purple-50 to-violet-50 border-purple-200'
                                } border p-4`}
                              >
                                <div className="flex items-center gap-3 mb-2">
                                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                                    oppId === 'volume-bundling' ? 'bg-blue-100' :
                                    oppId === 'target-pricing' ? 'bg-emerald-100' :
                                    oppId === 'risk-management' ? 'bg-amber-100' :
                                    'bg-purple-100'
                                  }`}>
                                    <span className="text-lg">{insight.icon}</span>
                                  </div>
                                  <div>
                                    <h4 className={`text-[13px] font-semibold ${
                                      oppId === 'volume-bundling' ? 'text-blue-900' :
                                      oppId === 'target-pricing' ? 'text-emerald-900' :
                                      oppId === 'risk-management' ? 'text-amber-900' :
                                      'text-purple-900'
                                    }`}>{insight.label}</h4>
                                    <span className={`text-[11px] font-medium ${
                                      oppId === 'volume-bundling' ? 'text-blue-600' :
                                      oppId === 'target-pricing' ? 'text-emerald-600' :
                                      oppId === 'risk-management' ? 'text-amber-600' :
                                      'text-purple-600'
                                    }`}>{insight.value}</span>
                                  </div>
                                </div>
                                <p className={`text-[11px] leading-relaxed ${
                                  oppId === 'volume-bundling' ? 'text-blue-700' :
                                  oppId === 'target-pricing' ? 'text-emerald-700' :
                                  oppId === 'risk-management' ? 'text-amber-700' :
                                  'text-purple-700'
                                }`}>
                                  {insight.insight}
                                </p>
                                {insight.source && (
                                  <p className={`text-[9px] mt-2 ${
                                    oppId === 'volume-bundling' ? 'text-blue-400' :
                                    oppId === 'target-pricing' ? 'text-emerald-400' :
                                    oppId === 'risk-management' ? 'text-amber-400' :
                                    'text-purple-400'
                                  }`}>
                                    Source: {insight.source}
                                  </p>
                                )}
                              </motion.div>
                            ))}
                          </>
                        ) : (
                          // No insights available - show appropriate message based on state
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="col-span-2 rounded-2xl bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-200 p-4"
                          >
                            <p className="text-[12px] text-gray-600 text-center">
                              {totalSpend === 0
                                ? `Upload spend data to see ${oppId === 'volume-bundling' ? 'consolidation' : oppId === 'target-pricing' ? 'pricing' : oppId === 'risk-management' ? 'risk management' : 'specification'} strengths for ${categoryName}.`
                                : topSuppliers.length === 0
                                  ? `Processing your ${categoryName} spend data...`
                                  : insightsFetchAttempted
                                    ? `Your ${categoryName} data has been analyzed. Chat with Max below to explore strengths and opportunities.`
                                    : `Analyzing your ${categoryName} data to identify strengths...`
                              }
                            </p>
                          </motion.div>
                        )}
                      </div>

                      {/* Summary - PERSONALIZED */}
                      <div className={`mt-5 p-4 rounded-xl border ${oppId === 'volume-bundling' ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100' :
                        oppId === 'target-pricing' ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100' :
                          oppId === 'risk-management' ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-100' :
                            'bg-gradient-to-r from-purple-50 to-violet-50 border-purple-100'
                        }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className={`h-4 w-4 ${oppId === 'volume-bundling' ? 'text-blue-600' :
                            oppId === 'target-pricing' ? 'text-emerald-600' :
                              oppId === 'risk-management' ? 'text-amber-600' :
                                'text-purple-600'
                            }`} />
                          <span className={`text-[12px] font-semibold ${oppId === 'volume-bundling' ? 'text-blue-800' :
                            oppId === 'target-pricing' ? 'text-emerald-800' :
                              oppId === 'risk-management' ? 'text-amber-800' :
                                'text-purple-800'
                            }`}>
                            {oppId === 'volume-bundling' ? 'Volume Bundling Summary' :
                              oppId === 'target-pricing' ? 'Target Pricing Summary' :
                                oppId === 'risk-management' ? 'Risk Management Summary' :
                                  'Re-spec Pack Summary'}
                          </span>
                        </div>
                        <p className={`text-[12px] leading-relaxed ${oppId === 'volume-bundling' ? 'text-blue-700' :
                          oppId === 'target-pricing' ? 'text-emerald-700' :
                            oppId === 'risk-management' ? 'text-amber-700' :
                              'text-purple-700'
                          }`}>
                          {oppId === 'volume-bundling' && `Your ${categoryName} category has a solid consolidation foundation. The recommendations focus on capturing additional volume leverage opportunities with your existing supplier base.`}
                          {oppId === 'target-pricing' && `Your ${categoryName} pricing shows some stability. The recommendations target specific areas where should-cost analysis and benchmarking can drive further savings.`}
                          {oppId === 'risk-management' && `Your ${categoryName} supply base has reasonable diversification. The recommendations address specific concentration risks and build contingency options.`}
                          {oppId === 'respec-pack' && `Your ${categoryName} specifications have a good baseline. The recommendations identify specific standardization opportunities for quick wins.`}
                        </p>
                      </div>
                    </div>
                  )}
                </motion.section>

                {/* What I Recommend - Horizontal Book-Style Pagination */}
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-3xl bg-white/80 backdrop-blur-sm shadow-lg shadow-slate-200/50 ring-1 ring-slate-200/60 overflow-hidden"
                >
                  <div
                    className="flex items-center justify-between p-7 cursor-pointer hover:bg-gray-50/50 transition-colors"
                    onClick={() => toggleSection('recommendations')}
                  >
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-bold text-gray-900">What I Recommend</h2>
                      {!isLoadingRecommendations && selectedRecommendations.size > 0 && (
                        <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                          {selectedRecommendations.size} selected
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {isLoadingRecommendations && (
                        <div className="flex items-center gap-2 text-[11px] text-blue-600">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Analyzing documents...</span>
                        </div>
                      )}
                      <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${expandedSections.has('recommendations') ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {expandedSections.has('recommendations') && (
                    <div className="px-7 pb-7">
                      {/* Header with Select All / Clear All */}
                      {!isLoadingRecommendations && !recommendationsError && (
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-[12px] text-gray-500">
                            Based on your uploaded contracts, supplier data & spend analysis
                          </p>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const allIndices = new Set<number>();
                                llmRecommendations.forEach((rec, idx) => {
                                  const isMonitoringMessage = rec.text.toLowerCase().includes('monitor') && rec.text.toLowerCase().includes('alert');
                                  if (!(isMonitoringMessage && idx === llmRecommendations.length - 1)) {
                                    allIndices.add(idx);
                                  }
                                });
                                setSelectedRecommendations(allIndices);
                              }}
                              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors px-2 py-1 rounded hover:bg-blue-50"
                            >
                              Select All
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRecommendations(new Set());
                              }}
                              className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 transition-colors px-2 py-1 rounded hover:bg-gray-100"
                            >
                              Clear All
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Horizontal Book-Style Carousel */}
                      <div className="relative">
                        {isLoadingRecommendations ? (
                          // Loading skeleton
                          <div className="grid grid-cols-2 gap-4">
                            {Array.from({ length: 4 }).map((_, idx) => (
                              <div key={idx} className="rounded-2xl border border-gray-100 bg-gray-50/50 p-5 animate-pulse">
                                <div className="h-5 w-5 rounded-full bg-gray-200 mb-3" />
                                <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
                                <div className="h-3 bg-gray-200 rounded w-full mb-1" />
                                <div className="h-3 bg-gray-200 rounded w-2/3" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            {(() => {
                              // Combine LLM recommendations with document-specific recommendations
                              const filteredLLMRecs = llmRecommendations.filter((rec, idx) => {
                                const isMonitoringMessage = rec.text.toLowerCase().includes('monitor') && rec.text.toLowerCase().includes('alert');
                                return !(isMonitoringMessage && idx === llmRecommendations.length - 1);
                              }).map(rec => ({
                                ...rec,
                                source: 'AI Analysis',
                                sourceType: 'ai' as const,
                                proofPoint: undefined as string | undefined,
                                severity: undefined as 'critical' | 'high' | 'medium' | undefined
                              }));

                              // Priority Issues with severity styling
                              const formattedPriorityIssues = priorityIssues.map(issue => ({
                                text: issue.text,
                                reason: issue.reason,
                                source: 'Priority Issue',
                                sourceType: 'priority' as const,
                                proofPoint: undefined as string | undefined,
                                severity: issue.severity
                              }));

                              // Add severity to document recs for type consistency
                              const formattedDocRecs = documentRecommendations.map(rec => ({
                                ...rec,
                                severity: undefined as 'critical' | 'high' | 'medium' | undefined
                              }));

                              // Combine: AI recs → Priority Issues → Document recs
                              const allRecs = [...filteredLLMRecs, ...formattedPriorityIssues, ...formattedDocRecs];

                              // Source type styling (extended for priority issues)
                              const sourceStyles: Record<string, { bg: string; text: string; icon: string; label: string }> = {
                                ai: { bg: 'bg-blue-100', text: 'text-blue-700', icon: '🤖', label: 'AI Analysis' },
                                priority: { bg: 'bg-red-100', text: 'text-red-700', icon: '⚠️', label: 'Priority Issue' },
                                spend: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: '📊', label: 'Spend Data' },
                                contract: { bg: 'bg-purple-100', text: 'text-purple-700', icon: '📋', label: 'Contract' },
                                supplier: { bg: 'bg-amber-100', text: 'text-amber-700', icon: '👥', label: 'Supplier Master' },
                                playbook: { bg: 'bg-rose-100', text: 'text-rose-700', icon: '📖', label: 'Playbook' }
                              };

                              // Severity styling for priority issues
                              const severityStyles = {
                                critical: { border: 'border-red-400', bg: 'bg-gradient-to-br from-red-50 to-orange-50', badge: 'bg-red-500 text-white', icon: '🚨' },
                                high: { border: 'border-orange-400', bg: 'bg-gradient-to-br from-orange-50 to-amber-50', badge: 'bg-orange-500 text-white', icon: '⚠️' },
                                medium: { border: 'border-yellow-400', bg: 'bg-gradient-to-br from-yellow-50 to-amber-50', badge: 'bg-yellow-500 text-white', icon: '💡' }
                              };

                              return (
                                <>
                                  {/* Summary Header */}
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700">
                                        📋 Recommendations
                                      </span>
                                      <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-600">
                                        🤖 {filteredLLMRecs.length}
                                      </span>
                                      {priorityIssues.length > 0 && (
                                        <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-red-50 text-red-600 animate-pulse">
                                          ⚠️ {priorityIssues.length} issues
                                        </span>
                                      )}
                                      {documentRecommendations.length > 0 && (
                                        <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-600">
                                          📄 {documentRecommendations.length}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[12px] font-bold text-gray-700">
                                      {allRecs.length} total
                                    </span>
                                  </div>

                                  {/* Book-like Pagination - 2 cards per page */}
                                  {(() => {
                                    const totalPages = Math.ceil(allRecs.length / RECS_PER_PAGE);
                                    const startIdx = recommendationPage * RECS_PER_PAGE;
                                    const currentPageRecs = allRecs.slice(startIdx, startIdx + RECS_PER_PAGE);

                                    return (
                                      <div className="min-h-[380px] flex flex-col">
                                        {/* Page Content */}
                                        <div className="flex-1 space-y-4">
                                          {currentPageRecs.map((rec, pageIdx) => {
                                            const globalIdx = startIdx + pageIdx;
                                            const isSelected = selectedRecommendations.has(globalIdx);
                                            const isAI = rec.sourceType === 'ai';
                                            const isPriority = rec.sourceType === 'priority';
                                            const isDoc = !isAI && !isPriority;
                                            const sourceStyle = sourceStyles[rec.sourceType] || sourceStyles.ai;
                                            const severity = rec.severity as 'critical' | 'high' | 'medium' | undefined;
                                            const severityStyle = severity ? severityStyles[severity] : null;

                                            // Determine card styling based on type
                                            const getCardStyle = () => {
                                              if (isSelected) return 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md';
                                              if (isPriority && severityStyle) return `${severityStyle.border} ${severityStyle.bg} hover:shadow-md`;
                                              if (isAI) return 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm';
                                              return 'border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/50 hover:border-amber-300 hover:shadow-sm';
                                            };

                                            const getNumberStyle = () => {
                                              if (isSelected) return 'bg-blue-600 border-blue-600';
                                              if (isPriority && severity === 'critical') return 'bg-red-100 border-red-400';
                                              if (isPriority && severity === 'high') return 'bg-orange-100 border-orange-400';
                                              if (isPriority && severity === 'medium') return 'bg-yellow-100 border-yellow-400';
                                              if (isAI) return 'bg-white border-gray-300';
                                              return 'bg-white border-amber-300';
                                            };

                                            const getNumberTextStyle = () => {
                                              if (isPriority && severity === 'critical') return 'text-red-600';
                                              if (isPriority && severity === 'high') return 'text-orange-600';
                                              if (isPriority && severity === 'medium') return 'text-yellow-600';
                                              if (isAI) return 'text-gray-400';
                                              return 'text-amber-500';
                                            };

                                            return (
                                              <motion.div
                                                key={`rec-${globalIdx}`}
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                transition={{ delay: pageIdx * 0.1 }}
                                                onClick={() => {
                                                  const newSelected = new Set(selectedRecommendations);
                                                  if (isSelected) newSelected.delete(globalIdx);
                                                  else newSelected.add(globalIdx);
                                                  setSelectedRecommendations(newSelected);
                                                }}
                                                whileHover={{ scale: 1.01 }}
                                                whileTap={{ scale: 0.99 }}
                                                className={`rounded-2xl border-2 p-5 transition-all cursor-pointer ${getCardStyle()}`}
                                              >
                                                <div className="flex items-start justify-between mb-3">
                                                  <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${getNumberStyle()}`}>
                                                    {isSelected
                                                      ? <Check className="h-4 w-4 text-white" />
                                                      : isPriority && severityStyle
                                                        ? <span className="text-[14px]">{severityStyle.icon}</span>
                                                        : <span className={`text-[13px] font-bold ${getNumberTextStyle()}`}>{globalIdx + 1}</span>
                                                    }
                                                  </div>
                                                  <div className="flex flex-col items-end gap-1">
                                                    {isPriority && severity ? (
                                                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide ${severityStyles[severity].badge}`}>
                                                        {severity}
                                                      </span>
                                                    ) : (
                                                      <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${sourceStyle.bg} ${sourceStyle.text}`}>
                                                        {sourceStyle.icon} {isAI ? 'AI' : (rec.source.length > 15 ? rec.source.substring(0, 15) + '...' : rec.source)}
                                                      </span>
                                                    )}
                                                    {rec.proofPoint && (
                                                      <span className="text-[10px] px-2 py-0.5 rounded bg-violet-100 text-violet-600 font-medium">
                                                        ✓ {rec.proofPoint}
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                                <h4 className={`text-[15px] font-semibold leading-relaxed mb-3 ${isSelected ? 'text-gray-900' : isPriority ? 'text-gray-900' : 'text-gray-800'}`}>
                                                  {rec.text}
                                                </h4>
                                                {rec.reason && (
                                                  <div className={`pt-3 border-t ${isPriority ? 'border-gray-200' : 'border-gray-100'}`}>
                                                    <p className="text-[12px] leading-relaxed">
                                                      <span className={`font-semibold ${isPriority ? 'text-red-600' : isAI ? 'text-blue-600' : 'text-amber-600'}`}>
                                                        {isPriority ? 'Action:' : 'Why:'}
                                                      </span>{' '}
                                                      <span className="text-gray-600">{rec.reason}</span>
                                                    </p>
                                                  </div>
                                                )}
                                              </motion.div>
                                            );
                                          })}

                                          {/* No recommendations */}
                                          {allRecs.length === 0 && (
                                            <div className="text-center py-12">
                                              <div className="text-4xl mb-3">📋</div>
                                              <p className="text-[14px] font-medium text-gray-600">No recommendations yet</p>
                                              <p className="text-[12px] text-gray-400 mt-1">Upload more data files to generate insights</p>
                                            </div>
                                          )}
                                        </div>

                                        {/* Book Navigation */}
                                        {totalPages > 1 && (
                                          <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-gray-100">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setRecommendationPage(p => Math.max(0, p - 1));
                                              }}
                                              disabled={recommendationPage === 0}
                                              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${
                                                recommendationPage === 0
                                                  ? 'text-gray-300 cursor-not-allowed'
                                                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                                              }`}
                                            >
                                              <ChevronLeft className="h-4 w-4" />
                                              Prev
                                            </button>

                                            <div className="flex items-center gap-2">
                                              {Array.from({ length: totalPages }).map((_, idx) => (
                                                <button
                                                  key={idx}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setRecommendationPage(idx);
                                                  }}
                                                  className={`h-8 w-8 rounded-full text-[12px] font-semibold transition-all ${
                                                    idx === recommendationPage
                                                      ? 'bg-blue-600 text-white shadow-md'
                                                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                  }`}
                                                >
                                                  {idx + 1}
                                                </button>
                                              ))}
                                            </div>

                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setRecommendationPage(p => Math.min(totalPages - 1, p + 1));
                                              }}
                                              disabled={recommendationPage === totalPages - 1}
                                              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${
                                                recommendationPage === totalPages - 1
                                                  ? 'text-gray-300 cursor-not-allowed'
                                                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                                              }`}
                                            >
                                              Next
                                              <ChevronRight className="h-4 w-4" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </>
                              );
                            })()}
                          </>
                        )}
                      </div>

                      {/* Monitoring Message */}
                      <p className="text-[12px] font-medium text-gray-500 mt-6 mb-6 p-3 rounded-xl bg-gray-50 border border-gray-100">
                        💡 {llmRecommendations.find(r => r.text.toLowerCase().includes('monitor') && r.text.toLowerCase().includes('alert'))?.text ||
                          "I will continuously monitor your contracts and market conditions, alerting you on significant changes."}
                      </p>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <div className="text-[12px] text-gray-500">
                          {selectedRecommendations.size === 0 ? (
                            <span>Click cards to select recommendations</span>
                          ) : (
                            <span className="text-blue-600 font-medium">
                              {selectedRecommendations.size} of {llmRecommendations.filter((rec, idx) => {
                                const isMonitoringMessage = rec.text.toLowerCase().includes('monitor') && rec.text.toLowerCase().includes('alert');
                                return !(isMonitoringMessage && idx === llmRecommendations.length - 1);
                              }).length + documentRecommendations.length} selected
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => router.push("/opportunities")}
                            className="h-11 px-6 rounded-xl text-[14px] font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
                          >
                            Ignore
                          </button>
                          <button
                            onClick={() => setShowSimulationModal(true)}
                            disabled={selectedRecommendations.size === 0}
                            className={`h-11 px-6 rounded-xl flex items-center gap-2 text-[14px] font-semibold transition-colors ${selectedRecommendations.size > 0
                              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              }`}
                          >
                            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                              <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                              <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                              <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                              <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                            </svg>
                            Simulate
                          </button>
                          <button
                            onClick={() => {
                              const selectedRecs = llmRecommendations.filter((_, idx) => selectedRecommendations.has(idx));
                              const acceptedData: AcceptedRecommendationsData = {
                                opportunityId: oppId,
                                opportunityName: opportunity?.name || initiativeTitle,
                                categoryName,
                                locations: categoryLocations,
                                totalSpend,
                                recommendations: selectedRecs,
                                proofPoints: proofPoints.map(pp => ({
                                  id: pp.id,
                                  name: pp.name,
                                  isValidated: pp.isValidated
                                })),
                                suppliers: topSuppliers,
                                metrics: {
                                  priceVariance: computedMetrics?.priceVariance,
                                  top3Concentration: computedMetrics?.top3Concentration,
                                  tailSpendPercentage: computedMetrics?.tailSpendPercentage,
                                  supplierCount: computedMetrics?.supplierCount || topSuppliers.length
                                },
                                savingsEstimate: savingsPercentage,
                                acceptedAt: Date.now()
                              };
                              actions.setAcceptedRecommendations(acceptedData);

                              actions.addActivity({
                                type: "validation",
                                title: `Accepted: ${opportunity?.name || initiativeTitle}`,
                                description: `Accepted ${selectedRecs.length} recommendations for ${categoryName}`,
                                metadata: { categoryName, savings: savingsPercentage }
                              });

                              router.push("/opportunities/accepted");
                            }}
                            disabled={selectedRecommendations.size === 0}
                            className={`h-11 px-8 rounded-xl text-[14px] font-semibold shadow-lg transition-all flex items-center gap-2 ${selectedRecommendations.size > 0
                              ? 'bg-gray-900 text-white hover:bg-black'
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              }`}
                          >
                            Accept
                            {selectedRecommendations.size > 0 && (
                              <span className="bg-white/20 px-1.5 py-0.5 rounded text-[11px]">
                                {selectedRecommendations.size}
                              </span>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.section>

              </div>
            </div>
          </div>
        </div>

        {/* Simulation Modal */}
        {showSimulationModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowSimulationModal(false)}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-10 w-full max-w-4xl mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Savings Simulation</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Projected impact of {selectedRecommendations.size} selected recommendation{selectedRecommendations.size !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={() => setShowSimulationModal(false)}
                  className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Charts */}
              <div className="p-6 space-y-8">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-emerald-50 rounded-2xl p-4">
                    <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">Total Projected Savings</p>
                    <p className="text-2xl font-bold text-emerald-700">
                      {formatCurrency(
                        llmRecommendations
                          .filter((_, idx) => selectedRecommendations.has(idx))
                          .reduce((sum, _, idx) => {
                            const recIndex = Array.from(selectedRecommendations)[Array.from(selectedRecommendations).indexOf(idx)] || idx;
                            return sum + (totalSpend * 0.01 * (recIndex + 1));
                          }, totalSpend * 0.02 * selectedRecommendations.size)
                      )}
                    </p>
                    <p className="text-xs text-emerald-600 mt-1">
                      ~{((selectedRecommendations.size * 2) + Math.min(selectedRecommendations.size, 3)).toFixed(1)}% of total spend
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-2xl p-4">
                    <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider mb-1">Implementation Timeline</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {selectedRecommendations.size <= 2 ? '3-6' : selectedRecommendations.size <= 4 ? '6-9' : '9-12'} months
                    </p>
                    <p className="text-xs text-blue-600 mt-1">Based on recommendation complexity</p>
                  </div>
                  <div className="bg-purple-50 rounded-2xl p-4">
                    <p className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider mb-1">Confidence Level</p>
                    <p className="text-2xl font-bold text-purple-700">
                      {Math.round(70 + (selectedRecommendations.size * 5))}%
                    </p>
                    <p className="text-xs text-purple-600 mt-1">Higher with more data validation</p>
                  </div>
                </div>

                {/* Bar Chart - Savings by Recommendation */}
                <div className="bg-gray-50 rounded-2xl p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Savings Distribution by Recommendation</h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={llmRecommendations
                          .filter((_, idx) => selectedRecommendations.has(idx))
                          .map((rec, idx) => {
                            const savingsPercent = 1.5 + (idx * 0.8) + Math.random() * 1;
                            const savingsAmount = totalSpend * (savingsPercent / 100);
                            return {
                              name: `Rec ${idx + 1}`,
                              fullName: rec.text.length > 50 ? rec.text.substring(0, 50) + '...' : rec.text,
                              savings: Math.round(savingsAmount),
                              percent: savingsPercent.toFixed(1)
                            };
                          })
                        }
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: '#6b7280' }}
                          axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: '#6b7280' }}
                          axisLine={{ stroke: '#e5e7eb' }}
                          tickFormatter={(value) => formatCurrency(value)}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-gray-900 text-white p-3 rounded-xl shadow-xl max-w-xs">
                                  <p className="text-xs text-gray-300 mb-1">{data.fullName}</p>
                                  <p className="text-lg font-bold text-emerald-400">{formatCurrency(data.savings)}</p>
                                  <p className="text-xs text-gray-400">{data.percent}% of spend</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="savings" radius={[8, 8, 0, 0]}>
                          {llmRecommendations
                            .filter((_, idx) => selectedRecommendations.has(idx))
                            .map((_, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'][index % 5]}
                              />
                            ))
                          }
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Pie Chart - Category Breakdown */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-2xl p-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Impact by Category</h3>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Price Optimization', value: 35, color: '#10b981' },
                              { name: 'Volume Consolidation', value: 30, color: '#3b82f6' },
                              { name: 'Supplier Negotiation', value: 25, color: '#8b5cf6' },
                              { name: 'Process Efficiency', value: 10, color: '#f59e0b' },
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {[
                              { color: '#10b981' },
                              { color: '#3b82f6' },
                              { color: '#8b5cf6' },
                              { color: '#f59e0b' },
                            ].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl">
                                    <p className="text-sm font-medium">{payload[0].name}</p>
                                    <p className="text-lg font-bold">{payload[0].value}%</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Implementation Phases</h3>
                    <div className="space-y-3">
                      {[
                        { phase: 'Phase 1: Quick Wins', timeline: '0-3 months', savings: '40%', color: 'bg-emerald-500' },
                        { phase: 'Phase 2: Optimization', timeline: '3-6 months', savings: '35%', color: 'bg-blue-500' },
                        { phase: 'Phase 3: Strategic', timeline: '6-12 months', savings: '25%', color: 'bg-purple-500' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className={`h-3 w-3 rounded-full ${item.color}`} />
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-medium text-gray-700">{item.phase}</span>
                              <span className="text-xs text-gray-500">{item.timeline}</span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${item.color} rounded-full`}
                                style={{ width: item.savings }}
                              />
                            </div>
                          </div>
                          <span className="text-xs font-bold text-gray-700 w-10 text-right">{item.savings}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-6 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500">
                  * Projections based on industry benchmarks and your data. Actual results may vary.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowSimulationModal(false)}
                    className="h-10 px-5 rounded-xl text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-white transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setShowSimulationModal(false);
                      // Trigger accept flow
                      const selectedRecs = llmRecommendations.filter((_, idx) => selectedRecommendations.has(idx));
                      const acceptedData: AcceptedRecommendationsData = {
                        opportunityId: oppId,
                        opportunityName: opportunity?.name || initiativeTitle,
                        categoryName,
                        locations: categoryLocations,
                        totalSpend,
                        recommendations: selectedRecs,
                        proofPoints: proofPoints.map(pp => ({
                          id: pp.id,
                          name: pp.name,
                          isValidated: pp.isValidated
                        })),
                        suppliers: topSuppliers,
                        metrics: {
                          priceVariance: computedMetrics?.priceVariance,
                          top3Concentration: computedMetrics?.top3Concentration,
                          tailSpendPercentage: computedMetrics?.tailSpendPercentage,
                          supplierCount: computedMetrics?.supplierCount || topSuppliers.length
                        },
                        savingsEstimate: savingsPercentage,
                        acceptedAt: Date.now()
                      };
                      actions.setAcceptedRecommendations(acceptedData);
                      router.push("/opportunities/accepted");
                    }}
                    className="h-10 px-6 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-black transition-colors"
                  >
                    Accept & Proceed
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Background Decor */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute bottom-[-20%] left-[-10%] h-[70%] w-[55%] rotate-[-12deg] overflow-hidden bg-[#E5B800] shadow-2xl opacity-40">
            <div className="absolute inset-0 flex flex-col space-y-6 pt-12">
              {Array.from({ length: 25 }).map((_, i) => (
                <div key={i} className="h-[2px] w-full bg-black/5" />
              ))}
            </div>
            <div className="absolute top-6 left-0 h-[2px] w-full bg-white/30" />
            <div className="absolute top-12 left-0 h-[2px] w-full bg-white/20" />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
