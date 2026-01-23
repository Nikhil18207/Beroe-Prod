"use client";

import { motion } from "framer-motion";
import { CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

export default function SetupPage() {
  const tasks = [
    "Confirm your portfolio",
    "Set your optimization goals",
    "Data Sources",
    "Key Insights",
    "Review your category data",
  ];

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#F0F9FF]">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-b from-[#87CEEB]/40 via-white to-white" />
        
        {/* Yellow Building Detail */}
        <div className="absolute bottom-[-10%] left-[-10%] z-0 h-[60%] w-[50%] rotate-[-15deg] overflow-hidden border-t-8 border-white bg-[#E5B800] shadow-2xl">
          <div className="flex h-full w-full flex-col space-y-4 pt-10">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="h-[2px] w-full bg-black/10" />
            ))}
          </div>
          {/* Railing */}
          <div className="absolute top-4 left-0 h-[2px] w-full bg-white/40" />
          <div className="absolute top-10 left-0 h-[2px] w-full bg-white/40" />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 flex w-full max-w-[800px] flex-col items-center px-6 text-center"
      >
        {/* Logo Orb */}
        <div className="mb-10 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 via-purple-500 to-pink-500 p-[2px] shadow-xl shadow-blue-200/50">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 blur-[2px]" />
          </div>
        </div>

        <div className="mb-12 space-y-4">
          <p className="text-xl font-medium text-[#4A4D55]">First, let's get me up to speed</p>
          <h1 className="text-4xl font-semibold tracking-tight text-[#2D3344]">
            Help me learn about your business and <br /> procurement priorities
          </h1>
        </div>

        <div className="w-full max-w-[640px] overflow-hidden rounded-[32px] bg-white shadow-[0_30px_60px_rgba(0,0,0,0.06)] ring-1 ring-black/5">
          <div className="p-8 pb-4 text-left">
            <h2 className="text-lg font-semibold text-[#1A1C1E]">Complete your profile setup</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-gray-100 p-8">
            {tasks.map((task, index) => (
              <div key={index} className="flex items-center gap-4 group cursor-pointer">
                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-gray-300 group-hover:border-blue-500 transition-colors">
                  <div className="h-1 w-1 rounded-full bg-transparent" />
                </div>
                <span className="text-[15px] font-medium text-[#4A4D55] group-hover:text-black transition-colors">{task}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-6 p-8">
            <div className="flex flex-shrink-0 items-center gap-3">
              <span className="text-sm font-semibold text-[#1A1C1E]">0 of 5 complete</span>
              <div className="h-1 w-4 rounded-full bg-gray-200" />
            </div>
            <div className="h-[6px] w-full rounded-full bg-gray-100">
               <div className="h-full w-0 rounded-full bg-blue-500" />
            </div>
          </div>
        </div>

        <Link href="/setup/portfolio" className="mt-12 w-full max-w-[400px]">
          <Button
            className="h-16 w-full rounded-[20px] bg-[#1A1C1E] text-lg font-medium text-white transition-all hover:bg-[#2D3344] active:scale-[0.98] shadow-lg"
          >
            Continue
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
