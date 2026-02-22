"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If true, redirects to setup if user hasn't completed it */
  requireSetupComplete?: boolean;
  /** Custom redirect path (default: /login) */
  redirectTo?: string;
}

// Check if there's any persisted demo data (user has used the app before)
const hasDemoData = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    // Check for any of these indicators that user has completed setup
    const setupData = localStorage.getItem("beroe_setup_data");
    const spendAnalysis = localStorage.getItem("beroe_spend_analysis");
    const reviewData = localStorage.getItem("beroe_review_data");

    if (setupData) {
      const parsed = JSON.parse(setupData);
      if (parsed.categoryName && parsed.categoryName !== "") {
        return true;
      }
    }
    if (spendAnalysis) return true;
    if (reviewData) {
      const parsed = JSON.parse(reviewData);
      if (parsed.spendFile || (parsed.dataPointFiles && Object.keys(parsed.dataPointFiles).length > 0)) {
        return true;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return false;
};

/**
 * ProtectedRoute - Wraps pages that require authentication
 *
 * Supports "demo mode" where users who have persisted setup data
 * can continue using the app without re-authentication on refresh.
 *
 * Usage:
 * ```tsx
 * <ProtectedRoute>
 *   <YourPageContent />
 * </ProtectedRoute>
 * ```
 */
export default function ProtectedRoute({
  children,
  requireSetupComplete = false,
  redirectTo = "/login",
}: ProtectedRouteProps) {
  const router = useRouter();
  const { state } = useApp();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Give AppContext time to restore session from token
    const checkAuth = async () => {
      // Wait a bit for initial hydration
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check if token exists (session might still be loading)
      const token = localStorage.getItem("beroe_auth_token");

      // DEMO MODE: If user has persisted data from a previous session,
      // allow them to continue without requiring fresh authentication.
      // This prevents frustrating redirects when users refresh the page.
      if (hasDemoData()) {
        console.log("[ProtectedRoute] Demo data found, allowing access");
        setIsChecking(false);
        return;
      }

      if (!token) {
        // No token and no demo data, redirect to login
        console.log("[ProtectedRoute] No token found, redirecting to login");
        router.replace(redirectTo);
        return;
      }

      // Token exists, wait for user to be loaded (longer wait for API latency)
      if (!state.user) {
        // User not loaded yet, wait longer for API to complete
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      // After waiting, check again
      if (!state.user) {
        // Check one more time with fresh token state
        const freshToken = localStorage.getItem("beroe_auth_token");
        if (!freshToken) {
          // Token was cleared (possibly by AppContext due to invalid token)
          console.log("[ProtectedRoute] Token was cleared, redirecting to login");
          router.replace(redirectTo);
          return;
        }
        // Token still exists but user isn't loaded - likely API is slow
        // Allow access if there's demo data or token exists (trust the session)
        console.log("[ProtectedRoute] Token exists, allowing access (API may be slow)");
        setIsChecking(false);
        return;
      }

      // Check if setup is required
      if (requireSetupComplete && state.user && !state.user.setup_completed) {
        console.log("[ProtectedRoute] Setup not complete, redirecting to setup");
        router.replace("/setup");
        return;
      }

      setIsChecking(false);
    };

    checkAuth();
  }, [state.user, router, redirectTo, requireSetupComplete]);

  // Show loading while checking auth
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#E8F4FC] via-[#F0F8FF] to-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // User is authenticated or has demo data
  return <>{children}</>;
}
