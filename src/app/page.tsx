"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/setup");
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#E6F3FF]">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-br from-blue-100 via-white to-blue-50 opacity-50" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="absolute top-24 -right-24 h-96 w-96 rounded-full bg-sky-200/30 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[440px] px-6"
      >
        <div className="overflow-hidden rounded-[40px] bg-white p-10 shadow-[0_20px_50px_rgba(0,0,0,0.05)] ring-1 ring-black/5">
          <div className="flex flex-col items-center">
            {/* Logo Orb */}
            <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 via-purple-500 to-pink-500 p-[2px] shadow-lg shadow-blue-200/50">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 blur-[2px]" />
              </div>
            </div>

            <h1 className="mb-10 text-2xl font-semibold tracking-tight text-[#1A1C1E]">
              Sign in to your account
            </h1>

            <form className="w-full space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <div className="relative">
                  <Mail className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 pl-12 transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 px-12 transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-1/2 right-4 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="h-14 w-full rounded-2xl bg-[#2D3344] text-lg font-medium text-white transition-all hover:bg-[#1E2330] active:scale-[0.98]"
              >
                Continue
              </Button>

              <div className="pt-2 text-center">
                <a
                  href="#"
                  className="text-sm font-medium text-gray-600 transition-colors hover:text-black"
                >
                  Forgot password?
                </a>
              </div>
            </form>
          </div>
        </div>
      </motion.div>

      {/* Architecture Detail (Yellow bar at bottom) */}
      <div className="absolute bottom-0 left-0 z-0 h-48 w-full">
         <div className="absolute bottom-0 left-0 h-24 w-full bg-[#E5B800] opacity-90 shadow-2xl skew-y-3 origin-bottom-left" />
         <div className="absolute bottom-4 left-0 h-1 w-full border-t border-white/20" />
      </div>
    </div>
  );
}
