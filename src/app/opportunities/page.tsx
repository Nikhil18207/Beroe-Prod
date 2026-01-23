"use client";

import { motion } from "framer-motion";
import { 
  Home,
  Activity,
  ShieldCheck,
  Search,
  User,
  LogOut,
  Plus,
  Mic,
  Menu,
  ChevronDown,
  Settings2,
  ArrowUpDown,
  CheckCircle2,
  Info,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import React from "react";
import Link from "next/link";

const qualifiedOpportunities = [
  {
    category: "CORRUGATE",
    title: "Use cost model driven pricing mechanisms",
    type: "Savings",
    impact: "High",
    effort: "3-6 months",
    risk: "-2",
    esg: "0",
    confidence: 65,
    status: "Qualified",
    isNew: true
  },
  {
    category: "CORRUGATE",
    title: "Consider Volume consolidation for better discounts",
    type: "Savings",
    impact: "Medium",
    effort: "3-6 months",
    risk: "-2",
    esg: "0",
    confidence: 65,
    status: "Qualified",
    isNew: true
  },
  {
    category: "CORRUGATE",
    title: "Adjust sourcing mix to minimise tariff impact",
    type: "Resilience",
    impact: "High",
    effort: "3-6 months",
    esg: "-2",
    savings: "Low",
    confidence: 65,
    status: "Qualified"
  },
  {
    category: "STEEL",
    title: "Explore adding new suppliers to reduce supplier risk",
    type: "Resilience",
    impact: "High",
    effort: "3-6 months",
    esg: "-2",
    savings: "Low",
    confidence: 65,
    status: "Qualified",
    badge: "Impacted"
  },
  {
    category: "CORRUGATE",
    title: "Standardise payment terms across suppliers to 60 days",
    type: "Risk Reduction",
    impact: "High",
    effort: "3-6 months",
    esg: "-2",
    savings: "Low",
    confidence: 65,
    status: "Qualified"
  }
];

const potentialOpportunities = [
  {
    category: "STEEL",
    title: "Rationalise corrugate SKUs to reduce low value/ volume items",
    type: "Savings",
    impact: "High",
    effort: "3-6 months",
    confidence: 65,
    status: "Potential",
    isNew: true
  },
  {
    category: "STEEL",
    title: "Consolidate demands across sites to leverage economies of scale",
    type: "Savings",
    impact: "High",
    effort: "3-6 months",
    confidence: 65,
    status: "Potential",
    isNew: true
  }
];

export default function OpportunitiesPage() {
  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-[#F8FBFE]">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-b from-[#E0F2FE]/40 via-[#F8FBFE] to-white" />
        
        {/* Yellow Building Detail */}
        <div className="absolute bottom-[-15%] left-[-5%] z-0 h-[60%] w-[50%] rotate-[-10deg] overflow-hidden border-t-[12px] border-white/40 bg-[#EAB308] shadow-2xl opacity-50">
           <div className="absolute inset-0 flex flex-col space-y-8 pt-16">
             {Array.from({ length: 20 }).map((_, i) => (
               <div key={i} className="h-[1px] w-full bg-black/5" />
             ))}
           </div>
        </div>
      </div>

      {/* Left Icon Sidebar */}
      <div className="relative z-20 flex w-16 flex-col items-center border-r border-gray-200/40 bg-white/30 py-8 backdrop-blur-xl shrink-0">
        <Link href="/dashboard" className="mb-12 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
           <div className="h-full w-full bg-gradient-to-tr from-blue-500 via-purple-500 to-indigo-500 opacity-80" />
        </Link>
        
        <div className="flex flex-col gap-8 text-gray-400">
           <Link href="/dashboard" className="p-2 rounded-lg hover:bg-black/5 transition-colors cursor-pointer">
             <Home className="h-6 w-6" />
           </Link>
           <div className="p-2 rounded-lg hover:bg-black/5 transition-colors cursor-pointer">
             <Activity className="h-6 w-6" />
           </div>
           <div className="p-2 rounded-lg bg-white shadow-sm text-blue-600 ring-1 ring-black/5 transition-colors cursor-pointer">
             <ShieldCheck className="h-6 w-6" />
           </div>
        </div>

        <div className="mt-auto flex flex-col gap-8 text-gray-400">
           <div className="p-2 rounded-lg hover:bg-black/5 transition-colors cursor-pointer">
             <Search className="h-6 w-6" />
           </div>
           <div className="p-2 rounded-lg hover:bg-black/5 transition-colors cursor-pointer">
             <User className="h-6 w-6" />
           </div>
           <div className="p-2 rounded-lg hover:bg-black/5 transition-colors cursor-pointer">
             <LogOut className="h-6 w-6" />
           </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        
        {/* Top Search Bar */}
        <header className="flex h-16 items-center justify-between px-8 bg-transparent">
          <div className="flex items-center gap-4 flex-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-blue-400 to-purple-400 p-[1px]">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-white">
                 <div className="h-3 w-3 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400" />
              </div>
            </div>
            <button className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
              <Plus className="h-4 w-4" />
            </button>
            <div className="text-sm font-medium text-blue-900/80">
              Show me all opportunities involving Europe
            </div>
          </div>

          <div className="flex items-center gap-6 text-gray-400">
            <Menu className="h-5 w-5 hover:text-gray-600 cursor-pointer" />
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <main className="px-20 py-10 pb-32">
            
            {/* Opportunities Header */}
            <div className="mb-12">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4 block">Opportunities</span>
              
              <div className="flex items-center gap-2 mb-6 text-sm font-medium text-gray-800">
                Category: <span className="text-gray-900">All</span> <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-3xl text-gray-800 font-medium">
                  You have 
                  <div className="flex items-center gap-2 bg-blue-50/50 rounded-full px-4 py-1.5 ring-1 ring-blue-100/50">
                    <CheckCircle2 className="h-6 w-6 text-blue-500" />
                    <span className="text-gray-900">5 Qualified opportunities, &</span>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50/50 rounded-full px-4 py-1.5 ring-1 ring-gray-200/50">
                    <div className="h-6 w-6 rounded-md border-2 border-gray-300 flex items-center justify-center">
                       <div className="h-1 w-1 bg-gray-300 rounded-full" />
                    </div>
                    <span className="text-gray-900">2 Potential opportunities,</span>
                  </div>
                </div>

                <div className="flex items-baseline gap-4">
                  <h1 className="text-3xl font-medium text-gray-800">
                    Based on this your savings: <span className="font-bold text-black">$1.9M - $3M USD</span>
                  </h1>
                  <span className="text-lg text-gray-400">7% - 12%</span>
                </div>

                <p className="text-sm text-gray-400/80 max-w-2xl">
                  Want to get a more precise savings estimate and narrow down that range? <span className="text-gray-600 font-medium">Answer the questions against the opportunities.</span>
                </p>

                <div className="flex items-center gap-12 pt-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                    Confidence level: <span className="font-bold">80%</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                    Addressable Spend: <span className="font-bold">100%</span>
                    <button className="text-gray-400 hover:text-gray-600 transition-colors">
                      <Settings2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs & Filters */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-8">
              <div className="flex items-center gap-8">
                {["All", "Qualified", "Potential", "New", "Accepted"].map((tab, i) => (
                  <button key={tab} className={`relative text-lg font-medium transition-colors ${i === 0 ? "text-gray-900" : "text-gray-300 hover:text-gray-500"}`}>
                    {tab}
                    <span className="absolute -top-1.5 -right-3 text-[10px] font-bold opacity-60">
                      {i === 0 ? 7 : i === 1 ? 5 : i === 2 ? 2 : i === 3 ? 4 : 0}
                    </span>
                    {i === 0 && <motion.div layoutId="tab-underline" className="absolute -bottom-4 left-0 right-0 h-0.5 bg-gray-900" />}
                  </button>
                ))}
                <ChevronDown className="h-5 w-5 text-gray-300 cursor-pointer" />
              </div>

              <div className="flex items-center gap-6 text-gray-400">
                <button className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
                  <Settings2 className="h-5 w-5" />
                </button>
                <button className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
                  <ArrowUpDown className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Qualified Section */}
            <section className="mb-20">
              <div className="flex items-center gap-3 mb-8">
                <h2 className="text-lg font-bold text-gray-900">Qualified</h2>
                <div className="bg-black text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full">5</div>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {qualifiedOpportunities.map((opp, idx) => (
                  idx === 0 ? (
                    <Link key={idx} href="/opportunities/details">
                      <OpportunityCard opportunity={opp} />
                    </Link>
                  ) : (
                    <OpportunityCard key={idx} opportunity={opp} />
                  )
                ))}
              </div>
            </section>

            {/* Potential Section */}
            <section>
              <div className="flex items-center gap-3 mb-8">
                <h2 className="text-lg font-bold text-gray-900">Potential</h2>
                <div className="bg-black text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full">2</div>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {potentialOpportunities.map((opp, idx) => (
                  <OpportunityCard key={idx} opportunity={opp} />
                ))}
              </div>
            </section>

          </main>
        </div>
      </div>
    </div>
  );
}

function OpportunityCard({ opportunity: opp }: { opportunity: any }) {
  const isImpacted = opp.badge === "Impacted";
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`group relative flex flex-col rounded-3xl p-6 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 cursor-pointer overflow-hidden ${isImpacted ? 'bg-[#FFFBEB] ring-1 ring-yellow-200' : 'bg-white ring-1 ring-black/5'}`}
    >
      {/* Badges */}
      <div className="absolute top-0 right-0 p-4 flex gap-2">
        {opp.isNew && (
          <div className="rounded-full bg-purple-500 px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
            New
          </div>
        )}
        {opp.badge && (
          <div className="rounded-full bg-orange-500 px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
            {opp.badge}
          </div>
        )}
      </div>

      <div className="flex items-start justify-between mb-8">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isImpacted ? 'bg-yellow-100' : 'bg-blue-50'} ring-1 ring-black/5`}>
           {isImpacted ? (
             <Info className="h-4 w-4 text-yellow-600" />
           ) : (
             <CheckCircle2 className="h-4 w-4 text-blue-500" />
           )}
        </div>
        <div className="flex gap-2">
           <div className={`rounded-md px-2 py-1 text-[10px] font-bold ${isImpacted ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'} uppercase`}>
             {opp.type}
           </div>
           <div className="rounded-md bg-green-100 px-2 py-1 text-[10px] font-bold text-green-700 uppercase">
             {opp.status}
           </div>
        </div>
      </div>

      <div className="mb-8">
        <span className="text-[10px] font-bold text-gray-400 tracking-wider mb-2 block">{opp.category}</span>
        <h3 className="text-base font-bold text-gray-900 leading-snug line-clamp-2 min-h-[2.75rem]">
          {opp.title}
        </h3>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-4 rounded-2xl bg-gray-50/80 p-4 mb-6">
        <div>
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight block mb-1">
            {opp.type === 'Resilience' ? 'Risk Reduction' : opp.type === 'Risk Reduction' ? 'Risk Reduction' : 'Savings Impact'}
          </span>
          <span className="text-sm font-bold text-gray-900">{opp.impact || opp.savings}</span>
        </div>
        <div>
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight block mb-1">Effort</span>
          <span className="text-sm font-bold text-gray-900">{opp.effort}</span>
        </div>
        {opp.risk !== undefined && (
          <div>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight block mb-1">Risk</span>
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-gray-900">{opp.risk}</span>
              <ChevronDown className="h-3 w-3 text-green-500" />
            </div>
          </div>
        )}
        {opp.esg !== undefined && (
          <div>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight block mb-1">ESG</span>
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-gray-900">{opp.esg}</span>
              <span className="text-gray-400">~</span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">Initiative Confidence Score:</span>
          <span className="text-[11px] font-bold text-gray-900">{opp.confidence}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            whileInView={{ width: `${opp.confidence}%` }}
            className="h-full bg-gray-400" 
          />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
        <div className="flex items-center gap-2 text-[10px] font-medium text-gray-400">
           <div className="h-4 w-4 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400 p-[1px] flex items-center justify-center">
             <div className="h-full w-full rounded-full bg-white flex items-center justify-center">
               <div className="h-1.5 w-1.5 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400" />
             </div>
           </div>
           2 question to be answered
        </div>
        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
      </div>

      {isImpacted && (
        <div className="mt-4 pt-4 border-t border-yellow-200">
          <p className="text-[11px] text-yellow-700/80 leading-relaxed italic mb-3">
            This action is still valid, however the confidence level and the savings impact has been modified
          </p>
          <div className="flex items-center gap-2 text-[11px] font-bold text-yellow-700">
            Show the alert impacting this opportunity <ExternalLink className="h-3 w-3" />
          </div>
        </div>
      )}
    </motion.div>
  );
}
