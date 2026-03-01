"use client";

import { motion } from "framer-motion";
import {
  Building2,
  Users,
  Activity,
  TrendingUp,
  Clock,
  FileUp,
  LogIn,
  BarChart3,
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
  Shield,
  ArrowLeft,
  Settings,
  Bell,
  Zap,
  Globe,
  Eye,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";

// Types for admin data
interface OrganizationStats {
  id: string;
  name: string;
  slug: string;
  plan: string;
  industry: string | null;
  country: string | null;
  logo_url: string | null;
  user_count: number;
  department_count: number;
  is_active: boolean;
  created_at: string;
  last_activity_at: string | null;
  last_activity_description: string | null;
  last_active_user: string | null;
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

interface PlatformStats {
  total_organizations: number;
  active_organizations: number;
  total_users: number;
  active_users_today: number;
  active_users_week: number;
  total_activities_today: number;
  total_activities_week: number;
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
    case "GOALS_UPDATE":
      return <TrendingUp className="h-4 w-4 text-amber-500" />;
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
    case "GOALS_UPDATE":
      return "bg-amber-100 border-amber-200";
    default:
      return "bg-gray-100 border-gray-200";
  }
};

function AdminDashboardContent() {
  const { state } = useApp();
  const router = useRouter();
  const [organizations, setOrganizations] = useState<OrganizationStats[]>([]);
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Check if user is Super Admin
  const isSuperAdmin = state.user?.role_name?.toUpperCase() === "SUPER ADMINISTRATOR" ||
    state.user?.role_name?.toUpperCase() === "SUPER_ADMIN";

  // Fetch admin data
  const fetchAdminData = async () => {
    try {
      const token = localStorage.getItem("beroe_auth_token");
      if (!token) {
        router.push("/login");
        return;
      }

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

      // Fetch all data in parallel
      const [statsRes, orgsRes, activitiesRes] = await Promise.all([
        fetch(`${baseUrl}/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${baseUrl}/admin/organizations`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${baseUrl}/admin/activities?limit=20`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (orgsRes.ok) {
        const orgsData = await orgsRes.json();
        setOrganizations(orgsData);
      }

      if (activitiesRes.ok) {
        const activitiesData = await activitiesRes.json();
        setActivities(activitiesData);
      }
    } catch (error) {
      console.error("Failed to fetch admin data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAdminData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAdminData();
  };

  // Filter organizations by search
  const filteredOrgs = organizations.filter(
    (org) =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Bypass access check for demo purposes
  const isDemoMode = true;
  if (!isSuperAdmin && !loading && !isDemoMode) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#E8F4FC] via-[#F0F8FF] to-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-500 mb-6">
            You need Super Admin privileges to access this dashboard.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <Shield className="h-5 w-5 text-purple-400" />
                  Super Admin Dashboard
                </h1>
                <p className="text-sm text-slate-400">Platform monitoring and management</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all">
                <Bell className="h-5 w-5" />
              </button>
              <button className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all">
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin" />
              <p className="text-slate-400">Loading dashboard...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Overview - Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {/* Total Organizations */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/20 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-purple-500/20">
                    <Building2 className="h-6 w-6 text-purple-400" />
                  </div>
                  <span className="text-xs font-medium text-purple-400 bg-purple-500/20 px-2 py-1 rounded-full">
                    Organizations
                  </span>
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  {stats?.total_organizations || 0}
                </div>
                <p className="text-sm text-slate-400">
                  {stats?.active_organizations || 0} active
                </p>
              </motion.div>

              {/* Total Users */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-blue-500/20">
                    <Users className="h-6 w-6 text-blue-400" />
                  </div>
                  <span className="text-xs font-medium text-blue-400 bg-blue-500/20 px-2 py-1 rounded-full">
                    Users
                  </span>
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  {stats?.total_users || 0}
                </div>
                <p className="text-sm text-slate-400">
                  {stats?.active_users_today || 0} active today
                </p>
              </motion.div>

              {/* Active This Week */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-emerald-500/20">
                    <Zap className="h-6 w-6 text-emerald-400" />
                  </div>
                  <span className="text-xs font-medium text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded-full">
                    Weekly Active
                  </span>
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  {stats?.active_users_week || 0}
                </div>
                <p className="text-sm text-slate-400">users this week</p>
              </motion.div>

              {/* Activities */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-amber-500/20">
                    <Activity className="h-6 w-6 text-amber-400" />
                  </div>
                  <span className="text-xs font-medium text-amber-400 bg-amber-500/20 px-2 py-1 rounded-full">
                    Activities
                  </span>
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  {stats?.total_activities_today || 0}
                </div>
                <p className="text-sm text-slate-400">
                  {stats?.total_activities_week || 0} this week
                </p>
              </motion.div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Organizations List - Takes 2 columns */}
              <div className="lg:col-span-2">
                <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 overflow-hidden">
                  {/* Header */}
                  <div className="p-6 border-b border-slate-700/50">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-purple-400" />
                        Organizations
                      </h2>
                      <span className="text-sm text-slate-400">
                        {filteredOrgs.length} total
                      </span>
                    </div>
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search organizations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                      />
                    </div>
                  </div>

                  {/* Organization Cards */}
                  <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                    {filteredOrgs.length === 0 ? (
                      <div className="text-center py-12">
                        <Building2 className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400">No organizations found</p>
                      </div>
                    ) : (
                      filteredOrgs.map((org, index) => (
                        <motion.div
                          key={org.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ scale: 1.01, x: 4 }}
                          onClick={() => router.push(`/admin/organization/${org.id}`)}
                          className="group rounded-xl bg-slate-900/50 border border-slate-700/50 p-4 cursor-pointer hover:bg-slate-800/50 hover:border-slate-600/50 transition-all"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                              {/* Logo/Avatar */}
                              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
                                {org.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-semibold text-white group-hover:text-purple-400 transition-colors truncate">
                                  {org.name}
                                </h3>
                                <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3.5 w-3.5" />
                                    {org.user_count} users
                                  </span>
                                  {org.industry && (
                                    <span className="flex items-center gap-1">
                                      <Globe className="h-3.5 w-3.5" />
                                      {org.industry}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${org.is_active
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-red-500/20 text-red-400"
                                  }`}
                              >
                                {org.is_active ? "Active" : "Inactive"}
                              </span>
                              <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
                            </div>
                          </div>

                          {/* Last Activity */}
                          {org.last_activity_at && (
                            <div className="mt-3 pt-3 border-t border-slate-700/50">
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-3.5 w-3.5 text-slate-500" />
                                <span className="text-slate-500">
                                  {formatRelativeTime(org.last_activity_at)}
                                </span>
                                <span className="text-slate-400 truncate">
                                  {org.last_active_user && `${org.last_active_user} - `}
                                  {org.last_activity_description}
                                </span>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Activity Feed - Takes 1 column */}
              <div className="lg:col-span-1">
                <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 overflow-hidden">
                  {/* Header */}
                  <div className="p-6 border-b border-slate-700/50">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Activity className="h-5 w-5 text-amber-400" />
                      Live Activity Feed
                    </h2>
                  </div>

                  {/* Activity List */}
                  <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                    {activities.length === 0 ? (
                      <div className="text-center py-12">
                        <Activity className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400">No recent activity</p>
                      </div>
                    ) : (
                      activities.map((activity, index) => (
                        <motion.div
                          key={activity.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="rounded-xl bg-slate-900/50 border border-slate-700/50 p-3 hover:bg-slate-800/50 transition-all"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`p-2 rounded-lg border ${getActivityColor(
                                activity.activity_type
                              )}`}
                            >
                              {getActivityIcon(activity.activity_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white line-clamp-2">
                                {activity.description}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-xs text-slate-500">
                                  {activity.organization_name}
                                </span>
                                <span className="text-slate-600">·</span>
                                <span className="text-xs text-slate-500">
                                  {formatRelativeTime(activity.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function AdminDashboardPage() {
  return <AdminDashboardContent />;
}
