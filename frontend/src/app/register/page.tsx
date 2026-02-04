"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, User, Building2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated, isLoading: authLoading, error, clearError } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    company: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, authLoading, router]);

  // Clear errors when inputs change
  useEffect(() => {
    if (error) clearError();
    if (localError) setLocalError(null);
  }, [formData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    // Validation
    if (!formData.name.trim()) {
      setLocalError("Full name is required");
      return;
    }
    if (!formData.email.trim()) {
      setLocalError("Email is required");
      return;
    }
    if (!formData.username.trim()) {
      setLocalError("Username is required");
      return;
    }
    if (formData.username.length < 3) {
      setLocalError("Username must be at least 3 characters");
      return;
    }
    if (!formData.password) {
      setLocalError("Password is required");
      return;
    }
    if (formData.password.length < 6) {
      setLocalError("Password must be at least 6 characters");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setLocalError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    const success = await register({
      name: formData.name.trim(),
      email: formData.email.trim(),
      username: formData.username.trim(),
      password: formData.password,
      company: formData.company.trim() || undefined,
    });

    if (success) {
      router.push("/setup/portfolio");
    }

    setIsSubmitting(false);
  };

  const displayError = localError || error;

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#E8F4FC] via-[#F0F8FF] to-white">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-b from-[#E8F4FC] via-[#F0F8FF] to-white">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background Decor */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute bottom-[-20%] left-[-10%] h-[70%] w-[55%] rotate-[-12deg] overflow-hidden bg-[#E5B800] shadow-2xl opacity-60">
            <div className="absolute inset-0 flex flex-col space-y-6 pt-12">
              {Array.from({ length: 25 }).map((_, i) => (
                <div key={i} className="h-[2px] w-full bg-black/5" />
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Logo */}
            <div className="flex items-center gap-3 mb-12">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <div className="h-6 w-6 rounded-full bg-white/30 backdrop-blur-sm" />
              </div>
              <span className="text-2xl font-bold text-gray-900">Beroe</span>
            </div>

            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Start Your
              <br />
              <span className="text-blue-600">Procurement Journey</span>
            </h1>
            <p className="text-lg text-gray-600 max-w-md">
              Join thousands of procurement professionals using AI to optimize their sourcing strategies.
            </p>

            {/* Benefits */}
            <div className="mt-12 space-y-4">
              {[
                "Free 14-day trial, no credit card required",
                "Set up in minutes with guided onboarding",
                "Instant insights from your spend data",
              ].map((benefit, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + idx * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-gray-700">{benefit}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Register Form */}
      <div className="flex-1 flex items-center justify-center px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
              <div className="h-5 w-5 rounded-full bg-white/30 backdrop-blur-sm" />
            </div>
            <span className="text-xl font-bold text-gray-900">Beroe</span>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-3xl shadow-xl p-8 ring-1 ring-gray-100">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Create account</h2>
              <p className="text-gray-500 mt-2">Get started with your free trial</p>
            </div>

            {/* Error Message */}
            {displayError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3"
              >
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{displayError}</p>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="John Doe"
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-gray-900 placeholder:text-gray-400"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Email Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@company.com"
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-gray-900 placeholder:text-gray-400"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Username Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="johndoe"
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-gray-900 placeholder:text-gray-400"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Company Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company <span className="text-gray-400">(Optional)</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    placeholder="Acme Inc."
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-gray-900 placeholder:text-gray-400"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Min. 6 characters"
                    className="w-full pl-12 pr-12 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-gray-900 placeholder:text-gray-400"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-gray-900 placeholder:text-gray-400"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-gray-900 text-white font-semibold hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create account"
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-sm text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Login Link */}
            <p className="text-center text-gray-600">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                Sign in
              </Link>
            </p>
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-gray-400 mt-8">
            By creating an account, you agree to our{" "}
            <Link href="/terms" className="text-gray-600 hover:text-gray-800">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-gray-600 hover:text-gray-800">
              Privacy Policy
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
