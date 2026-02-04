"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// Types
interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  company?: string;
  role?: string;
  goals?: {
    cost: number;
    risk: number;
    esg: number;
  };
  setup_step: number;
  setup_completed: boolean;
  created_at: string;
  last_login?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  username: string;
  name: string;
  password: string;
  company?: string;
  role?: string;
}

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (data: RegisterData) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  updateUser: (user: User) => void;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage keys
const TOKEN_KEY = "beroe_auth_token";
const USER_KEY = "beroe_auth_user";

// Demo user for simple login
const DEMO_USER: User = {
  id: "demo-user-001",
  email: "demo@beroe.com",
  username: "demo",
  name: "Demo User",
  company: "Demo Company",
  role: "Procurement Manager",
  goals: { cost: 40, risk: 35, esg: 25 },
  setup_step: 0,
  setup_completed: false,
  created_at: new Date().toISOString(),
};

// Auth Provider Component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Initialize auth state from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem(USER_KEY);
    const storedToken = localStorage.getItem(TOKEN_KEY);

    if (storedUser && storedToken) {
      setState({
        user: JSON.parse(storedUser),
        token: storedToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Login function - DEMO MODE: just set the user, no API call
  const login = useCallback(async (credentials: LoginCredentials): Promise<boolean> => {
    // Demo mode - instant login, no validation
    const user = {
      ...DEMO_USER,
      email: credentials.email || DEMO_USER.email,
    };
    const token = "demo-token-" + Date.now();

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    setState({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    return true;
  }, []);

  // Register function - DEMO MODE: just set the user
  const register = useCallback(async (data: RegisterData): Promise<boolean> => {
    const user: User = {
      ...DEMO_USER,
      email: data.email,
      username: data.username,
      name: data.name,
      company: data.company,
    };
    const token = "demo-token-" + Date.now();

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    setState({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    return true;
  }, []);

  // Logout function
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    router.push("/login");
  }, [router]);

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Update user
  const updateUser = useCallback((user: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setState((prev) => ({ ...prev, user }));
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    clearError,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Helper to get auth token (for API client)
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export default AuthContext;
