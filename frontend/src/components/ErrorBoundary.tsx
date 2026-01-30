"use client";

import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[400px] w-full flex-col items-center justify-center rounded-2xl bg-red-50/50 p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-6">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Something went wrong
          </h2>
          <p className="text-gray-500 text-center max-w-md mb-6">
            An unexpected error occurred. Please try refreshing the page or
            contact support if the problem persists.
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={this.handleReset}
              className="h-11 px-6 rounded-xl"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button
              onClick={() => window.location.reload()}
              className="h-11 px-6 rounded-xl bg-[#1A1C1E] text-white hover:bg-black"
            >
              Refresh Page
            </Button>
          </div>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <div className="mt-6 w-full max-w-lg rounded-xl bg-gray-900 p-4 text-left">
              <p className="text-xs font-mono text-red-400 break-all">
                {this.state.error.message}
              </p>
              <pre className="mt-2 text-xs font-mono text-gray-400 overflow-auto max-h-32">
                {this.state.error.stack}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Enhanced loading fallback component
export function LoadingFallback({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex min-h-[400px] w-full flex-col items-center justify-center">
      <div className="relative">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-blue-500 shadow-lg shadow-blue-500/20" />
        <div className="absolute inset-0 h-12 w-12 rounded-full bg-gradient-to-r from-blue-400/20 to-purple-400/20 animate-ping" />
        <div className="absolute inset-2 h-8 w-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 opacity-60 blur-sm animate-pulse" />
      </div>
      <p className="mt-6 text-sm text-gray-400 font-medium">{message}</p>
      <div className="mt-2 flex space-x-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-1.5 w-6 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full animate-pulse"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// Empty state component
export function EmptyState({
  title = "No data",
  description = "There's nothing here yet.",
  icon: Icon = AlertCircle,
  action,
}: {
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[300px] w-full flex-col items-center justify-center rounded-2xl bg-gray-50/50 p-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 mb-4">
        <Icon className="h-7 w-7 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-gray-500 text-center max-w-sm mb-4">{description}</p>
      {action}
    </div>
  );
}

export default ErrorBoundary;
