"use client";

import { motion } from "framer-motion";
import {
  Home,
  Activity,
  ShieldCheck,
  Search,
  User,
  LogOut
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";

export default function ProcessingPage() {
  const router = useRouter();
  const { state, actions } = useApp();
  const [status, setStatus] = useState("Analyzing your spend data...");

  useEffect(() => {
    const statuses = [
      "Analyzing your spend data...",
      "Evaluating proof points...",
      "Calculating savings opportunities...",
      "Preparing your dashboard..."
    ];

    let currentIndex = 0;
    const statusInterval = setInterval(() => {
      currentIndex = (currentIndex + 1) % statuses.length;
      setStatus(statuses[currentIndex]);
    }, 1000);

    const timer = setTimeout(() => {
      actions.setSetupStep(5);
      router.push("/dashboard");
    }, 4000);

    return () => {
      clearTimeout(timer);
      clearInterval(statusInterval);
    };
  }, [router, actions]);

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
           <div className="p-2 rounded-lg hover:bg-black/5 transition-colors cursor-pointer">
             <Home className="h-6 w-6" />
           </div>
           <div className="p-2 rounded-lg bg-blue-50/50 text-blue-600 transition-colors cursor-pointer">
             <Activity className="h-6 w-6" />
           </div>
           <div className="p-2 rounded-lg hover:bg-black/5 transition-colors cursor-pointer">
             <ShieldCheck className="h-6 w-6" />
           </div>
        </div>

        <div className="mt-auto flex flex-col gap-8 text-gray-400">
           <Search className="h-6 w-6" />
           <User className="h-6 w-6" />
           <LogOut className="h-6 w-6 text-red-400/60" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-8">
        <div className="relative flex flex-col items-center max-w-2xl text-center space-y-8">
          
          {/* Central AI Orb Animation */}
          <div className="relative h-40 w-40">
            {/* Animated Glow Layers */}
            <motion.div 
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.6, 0.3],
                rotate: [0, 180, 360]
              }}
              transition={{ 
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-400/30 via-purple-500/20 to-indigo-400/30 blur-3xl"
            />
            
            <motion.div 
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, -180, -360]
              }}
              transition={{ 
                duration: 10,
                repeat: Infinity,
                ease: "linear"
              }}
              className="absolute inset-4 rounded-full bg-gradient-to-bl from-cyan-400/20 via-blue-500/20 to-purple-400/20 blur-2xl"
            />

            {/* Core Orb */}
            <motion.div 
              animate={{ 
                y: [0, -8, 0],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ 
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="relative h-full w-full rounded-full bg-white shadow-[0_0_60px_rgba(59,130,246,0.3)] ring-1 ring-white/50 overflow-hidden"
            >
              {/* Internal Swirls */}
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-white to-purple-500/10" />
              
              <motion.div 
                animate={{ 
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 0.8, 0.5],
                  x: [-20, 20, -20],
                  y: [-20, 20, -20]
                }}
                transition={{ 
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute -inset-10 bg-gradient-to-tr from-blue-400 via-indigo-500 to-purple-500 blur-xl opacity-40 mix-blend-multiply"
              />

              <motion.div 
                animate={{ 
                  scale: [1.2, 0.8, 1.2],
                  x: [20, -20, 20],
                  y: [20, -20, 20]
                }}
                transition={{ 
                  duration: 7,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute -inset-10 bg-gradient-to-br from-cyan-300 via-blue-400 to-indigo-500 blur-xl opacity-30 mix-blend-screen"
              />

              {/* Surface Reflection */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-black/5" />
            </motion.div>
          </div>

          {/* Text Content */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="space-y-4"
          >
            <h1 className="text-3xl font-medium tracking-tight text-[#1A1C1E] font-serif italic">
              {state.analysisResponse ? "Analysis Complete!" : "Thanks for validating your data"}
            </h1>
            <p className="text-lg text-gray-400/80 font-medium">
              {status}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
