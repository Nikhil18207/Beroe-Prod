"use client";

import { motion } from "framer-motion";
import { Check, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";

export default function SetupPage() {
  const { state } = useApp();
  const router = useRouter();
  const completedSteps = state.setupStep;

  const tasks = [
    { name: "Confirm your portfolio", completed: completedSteps > 0 },
    { name: "Set your optimization goals", completed: completedSteps > 1 },
    { name: "Review your data", completed: completedSteps > 2 },
  ];

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#F0F9FF]">
      {/* Back Button */}
      <Link
        href="/login"
        className="absolute top-6 left-6 z-20 flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-gray-600 hover:bg-white hover:text-gray-900 transition-colors shadow-sm ring-1 ring-gray-100"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>

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
        {/* Logo */}
        <div className="mb-10 flex justify-center w-full">
          <img src="/53700-beroe-logo.webp" alt="Beroe" className="h-16 object-contain" />
        </div>

        <div className="mb-12 space-y-4">
          <h2 className="text-3xl font-semibold text-[#2D3344]">
            Hi {state.user?.name || "there"}
            {state.user?.org_name && (
              <span className="text-blue-600"> from {state.user.org_name}</span>
            )}
          </h2>
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
                <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
                  task.completed
                    ? "border-green-500 bg-green-500"
                    : "border-dashed border-gray-300 group-hover:border-blue-500"
                }`}>
                  {task.completed && <Check className="h-4 w-4 text-white" />}
                </div>
                <span className={`text-[15px] font-medium transition-colors ${
                  task.completed ? "text-green-600" : "text-[#4A4D55] group-hover:text-black"
                }`}>{task.name}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-6 p-8">
            <div className="flex flex-shrink-0 items-center gap-3">
              <span className="text-sm font-semibold text-[#1A1C1E]">{completedSteps} of 3 complete</span>
              <div className="h-1 w-4 rounded-full bg-gray-200" />
            </div>
            <div className="h-[6px] w-full rounded-full bg-gray-100">
               <div
                 className="h-full rounded-full bg-blue-500 transition-all duration-500"
                 style={{ width: `${(completedSteps / 3) * 100}%` }}
               />
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
