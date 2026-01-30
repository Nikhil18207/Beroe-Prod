"use client";

import { motion } from "framer-motion";
import {
  Home,
  Activity,
  ShieldCheck,
  Search,
  Plus,
  ChevronDown,
  Settings2,
  ArrowUpDown,
  CheckCircle2,
  ExternalLink,
  Menu,
  Pencil,
  AlertTriangle,
  Users,
  Send,
  Mic
} from "lucide-react";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";

// Initiative recommendations for each opportunity type
const OPPORTUNITY_INITIATIVES: Record<string, Array<{
  title: string;
  type: "Savings" | "Resilience";
  impactLabel?: string;
  effort: string;
  risk?: string;
  esg?: string;
}>> = {
  "volume-bundling": [
    { title: "Consolidate demands across sites to leverage economies of scale", type: "Savings", effort: "3-6 months", risk: "-2", esg: "0" },
    { title: "Consider volume consolidation for better discounts", type: "Savings", effort: "3-6 months", risk: "-2", esg: "0" },
    { title: "Bundle similar categories to increase negotiating leverage", type: "Savings", effort: "6-12 months", risk: "-1", esg: "0" },
  ],
  "target-pricing": [
    { title: "Use cost model driven pricing mechanisms", type: "Savings", effort: "3-6 months", risk: "-2", esg: "0" },
    { title: "Implement should-cost analysis for key items", type: "Savings", effort: "3-6 months", risk: "-1", esg: "0" },
    { title: "Adjust sourcing mix to minimize tariff impact", type: "Resilience", impactLabel: "Risk Reduction", effort: "3-6 months", esg: "-2" },
  ],
  "risk-management": [
    { title: "Explore adding new suppliers to reduce supplier risk", type: "Resilience", impactLabel: "Risk Reduction", effort: "3-6 months", esg: "-2" },
    { title: "Standardize payment terms across suppliers to 60 days", type: "Resilience", impactLabel: "Risk Reduction", effort: "3-6 months", esg: "-2" },
    { title: "Develop contingency sourcing plans for high-risk regions", type: "Resilience", impactLabel: "Risk Reduction", effort: "6-12 months", esg: "-1" },
  ],
  "respec-pack": [
    { title: "Rationalize SKUs to reduce low value/volume items", type: "Savings", effort: "3-6 months", risk: "-1", esg: "0" },
    { title: "Standardize specifications across regions", type: "Savings", effort: "6-12 months", risk: "0", esg: "+1" },
  ],
};

export default function OpportunitiesPage() {
  const { state } = useApp();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("All");
  const [chatInput, setChatInput] = useState("");

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      router.push(`/chat?q=${encodeURIComponent(chatInput)}`);
    }
  };

  // Get data from context
  const savingsSummary = state.savingsSummary;
  const setupOpportunities = state.setupOpportunities;
  const categoryName = state.setupData.categoryName?.toUpperCase() || "CATEGORY";
  const totalSpend = state.portfolioItems.length > 0
    ? state.portfolioItems.reduce((sum, item) => sum + item.spend, 0)
    : state.setupData.spend || 0;

  // Generate opportunities from setupOpportunities (4 main opportunities with proof points)
  const generatedOpportunities: Array<{
    id: string;
    category: string;
    title: string;
    opportunityName: string;
    type: "Savings" | "Resilience";
    impactLabel?: string;
    impact: "High" | "Medium" | "Low";
    effort: string;
    risk?: string;
    esg?: string;
    savings?: string;
    confidence: number;
    status: "Qualified" | "Potential";
    isNew: boolean;
    questionsToAnswer: number;
    badge?: string;
    savings_low?: number;
    savings_high?: number;
  }> = [];

  // Process each of the 4 main opportunities
  setupOpportunities.forEach(opp => {
    const validatedCount = opp.proofPoints.filter(pp => pp.isValidated).length;
    const totalPoints = opp.proofPoints.length;
    const validationRatio = totalPoints > 0 ? validatedCount / totalPoints : 0;
    const confidence = Math.round(validationRatio * 100);

    // Qualified = 3+ proof points validated, Potential = <3
    const status: "Qualified" | "Potential" = validatedCount >= 3 ? "Qualified" : "Potential";

    // Determine impact based on validation ratio
    const impact: "High" | "Medium" | "Low" =
      validationRatio >= 0.7 ? "High" :
      validationRatio >= 0.4 ? "Medium" : "Low";

    // Get initiatives for this opportunity type
    const initiatives = OPPORTUNITY_INITIATIVES[opp.id] || [];

    // Parse savings percentage from potentialSavings string (e.g., "0-5%", "1-2%")
    const savingsMatch = opp.potentialSavings.match(/(\d+)-(\d+)%/);
    const lowPct = savingsMatch ? parseInt(savingsMatch[1]) / 100 : 0;
    const highPct = savingsMatch ? parseInt(savingsMatch[2]) / 100 : 0;

    // Calculate actual savings based on total spend and validation
    const addressableSpend = totalSpend * 0.8; // 80% addressable
    const savings_low = Math.round(addressableSpend * lowPct * validationRatio);
    const savings_high = Math.round(addressableSpend * highPct * validationRatio);

    // Generate opportunities from initiatives
    initiatives.forEach((init, idx) => {
      generatedOpportunities.push({
        id: `${opp.id}-init-${idx}`,
        category: categoryName,
        title: init.title,
        opportunityName: opp.name,
        type: init.type,
        impactLabel: init.impactLabel,
        impact,
        effort: init.effort,
        risk: init.risk,
        esg: init.esg,
        savings: init.type === "Resilience" ? "Low" : undefined,
        confidence: Math.max(confidence, 40), // Minimum 40% confidence if any data
        status,
        isNew: true,
        questionsToAnswer: totalPoints - validatedCount,
        savings_low,
        savings_high,
      });
    });
  });

  // Calculate totals
  const totalSavingsLow = savingsSummary?.total_savings_low ||
    generatedOpportunities.reduce((sum, o) => sum + (o.savings_low || 0), 0) / 3; // Divide by avg initiatives per opp
  const totalSavingsHigh = savingsSummary?.total_savings_high ||
    generatedOpportunities.reduce((sum, o) => sum + (o.savings_high || 0), 0) / 3;

  const avgConfidence = generatedOpportunities.length > 0
    ? Math.round(generatedOpportunities.reduce((sum, o) => sum + o.confidence, 0) / generatedOpportunities.length)
    : 0;
  const confidenceScore = savingsSummary?.confidence_score
    ? Math.round(savingsSummary.confidence_score * 100)
    : avgConfidence || 0;

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
      <div className="relative z-20 flex w-16 flex-col items-center border-r border-white/20 bg-white/40 py-6 backdrop-blur-xl shrink-0">
        {/* Logo */}
        <Link href="/dashboard" className="mb-8 flex h-11 w-11 items-center justify-center rounded-2xl overflow-hidden shadow-lg">
          <div className="h-full w-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
            <div className="h-5 w-5 rounded-full bg-white/30 backdrop-blur-sm" />
          </div>
        </Link>

        {/* Main Navigation */}
        <div className="flex flex-col gap-5 text-gray-400">
          {/* Home */}
          <Link href="/dashboard" className="p-2.5 rounded-xl hover:bg-white/50 transition-colors cursor-pointer">
            <Home className="h-5 w-5" strokeWidth={1.5} />
          </Link>
          {/* Activity/Today */}
          <Link href="/today" className="p-2.5 rounded-xl hover:bg-white/50 transition-colors cursor-pointer">
            <Activity className="h-5 w-5" strokeWidth={1.5} />
          </Link>
          {/* Shield/Opportunities - Active */}
          <div className="p-2.5 rounded-xl bg-white shadow-sm text-blue-600 ring-1 ring-black/5 transition-colors cursor-pointer">
            <ShieldCheck className="h-5 w-5" strokeWidth={1.5} />
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="mt-auto flex flex-col gap-5 text-gray-400">
          {/* Search */}
          <div className="p-2.5 rounded-xl hover:bg-white/50 transition-colors cursor-pointer">
            <Search className="h-5 w-5" strokeWidth={1.5} />
          </div>
          {/* Users/Team */}
          <div className="p-2.5 rounded-xl hover:bg-white/50 transition-colors cursor-pointer">
            <Users className="h-5 w-5" strokeWidth={1.5} />
          </div>
          {/* User Avatar */}
          <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-white text-sm font-semibold cursor-pointer hover:bg-gray-800 transition-colors">
            N
          </Link>
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
          <main className="px-16 py-8 pb-32">

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
                  <span className="text-2xl font-semibold text-gray-800">{displayQualified.length} Qualified opportunities,</span>
                </div>

                <span className="text-2xl text-gray-700">&</span>

                {/* Potential Badge */}
                <div className="flex items-center gap-2 bg-gray-100/80 rounded-full px-4 py-2 ring-1 ring-gray-200">
                  <div className="h-5 w-5 rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center">
                    <div className="h-1.5 w-1.5 bg-gray-400 rounded-full" />
                  </div>
                  <span className="text-2xl font-semibold text-gray-800">{displayPotential.length} Potential opportunities,</span>
                </div>
              </div>

              {/* Savings Line */}
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-2xl text-gray-700">Based on this your savings:</span>
                <span className="text-2xl font-bold text-gray-900">{formatCurrency(totalSavingsLow)} - {formatCurrency(totalSavingsHigh)} USD</span>
                <span className="text-lg text-gray-400">{savingsPercentageLow}% - {savingsPercentageHigh}%</span>
              </div>

              {/* Help Text */}
              <p className="text-sm text-gray-400 mb-5">
                Want to get a more precise savings estimate and narrow down that range?{" "}
                <span className="text-gray-600 font-medium">Answer the questions</span>{" "}
                against the opportunities.
              </p>

              {/* Confidence & Addressable Spend */}
              <div className="flex items-center gap-10">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Confidence level:</span>
                  <span className="font-bold text-gray-900">{confidenceScore}%</span>
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
                    className={`relative text-lg font-medium transition-colors ${
                      activeTab === tab.name ? "text-gray-900" : "text-gray-300 hover:text-gray-500"
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
                  {displayQualified.length}
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>

              {/* Dashed line separator */}
              <div className="border-t border-dashed border-gray-200 mb-6" />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {displayQualified.map((opp, idx) => (
                  <OpportunityCard key={idx} opportunity={opp} variant="qualified" />
                ))}
              </div>
            </section>

            {/* Potential Section */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-base font-semibold text-gray-900">Potential</h2>
                <div className="bg-gray-900 text-white text-xs font-bold h-6 w-6 flex items-center justify-center rounded-full">
                  {displayPotential.length}
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>

              {/* Dashed line separator */}
              <div className="border-t border-dashed border-gray-200 mb-6" />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {displayPotential.map((opp, idx) => (
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

function OpportunityCard({ opportunity: opp, variant }: { opportunity: any; variant: "qualified" | "potential" }) {
  const router = useRouter();
  const isImpacted = opp.badge === "Impacted";
  const isPotential = variant === "potential";
  const isResilience = opp.type === "Resilience";

  const handleClick = () => {
    // Extract opportunity type and initiative index from the ID (e.g., "volume-bundling-init-0")
    const parts = opp.id.split("-init-");
    const oppType = parts[0]; // e.g., "volume-bundling"
    const initIndex = parts[1] || "0"; // e.g., "0"
    router.push(`/opportunities/details?opp=${oppType}&init=${initIndex}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
      onClick={handleClick}
      className={`group relative flex flex-col rounded-3xl p-5 transition-all hover:shadow-xl hover:-translate-y-1 cursor-pointer overflow-visible ${
        isImpacted
          ? 'bg-amber-50/90 ring-1 ring-amber-200/50'
          : 'bg-white ring-1 ring-gray-100'
      }`}
    >
      {/* Top Badges - positioned outside card */}
      <div className="absolute -top-3 right-4 flex gap-2">
        {opp.isNew && (
          <div className="rounded-full bg-fuchsia-500 px-3 py-1 text-[10px] font-bold text-white shadow-md">
            New
          </div>
        )}
        {isImpacted && (
          <div className="rounded-full bg-orange-500 px-3 py-1 text-[10px] font-bold text-white shadow-md">
            Impacted
          </div>
        )}
      </div>

      {/* Header Row */}
      <div className="flex items-start justify-between mb-4 mt-1">
        <div className="flex items-center gap-2">
          {/* Icon */}
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${
            isImpacted ? 'bg-amber-100' : isPotential ? 'bg-gray-100' : 'bg-emerald-50'
          }`}>
            {isImpacted ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <AlertTriangle className="h-3 w-3 text-amber-500 absolute ml-4 mt-3" />
              </>
            ) : isPotential ? (
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
          <div className={`rounded-md px-2.5 py-1 text-[10px] font-semibold ${
            isResilience ? 'bg-gray-100 text-gray-600' : 'bg-gray-100 text-gray-600'
          }`}>
            {isResilience ? "Resilience" : "Savings"}
          </div>
          <div className={`rounded-md px-2.5 py-1 text-[10px] font-semibold ${
            isPotential
              ? 'bg-orange-100 text-orange-600 ring-1 ring-orange-200'
              : 'bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200'
          }`}>
            {opp.status}
          </div>
        </div>
      </div>

      {/* Category & Title */}
      <div className="mb-4">
        <span className="text-[10px] font-bold text-gray-400 tracking-wider block mb-1.5">
          {opp.category}
        </span>
        <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 min-h-[2.5rem]">
          {opp.title}
        </h3>
      </div>

      {/* Metrics Box */}
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50/80 p-3.5 mb-4">
        <div>
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide block mb-0.5">
            {opp.impactLabel || (isResilience ? "Risk Reduction" : "Savings Impact")}
          </span>
          <span className="text-sm font-bold text-gray-900">{opp.impact}</span>
        </div>
        <div>
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide block mb-0.5">
            Effort
          </span>
          <span className="text-sm font-bold text-gray-900">{opp.effort}</span>
        </div>
        {opp.risk !== undefined && (
          <div>
            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide block mb-0.5">
              Risk
            </span>
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-gray-900">{opp.risk}</span>
              <ChevronDown className="h-3 w-3 text-red-500" />
            </div>
          </div>
        )}
        {opp.esg !== undefined && (
          <div>
            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide block mb-0.5">
              ESG
            </span>
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-gray-900">{opp.esg}</span>
              <span className="text-gray-400 text-xs">~</span>
            </div>
          </div>
        )}
        {opp.savings !== undefined && (
          <div>
            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide block mb-0.5">
              Savings
            </span>
            <span className="text-sm font-bold text-gray-900">{opp.savings}</span>
          </div>
        )}
      </div>

      {/* Confidence Score */}
      {isImpacted ? (
        <div className="bg-white rounded-xl p-3.5 ring-1 ring-gray-100 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">
              Initiative Confidence Score:
            </span>
            <span className="text-sm font-bold text-orange-500">{opp.confidence}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${opp.confidence}%` }}
              viewport={{ once: true }}
              className="h-full bg-orange-400 rounded-full"
            />
          </div>
        </div>
      ) : (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">
              Initiative Confidence Score:
            </span>
            <span className="text-sm font-bold text-gray-900">{opp.confidence}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${opp.confidence}%` }}
              viewport={{ once: true }}
              className="h-full bg-gray-300 rounded-full"
            />
          </div>
        </div>
      )}

      {/* Impacted Message */}
      {isImpacted && (
        <div className="mb-3">
          <p className="text-[11px] text-gray-500 leading-relaxed mb-2">
            This action is still valid, however the confidence level and the savings impact has been modified
          </p>
          <button className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 hover:text-gray-900 transition-colors">
            Show the alert impacting this opportunity
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Potential Card Message */}
      {isPotential && (
        <div className="mb-3">
          <p className="text-[11px] text-gray-500 leading-relaxed">
            To get a better confidence on the savings and narrow down the savings range, you can answer a few questions to uncover the potential opportunities:
          </p>
        </div>
      )}

      {/* Questions Footer */}
      <div className="flex items-center gap-2 mt-auto pt-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 p-[1.5px]">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-white">
            <div className="h-2 w-2 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400" />
          </div>
        </div>
        <span className="text-[11px] text-gray-400">
          {opp.questionsToAnswer || 2} question to be answered
        </span>
      </div>
    </motion.div>
  );
}
