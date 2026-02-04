"use client";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// No auth check - just render children
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  return <>{children}</>;
}
