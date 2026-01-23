"use client";

import { motion } from "framer-motion";
import { 
  ChevronLeft, 
  ArrowRight, 
  Folder, 
  Trash2, 
  Plus, 
  X,
  Home,
  Activity,
  ShieldCheck,
  Search,
  User,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function PortfolioSetupPage() {
  const portfolioItems = [
    { name: "Grains", locations: ["Europe", "India"] },
    { name: "Oils", locations: ["Europe", "India"] },
  ];

  const steps = [
    { name: "Confirm your portfolio", active: true },
    { name: "Set your optimization goals", active: false },
    { name: "Data Sources", active: false },
    { name: "Key Insights", active: false },
    { name: "Review your data", active: false },
  ];

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-[#F0F9FF]">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-b from-[#B3D9FF]/40 via-[#F0F9FF] to-white" />
        
        {/* Yellow Building Detail - matching the perspective in the image */}
        <div className="absolute bottom-[-10%] left-[-5%] z-0 h-[50%] w-[60%] rotate-[-8deg] overflow-hidden border-t-[10px] border-white/50 bg-[#E5B800] shadow-2xl">
           <div className="absolute inset-0 flex flex-col space-y-6 pt-12">
             {Array.from({ length: 15 }).map((_, i) => (
               <div key={i} className="h-[1px] w-full bg-black/10" />
             ))}
           </div>
           {/* Windows/Structure detail */}
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
          <Link href="/setup" className="flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-black">
            <ChevronLeft className="h-4 w-4" />
            Go Back
          </Link>
          
          <div className="flex items-center gap-3">
             <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Your Portfolio</span>
             <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white">2</span>
          </div>

          <Link href="/setup/goals">
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
                First, let's confirm what categories & geographies your portfolio includes.
              </h1>
              {/* Logo Orb Small */}
              <div className="mt-4 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 via-purple-500 to-pink-500 p-[1px] shadow-sm">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                  <div className="h-4 w-4 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 blur-[1px]" />
                </div>
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
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${step.active ? 'border-black bg-black' : 'border-dashed border-gray-300'}`}>
                      {step.active && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-[14px] font-medium text-[#1A1C1E]">{step.name}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-gray-100 p-6 pt-5">
                <div className="flex items-center justify-between mb-3">
                   <span className="text-[12px] font-semibold text-gray-400">0 of 5 complete</span>
                   <div className="h-1 w-8 rounded-full bg-gray-100">
                      <div className="h-full w-0 bg-blue-500 rounded-full" />
                   </div>
                </div>
                <div className="h-[4px] w-full rounded-full bg-gray-50">
                  <div className="h-full w-[15%] rounded-full bg-[#1A1C1E]" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Portfolio Cards */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {portfolioItems.map((item, idx) => (
              <Link href="/setup/goals" key={idx} className="block">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="group relative flex flex-col rounded-[32px] bg-white p-8 shadow-[0_15px_30px_rgba(0,0,0,0.03)] transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] ring-1 ring-black/5"
                >
                  <div className="flex items-center justify-between mb-8">
                     <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 transition-colors group-hover:bg-sky-100">
                        <Folder className="h-6 w-6 text-sky-500" />
                     </div>
                     <button className="text-gray-300 transition-colors hover:text-red-500" onClick={(e) => e.preventDefault()}>
                        <Trash2 className="h-5 w-5" />
                     </button>
                  </div>

                  <h3 className="mb-6 text-2xl font-semibold text-[#1A1C1E]">{item.name}</h3>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {item.locations.map((loc) => (
                      <Badge key={loc} variant="secondary" className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-2.5 text-[13px] font-medium text-[#4A4D55] border-none hover:bg-gray-100" onClick={(e) => e.preventDefault()}>
                        {loc}
                        <X className="h-3 w-3 text-gray-400" />
                      </Badge>
                    ))}
                  </div>

                  <Button variant="outline" className="mt-auto h-12 w-fit rounded-xl border-dashed border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-black" onClick={(e) => e.preventDefault()}>
                     <Plus className="mr-2 h-4 w-4" />
                     Add Location
                  </Button>
                </motion.div>
              </Link>
            ))}

            {/* Add Category Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex cursor-pointer flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-gray-200 p-8 transition-all hover:border-blue-400/50 hover:bg-blue-50/10 group"
            >
               <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-500 transition-transform group-hover:scale-110">
                  <Plus className="h-6 w-6" />
               </div>
               <span className="text-xl font-semibold text-[#1A1C1E]">Add a Category</span>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
