"use client";

import { motion, LazyMotion, domAnimation } from "framer-motion";
import {
  Plus,
  ChevronDown,
  Settings2,
  ArrowUpDown,
  CheckCircle2,
  ExternalLink,
  Menu,
  Pencil,
  AlertTriangle,
  Send,
  Mic
} from "lucide-react";
import React, { useState, useMemo, useCallback, memo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Sidebar from "@/components/Sidebar";
import {
  calculateOpportunityRiskImpact,
  calculateWeightedPriorityScore,
  calculateDeterministicConfidence,
  type ProofPointResult,
  type RiskImpact
} from "@/lib/calculations/procurement-metrics";

// Opportunity type configuration
const OPPORTUNITY_TYPE_CONFIG: Record<string, {
  name: string;
  type: "Savings" | "Resilience";
  impactLabel?: string;
  effort: string;
  description: string;
}> = {
  "volume-bundling": {
    name: "Bundle volumes across oil types for economies of scale",
    type: "Savings",
    effort: "3-6 months",
    description: "Consolidate purchasing across different vegetable oil categories to maximize volume discounts"
  },
  "target-pricing": {
    name: "Use cost model driven pricing mechanisms",
    type: "Savings",
    effort: "3-6 months",
    description: "Leverage cost modeling to negotiate better pricing and identify overcharges"
  },
  "risk-management": {
    name: "Use financial instruments to manage procurement risks",
    type: "Resilience",
    impactLabel: "Risk Reduction",
    effort: "6-12 months",
    description: "Identify and mitigate supply chain risks including single sourcing, concentration, and external factors"
  },
  "respec-pack": {
    name: "Optimize pack sizes and bulk delivery options",
    type: "Savings",
    effort: "6-12 months",
    description: "Review pack sizes and explore flexi tanks or bulk delivery to streamline supply chain and reduce costs"
  },
};

function OpportunitiesContent() {
  const { state } = useApp();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("All");
  const [chatInput, setChatInput] = useState("");
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch - only render data-dependent content after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleChatSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      router.push(`/chat?q=${encodeURIComponent(chatInput)}`);
    }
  }, [chatInput, router]);

  // Get data from context
  const savingsSummary = state.savingsSummary;
  const setupOpportunities = state.setupOpportunities;
  const opportunityMetrics = state.opportunityMetrics; // Real 7-step calculated metrics
  const llmProofPointEvaluations = state.llmProofPointEvaluations; // Pre-computed LLM evaluations from setup
  const categoryName = state.setupData.categoryName?.toUpperCase() || "CATEGORY";
  const totalSpend = state.spendAnalysis?.totalSpend ||
    (state.portfolioItems.length > 0
      ? state.portfolioItems.reduce((sum, item) => sum + item.spend, 0)
      : state.setupData.spend || 0);
  const goals = state.setupData.goals || { cost: 60, risk: 25, esg: 15 };
  const computedMetrics = state.computedMetrics;

  // Generate exactly 4 bento cards - one for each opportunity type
  // Each card shows proof points as initiatives inside
  const generatedOpportunities = useMemo(() => {
    const opportunities: Array<{
      id: string;
      category: string;
      title: string;
      description: string;
      opportunityName: string;
      type: "Savings" | "Resilience";
      impactLabel?: string;
      impact: "High" | "Medium" | "Low";
      effort: string;
      potentialSavings: string;
      confidence: number;
      status: "Qualified" | "Potential";
      isNew: boolean;
      questionsToAnswer: number;
      savings_low?: number;
      savings_high?: number;
      proofPoints: Array<{
        id: string;
        name: string;
        description: string;
        isValidated: boolean;
      }>;
      // Risk field
      riskImpact: RiskImpact;
      priorityScore: number;
    }> = [];

    // Process each of the 4 main opportunities from setupOpportunities
    setupOpportunities.forEach(opp => {
      const config = OPPORTUNITY_TYPE_CONFIG[opp.id];
      if (!config) return;

      const validatedCount = opp.proofPoints.filter(pp => pp.isValidated).length;
      const totalPoints = opp.proofPoints.length;
      const validationRatio = totalPoints > 0 ? validatedCount / totalPoints : 0;

      // Get real metrics from 7-step calculation if available
      const realMetrics = opportunityMetrics?.find(m => m.opportunityId === opp.id);

      // DETERMINISTIC confidence calculation using computed metrics
      // This replaces LLM-based confidence which was non-deterministic
      const proofPointIds = opp.proofPoints.map(pp => pp.id);
      const deterministicResult = computedMetrics
        ? calculateDeterministicConfidence(opp.id, proofPointIds, computedMetrics)
        : null;

      // Priority: Deterministic (from metrics) > 7-step calculation > validation ratio fallback
      const confidence = deterministicResult
        ? deterministicResult.confidenceScore
        : realMetrics
          ? Math.round(realMetrics.confidenceScore * 100)
          : Math.round(validationRatio * 100);

      // Qualified = confidence score >= 50% (enough evidence)
      // Potential = confidence score < 50% (needs more validation)
      const status: "Qualified" | "Potential" =
        confidence >= 50 ? "Qualified" : "Potential";

      // Use impact from 7-step calculation, or fallback to validation ratio
      const impact: "High" | "Medium" | "Low" = realMetrics?.impactBucket ||
        (validationRatio >= 0.7 ? "High" :
          validationRatio >= 0.4 ? "Medium" : "Low");

      // Use real savings from 7-step calculation if available
      let savings_low: number;
      let savings_high: number;

      if (realMetrics) {
        // Use actual calculated savings from 7-step methodology
        savings_low = Math.round(realMetrics.savingsLow);
        savings_high = Math.round(realMetrics.savingsHigh);
      } else {
        // Fallback: Parse savings percentage from potentialSavings string (e.g., "0-5%", "1-2%")
        const savingsMatch = opp.potentialSavings.match(/(\d+)-(\d+)%/);
        const lowPct = savingsMatch ? parseInt(savingsMatch[1]) / 100 : 0;
        const highPct = savingsMatch ? parseInt(savingsMatch[2]) / 100 : 0;

        // Calculate fallback savings based on total spend and validation
        const addressableSpend = totalSpend * 0.8; // 80% addressable
        savings_low = Math.round(addressableSpend * lowPct * validationRatio);
        savings_high = Math.round(addressableSpend * highPct * validationRatio);
      }

      // Convert proof points to ProofPointResult format for calculations
      // ProofPoint from context only has: id, name, description, isValidated
      const proofPointResults: ProofPointResult[] = opp.proofPoints.map(pp => ({
        id: pp.id,
        name: pp.name,
        value: 0, // Default value since ProofPoint doesn't have this
        impact: 'Not Tested' as const, // Default - will be evaluated based on data
        insight: pp.description || '', // Use description as fallback
        isTested: pp.isValidated,
        threshold: { high: '', medium: '', low: '' }
      }));

      // Calculate Risk impact
      const riskImpact = calculateOpportunityRiskImpact(opp.id, proofPointResults, computedMetrics || undefined);

      // Calculate savings estimate for priority scoring
      const savingsEstimate = (savings_low + savings_high) / 2;

      // Calculate weighted priority score based on user goals
      // Pass neutral ESG impact since we're only showing Risk
      const neutralEsgImpact = { score: 0, normalizedScore: 50, esgLevel: 'Medium' as const, label: '0', description: '', breakdown: { environmental: 0, social: 0, governance: 0 } };
      const priorityResult = calculateWeightedPriorityScore(
        goals,
        savingsEstimate,
        totalSpend,
        riskImpact,
        neutralEsgImpact
      );

      opportunities.push({
        id: opp.id,
        category: categoryName,
        title: config.name,
        description: config.description,
        opportunityName: opp.name,
        type: config.type,
        impactLabel: config.impactLabel,
        impact,
        effort: config.effort,
        potentialSavings: opp.potentialSavings,
        confidence: Math.max(confidence, 10), // Minimum 10% confidence
        status,
        isNew: true,
        questionsToAnswer: totalPoints - validatedCount,
        savings_low,
        savings_high,
        proofPoints: opp.proofPoints, // Include all proof points as initiatives
        // Risk field
        riskImpact,
        priorityScore: priorityResult.priorityScore,
      });
    });

    // Sort opportunities by priority score (higher = more aligned with user goals)
    opportunities.sort((a, b) => b.priorityScore - a.priorityScore);

    return opportunities;
  }, [setupOpportunities, categoryName, totalSpend, opportunityMetrics, goals, computedMetrics]);

  // Calculate totals - use nullish coalescing to handle 0 values correctly
  const totalSavingsLow = savingsSummary?.total_savings_low ??
    generatedOpportunities.reduce((sum, o) => sum + (o.savings_low || 0), 0);
  const totalSavingsHigh = savingsSummary?.total_savings_high ??
    generatedOpportunities.reduce((sum, o) => sum + (o.savings_high || 0), 0);

  const avgConfidence = generatedOpportunities.length > 0
    ? Math.round(generatedOpportunities.reduce((sum, o) => sum + o.confidence, 0) / generatedOpportunities.length)
    : 0;
  const confidenceScore = savingsSummary?.confidence_score
    ? Math.round(savingsSummary.confidence_score * 100)
    : avgConfidence || 0;

  // Calculate total proof points validated
  const totalValidatedProofPoints = generatedOpportunities.reduce(
    (sum, o) => sum + (o.proofPoints?.filter((pp: any) => pp.isValidated).length || 0), 0
  );
  const totalProofPoints = generatedOpportunities.reduce(
    (sum, o) => sum + (o.proofPoints?.length || 0), 0
  );

  // Calculate savings percentage
  const savingsPercentageLow = totalSpend > 0 ? Math.round((totalSavingsLow / totalSpend) * 100) : 0;
  const savingsPercentageHigh = totalSpend > 0 ? Math.round((totalSavingsHigh / totalSpend) * 100) : 0;

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount.toFixed(0)}`;
  };

  // Split into qualified and potential
  const displayQualified = generatedOpportunities.filter(o => o.status === "Qualified");
  const displayPotential = generatedOpportunities.filter(o => o.status === "Potential");
  const newCount = generatedOpportunities.filter(o => o.isNew).length;

  const tabs = [
    { name: "All", count: generatedOpportunities.length },
    { name: "Qualified", count: displayQualified.length },
    { name: "Potential", count: displayPotential.length },
    { name: "New", count: newCount },
    { name: "Accepted", count: 0 }
  ];

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-gradient-to-b from-[#E8F4FC] via-[#F0F8FF] to-white">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Yellow Building Detail - Subtle background */}
        <div className="absolute bottom-[-20%] left-[-10%] h-[70%] w-[55%] rotate-[-12deg] overflow-hidden bg-[#E5B800] shadow-2xl opacity-40">
          <div className="absolute inset-0 flex flex-col space-y-6 pt-12">
            {Array.from({ length: 25 }).map((_, i) => (
              <div key={i} className="h-[2px] w-full bg-black/5" />
            ))}
          </div>
          {/* White railing lines */}
          <div className="absolute top-6 left-0 h-[2px] w-full bg-white/30" />
          <div className="absolute top-12 left-0 h-[2px] w-full bg-white/20" />
        </div>
      </div>

      {/* Left Icon Sidebar */}
      <Sidebar user={state.user} />

      {/* Main Content Area */}
      <div className="relative z-30 flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-[#E8F4FC] via-[#F0F8FF] to-white">

        {/* Top Header Bar */}
        <header className="flex h-16 items-center justify-between px-6 bg-transparent">
          <form onSubmit={handleChatSubmit} className="flex items-center gap-3 flex-1">
            {/* Gradient Orb */}
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 p-[2px] shadow-md shrink-0">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-white/90 backdrop-blur-sm">
                <div className="h-4 w-4 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 opacity-80" />
              </div>
            </div>

            {/* Plus Button */}
            <button type="button" className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors shrink-0">
              <Plus className="h-4 w-4" />
            </button>

            {/* Chat Input */}
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Show me all opportunities involving Europe..."
              className="flex-1 bg-transparent text-sm font-medium text-gray-700 placeholder:text-blue-400 outline-none border-none"
            />

            {/* Send Button */}
            {chatInput.trim() && (
              <button type="submit" className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shrink-0">
                <Send className="h-4 w-4" />
              </button>
            )}
          </form>

          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-white/50 rounded-lg transition-colors">
              <Mic className="h-5 w-5 text-gray-400" />
            </button>
            <button className="p-2 hover:bg-white/50 rounded-lg transition-colors">
              <Menu className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <main className="px-6 py-12 pb-32">

            {/* Opportunities Header */}
            <div className="mb-10">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.15em] mb-4 block">
                OPPORTUNITIES
              </span>

              <div className="flex items-center gap-2 mb-5">
                <span className="text-sm text-gray-600">Category:</span>
                <span className="text-sm font-medium text-gray-900">All</span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>

              {/* Main Stats Line */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <span className="text-2xl text-gray-700">You have</span>

                {/* Qualified Badge */}
                <div className="flex items-center gap-2 bg-emerald-50/80 rounded-full px-4 py-2 ring-1 ring-emerald-100">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="text-2xl font-semibold text-gray-800">{mounted ? displayQualified.length : 0} Qualified opportunities,</span>
                </div>

                <span className="text-2xl text-gray-700">&</span>

                {/* Potential Badge */}
                <div className="flex items-center gap-2 bg-gray-100/80 rounded-full px-4 py-2 ring-1 ring-gray-200">
                  <div className="h-5 w-5 rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center">
                    <div className="h-1.5 w-1.5 bg-gray-400 rounded-full" />
                  </div>
                  <span className="text-2xl font-semibold text-gray-800">{mounted ? displayPotential.length : 0} Potential opportunities,</span>
                </div>
              </div>

              {/* Savings Line */}
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-2xl text-gray-700">Based on this your savings:</span>
                <span className="text-2xl font-bold text-gray-900">{mounted ? `${formatCurrency(totalSavingsLow)} - ${formatCurrency(totalSavingsHigh)}` : '$0 - $0'} USD</span>
                <span className="text-lg text-gray-400">{mounted ? `${savingsPercentageLow}% - ${savingsPercentageHigh}%` : '0% - 0%'}</span>
              </div>

              {/* Help Text */}
              <p className="text-sm text-gray-400 mb-5">
                Want to get a more precise savings estimate and narrow down that range?{" "}
                <span className="text-gray-600 font-medium">Answer the questions</span>{" "}
                against the opportunities.
              </p>

              {/* Confidence, Proof Points & Addressable Spend */}
              <div className="flex items-center gap-10">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Confidence level:</span>
                  <span className="font-bold text-gray-900">{confidenceScore}%</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Proof Points Validated:</span>
                  <span className="font-bold text-gray-900">{totalValidatedProofPoints}/{totalProofPoints}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Addressable Spend:</span>
                  <span className="font-bold text-gray-900 bg-blue-50 px-2 py-0.5 rounded">80%</span>
                  <button className="text-gray-400 hover:text-gray-600 transition-colors">
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs & Filters */}
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-8">
                {tabs.map((tab) => (
                  <button
                    key={tab.name}
                    onClick={() => setActiveTab(tab.name)}
                    className={`relative text-lg font-medium transition-colors ${activeTab === tab.name ? "text-gray-900" : "text-gray-300 hover:text-gray-500"
                      }`}
                  >
                    {tab.name}
                    <sup className="ml-0.5 text-xs opacity-70">{tab.count}</sup>
                    {activeTab === tab.name && (
                      <motion.div
                        layoutId="tab-underline"
                        className="absolute -bottom-2 left-0 right-0 h-[2px] bg-gray-900"
                      />
                    )}
                  </button>
                ))}
                <ChevronDown className="h-5 w-5 text-gray-300 cursor-pointer hover:text-gray-500" />
              </div>

              <div className="flex items-center gap-4 text-gray-400">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Settings2 className="h-5 w-5" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <ArrowUpDown className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Qualified Section */}
            <section className="mb-16">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-base font-semibold text-gray-900">Qualified</h2>
                <div className="bg-gray-900 text-white text-xs font-bold h-6 w-6 flex items-center justify-center rounded-full">
                  {mounted ? displayQualified.length : 0}
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>

              {/* Dashed line separator */}
              <div className="border-t border-dashed border-gray-200 mb-6" />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {mounted && displayQualified.map((opp, idx) => (
                  <OpportunityCard key={idx} opportunity={opp} variant="qualified" />
                ))}
              </div>
            </section>

            {/* Potential Section */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-base font-semibold text-gray-900">Potential</h2>
                <div className="bg-gray-900 text-white text-xs font-bold h-6 w-6 flex items-center justify-center rounded-full">
                  {mounted ? displayPotential.length : 0}
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>

              {/* Dashed line separator */}
              <div className="border-t border-dashed border-gray-200 mb-6" />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {mounted && displayPotential.map((opp, idx) => (
                  <OpportunityCard key={idx} opportunity={opp} variant="potential" />
                ))}
              </div>
            </section>

          </main>
        </div>
      </div>
    </div>
  );
}

export default function OpportunitiesPage() {
  return (
    <ProtectedRoute>
      <OpportunitiesContent />
    </ProtectedRoute>
  );
}

const OpportunityCard = memo(function OpportunityCard({ opportunity: opp, variant }: { opportunity: any; variant: "qualified" | "potential" }) {
  const router = useRouter();
  const isPotential = variant === "potential";
  const isResilience = opp.type === "Resilience";
  const proofPoints = opp.proofPoints || [];
  const validatedCount = proofPoints.filter((pp: any) => pp.isValidated).length;
  const totalPoints = proofPoints.length;

  const handleClick = useCallback(() => {
    // Navigate to the opportunity details page with the opportunity ID
    router.push(`/opportunities/details?opp=${opp.id}`);
  }, [router, opp.id]);

  // Format savings for display
  const formatSavings = (low: number, high: number) => {
    const formatAmount = (amount: number) => {
      if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
      if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
      return `$${amount.toFixed(0)}`;
    };
    if (low === 0 && high === 0) return opp.potentialSavings || "0-5%";
    return `${formatAmount(low)} - ${formatAmount(high)}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
      onClick={handleClick}
      className="group relative flex flex-col rounded-3xl p-5 transition-all hover:shadow-xl hover:-translate-y-1 cursor-pointer overflow-visible bg-white ring-1 ring-gray-100"
    >
      {/* Top Badges - positioned outside card */}
      <div className="absolute -top-3 right-4 flex gap-2">
        {opp.isNew && (
          <div className="rounded-full bg-fuchsia-500 px-3 py-1 text-[10px] font-bold text-white shadow-md">
            New
          </div>
        )}
      </div>

      {/* Header Row */}
      <div className="flex items-start justify-between mb-3 mt-1">
        <div className="flex items-center gap-2">
          {/* Icon */}
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${isPotential ? 'bg-gray-100' : 'bg-emerald-50'
            }`}>
            {isPotential ? (
              <div className="h-4 w-4 rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center">
                <div className="h-1 w-1 bg-gray-400 rounded-full" />
              </div>
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            )}
          </div>
        </div>

        {/* Type & Status Badges */}
        <div className="flex gap-1.5">
          <div className="rounded-md px-2.5 py-1 text-[10px] font-semibold bg-gray-100 text-gray-600">
            {isResilience ? "Resilience" : "Savings"}
          </div>
          <div className={`rounded-md px-2.5 py-1 text-[10px] font-semibold ${isPotential
            ? 'bg-orange-100 text-orange-600 ring-1 ring-orange-200'
            : 'bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200'
            }`}>
            {opp.status}
          </div>
        </div>
      </div>

      {/* Category & Title */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-gray-400 tracking-wider">
            {opp.category}
          </span>
        </div>
        <h3 className="text-base font-bold text-gray-900 leading-snug mb-1">
          {opp.title}
        </h3>
        <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">
          {opp.description}
        </p>
      </div>

      {/* Metrics Box */}
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50/80 p-3 mb-3">
        <div>
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide block mb-0.5">
            Potential Savings
          </span>
          <span className="text-sm font-bold text-emerald-600">
            {formatSavings(opp.savings_low || 0, opp.savings_high || 0)}
          </span>
        </div>
        <div>
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide block mb-0.5">
            Effort
          </span>
          <span className="text-sm font-bold text-gray-900">{opp.effort}</span>
        </div>
      </div>

      {/* Confidence Score */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">
            Confidence:
          </span>
          <span className={`text-sm font-bold ${opp.confidence >= 70 ? 'text-emerald-600' : opp.confidence >= 40 ? 'text-amber-600' : 'text-gray-600'}`}>
            {opp.confidence}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${opp.confidence}%` }}
            viewport={{ once: true }}
            className={`h-full rounded-full ${opp.confidence >= 70 ? 'bg-emerald-400' : opp.confidence >= 40 ? 'bg-amber-400' : 'bg-gray-300'
              }`}
          />
        </div>
      </div>

      {/* Potential Card Message */}
      {isPotential && (
        <div className="mb-3">
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Validate more proof points to increase confidence and qualify this opportunity.
          </p>
        </div>
      )}

      {/* Questions Footer */}
      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-100">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 p-[1.5px]">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-white">
            <div className="h-2 w-2 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400" />
          </div>
        </div>
        <span className="text-[11px] text-gray-400">
          {opp.questionsToAnswer} proof point{opp.questionsToAnswer !== 1 ? 's' : ''} to validate
        </span>
      </div>
    </motion.div>
  );
});
