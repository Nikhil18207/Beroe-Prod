"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, Loader2, User } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/AppContext";
import { procurementApi } from "@/lib/api";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { actions } = useApp();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Check backend health first
      const health = await procurementApi.healthCheck();

      if (health.status === "healthy") {
        // For now, simulate login (in production, this would be real auth)
        // Set user in context
        actions.setUser({
          id: "user-1",
          email: email,
          name: username || email.split("@")[0],
          company: "Enterprise Corp",
          role: "Procurement Manager"
        });

        router.push("/setup");
      }
    } catch (err) {
      console.error("Login error:", err);
      // Even if backend is down, allow navigation for demo purposes
      actions.setUser({
        id: "user-1",
        email: email || "demo@beroe.com",
        name: username || (email ? email.split("@")[0] : "Demo User"),
        company: "Enterprise Corp",
        role: "Procurement Manager"
      });
      router.push("/setup");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden">
      {/* Enhanced Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20" />
        <div className="gradient-mesh absolute inset-0 opacity-60" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-gradient-to-br from-blue-400/20 to-purple-400/20 blur-3xl animate-pulse" />
        <div className="absolute top-24 -right-24 h-96 w-96 rounded-full bg-gradient-to-br from-cyan-400/15 to-blue-400/15 blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-[800px] w-[800px] rounded-full bg-gradient-radial from-transparent via-blue-100/10 to-transparent blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 0.8,
          ease: [0.25, 0.46, 0.45, 0.94],
          scale: { duration: 0.6, delay: 0.2 }
        }}
        className="relative z-10 w-full max-w-[480px] px-6"
      >
        <div className="glass-card overflow-hidden rounded-[32px] p-12 shadow-2xl border border-white/20 backdrop-blur-2xl bg-gradient-to-br from-white/90 via-white/80 to-white/70">
          <div className="flex flex-col items-center">
            {/* Enhanced Logo Orb */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.8, delay: 0.3, type: "spring", stiffness: 200 }}
              className="mb-10 flex h-20 w-20 items-center justify-center"
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-[3px] animate-spin opacity-75" style={{ animationDuration: '8s' }}>
                  <div className="h-full w-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 blur-sm" />
                </div>
                <div className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-white via-blue-50 to-purple-50 backdrop-blur-xl border border-white/30 shadow-2xl">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/50 animate-pulse" />
                  <div className="absolute inset-2 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 opacity-60 blur-sm animate-ping" style={{ animationDuration: '3s' }} />
                </div>
              </div>
            </motion.div>

            <h1 className="mb-10 text-2xl font-semibold tracking-tight text-[#1A1C1E]">
              Sign in to your account
            </h1>

            <form className="w-full space-y-5" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="space-y-3"
              >
                <div className="relative group">
                  <Mail className="absolute top-1/2 left-5 h-5 w-5 -translate-y-1/2 text-gray-800 group-focus-within:text-blue-600 transition-colors duration-300" />
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-14 rounded-2xl border-0 bg-white/70 backdrop-blur-sm pl-14 pr-4 text-gray-900 placeholder:text-gray-500 shadow-lg ring-1 ring-white/30 transition-all duration-300 hover:bg-white/80 hover:ring-white/40 focus:bg-white/90 focus:ring-2 focus:ring-blue-500/50 focus:shadow-glow focus:shadow-blue-500/25"
                    disabled={isLoading}
                  />
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="space-y-3"
              >
                <div className="relative group">
                  <Lock className="absolute top-1/2 left-5 h-5 w-5 -translate-y-1/2 text-gray-800 group-focus-within:text-blue-600 transition-colors duration-300" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-14 rounded-2xl border-0 bg-white/70 backdrop-blur-sm pl-14 pr-14 text-gray-900 placeholder:text-gray-500 shadow-lg ring-1 ring-white/30 transition-all duration-300 hover:bg-white/80 hover:ring-white/40 focus:bg-white/90 focus:ring-2 focus:ring-blue-500/50 focus:shadow-glow focus:shadow-blue-500/25"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-1/2 right-5 -translate-y-1/2 text-gray-800 hover:text-gray-900 transition-colors duration-200 p-1 rounded-lg hover:bg-gray-100/50"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.7 }}
                className="space-y-3"
              >
                <div className="relative group">
                  <User className="absolute top-1/2 left-5 h-5 w-5 -translate-y-1/2 text-gray-800 group-focus-within:text-blue-600 transition-colors duration-300" />
                  <Input
                    type="text"
                    placeholder="Enter your name"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-14 rounded-2xl border-0 bg-white/70 backdrop-blur-sm pl-14 pr-4 text-gray-900 placeholder:text-gray-500 shadow-lg ring-1 ring-white/30 transition-all duration-300 hover:bg-white/80 hover:ring-white/40 focus:bg-white/90 focus:ring-2 focus:ring-blue-500/50 focus:shadow-glow focus:shadow-blue-500/25"
                    disabled={isLoading}
                  />
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
              >
                <Button
                  type="submit"
                  disabled={isLoading}
                  variant="glass"
                  size="lg"
                  className="h-16 w-full rounded-2xl bg-gradient-to-r from-blue-600/90 via-purple-600/90 to-pink-600/90 text-white text-lg font-semibold shadow-2xl shadow-purple-500/30 hover:shadow-3xl hover:shadow-purple-500/50 hover:from-blue-500/90 hover:via-purple-500/90 hover:to-pink-500/90 backdrop-blur-xl border border-white/20 hover:border-white/40 transition-all duration-300 group"
                >
                  {isLoading ? (
                    <>
                      <div className="relative mr-3">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <div className="absolute inset-0 h-6 w-6 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 opacity-30 animate-ping" />
                      </div>
                      <span className="text-gradient animate-pulse">Connecting...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue</span>
                      <div className="ml-2 h-2 w-2 rounded-full bg-white/60 group-hover:bg-white transition-colors duration-300" />
                    </>
                  )}
                </Button>
              </motion.div>

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
