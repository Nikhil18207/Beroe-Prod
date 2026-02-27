"use client";

import { motion, LazyMotion, domAnimation } from "framer-motion";
import {
  Plus,
  Mic,
  Menu,
  ArrowRight,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  Activity,
  Send,
  X
} from "lucide-react";
import React, { useState, useMemo, useCallback, memo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp, type ActivityItem } from "@/context/AppContext";
import { AnimatePresence } from "framer-motion";
import ProtectedRoute from "@/components/ProtectedRoute";
import Sidebar from "@/components/Sidebar";
import { calculateDeterministicConfidence } from "@/lib/calculations/procurement-metrics";

// Helper function to format relative time
const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (seconds < 60) return "JUST NOW";
  if (minutes < 60) return `${minutes} MIN${minutes > 1 ? 'S' : ''} AGO`;
  if (hours < 24) return `${hours} HOUR${hours > 1 ? 'S' : ''} AGO`;
  if (days < 7) return `${days} DAY${days > 1 ? 'S' : ''} AGO`;
  if (weeks < 4) return `${weeks} WEEK${weeks > 1 ? 'S' : ''} AGO`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
};

// Fallback conversations when no activity exists
const fallbackConversations = [
  {
    id: "fallback-1",
    title: "Get started with your analysis",
    description: "Upload your spend data and run an analysis to see savings opportunities.",
    time: "START NOW"
  }
];

function DashboardContent() {
  const { state } = useApp();
  const router = useRouter();
  const [chatInput, setChatInput] = useState("");
  const [selectedActivityGroup, setSelectedActivityGroup] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch - only render data-dependent content after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const userName = state.user?.name || "User";

  // Group activities by analysis session (each "analysis" type activity starts a new group)
  // Only show the most recent activity of each type (deduplicate)
  const groupedActivities = React.useMemo(() => {
    const groups: { main: ActivityItem; related: ActivityItem[] }[] = [];
    let currentGroup: { main: ActivityItem; related: ActivityItem[] } | null = null;

    // Sort by timestamp descending (newest first)
    const sortedActivities = [...state.activityHistory].sort((a, b) => b.timestamp - a.timestamp);

    // Track seen activity titles to deduplicate (only keep most recent of each)
    const seenTitles = new Set<string>();

    for (const activity of sortedActivities) {
      // Skip if we've already seen this exact title (duplicate)
      if (seenTitles.has(activity.title)) {
        continue;
      }
      seenTitles.add(activity.title);

      if (activity.type === "analysis") {
        // Start a new group with this analysis as the main card
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = { main: activity, related: [] };
      } else if (currentGroup) {
        // Add to current group's related activities
        currentGroup.related.push(activity);
      } else {
        // No analysis yet, create a standalone group
        currentGroup = { main: activity, related: [] };
      }
    }

    // Push the last group
    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  }, [state.activityHistory]);

  // Get up to 3 groups for display (show more in "View all" page)
  const displayedGroups = groupedActivities.slice(0, 3);

  // Helper to get activity icon
  const getActivityIcon = (type: ActivityItem["type"], isSmall = false) => {
    const size = isSmall ? "h-4 w-4" : "h-6 w-6";
    const colorClass = isSmall ? "" : "group-hover:text-emerald-300 transition-colors duration-300";

    switch (type) {
      case "analysis":
        return <Activity className={`${size} text-emerald-400 ${colorClass}`} />;
      case "upload":
        return (
          <svg className={`${size} text-purple-400 ${isSmall ? "" : "group-hover:text-purple-300 transition-colors duration-300"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17,8 12,3 7,8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        );
      case "goals":
        return (
          <svg className={`${size} text-amber-400 ${isSmall ? "" : "group-hover:text-amber-300 transition-colors duration-300"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        );
      default:
        return (
          <svg className={`${size} text-blue-400 ${isSmall ? "" : "group-hover:text-blue-300 transition-colors duration-300"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        );
    }
  };

  // Helper to get icon container classes
  const getIconContainerClasses = (type: ActivityItem["type"]) => {
    switch (type) {
      case "analysis":
        return "bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border-emerald-400/30 group-hover:shadow-emerald-500/30";
      case "upload":
        return "bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-400/30 group-hover:shadow-purple-500/30";
      case "goals":
        return "bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-400/30 group-hover:shadow-amber-500/30";
      default:
        return "bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-blue-400/30 group-hover:shadow-blue-500/30";
    }
  };

  const handleChatSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      // Navigate to chat page with the query
      router.push(`/chat?q=${encodeURIComponent(chatInput)}`);
    }
  }, [chatInput, router]);

  // ============================================================================
  // CALCULATE REAL DATA FROM BACKEND OR SETUP OPPORTUNITIES
  // ============================================================================

  // Get the 4 setup opportunities with their validated proof points
  const setupOpportunities = state.setupOpportunities;

  // Get backend opportunities if available
  const backendOpportunities = state.opportunities || [];
  const hasBackendData = backendOpportunities.length > 0;

  // Get computed metrics for deterministic confidence calculation
  const computedMetrics = state.computedMetrics;

  // Calculate qualified vs potential using SAME logic as opportunities page
  // Qualified = confidence >= 50%, Potential = confidence < 50%
  const opportunityStatuses = useMemo(() => {
    return setupOpportunities.map(opp => {
      const proofPointIds = opp.proofPoints.map(pp => pp.id);
      const validatedCount = opp.proofPoints.filter(pp => pp.isValidated).length;
      const totalPoints = opp.proofPoints.length;
      const validationRatio = totalPoints > 0 ? validatedCount / totalPoints : 0;

      // Use deterministic confidence calculation (same as opportunities page)
      const deterministicResult = computedMetrics
        ? calculateDeterministicConfidence(opp.id, proofPointIds, computedMetrics)
        : null;

      // Priority: Deterministic > backend data > validation ratio fallback
      let confidence: number;
      if (deterministicResult) {
        confidence = deterministicResult.confidenceScore;
      } else if (hasBackendData) {
        const backendOpp = backendOpportunities.find(bo => bo.opportunity_id === opp.id);
        confidence = backendOpp
          ? (backendOpp.impact_bucket === "High" ? 80 : backendOpp.impact_bucket === "Medium" ? 60 : 30)
          : Math.round(validationRatio * 100);
      } else {
        confidence = Math.round(validationRatio * 100);
      }

      // Qualified = confidence >= 50% (same threshold as opportunities page)
      const status: "Qualified" | "Potential" = confidence >= 50 ? "Qualified" : "Potential";

      return { id: opp.id, confidence, status };
    });
  }, [setupOpportunities, computedMetrics, hasBackendData, backendOpportunities]);

  const qualifiedCount = opportunityStatuses.filter(o => o.status === "Qualified").length;
  const potentialCount = opportunityStatuses.filter(o => o.status === "Potential").length;
  const totalOpportunities = setupOpportunities.length;

  // Get total spend - use spendAnalysis (filtered by category) first
  // setupData.spend contains ORIGINAL total (all categories)
  // spendAnalysis.totalSpend contains FILTERED spend for selected category
  const totalSpend = state.spendAnalysis?.totalSpend ||
    (state.portfolioItems.length > 0
      ? state.portfolioItems.reduce((sum, item) => sum + item.spend, 0)
      : state.setupData.spend || 0);

  // Check if computed metrics are available (already declared above)
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

  // Calculate potential savings using the 10-step methodology
  // Priority: savingsSummary (10-step result) > opportunityMetrics (10-step per opp) > fallback
  const calculateSavings = () => {
    // Priority 1: Use savings summary if available (from 10-step calculation)
    if (state.savingsSummary) {
      return {
        low: state.savingsSummary.total_savings_low,
        high: state.savingsSummary.total_savings_high,
      };
    }

    // Priority 2: Sum from opportunityMetrics (10-step calculated per opportunity)
    const opportunityMetrics = state.opportunityMetrics;
    if (opportunityMetrics && opportunityMetrics.length > 0) {
      const totalLow = opportunityMetrics.reduce((sum, m) => sum + m.savingsLow, 0);
      const totalHigh = opportunityMetrics.reduce((sum, m) => sum + m.savingsHigh, 0);
      return { low: totalLow, high: totalHigh };
    }

    // Priority 3: Fallback - calculate per opportunity using validation ratio
    // This matches the opportunities page fallback logic
    let totalSavingsLow = 0;
    let totalSavingsHigh = 0;
    const addressableSpend = totalSpend * 0.8; // 80% addressable

    setupOpportunities.forEach(opp => {
      const validatedCount = opp.proofPoints.filter(pp => pp.isValidated).length;
      const totalPoints = opp.proofPoints.length;
      const validationRatio = totalPoints > 0 ? validatedCount / totalPoints : 0;

      // Parse savings percentage from potentialSavings string (e.g., "0-5%", "1-2%")
      const savingsMatch = opp.potentialSavings.match(/(\d+)-(\d+)%/);
      if (savingsMatch) {
        const lowPct = parseInt(savingsMatch[1]) / 100;
        const highPct = parseInt(savingsMatch[2]) / 100;

        // Scale savings by validation ratio
        totalSavingsLow += addressableSpend * lowPct * validationRatio;
        totalSavingsHigh += addressableSpend * highPct * validationRatio;
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

  // Get confidence score from savings summary or calculate using deterministic method
  // Uses same calculation as opportunities page for consistency
  const confidenceScore = state.savingsSummary?.confidence_score
    ? Math.round(state.savingsSummary.confidence_score * 100)
    : opportunityStatuses.length > 0
      ? Math.round(
        // Average confidence across all opportunities (same as opportunities page)
        opportunityStatuses.reduce((sum, opp) => sum + opp.confidence, 0) /
        opportunityStatuses.length
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
          <main className="px-6 py-12 pb-32">

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

            {/* Recent Activity Section */}
            <div className="relative">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                {groupedActivities.length > 3 && (
                  <Link
                    href="/activity"
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    View all
                    <ArrowRight className="h-4 w-4 rotate-[-45deg]" />
                  </Link>
                )}
              </div>

              {/* Grid of bento cards - each group gets a card */}
              {/* Always use grid layout to prevent hydration layout shift */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mounted && displayedGroups.length > 0 ? (
                <>
                  {displayedGroups.map((group, index) => (
                    <motion.div
                      key={group.main.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      whileHover={{
                        scale: 1.02,
                        y: -8,
                        transition: { type: "spring", stiffness: 300, damping: 20 }
                      }}
                      onClick={() => group.related.length > 0 && setSelectedActivityGroup(group.main.id)}
                      className="group rounded-3xl glass-card p-6 ring-1 ring-white/20 hover:shadow-2xl hover:shadow-blue-500/10 hover:ring-white/40 transition-all duration-300 cursor-pointer border border-white/10 hover:border-white/30"
                    >
                      <div className="flex items-center justify-between mb-5">
                        <motion.div
                          whileHover={{ rotate: 15, scale: 1.1 }}
                          transition={{ type: "spring", stiffness: 400, damping: 17 }}
                          className={`flex h-12 w-12 items-center justify-center rounded-2xl backdrop-blur-sm border group-hover:shadow-glow ${getIconContainerClasses(group.main.type)}`}
                        >
                          {getActivityIcon(group.main.type)}
                        </motion.div>
                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(group.main.timestamp)}
                        </div>
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-1">
                        {group.main.title}
                      </h3>
                      <p className="text-xs text-gray-500 line-clamp-2">
                        {group.main.description}
                      </p>
                      {/* Indicator for related activities */}
                      {group.related.length > 0 && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200/30">
                          <div className="flex -space-x-1.5">
                            {group.related.slice(0, 3).map((activity, idx) => (
                              <div
                                key={activity.id}
                                className={`h-5 w-5 rounded-full border-2 border-white flex items-center justify-center ${activity.type === "upload" ? "bg-purple-100" : activity.type === "goals" ? "bg-amber-100" : activity.type === "analysis" ? "bg-emerald-100" : "bg-blue-100"
                                  }`}
                                style={{ zIndex: 3 - idx }}
                              >
                                {getActivityIcon(activity.type, true)}
                              </div>
                            ))}
                          </div>
                          <span className="text-[10px] text-gray-500">+{group.related.length} more</span>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </>
              ) : (
                // Fallback when no activities
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  whileHover={{
                    scale: 1.02,
                    y: -8,
                    transition: { type: "spring", stiffness: 300, damping: 20 }
                  }}
                  className="group rounded-3xl glass-card p-6 ring-1 ring-white/20 hover:shadow-2xl hover:shadow-blue-500/10 hover:ring-white/40 transition-all duration-300 cursor-pointer border border-white/10 hover:border-white/30"
                  onClick={() => router.push("/setup")}
                >
                  <div className="flex items-center justify-between mb-5">
                    <motion.div
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                      className="flex h-12 w-12 items-center justify-center rounded-2xl backdrop-blur-sm border bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-blue-400/30 group-hover:shadow-glow group-hover:shadow-blue-500/30"
                    >
                      <Plus className="h-6 w-6 text-blue-400 group-hover:text-blue-300 transition-colors duration-300" />
                    </motion.div>
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                      START NOW
                    </div>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Get started with your analysis
                  </h3>
                  <p className="text-xs text-gray-500">
                    Upload your spend data and run an analysis to see savings opportunities.
                  </p>
                </motion.div>
              )}
              </div>

              {/* Popup Modal for related activities */}
              <AnimatePresence>
                {selectedActivityGroup && (
                  <>
                    {/* Backdrop */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                      onClick={() => setSelectedActivityGroup(null)}
                    />
                    {/* Popup */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md mx-4"
                    >
                      <div className="glass-card rounded-3xl p-6 shadow-2xl border border-white/30 bg-white/95 backdrop-blur-xl max-h-[80vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-5">
                          <h3 className="text-sm font-semibold text-gray-900">Related Activity</h3>
                          <button
                            onClick={() => setSelectedActivityGroup(null)}
                            className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                          >
                            <X className="h-4 w-4 text-gray-500" />
                          </button>
                        </div>

                        {/* Activity cards */}
                        <div className="space-y-3">
                          {groupedActivities
                            .find(g => g.main.id === selectedActivityGroup)
                            ?.related.map((activity, index) => (
                              <motion.div
                                key={activity.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, delay: index * 0.1 }}
                                className="group rounded-2xl p-4 ring-1 ring-gray-200/50 hover:ring-gray-300/50 hover:shadow-lg transition-all duration-200 bg-white/50"
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${activity.type === "upload"
                                    ? "bg-purple-500/10 border-purple-400/30"
                                    : activity.type === "goals"
                                      ? "bg-amber-500/10 border-amber-400/30"
                                      : activity.type === "analysis"
                                        ? "bg-emerald-500/10 border-emerald-400/30"
                                        : "bg-blue-500/10 border-blue-400/30"
                                    }`}>
                                    {getActivityIcon(activity.type, false)}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                                    <Clock className="h-3 w-3" />
                                    {formatRelativeTime(activity.timestamp)}
                                  </div>
                                </div>
                                <h4 className="text-sm font-medium text-gray-800 mb-1">
                                  {activity.title}
                                </h4>
                                <p className="text-xs text-gray-500">
                                  {activity.description}
                                </p>
                              </motion.div>
                            ))}
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

          </main>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
