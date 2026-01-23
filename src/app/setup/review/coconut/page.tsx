"use client";

import { motion } from "framer-motion";
import { 
  ChevronLeft, 
  ArrowRight, 
  Pencil,
  Check,
  ChevronDown,
  Upload,
  Home,
  Activity,
  ShieldCheck,
  Search,
  User,
  LogOut,
  FolderOpen,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import React from "react";

export default function ReviewCoconutPage() {
  const steps = [
    { name: "Confirm your portfolio", completed: true, active: false },
    { name: "Set your optimization goals", completed: true, active: false },
    { name: "Data Sources", completed: true, active: false },
    { name: "Key Insights", completed: true, active: false },
    { name: "Review your data", completed: false, active: true, subItems: [
      { name: "Grains", status: "completed" },
      { name: "Coconut", status: "active" },
      { name: "Oils", status: "needs_review" },
      { name: "Rice", status: "completed" }
    ]},
  ];

  const dataPoints = [
    { name: "Overall Spend", status: "Validated", date: "23 May, 2026", action: "View", subItems: [
      { name: "Spend by Location", status: "Validated" },
      { name: "Spend by Supplier", status: "Validated" },
      { name: "Volume by Supplier", status: "Validated" },
      { name: "Volume by Geography", status: "Not Available" },
      { name: "Price", status: "Not Available" },
    ]},
    { name: "Supply Master", status: "Available", date: "23 May, 2026", action: "Upload" },
    { name: "Contracts", count: 1, status: "1 Item Available", date: "23 May, 2026", action: "Upload" },
    { name: "Category Playbook", status: "0 Items", date: "23 May, 2026", action: "Upload" },
    { name: "Other", status: "5 Items", date: "23 May, 2026", action: "View" },
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
      <div className="relative z-20 flex w-16 flex-col items-center border-r border-gray-200/40 bg-white/30 py-8 backdrop-blur-xl">
        <div className="mb-12 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="h-5 w-5 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500" />
        </div>
        
        <div className="flex flex-col gap-8 text-gray-400">
           <Home className="h-6 w-6" />
           <Activity className="h-6 w-6 text-blue-600" />
           <ShieldCheck className="h-6 w-6" />
        </div>

        <div className="mt-auto flex flex-col gap-8 text-gray-400">
           <Search className="h-6 w-6" />
           <User className="h-6 w-6" />
           <LogOut className="h-6 w-6 text-red-400/60" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-1 flex-col p-8 lg:p-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <Link href="/setup/summary" className="flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-black">
            <ChevronLeft className="h-4 w-4" />
            Go Back
          </Link>
          
          <Link href="/">
            <Button className="h-10 rounded-xl bg-[#1A1C1E] px-6 text-[13px] font-semibold text-white hover:bg-black">
              Proceed to Home
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[380px_1fr]">
          {/* Left Column - Intro & Checklist */}
          <div className="space-y-10">
            <div className="space-y-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Max</span>
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                  <FolderOpen className="h-4.5 w-4.5 text-blue-500" />
                </div>
                <h1 className="text-3xl font-medium leading-[1.15] tracking-tight text-[#1A1C1E]">
                  Showing data for <span className="text-black font-semibold">Coconut</span> based on the latest data available with Max
                </h1>
              </div>
              <p className="max-w-[340px] text-[14px] leading-relaxed text-gray-500">
                Validating your data will provide additional context for me to analyze opportunities and ensure the greatest value.
              </p>
            </div>

            {/* Profile Avatar stack */}
            <div className="flex items-center gap-2">
               <div className="h-8 w-8 rounded-full border-2 border-white bg-blue-100 shadow-sm overflow-hidden">
                  <div className="h-full w-full bg-gradient-to-tr from-blue-400 to-indigo-600" />
               </div>
               <div className="h-8 w-8 -ml-3 rounded-full border-2 border-white bg-purple-100 shadow-sm overflow-hidden">
                  <div className="h-full w-full bg-gradient-to-tr from-purple-400 to-pink-600 opacity-50" />
               </div>
            </div>

            {/* Checklist Card */}
            <div className="w-full max-w-[340px] overflow-hidden rounded-[32px] bg-white shadow-[0_20px_40px_rgba(0,0,0,0.03)] ring-1 ring-black/5">
              <div className="p-7 pb-4">
                <h2 className="text-[15px] font-semibold text-[#1A1C1E]">Complete your profile setup</h2>
              </div>
              
              <div className="space-y-1 p-2">
                {steps.map((step, idx) => (
                  <div key={idx} className="space-y-1">
                    <div 
                      className={`flex items-center gap-4 rounded-2xl p-4 transition-colors ${step.active ? 'bg-gray-50/80' : ''}`}
                    >
                      <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${step.completed ? 'border-black bg-black' : step.active ? 'border-black bg-white' : 'border-dashed border-gray-300'}`}>
                        {step.completed ? <Check className="h-3 w-3 text-white" /> : step.active && <div className="h-1.5 w-1.5 rounded-full bg-black" />}
                      </div>
                      <span className={`text-[14px] font-medium ${step.completed ? 'text-gray-400 line-through' : 'text-[#1A1C1E]'}`}>{step.name}</span>
                      {step.active && <ChevronDown className="ml-auto h-4 w-4 text-gray-400" />}
                    </div>
                    {step.active && step.subItems && (
                      <div className="ml-9 space-y-2 pb-2 pr-4">
                        {step.subItems.map((item, i) => (
                          <div key={i} className="flex items-center justify-between py-1">
                             <div className="flex items-center gap-3">
                                <div className={`h-4 w-[1.5px] rounded-full ${item.status === 'active' ? 'bg-black' : 'bg-gray-200'}`} />
                                <span className={`text-[13px] font-medium ${item.status === 'active' ? 'text-black' : 'text-gray-500'}`}>{item.name}</span>
                             </div>
                             {item.status === 'completed' && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                             {item.status === 'active' && <div className="h-2 w-2 rounded-full bg-black" />}
                             {item.status === 'needs_review' && <span className="text-[11px] font-bold text-red-500/80">Needs Review</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-2 border-t border-gray-100 p-6 pt-5">
                <div className="flex items-center justify-between mb-3">
                   <span className="text-[12px] font-semibold text-gray-400">4 of 5 complete</span>
                </div>
                <div className="h-[4px] w-full rounded-full bg-gray-50">
                  <div className="h-full w-[80%] rounded-full bg-[#1A1C1E] transition-all duration-700" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Data Review Content */}
          <div className="space-y-8">
            {/* Top Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
               <div className="rounded-[32px] bg-white p-6 shadow-sm ring-1 ring-black/[0.03]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Spend</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-semibold text-[#1A1C1E]">$ 2.8M</span>
                    <span className="text-[11px] text-gray-400">May '24 - April '25</span>
                  </div>
               </div>
               
               <div className="rounded-[32px] bg-white p-6 shadow-sm ring-1 ring-black/[0.03]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Cost</span>
                  <div className="mt-2">
                    <span className="text-2xl font-semibold text-amber-500">Medium</span>
                  </div>
               </div>

               <div className="rounded-[32px] bg-white p-6 shadow-sm ring-1 ring-black/[0.03]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Risk</span>
                  <div className="mt-2">
                    <span className="text-2xl font-semibold text-emerald-500">Low</span>
                  </div>
               </div>

               <div className="rounded-[32px] bg-white p-6 shadow-sm ring-1 ring-black/[0.03] relative group">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">ESG</span>
                  <div className="mt-2">
                    <span className="text-2xl font-semibold text-red-500">High</span>
                  </div>
                  <button className="absolute right-6 top-6 flex h-8 items-center gap-2 rounded-lg bg-gray-50 px-3 text-[11px] font-medium text-gray-500 opacity-0 transition-opacity group-hover:opacity-100">
                    Edit Goals
                    <Pencil className="h-3 w-3" />
                  </button>
               </div>
            </div>

            {/* Data Points Table Section */}
            <div className="rounded-[40px] bg-white p-8 shadow-[0_20px_60px_rgba(0,0,0,0.02)] ring-1 ring-black/5">
               <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-semibold text-[#1A1C1E]">Data Points</h3>
                  <div className="flex items-center gap-1 rounded-2xl bg-gray-50 p-1.5">
                     <button className="rounded-xl bg-white px-5 py-2 text-[13px] font-medium text-[#1A1C1E] shadow-sm ring-1 ring-black/5">All</button>
                     <button className="flex items-center gap-2 px-5 py-2 text-[13px] font-medium text-gray-500 transition-colors hover:text-black">
                        Needs Validation
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[11px] font-bold text-gray-600">5</span>
                     </button>
                     <button className="flex items-center gap-2 px-5 py-2 text-[13px] font-medium text-gray-500 transition-colors hover:text-black">
                        Not Available
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[11px] font-bold text-gray-600">3</span>
                     </button>
                  </div>
               </div>

               {/* Table */}
               <div className="w-full overflow-hidden">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="border-b border-gray-100 text-[12px] font-medium uppercase tracking-widest text-gray-400">
                           <th className="pb-4 pl-4 font-medium">Data</th>
                           <th className="pb-4 font-medium">Status</th>
                           <th className="pb-4 font-medium">Last Updated</th>
                           <th className="pb-4 pr-4 text-right font-medium">Action</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                        {dataPoints.map((row, idx) => (
                           <React.Fragment key={idx}>
                              <tr className="group transition-colors hover:bg-gray-50/50">
                                 <td className="py-6 pl-4">
                                    <div className="flex items-center gap-3">
                                       {row.subItems && <ChevronDown className="h-4 w-4 text-gray-400" />}
                                       <span className="text-[15px] font-medium text-[#1A1C1E]">
                                          {row.name} {row.count && <span className="ml-2 text-gray-400 font-normal">{row.count}</span>}
                                       </span>
                                    </div>
                                 </td>
                                 <td className="py-6">
                                    <div className={`flex items-center gap-2 text-[14px] font-medium ${row.status === 'Validated' ? 'text-gray-600' : 'text-gray-600'}`}>
                                       {row.status === 'Validated' || row.status === 'Available' || row.status.includes('Available') ? (
                                          <Check className="h-4 w-4 text-emerald-500" />
                                       ) : (
                                          <div className="h-4 w-4" />
                                       )}
                                       {row.status}
                                    </div>
                                 </td>
                                 <td className="py-6 text-[14px] text-gray-400">{row.date}</td>
                                 <td className="py-6 pr-4 text-right">
                                    <button className="inline-flex items-center gap-2 text-[14px] font-semibold text-gray-900 transition-colors hover:text-blue-600">
                                       {row.action}
                                       {row.action === "Upload" ? <Upload className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                                    </button>
                                 </td>
                              </tr>
                              {row.subItems && row.subItems.map((sub, sIdx) => (
                                 <tr key={sIdx} className="bg-gray-50/20 group transition-colors hover:bg-gray-50/50">
                                    <td className="py-4 pl-14">
                                       <span className="text-[14px] text-gray-600">{sub.name}</span>
                                    </td>
                                    <td className="py-4">
                                       <div className={`flex items-center gap-2 text-[13px] ${sub.status === 'Not Available' ? 'text-red-500' : 'text-gray-500'}`}>
                                          {sub.status === 'Validated' ? (
                                             <Check className="h-3.5 w-3.5 text-emerald-500" />
                                          ) : (
                                             <X className="h-3.5 w-3.5 text-red-500" />
                                          )}
                                          {sub.status}
                                       </div>
                                    </td>
                                    <td className="py-4 text-[13px] text-gray-400"></td>
                                    <td className="py-4 pr-4 text-right"></td>
                                 </tr>
                              ))}
                           </React.Fragment>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>

            {/* Approve & Continue Button */}
            <div className="flex justify-end pt-4">
              <Link href="/setup/processing">
                <Button className="h-14 rounded-2xl bg-[#1A1C1E] px-10 text-[15px] font-semibold text-white shadow-xl shadow-black/10 transition-all hover:scale-[1.02] hover:bg-black active:scale-[0.98]">
                  Approve & Continue
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
