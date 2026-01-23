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
  ArrowLeft,
  CheckCircle2,
  ChevronUp,
  Plus,
  Mic,
  Send,
  MoreHorizontal,
  ChevronRight,
  Square
} from "lucide-react";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const findings = [
  "I can see significant price variation across identical / similar corrugates SKUs across your spend data."
];

const tests = [
  { text: "Analyzed spend data to find out the high spend suppliers and checked for price variations in them.", completed: true },
  { text: "Determined the key levers and test questions for the corrugates from Kearney framework", completed: true },
  { text: "I looked into the contracts of Westrock and International Paper", completed: true },
  { text: "I looked at the relevant external price indicies (pulp NBSK index)", completed: true },
  { text: "Determined that Pulp is the key cost driver for corrugates from the kearney industry playbook", completed: true }
];

const recommendations = [
  { text: "Switch to index based pricing - kraft liner index O211 or RISI", checked: true },
  { text: "Re-negotiate with your two major suppliers, Westrock and International paper", checked: true },
  { text: "Set up bilateral negotiation with Westrock in Negotip tool", checked: true }
];

export default function OpportunityDetailPage() {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const router = useRouter();

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-[#F8FBFE]">
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
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Column: Opportunity Assistant */}
        <div className="flex w-[400px] flex-col border-r border-gray-100 bg-white/80 backdrop-blur-md">
          <header className="flex h-16 items-center gap-4 border-b border-gray-100 px-6">
            <Link href="/opportunities" className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
              <ArrowLeft className="h-4 w-4 text-gray-600" />
            </Link>
            <div className="flex items-center gap-2 overflow-hidden">
              <h1 className="truncate text-sm font-bold text-gray-900">Use cost model driven pricing mechanisms</h1>
              <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-900">Opportunity Assistant</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider uppercase">2 mins ago</span>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </div>

            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-800 leading-relaxed">
                Can you help me with some additional clarity? 1/2
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                1. Based on your category playbook for corrugates (file name 'corrugates playbook_2024'), I see some cost models, can you help me understand to what degree do you use them in day to day procurement?
              </p>
            </div>

            <div className="space-y-3">
              {[
                "No cost models available. Fixed price with suppliers",
                "Cost models available, pricing mechanism defined by suppliers",
                "Cost models defined, occasionally used for pricing adjustments",
                "Cost models defined, variable pricing formulae automatically calculated based on latest market indicies"
              ].map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedOption(idx)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    selectedOption === idx 
                      ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100 shadow-sm' 
                      : 'bg-white border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex gap-3">
                    <div className={`mt-0.5 h-4 w-4 shrink-0 rounded border transition-colors ${
                      selectedOption === idx ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'
                    }`} />
                    <span className={`text-[13px] leading-tight font-medium ${selectedOption === idx ? 'text-blue-900' : 'text-gray-700'}`}>
                      {option}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <button className="h-12 w-24 rounded-xl bg-gray-900 font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95">
              Next
            </button>
          </div>

          <div className="p-6">
            <div className="relative flex items-center gap-2 rounded-2xl bg-[#F0F4F8] p-3 shadow-inner ring-1 ring-black/5">
               <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-blue-400 to-purple-400 p-[1px] shrink-0">
                  <div className="h-full w-full rounded-full bg-white flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400" />
                  </div>
               </div>
               <Plus className="h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600" />
               <input 
                 type="text" 
                 placeholder="Type something..." 
                 className="flex-1 bg-transparent text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400"
               />
               <div className="flex items-center gap-2">
                 <Mic className="h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600" />
                 <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-white shadow-sm hover:bg-black transition-colors">
                   <Send className="h-4 w-4" />
                 </button>
               </div>
            </div>
          </div>
        </div>

        {/* Right Column: Content */}
        <div className="flex-1 overflow-y-auto bg-transparent custom-scrollbar">
          <div className="mx-auto max-w-5xl space-y-6 p-10 pb-32">
            
            {/* Savings Section */}
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-black/5"
            >
              <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-black/5 shadow-sm">
                    <CheckCircle2 className="h-5 w-5 text-blue-500" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">Savings</h2>
                </div>
                <ChevronUp className="h-5 w-5 text-gray-300" />
              </div>

              <h3 className="mb-8 text-2xl font-bold text-gray-900">Use cost model driven pricing mechanisms</h3>

              <div className="grid grid-cols-4 gap-6 rounded-2xl bg-gray-50/50 p-6 ring-1 ring-gray-100">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Impact</span>
                  <span className="text-xl font-bold text-gray-900">High</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Confidence</span>
                  <span className="text-xl font-bold text-gray-900">65%</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Question Tested</span>
                  <span className="text-xl font-bold text-gray-900">3 out of 5</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Effort</span>
                  <span className="text-xl font-bold text-gray-900">3-6 Months</span>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-8 px-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-500">Risk:</span>
                  <span className="text-sm font-bold text-gray-900">-2</span>
                  <ChevronDown className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-500">ESG:</span>
                  <span className="text-sm font-bold text-gray-900">0</span>
                  <span className="text-gray-400">~</span>
                </div>
              </div>
            </motion.section>

            {/* What did I find? Section */}
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-black/5"
            >
              <div className="mb-8 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">What did I find?</h2>
                <ChevronUp className="h-5 w-5 text-gray-300" />
              </div>

              <p className="mb-10 text-base text-gray-600 leading-relaxed max-w-2xl">
                I can see significant price variation across identical / similar corrugates SKUs across your spend data.
              </p>

              <div className="grid grid-cols-5 gap-8">
                {/* Chart Area */}
                <div className="col-span-3 space-y-4">
                  <h4 className="text-sm font-bold text-gray-900">Pulp NBSK del Eur</h4>
                  <div className="relative h-[200px] w-full border-l border-b border-gray-100">
                    {/* Simplified Chart Path */}
                    <svg className="h-full w-full" viewBox="0 0 400 200">
                      <motion.path 
                        d="M 0 40 L 40 60 L 80 50 L 120 120 L 160 160 L 200 160 L 240 120 L 280 120 L 320 140 L 360 160 L 400 180" 
                        fill="none" 
                        stroke="#2563EB" 
                        strokeWidth="2.5"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                      />
                    </svg>
                    <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-[10px] font-bold text-gray-400">
                      <span>Apr 24</span>
                      <span>Apr 25</span>
                    </div>
                  </div>
                  <div className="flex gap-4 pt-4">
                    {["OECD-FAO Agricult...", "Palm Oil Futures (B...", "South American S..."].map((idx) => (
                      <span key={idx} className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">{idx}</span>
                    ))}
                  </div>
                </div>

                {/* Info Boxes */}
                <div className="col-span-2 space-y-4">
                  <div className="rounded-2xl border border-gray-100 bg-gray-50/30 p-4 shadow-sm">
                    <p className="text-[12px] leading-relaxed text-gray-600">
                      Pulp index for your major supply region (Vietnam) &gt; 50% spend, went down by 14%. Your prices have remained flat, and index based pricing would have given you 10-12% reduction
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50/30 p-4 shadow-sm">
                    <p className="text-[12px] leading-relaxed text-gray-600">
                      Long term projection is still showing a downward trend. Switching to index based pricing will help you take advantage of the market conditions.
                    </p>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* How did I test? Section */}
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-black/5"
            >
              <div className="mb-8 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">How did I test:</h2>
                <ChevronUp className="h-5 w-5 text-gray-300" />
              </div>

              <div className="space-y-4">
                {tests.map((test, idx) => (
                  <div key={idx} className="flex items-start gap-4">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-green-50">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-600 leading-relaxed">
                      {test.text}
                    </span>
                  </div>
                ))}
              </div>
            </motion.section>

            {/* What I Recommend Section */}
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-black/5"
            >
              <div className="mb-8 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">What I Recommend</h2>
                <ChevronUp className="h-5 w-5 text-gray-300" />
              </div>

              <div className="space-y-3 mb-8">
                {recommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${rec.checked ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-300'}`}>
                      {rec.checked && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                    </div>
                    <span className="text-sm font-bold text-gray-900">{rec.text}</span>
                  </div>
                ))}
              </div>

              <p className="text-[12px] font-medium text-gray-500 italic mb-8">
                I will monitor the index movements for you with a threshold of +-5.
              </p>

              <div className="flex items-center justify-end gap-3">
                <button className="h-11 px-6 rounded-xl text-sm font-bold text-gray-900 hover:bg-gray-50 transition-colors">
                  Ignore
                </button>
                <button className="h-11 px-6 rounded-xl bg-blue-100 flex items-center gap-2 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-200 transition-colors">
                  <Square className="h-4 w-4 fill-blue-700/20" />
                  Simulate
                </button>
                <button 
                  onClick={() => router.push("/opportunities/accepted")}
                  className="h-11 px-8 rounded-xl bg-gray-900 text-sm font-bold text-white shadow-lg hover:bg-black transition-all"
                >
                  Accept
                </button>
              </div>
            </motion.section>

          </div>
        </div>
      </div>

      {/* Background Decor */}
      <div className="absolute bottom-[-15%] left-[-5%] z-0 h-[60%] w-[50%] rotate-[-10deg] overflow-hidden border-t-[12px] border-white/40 bg-[#EAB308] shadow-2xl opacity-50 pointer-events-none">
         <div className="absolute inset-0 flex flex-col space-y-8 pt-16">
           {Array.from({ length: 20 }).map((_, i) => (
             <div key={i} className="h-[1px] w-full bg-black/5" />
           ))}
         </div>
      </div>
    </div>
  );
}
