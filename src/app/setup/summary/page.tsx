"use client";

import { motion } from "framer-motion";
import { 
  ChevronLeft, 
  ArrowRight, 
  Pencil,
  Download,
  ChevronDown,
  Home,
  Activity,
  ShieldCheck,
  Search,
  User,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import React from "react";

export default function SummaryViewPage() {
  const locations = [
    { name: "United States", value: "34%" },
    { name: "Canada", value: "29%" },
    { name: "Mexico", value: "21%" },
    { name: "Germany", value: "7%" },
    { name: "Japan", value: "3%" },
    { name: "France", value: "1%", ghost: true },
  ];

  const suppliers = [
    { name: "Asia Pacific Grains", value: "34%" },
    { name: "Pacific Rim Cereals", value: "29%" },
    { name: "EuroGrain Trading", value: "21%" },
    { name: "Orient Food Supply", value: "7%" },
    { name: "Brazilian Grain Consortium", value: "3%" },
    { name: "Nordic Cereals Ltd", value: "1%", ghost: true },
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
      <div className="relative z-10 flex flex-1 flex-col p-8 lg:p-12">
        {/* Card Container */}
        <div className="mx-auto w-full max-w-6xl rounded-[40px] bg-white p-10 shadow-[0_20px_60px_rgba(0,0,0,0.02)] ring-1 ring-black/5">
          
          {/* Header Actions */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/setup/review" className="flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-black">
                <ChevronLeft className="h-4 w-4" />
                Go Back
              </Link>
              <span className="text-gray-200">/</span>
              <span className="text-sm font-bold text-black">Summary View</span>
            </div>
            
            <div className="flex items-center gap-3">
               <Button variant="outline" className="h-10 rounded-xl px-5 text-[13px] font-semibold border-gray-200">
                 <Pencil className="mr-2 h-4 w-4" />
                 Edit
               </Button>
                 <Link href="/setup/review/coconut">
                   <Button className="h-10 rounded-xl bg-[#1A1C1E] px-6 text-[13px] font-semibold text-white hover:bg-black">
                     Approve & Continue
                     <ArrowRight className="ml-2 h-4 w-4" />
                   </Button>
                 </Link>
            </div>
          </div>

          {/* Subtitle */}
          <p className="mb-10 max-w-2xl text-[15px] leading-relaxed text-gray-500">
            Here is a summary view of your spend data. You can also get a preview of the data or can download for a more detailed view.
          </p>

          {/* Spend Controls Row */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Spend</span>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-bold text-black">$</span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
                <span className="text-2xl font-bold text-black">3.3M</span>
                <span className="ml-2 text-[12px] font-medium text-gray-400">Jun '24 - May '25</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-2xl bg-gray-50 p-1.5">
                <button className="rounded-xl bg-white px-5 py-2 text-[13px] font-medium text-[#1A1C1E] shadow-sm ring-1 ring-black/5">$ Currency</button>
                <button className="px-5 py-2 text-[13px] font-medium text-gray-400 transition-colors hover:text-black">% Percentage</button>
              </div>
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-gray-200">
                <Download className="h-4 w-4 text-gray-500" />
              </Button>
              <button className="flex items-center gap-2 pl-4 pr-1 text-[13px] font-semibold text-gray-900 transition-colors hover:text-blue-600">
                View Full Data
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Charts/Lists Grid */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Spend by Location */}
            <div className="rounded-[32px] border border-gray-100 bg-white p-8">
              <h3 className="mb-8 text-[15px] font-medium text-gray-600 italic">
                Spend by Location looks like this
              </h3>
              <div className="space-y-6">
                {locations.map((item, idx) => (
                  <div key={idx} className={`flex items-center justify-between pb-4 border-b border-gray-50 last:border-0 ${item.ghost ? 'opacity-20' : ''}`}>
                    <span className={`text-[15px] ${item.ghost ? 'text-gray-400' : 'text-gray-900 font-medium'}`}>
                      {item.name}
                    </span>
                    <span className={`text-[15px] ${item.ghost ? 'text-gray-400' : 'text-gray-600 font-semibold'}`}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Spend by Supplier */}
            <div className="rounded-[32px] border border-gray-100 bg-white p-8">
              <h3 className="mb-8 text-[15px] font-medium text-gray-600 italic">
                Spend by Supplier looks like this
              </h3>
              <div className="space-y-6">
                {suppliers.map((item, idx) => (
                  <div key={idx} className={`flex items-center justify-between pb-4 border-b border-gray-50 last:border-0 ${item.ghost ? 'opacity-20' : ''}`}>
                    <span className={`text-[15px] ${item.ghost ? 'text-gray-400' : 'text-gray-900 font-medium'}`}>
                      {item.name}
                    </span>
                    <span className={`text-[15px] ${item.ghost ? 'text-gray-400' : 'text-gray-600 font-semibold'}`}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
