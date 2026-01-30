"use client";

import { motion } from "framer-motion";
import {
  Home,
  Activity,
  ShieldCheck,
  Search,
  User,
  LogOut,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  CheckCircle2,
  Plus,
  Mic,
  Send,
  FileText,
  ChevronRight,
  Download
} from "lucide-react";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";

// Processing steps for the AI
const processingSteps = [
  {
    icon: "document",
    title: "Detected 5 contracts",
    result: "2 Insights",
    expandable: true
  },
  {
    icon: "bullet",
    title: "updating insights from contracts",
    result: "5 Results",
    expandable: true,
    indent: true
  },
  {
    icon: "document",
    title: "Consolidating price variance from send data",
    expandable: false
  },
  {
    icon: "bullet",
    title: "5 similar SKUs and 10 same SKUs with different pricing identified",
    expandable: false,
    indent: true
  },
  {
    icon: "document",
    title: "Comparing Price Trends",
    result: "3 Results",
    expandable: true
  }
];

export default function AcceptedOpportunityPage() {
  const { state } = useApp();
  const [isGenerating, setIsGenerating] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Simulate the generation process
  useEffect(() => {
    if (isGenerating && currentStep < processingSteps.length) {
      const timer = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, 800);
      return () => clearTimeout(timer);
    } else if (currentStep >= processingSteps.length) {
      const timer = setTimeout(() => {
        setIsGenerating(false);
        setShowSummary(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isGenerating, currentStep]);

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-[#F0F7FF]">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-b from-[#E0F0FF]/60 via-[#F0F7FF] to-white" />

        {/* Yellow Building Detail */}
        <div className="absolute bottom-[-15%] left-[-5%] z-0 h-[60%] w-[50%] rotate-[-10deg] overflow-hidden border-t-[12px] border-white/40 bg-[#EAB308] shadow-2xl opacity-40">
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
           <Link href="/opportunities" className="p-2 rounded-lg bg-white shadow-sm text-blue-600 ring-1 ring-black/5 transition-colors cursor-pointer">
             <ShieldCheck className="h-6 w-6" />
           </Link>
        </div>

        <div className="mt-auto flex flex-col gap-8 text-gray-400">
           <div className="p-2 rounded-lg hover:bg-black/5 transition-colors cursor-pointer">
             <Search className="h-6 w-6" />
           </div>
           <div className="p-2 rounded-lg hover:bg-black/5 transition-colors cursor-pointer">
             <User className="h-6 w-6" />
           </div>
           <div className="p-2 rounded-lg hover:bg-black/5 transition-colors cursor-pointer text-red-400">
             <LogOut className="h-6 w-6" />
           </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden relative z-10">

        {/* Left Column: Chat Interface */}
        <div className="flex w-[480px] flex-col border-r border-gray-100 bg-white">
          <header className="flex h-14 items-center gap-3 border-b border-gray-100 px-5">
            <Link href="/opportunities" className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
              <ArrowLeft className="h-4 w-4 text-gray-600" />
            </Link>
            <div className="flex items-center gap-2 overflow-hidden flex-1">
              <h1 className="text-[14px] font-semibold text-gray-900">Opportunity Assistant</h1>
              <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Assistant Header */}
            <div className="flex items-center gap-3">
              <span className="text-[14px] font-semibold text-gray-900">Opportunity Assistant</span>
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">1 min ago</span>
              <ChevronDown className="h-4 w-4 text-gray-400 ml-auto" />
            </div>

            {/* Assistant Message */}
            <p className="text-[14px] text-gray-700 leading-relaxed">
              I have created an <span className="font-semibold text-blue-600 underline cursor-pointer">action tracker</span> for you. Do you now want to view your impacted opportunity?
            </p>

            {/* User Message */}
            <div className="rounded-2xl bg-[#F0F5FA] p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[13px] font-semibold text-gray-800">{state.user?.name || "User"}</span>
                <span className="text-[11px] text-gray-400">12:30 PM</span>
              </div>
              <p className="text-[14px] font-medium text-gray-900 leading-relaxed">
                Can you create a summary of the identified and accepted opportunities that I can present to my internal stakeholders?
              </p>
            </div>

            {/* AI Processing */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-blue-400 to-purple-400 p-[1px]">
                  <div className="h-full w-full rounded-full bg-white flex items-center justify-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400" />
                  </div>
                </div>
                <span className="text-[14px] font-semibold text-gray-900">Working on the stakeholder presentation..</span>
              </div>

              {/* Processing Steps */}
              <div className="space-y-3 pl-2">
                {processingSteps.slice(0, currentStep).map((step, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-center gap-3 ${step.indent ? 'pl-6' : ''}`}
                  >
                    {step.icon === "document" ? (
                      <FileText className="h-4 w-4 text-gray-400" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                    )}
                    <span className="text-[13px] text-gray-600 flex-1">{step.title}</span>
                    {step.result && (
                      <div className="flex items-center gap-1 text-[12px] text-gray-500">
                        <span>{step.result}</span>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Summary Link - Show after processing */}
              {showSummary && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3 pt-4"
                >
                  <p className="text-[14px] text-gray-700">Here is you summary for the leadership</p>
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors cursor-pointer">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                      <svg className="h-4 w-4 text-blue-600" viewBox="0 0 16 16" fill="none">
                        <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                        <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                        <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                        <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    </div>
                    <span className="text-[14px] font-semibold text-gray-900 flex-1">Opportunity Summary</span>
                    <span className="text-[13px] font-medium text-blue-600">Download</span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </motion.div>
              )}
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
                 placeholder=""
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

        {/* Right Column: Summary Document */}
        <div className="flex-1 overflow-y-auto bg-[#F8FBFE] custom-scrollbar">
          {/* Breadcrumb */}
          <div className="sticky top-0 z-10 flex items-center gap-3 px-8 py-4 bg-[#F8FBFE]/80 backdrop-blur-sm border-b border-gray-100">
            <Link href="/opportunities" className="flex items-center gap-2 text-[13px] font-medium text-gray-500 hover:text-gray-700 transition-colors">
              <ChevronLeft className="h-4 w-4" />
              Go Back
            </Link>
            <div className="h-4 w-px bg-gray-200" />
            <div className="flex items-center gap-2 text-[13px] font-medium text-teal-600">
              <CheckCircle2 className="h-4 w-4" />
              Savings
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300" />
            <span className="text-[13px] font-medium text-gray-900">Opportunity Summary</span>
          </div>

          <div className="p-8 pb-32">
            {isGenerating && !showSummary ? (
              /* Loading State */
              <div className="flex flex-col items-center justify-center min-h-[400px]">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center"
                >
                  <p className="text-[16px] font-medium text-gray-700 mb-6">Generating Details</p>
                  <div className="flex items-center justify-center gap-2">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <motion.div
                        key={i}
                        className={`h-2.5 w-2.5 rounded-full ${i === 0 ? 'bg-blue-500' : 'bg-gray-300'}`}
                        animate={{
                          backgroundColor: i === (Math.floor(Date.now() / 500) % 5) ? '#3B82F6' : '#D1D5DB'
                        }}
                        transition={{ duration: 0.3 }}
                      />
                    ))}
                  </div>
                </motion.div>
              </div>
            ) : showSummary && (
              /* Summary Document */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto"
              >
                {/* Document Header */}
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <h1 className="text-[26px] font-bold text-gray-900 mb-2">Supply Chain Resilience Initiatives Summary</h1>
                    <p className="text-[14px] text-gray-500">Strategic Summary for Leadership Review | Q4 2025</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    </button>
                    <button className="h-10 px-5 rounded-xl bg-gray-900 text-[13px] font-semibold text-white flex items-center gap-2 hover:bg-black transition-colors">
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                  </div>
                </div>

                {/* Section 01: Executive Summary */}
                <div className="mb-10 border-t border-gray-100 pt-8">
                  <div className="grid grid-cols-12 gap-8">
                    <div className="col-span-3">
                      <span className="text-[32px] font-light text-gray-300">01</span>
                      <h2 className="text-[15px] font-semibold text-gray-900 mt-1">Executive<br />Summary</h2>
                    </div>
                    <div className="col-span-9 space-y-6">
                      <div>
                        <h3 className="text-[15px] font-bold text-gray-900 mb-2">Procurement Optimization Strategy</h3>
                        <p className="text-[14px] text-gray-600 leading-relaxed">
                          Four strategic procurement initiatives can deliver 10-25% reduction in total cost of ownership while improving operational efficiency
                        </p>
                      </div>

                      {/* Metrics Cards */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="rounded-xl bg-[#F8FAFC] p-5 border border-gray-100">
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-2">Projected Savings</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-[28px] font-bold text-teal-500">€2.4M</span>
                            <span className="text-[12px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">$1.3M</span>
                          </div>
                        </div>
                        <div className="rounded-xl bg-[#F8FAFC] p-5 border border-gray-100">
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-2">Risk Reduction</span>
                          <span className="text-[28px] font-bold text-gray-900">5%</span>
                        </div>
                        <div className="rounded-xl bg-[#F8FAFC] p-5 border border-gray-100">
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-2">Active Initiatives</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-[28px] font-bold text-gray-900">4</span>
                            <span className="text-[12px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">$1.3M</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 02: Key Strategic Initiatives */}
                <div className="border-t border-gray-100 pt-8">
                  <div className="grid grid-cols-12 gap-8">
                    <div className="col-span-3">
                      <span className="text-[32px] font-light text-gray-300">02</span>
                      <h2 className="text-[15px] font-semibold text-gray-900 mt-1">Key Strategic<br />Initiatives</h2>
                    </div>
                    <div className="col-span-9 space-y-8">
                      {/* Initiative 1 */}
                      <div>
                        <h3 className="text-[15px] font-bold text-gray-900 mb-3">Index-Based Pricing</h3>
                        <p className="text-[14px] text-gray-600 leading-relaxed">
                          Linking prices to market indices creates transparent, objective pricing that adjusts automatically with market conditions. This eliminates constant renegotiations, mitigates volatility risk for both parties, and enables more accurate budget forecasting.
                        </p>
                      </div>

                      {/* Initiative 2 */}
                      <div>
                        <h3 className="text-[15px] font-bold text-gray-900 mb-3">Payment Terms Optimization</h3>
                        <p className="text-[14px] text-gray-600 leading-relaxed">
                          Strategic payment terms improve working capital by extending days payable outstanding or capturing early payment discounts. This provides low-cost financing alternatives while strengthening supplier relationships through predictable, fair payment practices.
                        </p>
                      </div>

                      {/* Initiative 3 */}
                      <div>
                        <h3 className="text-[15px] font-bold text-gray-900 mb-3">Supplier Consolidation</h3>
                        <p className="text-[14px] text-gray-600 leading-relaxed">
                          Reducing the supplier base concentrates spend with strategic partners, enabling volume discounts and preferred pricing. This simplifies operations, reduces transaction costs, and builds deeper relationships that drive innovation and mutual value creation.
                        </p>
                      </div>

                      {/* Initiative 4 */}
                      <div>
                        <h3 className="text-[15px] font-bold text-gray-900 mb-3">Volume Bundling</h3>
                        <p className="text-[14px] text-gray-600 leading-relaxed">
                          Aggregating demand across business units or time periods creates leverage for better pricing. Coordinated purchasing increases order sizes, reduces supplier marketing costs, and qualifies for tier-based discounts that wouldn't be accessible individually.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
