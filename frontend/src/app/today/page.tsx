"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Activity,
  ShieldCheck,
  Search,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Layers,
  FileText,
  BarChart3,
  Zap,
  Menu,
  Plus,
  Mic,
  Users,
  Send
} from "lucide-react";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";

// Sample notification data
const todayInsights = {
  areasNeedingAttention: 3,
  newOpportunities: 6
};

// Sample opportunities for hover preview
const newOpportunities = [
  {
    id: "1",
    title: "Consolidate Spend with Top Performers",
    category: "CORRUGATE",
    impact: "High",
    savings: "$450K - $680K",
    confidence: 78,
    description: "Consolidate 60% of corrugate spend with top 3 suppliers to achieve volume discounts of 8-12%.",
    isNew: true
  },
  {
    id: "2",
    title: "Renegotiate Expiring Contracts",
    category: "STEEL",
    impact: "Medium",
    savings: "$320K - $480K",
    confidence: 65,
    description: "3 contracts expiring in Q2 present opportunity for better terms based on market conditions.",
    isNew: true
  },
  {
    id: "3",
    title: "Supplier ESG Compliance Gap",
    category: "PACKAGING",
    impact: "High",
    savings: "Risk Reduction",
    confidence: 82,
    description: "2 tier-1 suppliers have expiring ESG certifications that need immediate attention.",
    isNew: true
  }
];

// Areas needing attention
const attentionAreas = [
  {
    id: "1",
    type: "alert",
    title: "Contract Performance Drift",
    description: "Packaging Materials Corp showing 15% delivery delays",
    severity: "high"
  },
  {
    id: "2",
    type: "warning",
    title: "Price Index Change",
    description: "Steel commodity prices up 8% this month",
    severity: "medium"
  },
  {
    id: "3",
    type: "info",
    title: "Supplier Risk Update",
    description: "AgroPure Ltd. ESG certification expires in 30 days",
    severity: "low"
  }
];

// Recent flows data
const recentFlows = [
  {
    id: "1",
    title: "Freight Consolidation Savings in Asia Ro...",
    description: "Max identified fragmented shipments between...",
    time: "2 hours ago",
    icon: "layers"
  },
  {
    id: "2",
    title: "Expiring Supplier ESG Certification",
    description: "One of your tier-1 suppliers, AgroPure Ltd., has a...",
    time: "2 days ago",
    icon: "file"
  },
  {
    id: "3",
    title: "Contract Performance Drift – Packaging...",
    description: "Max flagged declining performance trends in a k...",
    time: "Last week",
    icon: "chart"
  }
];

// Yesterday's items
const yesterdayItems = [
  {
    id: "1",
    title: "Market Intelligence Update",
    description: "New data on corrugate pricing trends in APAC region",
    time: "Yesterday"
  },
  {
    id: "2",
    title: "Supplier Scorecard Review",
    description: "Q4 performance scores ready for review",
    time: "Yesterday"
  }
];

export default function TodayPage() {
  const { state } = useApp();
  const router = useRouter();
  const [hoveredOpportunity, setHoveredOpportunity] = useState<typeof newOpportunities[0] | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [chatInput, setChatInput] = useState("");

  const userName = state.user?.name || "User";

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      // Navigate to chat page with the query
      router.push(`/chat?q=${encodeURIComponent(chatInput)}`);
    }
  };

  const handleOpportunityHover = (opp: typeof newOpportunities[0], e: React.MouseEvent) => {
    setHoveredOpportunity(opp);
    setHoverPosition({ x: e.clientX, y: e.clientY });
  };

  const getFlowIcon = (iconType: string) => {
    switch (iconType) {
      case "layers":
        return <Layers className="h-5 w-5 text-blue-500" />;
      case "file":
        return <FileText className="h-5 w-5 text-purple-500" />;
      case "chart":
        return <BarChart3 className="h-5 w-5 text-emerald-500" />;
      default:
        return <Zap className="h-5 w-5 text-gray-500" />;
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
          {/* Activity/Today - Active */}
          <div className="p-2.5 rounded-xl bg-white shadow-sm text-blue-600 ring-1 ring-black/5 transition-colors cursor-pointer">
            <Activity className="h-5 w-5" strokeWidth={1.5} />
          </div>
          {/* Shield/Opportunities */}
          <Link href="/opportunities" className="p-2.5 rounded-xl hover:bg-white/50 transition-colors cursor-pointer">
            <ShieldCheck className="h-5 w-5" strokeWidth={1.5} />
          </Link>
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
              placeholder="What can I help you with today?"
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

            {/* Today Header */}
            <div className="flex items-center gap-3 mb-10">
              <h1 className="text-4xl font-medium text-gray-900">Today</h1>
              <ArrowUpRight className="h-6 w-6 text-gray-400" />
            </div>

            {/* Main Insights Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 ring-1 ring-gray-100 shadow-sm mb-10"
            >
              <div className="flex items-start justify-between mb-8">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-100 to-amber-100">
                      <AlertCircle className="h-5 w-5 text-orange-500" />
                    </div>
                    <span className="text-lg font-semibold text-gray-900">
                      {todayInsights.areasNeedingAttention} areas needing attention
                    </span>
                  </div>

                  {/* Attention Items */}
                  <div className="space-y-3 ml-13">
                    {attentionAreas.map((area) => (
                      <div
                        key={area.id}
                        className="flex items-center gap-3 text-sm text-gray-600 hover:text-gray-900 cursor-pointer transition-colors"
                      >
                        <div className={`h-2 w-2 rounded-full ${
                          area.severity === "high" ? "bg-red-500" :
                          area.severity === "medium" ? "bg-amber-500" : "bg-blue-500"
                        }`} />
                        <span>{area.title}</span>
                        <ChevronRight className="h-4 w-4 text-gray-300" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-green-100">
                      <TrendingUp className="h-5 w-5 text-emerald-500" />
                    </div>
                    <span className="text-lg font-semibold text-gray-900">
                      {todayInsights.newOpportunities} new opportunities
                    </span>
                  </div>
                </div>
              </div>

              {/* Category Status Icons */}
              <div className="flex items-center gap-3 pt-6 border-t border-gray-100">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mr-4">Categories</span>
                <div className="flex items-center gap-2">
                  {/* Orange alert icons */}
                  <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center">
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center">
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                  </div>
                  {/* Green checkmark icons */}
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                  {/* Gray neutral icons */}
                  <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center">
                    <div className="h-3 w-3 rounded-full bg-gray-300" />
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center">
                    <div className="h-3 w-3 rounded-full bg-gray-300" />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* New Opportunities Preview */}
            <div className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">New Opportunities</h2>
                <Link
                  href="/opportunities"
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                >
                  View all
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {newOpportunities.map((opp) => (
                  <motion.div
                    key={opp.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    onMouseEnter={(e) => handleOpportunityHover(opp, e)}
                    onMouseLeave={() => setHoveredOpportunity(null)}
                    onClick={() => router.push("/opportunities/details")}
                    className="group relative rounded-2xl bg-white p-5 ring-1 ring-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer"
                  >
                    {/* New Badge */}
                    {opp.isNew && (
                      <div className="absolute -top-2 right-4 rounded-full bg-fuchsia-500 px-3 py-0.5 text-[10px] font-bold text-white shadow-md">
                        New
                      </div>
                    )}

                    <div className="flex items-start justify-between mb-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          opp.impact === "High"
                            ? "bg-emerald-100 text-emerald-600"
                            : "bg-amber-100 text-amber-600"
                        }`}>
                          {opp.impact}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold text-gray-400 tracking-wider block mb-1.5">
                      {opp.category}
                    </span>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2 min-h-[2.5rem]">
                      {opp.title}
                    </h3>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{opp.savings}</span>
                      <span className="font-medium">{opp.confidence}% confidence</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Recent Flows Section */}
            <div className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Recent Flows</h2>
                <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  View all
                  <ArrowUpRight className="h-4 w-4 rotate-[-45deg]" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {recentFlows.map((flow) => (
                  <motion.div
                    key={flow.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="rounded-2xl bg-white p-5 ring-1 ring-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                        {getFlowIcon(flow.icon)}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                        <Clock className="h-3 w-3" />
                        {flow.time}
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-1">
                      {flow.title}
                    </h3>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {flow.description}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Yesterday Section */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-base font-medium text-gray-400">Yesterday</h2>
                <div className="flex-1 border-t border-dashed border-gray-200" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {yesterdayItems.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="flex items-center gap-4 rounded-xl bg-white/60 p-4 ring-1 ring-gray-100/50 hover:bg-white hover:ring-gray-100 transition-all cursor-pointer"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                      <FileText className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-700 truncate">
                        {item.title}
                      </h4>
                      <p className="text-xs text-gray-400 truncate">
                        {item.description}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
                  </motion.div>
                ))}
              </div>
            </div>

          </main>
        </div>
      </div>

      {/* Hover Preview Card */}
      <AnimatePresence>
        {hoveredOpportunity && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed z-50 w-80 rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-gray-200"
            style={{
              left: Math.min(hoverPosition.x + 20, window.innerWidth - 340),
              top: Math.min(hoverPosition.y - 100, window.innerHeight - 300)
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded ${
                hoveredOpportunity.impact === "High"
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-amber-100 text-amber-600"
              }`}>
                {hoveredOpportunity.impact} Impact
              </span>
            </div>

            <span className="text-[10px] font-bold text-gray-400 tracking-wider block mb-1">
              {hoveredOpportunity.category}
            </span>
            <h3 className="text-base font-semibold text-gray-900 mb-3">
              {hoveredOpportunity.title}
            </h3>

            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              {hoveredOpportunity.description}
            </p>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <div>
                <span className="text-[10px] font-medium text-gray-400 uppercase block">Potential Savings</span>
                <span className="text-sm font-bold text-gray-900">{hoveredOpportunity.savings}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-medium text-gray-400 uppercase block">Confidence</span>
                <span className="text-sm font-bold text-emerald-600">{hoveredOpportunity.confidence}%</span>
              </div>
            </div>

            <button
              onClick={() => router.push("/opportunities/details")}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-black transition-colors"
            >
              View Details
              <ChevronRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
