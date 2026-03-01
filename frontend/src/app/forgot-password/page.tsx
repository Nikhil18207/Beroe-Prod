"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [resetLink, setResetLink] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/v1/auth/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setIsSubmitted(true);
        // In development, show the reset link
        if (data.reset_link) {
          setResetLink(data.reset_link);
        }
      } else {
        setError(data.detail || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Unable to connect to server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white">
      {/* Back Button */}
      <Link
        href="/login"
        className="absolute top-6 left-6 z-20 flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-gray-600 hover:bg-white hover:text-gray-900 transition-colors shadow-sm ring-1 ring-gray-100"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md px-6"
      >
        <div className="rounded-3xl bg-white p-8 shadow-xl ring-1 ring-gray-100">
          {!isSubmitted ? (
            <>
              {/* Header */}
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
                  <Mail className="h-7 w-7 text-blue-600" />
                </div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  Forgot Password?
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                  No worries! Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="h-12 pl-10 rounded-xl"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !email}
                  className="h-12 w-full rounded-xl bg-gray-900 text-white hover:bg-gray-800"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Back to Login
                </Link>
              </div>
            </>
          ) : (
            /* Success State */
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">
                Check your email
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                We&apos;ve sent a password reset link to{" "}
                <span className="font-medium text-gray-900">{email}</span>
              </p>

              {/* Development mode: Show reset link directly */}
              {resetLink && (
                <div className="mt-6 rounded-lg bg-amber-50 p-4 text-left">
                  <p className="text-xs font-medium text-amber-800 mb-2">
                    Development Mode - Reset Link:
                  </p>
                  <button
                    onClick={() => {
                      const url = new URL(resetLink);
                      router.push(url.pathname + url.search);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800 underline break-all"
                  >
                    Click here to reset your password
                  </button>
                </div>
              )}

              <div className="mt-6 space-y-3">
                <Button
                  onClick={() => {
                    setIsSubmitted(false);
                    setEmail("");
                    setResetLink("");
                  }}
                  variant="outline"
                  className="w-full h-12 rounded-xl"
                >
                  Try another email
                </Button>
                <Link href="/login">
                  <Button
                    variant="ghost"
                    className="w-full h-12 rounded-xl text-gray-600"
                  >
                    Back to Login
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Decorative bottom bar */}
      <div className="absolute bottom-0 left-0 z-0 h-24 w-full">
        <div className="absolute bottom-0 left-0 h-16 w-full bg-[#E5B800] opacity-90 shadow-2xl skew-y-2 origin-bottom-left" />
      </div>
    </div>
  );
}
