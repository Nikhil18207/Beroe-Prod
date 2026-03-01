"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/AppContext";
import { procurementApi } from "@/lib/api";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const { actions } = useApp();

  // Clear previous session data and form fields when landing on login page
  // This ensures a fresh start for new sessions
  useEffect(() => {
    actions.logout();
    // Clear form fields to prevent browser autofill (with delay to override browser autofill)
    const timer = setTimeout(() => {
      setEmail("");
      setPassword("");
    }, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Check backend health on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        await procurementApi.healthCheck();
      } catch (err) {
        console.log("Backend not available, using demo mode");
      }
    };
    checkBackend();
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }

    setIsLoading(true);

    try {
      // Login flow
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1"}/auth/login/json`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            password: password,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        // Store token (must match TOKEN_KEY in api/client.ts)
        localStorage.setItem("beroe_auth_token", data.access_token);
        // Set user in context
        actions.setUser({
          id: data.user.id,
          email: data.user.email,
          name: data.user.name || email.split("@")[0],
          company: data.user.org_name || data.user.company,
          role: data.user.role_name || data.user.role,
          organization_id: data.user.organization_id,
          department_id: data.user.department_id,
          role_id: data.user.role_id,
          org_name: data.user.org_name,
          dept_name: data.user.dept_name,
          role_name: data.user.role_name,
        });
        router.push("/setup");
      } else {
        // Show proper error message from backend
        const errorMessage = data.detail || "Invalid email or password";
        setError(errorMessage);
      }
    } catch (err) {
      // Network error or backend not available
      console.error("Login error:", err);
      setError("Unable to connect to server. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }, [email, password, actions, router]);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden">
      {/* Enhanced Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20" />
        <div className="gradient-mesh absolute inset-0 opacity-60" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-gradient-to-br from-blue-400/20 to-purple-400/20 blur-3xl animate-pulse" />
        <div
          className="absolute top-24 -right-24 h-96 w-96 rounded-full bg-gradient-to-br from-cyan-400/15 to-blue-400/15 blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 0.2,
          ease: "easeOut",
        }}
        className="relative z-10 w-full max-w-[520px] px-6"
      >
        <div className="glass-card overflow-hidden rounded-[32px] p-10 shadow-2xl border border-white/20 backdrop-blur-2xl bg-gradient-to-br from-white/90 via-white/80 to-white/70">
          <div className="flex flex-col items-center">
            {/* Beroe Logo */}
            <div className="mb-6">
              <img src="/Beroe_Inc_Logo.jpg" alt="Beroe" className="h-16" />
            </div>

            <h1 className="mb-5 text-xl font-semibold tracking-tight text-[#1A1C1E]">
              Welcome back
            </h1>

            <form className="w-full space-y-3" onSubmit={handleSubmit} autoComplete="nope">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="rounded-xl bg-red-50 p-3 text-sm text-red-600"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email Field */}
              <div className="relative group">
                <Mail className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-xl border-0 bg-white/70 pl-12 pr-4 text-gray-900 placeholder:text-gray-500 shadow-sm ring-1 ring-gray-200/50 focus:ring-2 focus:ring-blue-500/50"
                  disabled={isLoading}
                  required
                  autoComplete="one-time-code"
                />
              </div>

              {/* Password Field */}
              <div className="relative group">
                <Lock className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl border-0 bg-white/70 pl-12 pr-12 text-base text-gray-900 placeholder:text-gray-500 shadow-sm ring-1 ring-gray-200/50 focus:ring-2 focus:ring-blue-500/50"
                  disabled={isLoading}
                  required
                  minLength={8}
                  autoComplete="one-time-code"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 right-4 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isLoading}
                  variant="glass"
                  size="lg"
                  className="h-14 w-full rounded-xl bg-gradient-to-r from-blue-600/90 via-purple-600/90 to-pink-600/90 text-white text-base font-semibold shadow-xl hover:shadow-2xl hover:from-blue-500/90 hover:via-purple-500/90 hover:to-pink-500/90 backdrop-blur-xl border border-white/20 transition-all duration-300"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <span>Sign In</span>
                  )}
                </Button>
              </div>

              {/* Links */}
              <div className="pt-2 flex flex-col items-center gap-2">
                <Link href="/forgot-password" prefetch={true} className="text-sm font-medium text-gray-600 hover:text-black transition-colors">
                  Forgot password?
                </Link>
                <div className="text-sm text-gray-600">
                  New user?{" "}
                  <Link href="/register" prefetch={true} className="font-medium text-blue-600 hover:text-blue-700 transition-colors">
                    Register here
                  </Link>
                </div>
              </div>
            </form>
          </div>
        </div>
      </motion.div>

      {/* Yellow bar at bottom */}
      <div className="absolute bottom-0 left-0 z-0 h-48 w-full">
        <div className="absolute bottom-0 left-0 h-24 w-full bg-[#E5B800] opacity-90 shadow-2xl skew-y-3 origin-bottom-left" />
        <div className="absolute bottom-4 left-0 h-1 w-full border-t border-white/20" />
      </div>
    </div>
  );
}
