"use client";

import { motion } from "framer-motion";
import { 
  ChevronLeft, 
  ArrowRight, 
  Folder, 
  Plus, 
  Home,
  Activity,
  ShieldCheck,
  Search,
  User,
  LogOut,
  Check,
  CircleDollarSign,
  ShieldAlert,
  Leaf
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import Link from "next/link";
import React from "react";

export default function GoalsSetupPage() {
  const [goals, setGoals] = React.useState({
    cost: [40],
    risk: [85],
    esg: [15]
  });

  const getLabel = (val: number) => {
    if (val < 33) return { text: "Low", color: "text-amber-600" };
    if (val < 66) return { text: "Medium", color: "text-blue-600" };
    return { text: "High", color: "text-emerald-600" };
  };

  const steps = [
    { name: "Confirm your portfolio", completed: true, active: false },
    { name: "Set your optimization goals", completed: false, active: true },
    { name: "Data Sources", completed: false, active: false },
    { name: "Key Insights", completed: false, active: false },
    { name: "Review your data", completed: false, active: false },
  ];

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-[#F0F9FF]">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-b from-[#B3D9FF]/40 via-[#F0F9FF] to-white" />
        
        {/* Yellow Building Detail - Perspective matching image */}
        <div className="absolute bottom-[-10%] left-[-5%] z-0 h-[50%] w-[60%] rotate-[-8deg] overflow-hidden border-t-[10px] border-white/50 bg-[#E5B800] shadow-2xl">
           <div className="absolute inset-0 flex flex-col space-y-6 pt-12">
             {Array.from({ length: 15 }).map((_, i) => (
               <div key={i} className="h-[1px] w-full bg-black/10" />
             ))}
           </div>
           <div className="absolute top-1/4 left-1/4 grid grid-cols-4 gap-4 opacity-20">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-20 w-12 bg-black/20 rounded-sm" />
              ))}
           </div>
        </div>
      </div>

      {/* Left Icon Sidebar */}
      <div className="relative z-20 flex w-16 flex-col items-center border-r border-gray-200/50 bg-white/20 py-8 backdrop-blur-md">
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
      <div className="relative z-10 flex flex-1 flex-col p-8 lg:p-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-16">
          <Link href="/setup/portfolio" className="flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-black">
            <ChevronLeft className="h-4 w-4" />
            Go Back
          </Link>
          
          <div className="flex items-center gap-3">
             <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Your Optimization Goals</span>
          </div>

          <Link href="/setup/review">
            <Button className="h-11 rounded-xl bg-[#1A1C1E] px-6 text-sm font-medium text-white transition-all hover:bg-black">
              Apply & Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[400px_1fr]">
          {/* Left Column */}
          <div className="space-y-12">
            <div className="space-y-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Max</span>
              <h1 className="max-w-[320px] text-3xl font-medium leading-tight tracking-tight text-[#1A1C1E]">
                Now let's talk about what goals serve you best.
              </h1>
              <p className="max-w-[320px] text-[14px] leading-relaxed text-gray-500">
                How would you rate the importance of these themes?
              </p>
              <div className="mt-8 space-y-2 rounded-2xl bg-blue-50/50 p-4 border border-blue-100/50">
                <p className="text-[13px] italic leading-relaxed text-blue-600/80">
                  You can't set all categories to High. Increasing one category will automatically reduce others to keep the overall balance.
                </p>
              </div>
            </div>

            {/* Checklist Card */}
            <div className="w-full max-w-[340px] overflow-hidden rounded-[32px] bg-white shadow-[0_20px_40px_rgba(0,0,0,0.04)] ring-1 ring-black/5">
              <div className="p-7 pb-4">
                <h2 className="text-[15px] font-semibold text-[#1A1C1E]">Complete your profile setup</h2>
              </div>
              
              <div className="space-y-1 p-2">
                {steps.map((step, idx) => (
                  <div 
                    key={idx} 
                    className={`flex items-center gap-4 rounded-2xl p-4 transition-colors ${step.active ? 'bg-gray-50' : 'opacity-60'}`}
                  >
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${step.completed ? 'border-black bg-black' : step.active ? 'border-black bg-white' : 'border-dashed border-gray-300'}`}>
                      {step.completed ? <Check className="h-3 w-3 text-white" /> : step.active && <div className="h-1.5 w-1.5 rounded-full bg-black" />}
                    </div>
                    <span className={`text-[14px] font-medium ${step.completed ? 'text-gray-400 line-through' : 'text-[#1A1C1E]'}`}>{step.name}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-gray-100 p-6 pt-5">
                <div className="flex items-center justify-between mb-3">
                   <span className="text-[12px] font-semibold text-gray-400">1 of 5 complete</span>
                </div>
                <div className="h-[4px] w-full rounded-full bg-gray-50">
                  <div className="h-full w-[35%] rounded-full bg-[#1A1C1E] transition-all duration-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Goal Sliders */}
          <div className="flex flex-col gap-6 lg:flex-row">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 rounded-[40px] bg-white p-10 shadow-[0_20px_60px_rgba(0,0,0,0.04)] ring-1 ring-black/5"
            >
              <div className="flex items-center gap-4 mb-10">
                 <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50">
                    <Folder className="h-6 w-6 text-sky-500" />
                 </div>
                 <div>
                   <div className="flex items-center gap-2">
                     <h3 className="text-xl font-semibold text-[#1A1C1E]">All Categories</h3>
                     <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-[11px] font-bold text-white">3</span>
                   </div>
                   <p className="mt-1 text-[13px] text-gray-400">These are the categories used to evaluate this goal. Adjust each slider to reflect its relative importance.</p>
                 </div>
              </div>

              <div className="space-y-12">
                {/* Cost Savings */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <CircleDollarSign className="h-5 w-5 text-gray-400" />
                       <span className="text-[15px] font-medium text-[#1A1C1E]">Cost Savings</span>
                    </div>
                    <span className={`text-[15px] font-semibold ${getLabel(goals.cost[0]).color}`}>{getLabel(goals.cost[0]).text}</span>
                  </div>
                  <Slider 
                    value={goals.cost} 
                    onValueChange={(val) => setGoals(prev => ({ ...prev, cost: val }))}
                    max={100} 
                    step={1}
                    className="[&_[data-slot=slider-range]]:bg-indigo-500 [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-thumb]]:h-6 [&_[data-slot=slider-thumb]]:w-6 [&_[data-slot=slider-thumb]]:border-[3px] [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:shadow-md"
                  />
                  <div className="flex justify-between text-[10px] text-gray-300">
                    <span>|</span>
                    <span>|</span>
                    <span>|</span>
                  </div>
                </div>

                {/* Risk Management */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <ShieldAlert className="h-5 w-5 text-gray-400" />
                       <span className="text-[15px] font-medium text-[#1A1C1E]">Risk Management</span>
                    </div>
                    <span className={`text-[15px] font-semibold ${getLabel(goals.risk[0]).color}`}>{getLabel(goals.risk[0]).text}</span>
                  </div>
                  <Slider 
                    value={goals.risk} 
                    onValueChange={(val) => setGoals(prev => ({ ...prev, risk: val }))}
                    max={100} 
                    step={1}
                    className="[&_[data-slot=slider-range]]:bg-indigo-500 [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-thumb]]:h-6 [&_[data-slot=slider-thumb]]:w-6 [&_[data-slot=slider-thumb]]:border-[3px] [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:shadow-md"
                  />
                  <div className="flex justify-between text-[10px] text-gray-300">
                    <span>|</span>
                    <span>|</span>
                    <span>|</span>
                  </div>
                </div>

                {/* ESG */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <Leaf className="h-5 w-5 text-gray-400" />
                       <span className="text-[15px] font-medium text-[#1A1C1E]">ESG</span>
                    </div>
                    <span className={`text-[15px] font-semibold ${getLabel(goals.esg[0]).color}`}>{getLabel(goals.esg[0]).text}</span>
                  </div>
                  <Slider 
                    value={goals.esg} 
                    onValueChange={(val) => setGoals(prev => ({ ...prev, esg: val }))}
                    max={100} 
                    step={1}
                    className="[&_[data-slot=slider-range]]:bg-indigo-500 [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-thumb]]:h-6 [&_[data-slot=slider-thumb]]:w-6 [&_[data-slot=slider-thumb]]:border-[3px] [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:shadow-md"
                  />
                  <div className="flex justify-between text-[10px] text-gray-300">
                    <span>|</span>
                    <span>|</span>
                    <span>|</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Add Category Goal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="flex h-[320px] w-full cursor-pointer flex-col items-center justify-center rounded-[40px] border-2 border-dashed border-gray-200/60 bg-white/40 p-10 transition-all hover:border-blue-400/50 hover:bg-white/80 group lg:w-[320px]"
            >
               <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-sky-50 text-sky-500 transition-transform group-hover:scale-110">
                  <Plus className="h-7 w-7" />
               </div>
               <span className="text-center text-xl font-semibold leading-tight text-[#1A1C1E]">Add a Category Specific Goal</span>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
