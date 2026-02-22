"use client";

import { motion } from "framer-motion";
import {
  Building2,
  Users,
  Activity,
  Clock,
  FileUp,
  LogIn,
  BarChart3,
  ArrowLeft,
  Shield,
  Mail,
  Calendar,
  MapPin,
  Briefcase,
  Eye,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  UserCircle,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useApp } from "@/context/AppContext";

// Types
interface UserSummary {
  id: string;
  email: string;
  name: string | null;
  role_name: string;
  department_name: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

interface ActivityLogItem {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string;
  organization_id: string;
  organization_name: string;
  activity_type: string;
  description: string;
  resource_type: string | null;
  resource_name: string | null;
  ip_address: string | null;
  created_at: string;
}

interface OrganizationDetail {
  id: string;
  name: string;
  slug: string;
  plan: string;
  industry: string | null;
  size: string | null;
  country: string | null;
  logo_url: string | null;
  max_users: number;
  max_categories: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_count: number;
  department_count: number;
  users: UserSummary[];
  recent_activities: ActivityLogItem[];
}

// Format relative time
const formatRelativeTime = (dateString: string | null): string => {
  if (!dateString) return "Never";

  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// Format date
const formatDate = (dateString: string | null): string => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// Activity type icon
const getActivityIcon = (type: string) => {
  switch (type) {
    case "LOGIN":
      return <LogIn className="h-4 w-4 text-emerald-500" />;
    case "FILE_UPLOAD":
      return <FileUp className="h-4 w-4 text-purple-500" />;
    case "ANALYSIS_START":
    case "ANALYSIS_COMPLETE":
      return <BarChart3 className="h-4 w-4 text-blue-500" />;
    default:
      return <Activity className="h-4 w-4 text-gray-500" />;
  }
};

// Activity type color
const getActivityColor = (type: string) => {
  switch (type) {
    case "LOGIN":
      return "bg-emerald-100 border-emerald-200";
    case "FILE_UPLOAD":
      return "bg-purple-100 border-purple-200";
    case "ANALYSIS_START":
    case "ANALYSIS_COMPLETE":
      return "bg-blue-100 border-blue-200";
    default:
      return "bg-gray-100 border-gray-200";
  }
};

// Role badge color
const getRoleBadgeColor = (role: string) => {
  const upperRole = role.toUpperCase();
  if (upperRole.includes("ADMIN")) return "bg-purple-500/20 text-purple-400";
  if (upperRole.includes("MANAGER")) return "bg-blue-500/20 text-blue-400";
  if (upperRole.includes("ANALYST")) return "bg-emerald-500/20 text-emerald-400";
  if (upperRole.includes("VIEWER")) return "bg-slate-500/20 text-slate-400";
  return "bg-slate-500/20 text-slate-400";
};

function OrganizationDetailContent() {
  const { state } = useApp();
  const router = useRouter();
  const params = useParams();
  const orgId = params.id as string;

  const [organization, setOrganization] = useState<OrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"users" | "activity">("users");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Check if user is Super Admin
  const isSuperAdmin =
    state.user?.role_name?.toUpperCase() === "SUPER ADMINISTRATOR" ||
    state.user?.role_name?.toUpperCase() === "SUPER_ADMIN";

  // Fetch organization details
  const fetchOrganization = async () => {
    try {
      const token = localStorage.getItem("beroe_auth_token");
      if (!token) {
        router.push("/login");
        return;
      }

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const response = await fetch(`${baseUrl}/admin/organizations/${orgId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setOrganization(data);
      } else if (response.status === 404) {
        router.push("/admin/dashboard");
      }
    } catch (error) {
      console.error("Failed to fetch organization:", error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle organization status
  const toggleOrgStatus = async () => {
    if (!organization) return;
    setUpdatingStatus(true);

    try {
      const token = localStorage.getItem("beroe_auth_token");
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

      const response = await fetch(
        `${baseUrl}/admin/organizations/${orgId}/status?is_active=${!organization.is_active}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        setOrganization((prev) =>
          prev ? { ...prev, is_active: !prev.is_active } : null
        );
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  useEffect(() => {
    if (orgId) {
      fetchOrganization();
    }
  }, [orgId]);

  // Check access
  if (!isSuperAdmin && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f172a] via-[#1e293b] to-[#0f172a] flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-slate-400 mb-6">
            You need Super Admin privileges to view this page.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f172a] via-[#1e293b] to-[#0f172a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin" />
          <p className="text-slate-400">Loading organization...</p>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f172a] via-[#1e293b] to-[#0f172a] flex items-center justify-center">
        <div className="text-center">
          <Building2 className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Organization Not Found</h1>
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors mt-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f172a] via-[#1e293b] to-[#0f172a]">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                {/* Organization Avatar */}
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-xl shrink-0">
                  {organization.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">{organization.name}</h1>
                  <p className="text-sm text-slate-400">/{organization.slug}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Status Toggle */}
              <button
                onClick={toggleOrgStatus}
                disabled={updatingStatus}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  organization.is_active
                    ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                    : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                }`}
              >
                {updatingStatus ? (
                  <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : organization.is_active ? (
                  <ToggleRight className="h-5 w-5" />
                ) : (
                  <ToggleLeft className="h-5 w-5" />
                )}
                {organization.is_active ? "Active" : "Inactive"}
              </button>

              {/* View as Client Button */}
              <Link
                href={`/dashboard?org=${orgId}`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-all"
              >
                <Eye className="h-4 w-4" />
                View as Client
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Organization Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <Users className="h-5 w-5 text-blue-400" />
              <span className="text-slate-400 text-sm">Users</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {organization.user_count}
              <span className="text-sm font-normal text-slate-500 ml-2">
                / {organization.max_users} max
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <Briefcase className="h-5 w-5 text-purple-400" />
              <span className="text-slate-400 text-sm">Plan</span>
            </div>
            <div className="text-2xl font-bold text-white capitalize">{organization.plan}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <Calendar className="h-5 w-5 text-emerald-400" />
              <span className="text-slate-400 text-sm">Created</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {formatDate(organization.created_at)}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <MapPin className="h-5 w-5 text-amber-400" />
              <span className="text-slate-400 text-sm">Location</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {organization.country || "Not set"}
            </div>
          </motion.div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              activeTab === "users"
                ? "bg-purple-600 text-white"
                : "bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users ({organization.users.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              activeTab === "activity"
                ? "bg-purple-600 text-white"
                : "bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Activity ({organization.recent_activities.length})
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 overflow-hidden">
          {activeTab === "users" ? (
            <div className="divide-y divide-slate-700/50">
              {organization.users.length === 0 ? (
                <div className="p-12 text-center">
                  <UserCircle className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No users in this organization</p>
                </div>
              ) : (
                organization.users.map((user, index) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 hover:bg-slate-700/30 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* User Avatar */}
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                          {(user.name || user.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-white">
                            {user.name || "Unnamed User"}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Mail className="h-3.5 w-3.5" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Department */}
                        {user.department_name && (
                          <span className="px-2 py-1 rounded-lg bg-slate-700/50 text-slate-400 text-xs">
                            {user.department_name}
                          </span>
                        )}
                        {/* Role Badge */}
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-medium ${getRoleBadgeColor(
                            user.role_name
                          )}`}
                        >
                          {user.role_name}
                        </span>
                        {/* Status */}
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            user.is_active
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {user.is_active ? "Active" : "Inactive"}
                        </span>
                        {/* Last Login */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Clock className="h-3.5 w-3.5" />
                          {user.last_login ? formatRelativeTime(user.last_login) : "Never"}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-700/50">
              {organization.recent_activities.length === 0 ? (
                <div className="p-12 text-center">
                  <Activity className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No recent activity</p>
                </div>
              ) : (
                organization.recent_activities.map((activity, index) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="p-4 hover:bg-slate-700/30 transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`p-2.5 rounded-xl border ${getActivityColor(
                          activity.activity_type
                        )}`}
                      >
                        {getActivityIcon(activity.activity_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white">{activity.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <UserCircle className="h-3.5 w-3.5" />
                            {activity.user_name || activity.user_email}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatRelativeTime(activity.created_at)}
                          </span>
                          {activity.ip_address && (
                            <>
                              <span>·</span>
                              <span className="text-slate-600">{activity.ip_address}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function OrganizationDetailPage() {
  return <OrganizationDetailContent />;
}
