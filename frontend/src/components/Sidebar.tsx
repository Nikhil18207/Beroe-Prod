"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Activity,
  ShieldCheck,
  Search,
  User,
  LogOut,
  Users,
  Shield
} from "lucide-react";
import { isSuperAdmin, isOrgAdmin } from "@/types/api";
import type { User as UserType } from "@/types/api";

interface SidebarProps {
  user?: UserType | null;
}

/**
 * Unified Sidebar Component
 * Matches the clean, minimal design from setup/review page
 */
export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  const userIsSuperAdmin = isSuperAdmin(user || null);
  const userIsOrgAdmin = isOrgAdmin(user || null);

  // Determine active page
  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname?.startsWith(path);
  };

  return (
    <div className="relative z-20 flex w-16 flex-col items-center border-r border-gray-200/40 bg-white/30 py-8 backdrop-blur-xl shrink-0">
      {/* Logo */}
      <Link href="/dashboard" className="mb-12 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
        <img src="/beroe cut.jpg" alt="Beroe" className="h-8 w-8 object-contain" />
      </Link>

      {/* Main Navigation */}
      <div className="flex flex-col gap-8 text-gray-400">
        {/* Home/Dashboard */}
        <Link
          href="/dashboard"
          className={`p-2 rounded-xl transition-colors ${
            isActive("/dashboard")
              ? "text-blue-600 bg-blue-50"
              : "hover:text-gray-600 hover:bg-white/50"
          }`}
        >
          <Home className="h-6 w-6" />
        </Link>

        {/* Activity/Today */}
        <Link
          href="/today"
          className={`p-2 rounded-xl transition-colors ${
            isActive("/today")
              ? "text-blue-600 bg-blue-50"
              : "hover:text-gray-600 hover:bg-white/50"
          }`}
        >
          <Activity className="h-6 w-6" />
        </Link>

        {/* Opportunities */}
        <Link
          href="/opportunities"
          className={`p-2 rounded-xl transition-colors ${
            isActive("/opportunities")
              ? "text-blue-600 bg-blue-50"
              : "hover:text-gray-600 hover:bg-white/50"
          }`}
        >
          <ShieldCheck className="h-6 w-6" />
        </Link>

        {/* Super Admin Dashboard - Only visible to Super Admins */}
        {userIsSuperAdmin && (
          <Link
            href="/admin/dashboard"
            className={`p-2 rounded-xl transition-colors ${
              isActive("/admin/dashboard")
                ? "text-purple-600 bg-purple-50"
                : "text-purple-400 hover:text-purple-600 hover:bg-purple-50/50"
            }`}
            title="Super Admin Dashboard"
          >
            <Shield className="h-6 w-6" />
          </Link>
        )}

        {/* User Management - Only visible to Org Admins and above */}
        {userIsOrgAdmin && (
          <Link
            href="/admin/users"
            className={`p-2 rounded-xl transition-colors ${
              isActive("/admin/users")
                ? "text-blue-600 bg-blue-50"
                : "hover:text-gray-600 hover:bg-white/50"
            }`}
            title="Manage Users"
          >
            <Users className="h-6 w-6" />
          </Link>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="mt-auto flex flex-col gap-8 text-gray-400">
        {/* Search */}
        <button className="p-2 rounded-xl hover:text-gray-600 hover:bg-white/50 transition-colors">
          <Search className="h-6 w-6" />
        </button>

        {/* User Profile */}
        <Link
          href="/profile"
          className="p-2 rounded-xl hover:text-gray-600 hover:bg-white/50 transition-colors"
        >
          <User className="h-6 w-6" />
        </Link>

        {/* Logout */}
        <Link
          href="/"
          className="p-2 rounded-xl text-red-400/60 hover:text-red-500 hover:bg-red-50/50 transition-colors"
        >
          <LogOut className="h-6 w-6" />
        </Link>
      </div>
    </div>
  );
}

export default Sidebar;
