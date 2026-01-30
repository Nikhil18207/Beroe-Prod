"use client";

import { motion } from "framer-motion";
import {
  Home,
  Activity,
  ShieldCheck,
  Search,
  Plus,
  Mic,
  Menu,
  ArrowRight,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  Users,
  Send
} from "lucide-react";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";

// Recent conversations data
const recentConversations = [
  {
    id: "1",
    title: "Freight Consolidation Savings in Asia Ro...",
    description: "Max identified fragmented shipments between...",
    time: "2 HOURS AGO"
  },
  {
    id: "2",
    title: "Expiring Supplier ESG Certification",
    description: "One of your tier-1 suppliers, AgroPure Ltd., has a...",
    time: "2 DAYS AGO"
  },
  {
    id: "3",
    title: "Contract Performance Drift – Packaging...",
    description: "Max flagged declining performance trends in a k...",
    time: "LAST WEEK"
  }
];

export default function DashboardPage() {
  const { state } = useApp();
  const router = useRouter();
  const [chatInput, setChatInput] = useState("");

  const userName = state.user?.name || "User";

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      // Navigate to chat page with the query
      router.push(`/chat?q=${encodeURIComponent(chatInput)}`);
    }
  };

  // ============================================================================
  // CALCULATE REAL DATA FROM BACKEND OR SETUP OPPORTUNITIES
  // ============================================================================

  // Get the 4 setup opportunities with their validated proof points
  const setupOpportunities = state.setupOpportunities;

  // Get backend opportunities if available
  const backendOpportunities = state.opportunities || [];
  const hasBackendData = backendOpportunities.length > 0;

  // Calculate qualified vs potential based on backend data OR validated proof points
  let qualifiedCount: number;
  let potentialCount: number;
  let totalOpportunities: number;

  if (hasBackendData) {
    // Use backend impact buckets to determine qualified vs potential
    qualifiedCount = backendOpportunities.filter(opp =>
      opp.impact_bucket === "High" || opp.impact_bucket === "Medium"
    ).length;
    potentialCount = backendOpportunities.filter(opp =>
      opp.impact_bucket === "Low"
    ).length;
    totalOpportunities = backendOpportunities.length;
  } else {
    // Fallback to frontend validation: Qualified = 3+ proof points validated
    const qualifiedOpportunities = setupOpportunities.filter(opp =>
      opp.proofPoints.filter(pp => pp.isValidated).length >= 3
    );
    const potentialOpportunities = setupOpportunities.filter(opp =>
      opp.proofPoints.filter(pp => pp.isValidated).length < 3
    );
    qualifiedCount = qualifiedOpportunities.length;
    potentialCount = potentialOpportunities.length;
    totalOpportunities = setupOpportunities.length;
  }

  // Get total spend from portfolio items or setupData
  const totalSpend = state.portfolioItems.length > 0
    ? state.portfolioItems.reduce((sum, item) => sum + item.spend, 0)
    : state.setupData.spend || 0;

  // Get computed metrics from frontend calculations
  const computedMetrics = state.computedMetrics;
  const hasComputedMetrics = computedMetrics !== null && Object.keys(computedMetrics).length > 0;

  // Format savings for display
  const formatSavings = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount.toFixed(0)}`;
  };

  // Calculate potential savings from computed metrics, backend, or fallback
  const calculateSavings = () => {
    // Priority 1: Use savings summary if available (from frontend 7-step calculation OR backend)
    if (state.savingsSummary) {
      return {
        low: state.savingsSummary.total_savings_low,
        high: state.savingsSummary.total_savings_high,
      };
    }

    // Priority 2: If backend has opportunities with savings, sum them
    if (hasBackendData) {
      const low = backendOpportunities.reduce((sum, opp) => sum + (opp.savings_low || 0), 0);
      const high = backendOpportunities.reduce((sum, opp) => sum + (opp.savings_high || 0), 0);
      return { low, high };
    }

    // Priority 3: Estimate from computed metrics if available
    if (hasComputedMetrics && totalSpend > 0) {
      // Use the 7-step calculation methodology estimates
      const addressableSpend = totalSpend * 0.8; // 80% addressable
      const baseSavingsPct = 0.05; // 5% base

      // Adjust based on metrics
      const riskMultiplier = computedMetrics.overallRiskScore > 50 ? 1.2 : 1.0;
      const concentrationMultiplier = computedMetrics.top3Concentration > 70 ? 1.3 : 1.0;

      const adjustedPct = baseSavingsPct * riskMultiplier * concentrationMultiplier;

      return {
        low: Math.round(addressableSpend * adjustedPct * 0.6),
        high: Math.round(addressableSpend * adjustedPct * 1.4),
      };
    }

    // Priority 4: Fallback to validated proof points ratio
    let totalSavingsLow = 0;
    let totalSavingsHigh = 0;

    setupOpportunities.forEach(opp => {
      const validatedCount = opp.proofPoints.filter(pp => pp.isValidated).length;
      const totalPoints = opp.proofPoints.length;
      const validationRatio = validatedCount / totalPoints;

      // Parse savings percentage from potentialSavings string (e.g., "0-5%", "1-2%")
      const savingsMatch = opp.potentialSavings.match(/(\d+)-(\d+)%/);
      if (savingsMatch) {
        const lowPct = parseInt(savingsMatch[1]) / 100;
        const highPct = parseInt(savingsMatch[2]) / 100;

        // Scale savings by validation ratio
        totalSavingsLow += totalSpend * lowPct * validationRatio;
        totalSavingsHigh += totalSpend * highPct * validationRatio;
      }
    });

    return { low: totalSavingsLow, high: totalSavingsHigh };
  };

  const savings = calculateSavings();

  // Format total savings for display
  const totalSavings = savings.high > 0
    ? `${formatSavings(savings.low)} - ${formatSavings(savings.high)}`
    : "$0";

  // Calculate total validated proof points for health assessment
  const totalValidatedProofPoints = setupOpportunities.reduce(
    (sum, opp) => sum + opp.proofPoints.filter(pp => pp.isValidated).length,
    0
  );
  const totalProofPoints = setupOpportunities.reduce(
    (sum, opp) => sum + opp.proofPoints.length,
    0
  );

  // Get confidence score from savings summary or calculate from validation
  const confidenceScore = state.savingsSummary?.confidence_score
    ? Math.round(state.savingsSummary.confidence_score * 100)
    : hasBackendData
      ? Math.round(
          // Calculate confidence based on impact scores (scale 0-10 normalized to 0-100)
          backendOpportunities.reduce((sum, opp) => sum + (opp.impact_score || 5), 0) /
          backendOpportunities.length * 10
        )
      : Math.round((totalValidatedProofPoints / Math.max(totalProofPoints, 1)) * 100);

  // Determine portfolio health message based on validation, computed metrics, and backend data
  const getHealthMessage = () => {
    // Priority 1: Backend data with savings summary
    if (hasBackendData && state.savingsSummary) {
      const confidence = state.savingsSummary.confidence_bucket;
      if (confidence === "High") {
        return `Your analysis is complete with high confidence (${confidenceScore}%). You have ${qualifiedCount} opportunities ready for action with potential savings of ${totalSavings}.`;
      } else if (confidence === "Medium") {
        return `Analysis complete with medium confidence (${confidenceScore}%). Consider validating more data to improve savings estimates.`;
      } else {
        return `Analysis complete but confidence is low (${confidenceScore}%). Upload more data to improve opportunity qualification.`;
      }
    }

    // Priority 2: Frontend computed metrics with savings summary
    if (hasComputedMetrics && state.savingsSummary) {
      const confidence = state.savingsSummary.confidence_bucket;
      const riskLevel = computedMetrics!.overallRiskScore > 60 ? "elevated" : computedMetrics!.overallRiskScore > 40 ? "moderate" : "low";

      if (confidence === "High") {
        return `Analysis complete with high confidence (${confidenceScore}%). HHI index is ${computedMetrics!.hhiIndex.toFixed(0)}, supplier concentration at ${computedMetrics!.top3Concentration.toFixed(0)}%, with ${riskLevel} risk. ${qualifiedCount} opportunities identified.`;
      } else if (confidence === "Medium") {
        return `Analysis shows medium confidence (${confidenceScore}%). Top 3 suppliers control ${computedMetrics!.top3Concentration.toFixed(0)}% of spend. Consider validating more data sources.`;
      } else {
        return `Initial analysis shows ${riskLevel} risk profile with ${computedMetrics!.tailSpendPercentage.toFixed(0)}% tail spend. Upload additional data for higher confidence.`;
      }
    }

    // Priority 3: Computed metrics without savings summary
    if (hasComputedMetrics) {
      const riskLevel = computedMetrics!.overallRiskScore > 60 ? "elevated" : computedMetrics!.overallRiskScore > 40 ? "moderate" : "low";
      return `Metrics computed: HHI ${computedMetrics!.hhiIndex.toFixed(0)}, ${computedMetrics!.supplierCount} suppliers, ${computedMetrics!.top3Concentration.toFixed(0)}% concentration, ${riskLevel} risk score. ${qualifiedCount} opportunities identified with ${totalSavings} potential savings.`;
    }

    // Priority 4: Basic validation status
    if (totalValidatedProofPoints === 0) {
      return "Your portfolio data hasn't been validated yet. Upload and validate your data to unlock savings opportunities.";
    } else if (qualifiedCount === 0) {
      return "Your opportunities need more data validation to qualify. Continue validating proof points to increase confidence.";
    } else if (qualifiedCount < totalOpportunities) {
      return `You have ${qualifiedCount} qualified opportunities ready for action. Validate more data to qualify the remaining ${potentialCount} potential opportunities.`;
    } else {
      return "Your portfolio is fully validated with all opportunities qualified. You're ready to maximize your savings potential.";
    }
  };

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

      {/* Enhanced Left Icon Sidebar */}
      <div className="relative z-20 flex w-20 flex-col items-center glass-card border-r-0 border-l-0 py-8 backdrop-blur-2xl shrink-0 shadow-2xl bg-gradient-to-b from-white/20 via-white/10 to-white/5">
        {/* Enhanced Logo */}
        <motion.div
          whileHover={{ scale: 1.05, rotate: 5 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          className="mb-10"
        >
          <Link href="/dashboard" className="flex h-14 w-14 items-center justify-center rounded-3xl overflow-hidden shadow-2xl shadow-purple-500/30 border border-white/20 hover:shadow-glow hover:shadow-purple-500/50 transition-all duration-300 group">
            <div className="h-full w-full bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 flex items-center justify-center relative">
              <div className="h-6 w-6 rounded-full bg-white/40 backdrop-blur-sm group-hover:bg-white/60 transition-colors duration-300" />
              <div className="absolute inset-1 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 opacity-60 blur-sm animate-pulse" />
            </div>
          </Link>
        </motion.div>

        {/* Enhanced Main Navigation */}
        <div className="flex flex-col gap-6 text-gray-400">
          {/* Home - Active */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
            className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-xl border border-blue-400/30 shadow-lg shadow-blue-500/20 text-blue-400 ring-2 ring-blue-400/20 hover:ring-blue-400/40 transition-all duration-300 cursor-pointer group"
          >
            <Home className="h-6 w-6 group-hover:scale-110 transition-transform duration-200" strokeWidth={2} />
          </motion.div>
          {/* Activity/Today */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 300 }}
          >
            <Link href="/today" className="p-3 rounded-2xl hover:bg-white/20 backdrop-blur-sm hover:border hover:border-white/30 transition-all duration-300 cursor-pointer group hover:shadow-lg hover:shadow-white/10">
              <Activity className="h-6 w-6 group-hover:scale-110 group-hover:text-blue-400 transition-all duration-200" strokeWidth={2} />
            </Link>
          </motion.div>
          {/* Shield/Opportunities */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 300 }}
          >
            <Link href="/opportunities" className="p-3 rounded-2xl hover:bg-white/20 backdrop-blur-sm hover:border hover:border-white/30 transition-all duration-300 cursor-pointer group hover:shadow-lg hover:shadow-white/10">
              <ShieldCheck className="h-6 w-6 group-hover:scale-110 group-hover:text-blue-400 transition-all duration-200" strokeWidth={2} />
            </Link>
          </motion.div>
        </div>

        {/* Enhanced Bottom Navigation */}
        <div className="mt-auto flex flex-col gap-6 text-gray-400">
          {/* Search */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: "spring", stiffness: 300 }}
          >
            <div className="p-3 rounded-2xl hover:bg-white/20 backdrop-blur-sm hover:border hover:border-white/30 transition-all duration-300 cursor-pointer group hover:shadow-lg hover:shadow-white/10">
              <Search className="h-6 w-6 group-hover:scale-110 group-hover:text-blue-400 transition-all duration-200" strokeWidth={2} />
            </div>
          </motion.div>
          {/* Users/Team */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.6, type: "spring", stiffness: 300 }}
          >
            <div className="p-3 rounded-2xl hover:bg-white/20 backdrop-blur-sm hover:border hover:border-white/30 transition-all duration-300 cursor-pointer group hover:shadow-lg hover:shadow-white/10">
              <Users className="h-6 w-6 group-hover:scale-110 group-hover:text-blue-400 transition-all duration-200" strokeWidth={2} />
            </div>
          </motion.div>
          {/* Enhanced User Avatar */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.7, type: "spring", stiffness: 300 }}
            whileHover={{ scale: 1.1 }}
            className="mt-2"
          >
            <Link href="/" className="flex h-12 w-12 items-center justify-center rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white text-sm font-semibold cursor-pointer hover:shadow-2xl hover:shadow-gray-900/50 transition-all duration-300 border border-white/10 hover:border-white/20 group">
              <span className="group-hover:scale-110 transition-transform duration-200">N</span>
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Link>
          </motion.div>
        </div>
      </div>

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
              placeholder="Ask me anything about your procurement data..."
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
          <main className="px-16 py-12 pb-32">

            {/* Welcome Section */}
            <div className="mb-12">
              {/* Welcome Title */}
              <div className="flex items-center gap-2 mb-6">
                <h1 className="text-4xl font-medium text-gray-900">
                  Welcome, {userName}
                </h1>
                <ArrowUpRight className="h-5 w-5 text-gray-400 rotate-[-45deg]" />
              </div>

              {/* Intro Text */}
              <p className="text-gray-500 mb-4">
                Based on the inputs you have shared with me, you have
              </p>

              {/* Savings Amount */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-3xl font-semibold text-gray-900">{totalSavings} total potential savings</span>
                <ArrowUpRight className="h-5 w-5 text-gray-500" />
                <span className="text-2xl text-gray-600">identified across</span>
              </div>

              {/* Opportunities Stats */}
              <div className="flex items-center gap-4 mb-4">
                {/* Total Opportunities */}
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="text-xl font-semibold text-gray-900">{totalOpportunities} opportunities</span>
                  <ArrowUpRight className="h-4 w-4 text-gray-400" />
                </div>

                {/* Qualified */}
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="text-xl font-semibold text-gray-900">{qualifiedCount} Qualified</span>
                  <ArrowUpRight className="h-4 w-4 text-gray-400" />
                </div>

                {/* Potential */}
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 flex items-center justify-center">
                    <div className="h-1 w-3 bg-orange-400 rounded-full" />
                    <div className="h-3 w-0.5 bg-orange-400 rounded-full ml-0.5" />
                  </div>
                  <span className="text-xl font-semibold text-gray-900">{potentialCount} Potential</span>
                  <ArrowUpRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>

              {/* Proof Points Validation Progress */}
              <div className="flex items-center gap-3 mb-6 text-sm">
                <span className="text-gray-500">Proof Points Validated:</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${(totalValidatedProofPoints / totalProofPoints) * 100}%` }}
                    />
                  </div>
                  <span className="font-semibold text-gray-700">{totalValidatedProofPoints}/{totalProofPoints}</span>
                </div>
              </div>

              {/* Health Message - Dynamic based on validation status */}
              <p className="text-gray-500 max-w-2xl mb-8">
                {getHealthMessage()}
              </p>

              {/* Enhanced Action Buttons */}
              <div className="flex items-center gap-6 mt-2">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    href="/opportunities"
                    className="group flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-gray-900 via-gray-800 to-black text-white rounded-2xl font-semibold shadow-2xl shadow-gray-900/30 hover:shadow-3xl hover:shadow-gray-900/50 hover:from-gray-800 hover:via-gray-700 hover:to-gray-600 transition-all duration-300 border border-white/10 hover:border-white/20"
                  >
                    <span>View all Risks & Opportunities</span>
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                  </Link>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <button className="group flex items-center gap-3 px-8 py-4 glass-card text-gray-700 rounded-2xl font-semibold hover:bg-white/20 hover:shadow-xl hover:shadow-white/10 transition-all duration-300 border border-white/30 hover:border-white/50">
                    <span>View your Portfolio Health</span>
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                  </button>
                </motion.div>
              </div>
            </div>

            {/* Recent Conversations Section */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Recent Conversations</h2>
                <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  View all
                  <ArrowRight className="h-4 w-4 rotate-[-45deg]" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recentConversations.map((conversation, index) => (
                  <motion.div
                    key={conversation.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    whileHover={{
                      scale: 1.02,
                      y: -8,
                      transition: { type: "spring", stiffness: 300, damping: 20 }
                    }}
                    className="group rounded-3xl glass-card p-6 ring-1 ring-white/20 hover:shadow-2xl hover:shadow-blue-500/10 hover:ring-white/40 transition-all duration-300 cursor-pointer border border-white/10 hover:border-white/30"
                  >
                    <div className="flex items-center justify-between mb-5">
                      {/* Enhanced Layers Icon */}
                      <motion.div
                        whileHover={{ rotate: 15, scale: 1.1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-sm border border-blue-400/30 group-hover:shadow-glow group-hover:shadow-blue-500/30"
                      >
                        <svg className="h-6 w-6 text-blue-400 group-hover:text-blue-300 transition-colors duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2L2 7l10 5 10-5-10-5z" />
                          <path d="M2 17l10 5 10-5" />
                          <path d="M2 12l10 5 10-5" />
                        </svg>
                      </motion.div>
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                        <Clock className="h-3 w-3" />
                        {conversation.time}
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-1">
                      {conversation.title}
                    </h3>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {conversation.description}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>

          </main>
        </div>
      </div>
    </div>
  );
}
