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
  ArrowUpRight,
  ArrowRight,
  Layers,
  Clock
} from "lucide-react";
import React from "react";
import Link from "next/link";

export default function DashboardPage() {
  const conversations = [
    {
      title: "Freight Consolidation Savings in Asia Ro...",
      description: "Max identified fragmented shipments between...",
      time: "2 HOURS AGO",
    },
    {
      title: "Expiring Supplier ESG Certification",
      description: "One of your tier-1 suppliers, AgroPure Ltd., has a...",
      time: "2 DAYS AGO",
    },
    {
      title: "Contract Performance Drift - Packaging...",
      description: "Max flagged declining performance trends in a k...",
      time: "LAST WEEK",
    }
  ];

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-[#F8FBFE]">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-b from-[#E0F2FE]/40 via-[#F8FBFE] to-white" />
        
        {/* Yellow Building Detail */}
        <div className="absolute bottom-[-15%] left-[-5%] z-0 h-[60%] w-[50%] rotate-[-10deg] overflow-hidden border-t-[12px] border-white/40 bg-[#EAB308] shadow-2xl">
           <div className="absolute inset-0 flex flex-col space-y-8 pt-16">
             {Array.from({ length: 20 }).map((_, i) => (
               <div key={i} className="h-[1px] w-full bg-black/5" />
             ))}
           </div>
        </div>
      </div>

      {/* Left Icon Sidebar */}
      <div className="relative z-20 flex w-16 flex-col items-center border-r border-gray-200/40 bg-white/30 py-8 backdrop-blur-xl shrink-0">
        <div className="mb-12 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
           <div className="h-full w-full bg-gradient-to-tr from-blue-500 via-purple-500 to-indigo-500 opacity-80" />
        </div>
        
        <div className="flex flex-col gap-8 text-gray-400">
           <div className="p-2 rounded-lg bg-white shadow-sm text-blue-600 ring-1 ring-black/5 transition-colors cursor-pointer">
             <Home className="h-6 w-6" />
           </div>
           <div className="p-2 rounded-lg hover:bg-black/5 transition-colors cursor-pointer">
             <Activity className="h-6 w-6" />
           </div>
           <Link href="/opportunities" className="p-2 rounded-lg hover:bg-black/5 transition-colors cursor-pointer">
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
           <div className="p-2 rounded-lg hover:bg-black/5 transition-colors cursor-pointer">
             <LogOut className="h-6 w-6" />
           </div>
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="relative z-10 flex flex-1 flex-col overflow-y-auto">
        
        {/* Top Header */}
        <header className="flex h-20 items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
                <div className="h-full w-full bg-gradient-to-tr from-blue-400 to-purple-400 opacity-60" />
            </div>
            <button className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
              <Plus className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-blue-900/60">
              What other CPOs are asking me today?
            </span>
          </div>

          <div className="flex items-center gap-6 text-gray-400">
            <Mic className="h-5 w-5 hover:text-gray-600 cursor-pointer" />
            <Menu className="h-5 w-5 hover:text-gray-600 cursor-pointer" />
          </div>
        </header>

        {/* Hero Content */}
        <main className="flex-1 px-20 py-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl"
          >
            <div className="flex items-baseline gap-2 mb-8">
              <h1 className="text-4xl font-medium tracking-tight text-[#1A1C1E] font-serif italic">
                Welcome, Timeyin
              </h1>
              <ArrowUpRight className="h-4 w-4 text-gray-400" />
            </div>

            <div className="space-y-4 mb-10">
              <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                Based on the inputs you have shared with me, you have
              </p>
              
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-2xl font-medium text-blue-900/80">
                <span className="flex items-center gap-2">
                  $2.4M total potential savings <ArrowUpRight className="h-5 w-5 text-gray-400" />
                </span>
                <span className="text-gray-300">identified across</span>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-2">
                <div className="flex items-center gap-2 text-blue-900/80">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100/50">
                    <div className="h-3 w-3 rounded-full border-[1.5px] border-blue-500 flex items-center justify-center">
                       <div className="h-[2px] w-[2px] bg-blue-500 rounded-full" />
                    </div>
                  </div>
                  <span className="font-semibold">7 opportunities</span>
                  <ArrowUpRight className="h-4 w-4 text-gray-400" />
                </div>

                <div className="flex items-center gap-2 text-blue-900/80">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100/50">
                     <div className="h-3 w-3 rounded-full border-[1.5px] border-blue-500 flex items-center justify-center">
                       <div className="h-[2px] w-[2px] bg-blue-500 rounded-full" />
                    </div>
                  </div>
                  <span className="font-semibold">5 Qualified</span>
                  <ArrowUpRight className="h-4 w-4 text-gray-400" />
                </div>

                <div className="flex items-center gap-2 text-blue-900/80">
                  <span className="text-gray-300 text-xl font-light">/</span>
                  <span className="font-semibold">2 Potential</span>
                  <ArrowUpRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>

              <p className="max-w-lg text-sm text-gray-400/90 leading-relaxed pt-2">
                Your portfolio is currently in a healthy position with no significant
                risks. I'll keep monitoring it for you and update you immediately if I
                detect anything important.
              </p>
            </div>

            <div className="flex items-center gap-4 mb-24">
              <Link href="/opportunities" className="flex items-center gap-3 rounded-xl bg-[#1A1C1E] px-6 py-4 text-sm font-medium text-white shadow-xl hover:bg-black transition-all">
                View all Risks & Opportunities
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button className="flex items-center gap-3 rounded-xl bg-white px-6 py-4 text-sm font-medium text-gray-600 shadow-sm ring-1 ring-black/5 hover:bg-gray-50 transition-all">
                View your Portfolio Health
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {/* Recent Conversations */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-800">Recent Conversations</h2>
                <button className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors">
                  View all <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {conversations.map((conv, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 * idx }}
                    className="group relative flex flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50/50 group-hover:bg-blue-100/50 transition-colors">
                        <Layers className="h-5 w-5 text-blue-500/80" />
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-300 uppercase tracking-tighter">
                        <Clock className="h-3 w-3" />
                        {conv.time}
                      </div>
                    </div>
                    
                    <h3 className="mb-2 text-sm font-semibold text-gray-800 line-clamp-1">
                      {conv.title}
                    </h3>
                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
                      {conv.description}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
