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
  Plus,
  Mic,
  Send,
  SlidersHorizontal,
  ArrowDownWideNarrow,
  Sparkles,
  PencilLine
} from "lucide-react";
import React from "react";
import Link from "next/link";

export default function AcceptedOpportunityPage() {
  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-gradient-to-br from-[#E1F1FF] via-[#F8FBFE] to-[#E1F1FF]">
      {/* Blurry Sky background effect */}
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] h-[60%] w-[60%] rounded-full bg-blue-200/50 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[60%] w-[60%] rounded-full bg-indigo-100/50 blur-[120px]" />
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
        
        {/* Left Column: Opportunity Assistant */}
        <div className="flex w-[400px] flex-col bg-white/60 backdrop-blur-md border-r border-gray-200/50 m-4 rounded-[32px] shadow-2xl shadow-blue-500/5 overflow-hidden ring-1 ring-white/50">
          <header className="flex h-16 items-center gap-4 border-b border-gray-100/50 px-6">
            <Link href="/opportunities" className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100/50 transition-colors">
              <ArrowLeft className="h-4 w-4 text-gray-600" />
            </Link>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-gray-900">Opportunity Assistant</h1>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-8 flex flex-col">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-900">Opportunity Assistant</span>
                <span className="h-1 w-1 rounded-full bg-gray-300" />
                <span className="text-[10px] font-bold text-gray-400 uppercase">1 MIN AGO</span>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </div>

            <p className="text-base font-medium text-gray-800 leading-relaxed mb-4">
              Your action is accepted, how can I help you next?
            </p>
          </div>

          <div className="p-6 mt-auto">
            <div className="relative flex items-center gap-3 rounded-[24px] bg-[#F0F4F8]/80 p-4 shadow-inner ring-1 ring-black/5 backdrop-blur-sm">
               <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-blue-400 to-purple-400 p-[1px] shrink-0">
                  <div className="h-full w-full rounded-full bg-white flex items-center justify-center">
                    <div className="h-3 w-3 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400" />
                  </div>
               </div>
               <Plus className="h-5 w-5 text-gray-400 cursor-pointer hover:text-gray-600" />
               <input 
                 type="text" 
                 placeholder="Type something..." 
                 className="flex-1 bg-transparent text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400"
               />
               <div className="flex items-center gap-3">
                 <Mic className="h-5 w-5 text-gray-400 cursor-pointer hover:text-gray-600" />
                 <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white shadow-lg hover:bg-black transition-all hover:scale-105 active:scale-95">
                   <Send className="h-5 w-5 rotate-[-45deg] translate-y-[-1px] translate-x-[1px]" />
                 </button>
               </div>
            </div>
          </div>
        </div>

        {/* Right Column: Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-10 pt-16">
          <div className="mx-auto max-w-4xl">
            
            <div className="flex items-center gap-3 mb-10">
              <span className="text-lg font-bold text-gray-900">Category: Corrugate</span>
              <ChevronDown className="h-5 w-5 text-gray-400" />
            </div>

            {/* Filter Tabs */}
            <div className="mb-12 flex items-center gap-10">
              <div className="flex items-center gap-1">
                <span className="text-2xl font-bold text-gray-300">All</span>
                <sup className="text-[10px] font-bold text-gray-300">32</sup>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-2xl font-bold text-gray-300">Qualified</span>
                <sup className="text-[10px] font-bold text-gray-300">1</sup>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-2xl font-bold text-gray-300">Potential</span>
                <sup className="text-[10px] font-bold text-gray-300">2</sup>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-2xl font-bold text-gray-300">New</span>
                <sup className="text-[10px] font-bold text-gray-300">0</sup>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-2xl font-bold text-gray-900 border-b-2 border-gray-900">Accepted</span>
                <sup className="text-[10px] font-bold text-gray-900">1</sup>
              </div>
              <div className="ml-auto flex items-center gap-6">
                <SlidersHorizontal className="h-5 w-5 text-gray-400 cursor-pointer" />
                <ArrowDownWideNarrow className="h-5 w-5 text-gray-400 cursor-pointer" />
              </div>
            </div>

            <div className="flex items-center gap-3 mb-8">
              <span className="text-lg font-bold text-gray-900">Accepted</span>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold text-white">1</div>
              <ChevronDown className="h-5 w-5 text-gray-400" />
            </div>

            {/* Accepted Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-[540px] rounded-[40px] bg-white p-10 shadow-2xl shadow-blue-900/5 ring-1 ring-black/[0.03]"
            >
              <div className="flex items-center justify-between mb-10">
                 <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-black/5">
                    <CheckCircle2 className="h-6 w-6 text-blue-500" />
                 </div>
                 <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-gray-400">Savings</span>
                    <div className="px-4 py-1.5 rounded-full bg-green-50 ring-1 ring-green-100 text-xs font-bold text-green-600">
                      Accepted
                    </div>
                 </div>
              </div>

              <div className="mb-8">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-4">Corrugate</span>
                <h3 className="text-2xl font-bold text-gray-900 leading-tight">Use cost model driven pricing mechanisms</h3>
              </div>

              <div className="grid grid-cols-2 gap-10 p-8 rounded-3xl bg-gray-50/50 ring-1 ring-gray-100 mb-8">
                <div>
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-4">Savings Impact</span>
                   <span className="text-2xl font-bold text-gray-900">High</span>
                </div>
                <div>
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-4">Effort</span>
                   <span className="text-2xl font-bold text-gray-900">3-6 months</span>
                </div>
              </div>

              <div className="space-y-6 mb-10">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-500">Initiative Level Confidence Score:</span>
                  <span className="text-sm font-bold text-gray-900">65%</span>
                </div>
                
                <div className="flex items-center gap-8">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-500">Risk:</span>
                    <span className="text-sm font-bold text-gray-900">-2</span>
                    <ArrowLeft className="h-4 w-4 text-green-500 rotate-[-90deg]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-500">ESG:</span>
                    <span className="text-sm font-bold text-gray-900">0</span>
                    <span className="text-gray-400">~</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-blue-50/50 p-6 ring-1 ring-blue-100/50 mb-8">
                <p className="text-sm font-medium text-blue-900 leading-relaxed">
                  85% of companies use this lever in corrugates
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-600">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-sm font-bold">Do you want a drill down or go into details?</span>
                  <PencilLine className="h-4 w-4 text-gray-400" />
                </div>
              </div>
              <div className="mt-4">
                 <span className="text-xs font-medium text-gray-400 italic">One question to be answered</span>
              </div>
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  );
}
