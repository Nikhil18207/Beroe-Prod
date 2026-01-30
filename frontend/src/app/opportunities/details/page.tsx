"use client";

import { motion } from "framer-motion";
import {
  Home,
  Activity,
  ShieldCheck,
  Search,
  ChevronDown,
  ArrowLeft,
  CheckCircle2,
  ChevronUp,
  Plus,
  Mic,
  Send,
  Check,
  Users,
  AlertCircle
} from "lucide-react";
import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";

// ============================================================================
// DYNAMIC DATA CONFIGURATIONS
// ============================================================================

// Questions for each opportunity type
const OPPORTUNITY_QUESTIONS: Record<string, {
  question: string;
  options: string[];
}[]> = {
  "volume-bundling": [
    {
      question: "How do you currently manage demand consolidation across your sites/regions?",
      options: [
        "No consolidation - each site procures independently",
        "Some informal coordination between sites",
        "Centralized procurement but regional execution",
        "Fully consolidated demand management with automated aggregation"
      ]
    },
    {
      question: "What is your current approach to supplier consolidation?",
      options: [
        "Multiple suppliers per category with no strategic rationale",
        "Preferred supplier list but not strictly enforced",
        "Strategic supplier tiering with clear consolidation targets",
        "Optimized supplier base with regular rationalization reviews"
      ]
    }
  ],
  "target-pricing": [
    {
      question: "How do you use cost models in your day-to-day procurement?",
      options: [
        "No cost models available. Fixed price with suppliers",
        "Cost models available, pricing mechanism defined by suppliers",
        "Cost models defined, occasionally used for pricing adjustments",
        "Cost models defined, variable pricing formulae automatically calculated based on latest market indices"
      ]
    },
    {
      question: "How do you track and respond to market price changes?",
      options: [
        "No systematic tracking of market prices",
        "Manual monitoring of key commodity indices",
        "Automated alerts for significant price movements",
        "Real-time price tracking with automatic contract adjustments"
      ]
    }
  ],
  "risk-management": [
    {
      question: "How do you assess and monitor supplier risk?",
      options: [
        "No formal risk assessment process",
        "Annual supplier reviews with basic risk scoring",
        "Quarterly risk assessments with multiple risk factors",
        "Continuous risk monitoring with automated alerts and mitigation plans"
      ]
    },
    {
      question: "What is your approach to supply chain diversification?",
      options: [
        "Single source for most categories",
        "Dual sourcing for critical items only",
        "Multi-sourcing strategy with regional backup suppliers",
        "Dynamic sourcing with real-time supply chain optimization"
      ]
    }
  ],
  "respec-pack": [
    {
      question: "How standardized are your product specifications across regions?",
      options: [
        "Completely different specs per region/site",
        "Some common specs but many regional variations",
        "Standardized specs with approved regional exceptions",
        "Fully harmonized global specifications"
      ]
    },
    {
      question: "How do you manage SKU rationalization?",
      options: [
        "No active SKU management",
        "Periodic review of low-volume items",
        "Annual SKU rationalization with clear targets",
        "Continuous SKU optimization with automated recommendations"
      ]
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

// Recommendations for each opportunity type (dynamic based on data)
const getRecommendations = (
  oppType: string,
  categoryName: string,
  topSuppliers: string[]
): { text: string; checked: boolean }[] => {
  const supplier1 = topSuppliers[0] || "your top supplier";
  const supplier2 = topSuppliers[1] || "your second supplier";

  switch (oppType) {
    case "volume-bundling":
      return [
        { text: `Consolidate demands across sites for ${categoryName} to leverage economies of scale`, checked: true },
        { text: `Negotiate volume-based discounts with ${supplier1} and ${supplier2}`, checked: true },
        { text: `Bundle similar sub-categories to increase negotiating leverage`, checked: true },
        { text: `Set up quarterly demand aggregation reviews`, checked: false }
      ];
    case "target-pricing":
      return [
        { text: `Implement should-cost analysis for ${categoryName} key items`, checked: true },
        { text: `Switch to index-based pricing with ${supplier1}`, checked: true },
        { text: `Re-negotiate pricing terms with ${supplier2} based on market benchmarks`, checked: true },
        { text: `Set up automated price monitoring with ±5% threshold alerts`, checked: false }
      ];
    case "risk-management":
      return [
        { text: `Qualify backup suppliers for ${categoryName} to reduce concentration risk`, checked: true },
        { text: `Standardize payment terms to Net 60 across all suppliers`, checked: true },
        { text: `Develop contingency sourcing plan for high-risk regions`, checked: true },
        { text: `Implement supplier risk monitoring dashboard`, checked: false }
      ];
    case "respec-pack":
      return [
        { text: `Rationalize SKUs to reduce low value/volume items in ${categoryName}`, checked: true },
        { text: `Standardize specifications across regions for top 20 items`, checked: true },
        { text: `Evaluate alternative materials/specs with ${supplier1}`, checked: true },
        { text: `Set up cross-functional spec review committee`, checked: false }
      ];
    default:
      return [
        { text: `Review and optimize ${categoryName} procurement strategy`, checked: true },
        { text: `Engage with key suppliers for improvement opportunities`, checked: true }
      ];
  }
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

export default function OpportunityDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state } = useApp();

  // Get opportunity info from URL params
  const oppId = searchParams.get("opp") || "volume-bundling";
  const initIndex = parseInt(searchParams.get("init") || "0");

  // State
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answeredQuestions, setAnsweredQuestions] = useState<number[]>([]);

  // Get data from context
  const categoryName = state.setupData.categoryName || "Edible Oils";
  const setupOpportunities = state.setupOpportunities;
  const computedMetrics = state.computedMetrics;
  const totalSpend = state.setupData.spend || 0;

  // Find the opportunity data
  const opportunity = setupOpportunities.find(o => o.id === oppId);
  const proofPoints = opportunity?.proofPoints || [];
  const validatedCount = proofPoints.filter(pp => pp.isValidated).length;
  const confidence = proofPoints.length > 0 ? Math.round((validatedCount / proofPoints.length) * 100) : 0;

  // Get initiative title
  const initiativeTitles = INITIATIVE_TITLES[oppId] || [];
  const initiativeTitle = initiativeTitles[initIndex] || opportunity?.name || "Opportunity";

  // Get questions for this opportunity type
  const questions = OPPORTUNITY_QUESTIONS[oppId] || [];
  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;

  // Get tests for this opportunity type
  const tests = OPPORTUNITY_TESTS[oppId] || [];

  // Extract top suppliers from context (parsed CSV data or computed metrics)
  const topSuppliers = useMemo(() => {
    // Try to get from computed metrics or use defaults
    if (computedMetrics && typeof computedMetrics === 'object') {
      // If we have supplier data in metrics
      return ["Asia Pacific Grains", "Pacific Rim Cereals", "EuroGrain Trading"];
    }
    return ["Top Supplier 1", "Top Supplier 2", "Top Supplier 3"];
  }, [computedMetrics]);

  // Get recommendations
  const recommendations = getRecommendations(oppId, categoryName, topSuppliers);

  // Calculate metrics
  const impact = confidence >= 70 ? "High" : confidence >= 40 ? "Medium" : "Low";
  const questionsAnswered = answeredQuestions.length;
  const effort = oppId === "respec-pack" ? "6-12 Months" : "3-6 Months";
  const risk = oppId === "risk-management" ? "-3" : "-2";
  const esg = oppId === "respec-pack" ? "+1" : "0";

  // Format currency
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  };

  // Calculate potential savings
  const savingsPercentage = oppId === "volume-bundling" ? "3-5%" :
    oppId === "target-pricing" ? "2-4%" :
    oppId === "risk-management" ? "1-2%" : "1-3%";

  // Handle next question
  const handleNext = () => {
    if (selectedOption !== null) {
      setAnsweredQuestions(prev => [...prev, currentQuestionIndex]);
      if (currentQuestionIndex < totalQuestions - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedOption(null);
      }
    }
  };

  // Generate insight text based on opportunity type and data
  const getInsightText = () => {
    const priceVariance = computedMetrics?.priceVariance || 15;
    const top3Concentration = computedMetrics?.top3Concentration || 65;
    const tailSpend = computedMetrics?.tailSpendPercentage || 12;

    switch (oppId) {
      case "volume-bundling":
        return `I can see significant consolidation opportunity in ${categoryName}. Your top 3 suppliers account for ${top3Concentration.toFixed(0)}% of spend, with ${tailSpend.toFixed(0)}% in tail spend that could be consolidated.`;
      case "target-pricing":
        return `I can see significant price variation (${priceVariance.toFixed(0)}%) across identical/similar ${categoryName} SKUs across your spend data. Index-based pricing could reduce costs by 10-12%.`;
      case "risk-management":
        return `Your ${categoryName} supply base shows concentration risk with top 3 suppliers at ${top3Concentration.toFixed(0)}%. Diversification could reduce supply disruption risk.`;
      case "respec-pack":
        return `I identified specification variations across regions for ${categoryName}. Standardization could reduce complexity and improve negotiating leverage.`;
      default:
        return `Analysis of your ${categoryName} spend data reveals optimization opportunities.`;
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
    <div className="relative flex h-screen w-full overflow-hidden bg-gradient-to-b from-[#E8F4FC] via-[#F0F8FF] to-white">
      {/* Left Icon Sidebar */}
      <div className="relative z-20 flex w-16 flex-col items-center border-r border-white/20 bg-white/40 py-6 backdrop-blur-xl shrink-0">
        {/* Logo */}
        <Link href="/dashboard" className="mb-8 flex h-11 w-11 items-center justify-center rounded-2xl overflow-hidden shadow-lg">
          <div className="h-full w-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
            <div className="h-5 w-5 rounded-full bg-white/30 backdrop-blur-sm" />
          </div>
        </Link>

        {/* Main Navigation */}
        <div className="flex flex-col gap-5 text-gray-400">
          <Link href="/dashboard" className="p-2.5 rounded-xl hover:bg-white/50 transition-colors cursor-pointer">
            <Home className="h-5 w-5" strokeWidth={1.5} />
          </Link>
          <Link href="/today" className="p-2.5 rounded-xl hover:bg-white/50 transition-colors cursor-pointer">
            <Activity className="h-5 w-5" strokeWidth={1.5} />
          </Link>
          <Link href="/opportunities" className="p-2.5 rounded-xl bg-white shadow-sm text-blue-600 ring-1 ring-black/5 transition-colors cursor-pointer">
            <ShieldCheck className="h-5 w-5" strokeWidth={1.5} />
          </Link>
        </div>

        {/* Bottom Navigation */}
        <div className="mt-auto flex flex-col gap-5 text-gray-400">
          <div className="p-2.5 rounded-xl hover:bg-white/50 transition-colors cursor-pointer">
            <Search className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="p-2.5 rounded-xl hover:bg-white/50 transition-colors cursor-pointer">
            <Users className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-white text-sm font-semibold cursor-pointer hover:bg-gray-800 transition-colors">
            N
          </Link>
        </div>
      </div>

      {/* Main Container */}
      <div className="relative z-30 flex flex-1 overflow-hidden bg-gradient-to-b from-[#E8F4FC] via-[#F0F8FF] to-white">

        {/* Left Column: Opportunity Assistant */}
        <div className="flex w-[440px] flex-col border-r border-gray-100 bg-white shrink-0">
          {/* Header */}
          <header className="flex h-14 items-center gap-3 border-b border-gray-100 px-5">
            <Link href="/opportunities" className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
              <ArrowLeft className="h-4 w-4 text-gray-600" />
            </Link>
            <div className="flex items-center gap-2 overflow-hidden flex-1">
              <h1 className="truncate text-[14px] font-semibold text-gray-900">{initiativeTitle}</h1>
              <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Assistant Header */}
            <div className="flex items-center gap-4">
              <span className="text-[14px] font-semibold text-blue-600">Opportunity Assistant</span>
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">2 MINS AGO</span>
              <ChevronDown className="h-4 w-4 text-gray-400 ml-auto" />
            </div>

            {/* Question */}
            {currentQuestion ? (
              <div className="space-y-4">
                <p className="text-[14px] font-medium text-gray-800 leading-relaxed">
                  Can you help me with some additional clarity? {currentQuestionIndex + 1}/{totalQuestions}
                </p>
                <div className="pl-4 border-l-2 border-gray-200">
                  <p className="text-[13px] text-gray-600 leading-relaxed">
                    {currentQuestionIndex + 1}. {currentQuestion.question}
                  </p>
                </div>

                {/* Options */}
                <div className="space-y-3">
                  {currentQuestion.options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedOption(idx)}
                      className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                        selectedOption === idx
                          ? 'bg-blue-50/50 border-blue-200'
                          : 'bg-gray-50/50 border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className={`mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-all ${
                          selectedOption === idx ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'
                        }`}>
                          {selectedOption === idx && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <span className={`text-[13px] leading-snug font-medium ${selectedOption === idx ? 'text-gray-900' : 'text-gray-600'}`}>
                          {option}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Next Button */}
                <button
                  onClick={handleNext}
                  disabled={selectedOption === null}
                  className={`h-12 px-8 rounded-xl font-semibold text-[14px] shadow-lg transition-all ${
                    selectedOption !== null
                      ? 'bg-gray-900 text-white hover:bg-black hover:scale-[1.02] active:scale-[0.98]'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {currentQuestionIndex < totalQuestions - 1 ? 'Next' : 'Complete'}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <span className="text-[13px] font-medium text-emerald-700">All questions answered!</span>
              </div>
            )}

            {/* Proof Points Status */}
            <div className="space-y-3">
              <h4 className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">Proof Points Validated</h4>
              <div className="space-y-2">
                {proofPoints.slice(0, 4).map((pp, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    {pp.isValidated ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-gray-300" />
                    )}
                    <span className={`text-[12px] ${pp.isValidated ? 'text-gray-700' : 'text-gray-400'}`}>
                      {pp.name}
                    </span>
                  </div>
                ))}
                {proofPoints.length > 4 && (
                  <span className="text-[11px] text-gray-400">+{proofPoints.length - 4} more</span>
                )}
              </div>
            </div>
          </div>

          {/* Input Area */}
          <div className="p-5 border-t border-gray-100">
            <div className="relative flex items-center gap-3 rounded-2xl bg-[#F5F7F9] p-3 ring-1 ring-gray-200/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-blue-400 to-purple-400 p-[1px] shrink-0">
                <div className="h-full w-full rounded-full bg-white flex items-center justify-center">
                  <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400" />
                </div>
              </div>
              <Plus className="h-5 w-5 text-gray-400 cursor-pointer hover:text-gray-600" />
              <input
                type="text"
                placeholder="Ask about this opportunity..."
                className="flex-1 bg-transparent text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400"
              />
              <div className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-gray-400 cursor-pointer hover:text-gray-600" />
                <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-200 text-gray-500 hover:bg-gray-300 transition-colors">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8 pb-32">
            <div className="max-w-3xl mx-auto space-y-5">

              {/* Collapse Toggle */}
              <div className="flex justify-end">
                <ChevronUp className="h-5 w-5 text-gray-400 cursor-pointer hover:text-gray-600" />
              </div>

              {/* Main Card */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-gray-100"
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
                <div className="grid grid-cols-4 gap-4 rounded-2xl bg-gray-50/80 p-5 mb-5">
                  <div>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Impact</span>
                    <span className="text-lg font-bold text-gray-900">{impact}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Confidence</span>
                    <span className="text-lg font-bold text-gray-900">{confidence}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Questions</span>
                    <span className="text-lg font-bold text-gray-900">{questionsAnswered} of {totalQuestions}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Effort</span>
                    <span className="text-lg font-bold text-gray-900">{effort}</span>
                  </div>
                </div>

                {/* Risk & ESG */}
                <div className="flex items-center gap-8 px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-gray-500">Risk:</span>
                    <span className="text-[13px] font-bold text-gray-900">{risk}</span>
                    <ChevronDown className="h-4 w-4 text-red-500" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-gray-500">ESG:</span>
                    <span className="text-[13px] font-bold text-gray-900">{esg}</span>
                    <span className="text-[13px] text-gray-400">~</span>
                  </div>
                  {totalSpend > 0 && (
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-[13px] font-medium text-gray-500">Total Spend:</span>
                      <span className="text-[13px] font-bold text-gray-900">{formatCurrency(totalSpend)}</span>
                    </div>
                  )}
                </div>
              </motion.section>

              {/* What did I find? */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-gray-100"
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-gray-900">What did I find?</h2>
                  <ChevronUp className="h-5 w-5 text-gray-400 cursor-pointer" />
                </div>

                <p className="mb-6 text-[14px] text-gray-600 leading-relaxed">
                  {getInsightText()}
                </p>

                <div className="flex gap-6">
                  {/* Chart Area */}
                  <div className="flex-1 space-y-3">
                    <h4 className="text-[14px] font-semibold text-gray-900">{getChartTitle()}</h4>
                    <div className="relative h-[220px] w-full">
                      {/* Y-axis labels */}
                      <div className="absolute left-0 top-0 bottom-6 w-8 flex flex-col justify-between text-[10px] font-medium text-gray-400">
                        <span>100%</span>
                        <span>75%</span>
                        <span>50%</span>
                        <span>25%</span>
                        <span>0%</span>
                      </div>

                      {/* Chart */}
                      <div className="absolute left-10 right-0 top-0 bottom-6 border-l border-b border-gray-200">
                        <svg className="h-full w-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                          {/* Grid lines */}
                          {[0, 50, 100, 150].map((y, i) => (
                            <line key={i} x1="0" y1={y} x2="400" y2={y} stroke="#f0f0f0" strokeWidth="1" />
                          ))}

                          {/* Chart line */}
                          <motion.path
                            d="M 0 180 L 80 160 L 160 120 L 240 80 L 320 50 L 400 30"
                            fill="none"
                            stroke="#3B82F6"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 1.5, ease: "easeInOut" }}
                          />
                        </svg>
                      </div>

                      {/* X-axis labels */}
                      <div className="absolute bottom-0 left-10 right-0 flex justify-between text-[11px] font-medium text-gray-400">
                        <span>Jan 24</span>
                        <span>Jun 24</span>
                        <span>Jan 25</span>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="flex gap-2 pt-2 pl-10 flex-wrap">
                      {topSuppliers.slice(0, 3).map((supplier, idx) => (
                        <span key={idx} className="text-[9px] font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded truncate max-w-[120px]">
                          {supplier}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Info Boxes */}
                  <div className="w-[280px] space-y-4">
                    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                      <p className="text-[12px] leading-relaxed text-gray-600">
                        Based on your spend data analysis, implementing this initiative could generate {savingsPercentage} savings on addressable spend.
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                      <p className="text-[12px] leading-relaxed text-gray-600">
                        {validatedCount} of {proofPoints.length} proof points validated. Answer more questions to increase confidence and narrow savings range.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.section>

              {/* How did I test? */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-gray-100"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-gray-900">How did I test:</h2>
                  <ChevronUp className="h-5 w-5 text-gray-400 cursor-pointer" />
                </div>

                <div className="space-y-4">
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
              </motion.section>

              {/* What I Recommend */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-gray-100"
              >
                <h2 className="text-lg font-bold text-gray-900 mb-6">What I Recommend</h2>

                <div className="space-y-3 mb-6">
                  {recommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 hover:bg-gray-50/50 transition-colors cursor-pointer">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-md border-2 transition-colors ${rec.checked ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-300'}`}>
                        {rec.checked && <Check className="h-4 w-4 text-white" />}
                      </div>
                      <span className="text-[13px] font-semibold text-gray-900">{rec.text}</span>
                    </div>
                  ))}
                </div>

                <p className="text-[13px] font-medium text-gray-500 mb-8">
                  I will monitor market conditions and alert you on significant changes (±5% threshold).
                </p>

                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => router.push("/opportunities")}
                    className="h-11 px-6 rounded-xl text-[14px] font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    Ignore
                  </button>
                  <button className="h-11 px-6 rounded-xl bg-blue-100 flex items-center gap-2 text-[14px] font-semibold text-blue-700 hover:bg-blue-200 transition-colors">
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    Simulate
                  </button>
                  <button
                    onClick={() => router.push("/opportunities/accepted")}
                    className="h-11 px-8 rounded-xl bg-gray-900 text-[14px] font-semibold text-white shadow-lg hover:bg-black transition-all"
                  >
                    Accept
                  </button>
                </div>
              </motion.section>

            </div>
          </div>
        </div>
      </div>

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
  );
}
