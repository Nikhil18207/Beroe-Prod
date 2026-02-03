"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Activity,
  ShieldCheck,
  Search,
  Plus,
  ArrowLeft,
  ArrowRight,
  Clock,
  X,
  ChevronLeft
} from "lucide-react";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp, type ActivityItem } from "@/context/AppContext";

// Helper function to format relative time
const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (seconds < 60) return "JUST NOW";
  if (minutes < 60) return `${minutes} MIN${minutes > 1 ? 'S' : ''} AGO`;
  if (hours < 24) return `${hours} HOUR${hours > 1 ? 'S' : ''} AGO`;
  if (days < 7) return `${days} DAY${days > 1 ? 'S' : ''} AGO`;
  if (weeks < 4) return `${weeks} WEEK${weeks > 1 ? 'S' : ''} AGO`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
};

export default function ActivityPage() {
  const { state } = useApp();
  const router = useRouter();
  const [selectedActivityGroup, setSelectedActivityGroup] = useState<string | null>(null);

  // Group activities by analysis session (deduplicated - only show most recent of each type)
  const groupedActivities = React.useMemo(() => {
    const groups: { main: ActivityItem; related: ActivityItem[] }[] = [];
    let currentGroup: { main: ActivityItem; related: ActivityItem[] } | null = null;

    const sortedActivities = [...state.activityHistory].sort((a, b) => b.timestamp - a.timestamp);

    // Track seen activity titles to deduplicate
    const seenTitles = new Set<string>();

    for (const activity of sortedActivities) {
      // Skip duplicates
      if (seenTitles.has(activity.title)) {
        continue;
      }
      seenTitles.add(activity.title);

      if (activity.type === "analysis") {
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = { main: activity, related: [] };
      } else if (currentGroup) {
        currentGroup.related.push(activity);
      } else {
        currentGroup = { main: activity, related: [] };
      }
    }

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  }, [state.activityHistory]);

  // Helper to get activity icon
  const getActivityIcon = (type: ActivityItem["type"], isSmall = false) => {
    const size = isSmall ? "h-4 w-4" : "h-6 w-6";
    const colorClass = isSmall ? "" : "group-hover:text-emerald-300 transition-colors duration-300";

    switch (type) {
      case "analysis":
        return <Activity className={`${size} text-emerald-400 ${colorClass}`} />;
      case "upload":
        return (
          <svg className={`${size} text-purple-400 ${isSmall ? "" : "group-hover:text-purple-300 transition-colors duration-300"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17,8 12,3 7,8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        );
      case "goals":
        return (
          <svg className={`${size} text-amber-400 ${isSmall ? "" : "group-hover:text-amber-300 transition-colors duration-300"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        );
      default:
        return (
          <svg className={`${size} text-blue-400 ${isSmall ? "" : "group-hover:text-blue-300 transition-colors duration-300"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        );
    }
  };

  // Helper to get icon container classes
  const getIconContainerClasses = (type: ActivityItem["type"]) => {
    switch (type) {
      case "analysis":
        return "bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border-emerald-400/30 group-hover:shadow-emerald-500/30";
      case "upload":
        return "bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-400/30 group-hover:shadow-purple-500/30";
      case "goals":
        return "bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-400/30 group-hover:shadow-amber-500/30";
      default:
        return "bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-blue-400/30 group-hover:shadow-blue-500/30";
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20" />
        <div className="gradient-mesh absolute inset-0 opacity-60" />
      </div>

      <div className="relative z-10 flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-72 p-6 glass-card border-r border-white/20">
          <div className="flex items-center gap-3 mb-10">
            <div className="relative">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <div className="h-4 w-4 rounded-full bg-white/90" />
              </div>
            </div>
            <span className="text-lg font-semibold text-gray-900">Beroe AI</span>
          </div>

          <nav className="flex-1 space-y-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-white/30 transition-colors"
            >
              <Home className="h-5 w-5" />
              <span className="font-medium">Home</span>
            </Link>
            <Link
              href="/activity"
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/40 text-gray-900 shadow-sm"
            >
              <Activity className="h-5 w-5" />
              <span className="font-medium">Activity</span>
            </Link>
            <Link
              href="/opportunities"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-white/30 transition-colors"
            >
              <ShieldCheck className="h-5 w-5" />
              <span className="font-medium">Opportunities</span>
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Header */}
          <header className="sticky top-0 z-30 px-6 py-4 glass-card border-b border-white/20">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
                <span className="text-sm font-medium">Back</span>
              </button>
              <div className="h-6 w-px bg-gray-300" />
              <h1 className="text-lg font-semibold text-gray-900">All Activity</h1>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 p-6 md:p-10">
            {groupedActivities.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupedActivities.map((group, index) => (
                  <motion.div
                    key={group.main.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                    whileHover={{
                      scale: 1.02,
                      y: -8,
                      transition: { type: "spring", stiffness: 300, damping: 20 }
                    }}
                    onClick={() => group.related.length > 0 && setSelectedActivityGroup(group.main.id)}
                    className="group rounded-3xl glass-card p-6 ring-1 ring-white/20 hover:shadow-2xl hover:shadow-blue-500/10 hover:ring-white/40 transition-all duration-300 cursor-pointer border border-white/10 hover:border-white/30"
                  >
                    <div className="flex items-center justify-between mb-5">
                      <motion.div
                        whileHover={{ rotate: 15, scale: 1.1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl backdrop-blur-sm border group-hover:shadow-glow ${getIconContainerClasses(group.main.type)}`}
                      >
                        {getActivityIcon(group.main.type)}
                      </motion.div>
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(group.main.timestamp)}
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-1">
                      {group.main.title}
                    </h3>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {group.main.description}
                    </p>
                    {/* Indicator for related activities */}
                    {group.related.length > 0 && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200/30">
                        <div className="flex -space-x-1.5">
                          {group.related.slice(0, 3).map((activity, idx) => (
                            <div
                              key={activity.id}
                              className={`h-5 w-5 rounded-full border-2 border-white flex items-center justify-center ${
                                activity.type === "upload" ? "bg-purple-100" : activity.type === "goals" ? "bg-amber-100" : activity.type === "analysis" ? "bg-emerald-100" : "bg-blue-100"
                              }`}
                              style={{ zIndex: 3 - idx }}
                            >
                              {getActivityIcon(activity.type, true)}
                            </div>
                          ))}
                        </div>
                        <span className="text-[10px] text-gray-500">+{group.related.length} more</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <Activity className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">No activity yet</h3>
                <p className="text-sm text-gray-500 mb-6">Start an analysis to see your activity history</p>
                <Link
                  href="/setup"
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-medium hover:shadow-lg transition-shadow"
                >
                  <Plus className="h-5 w-5" />
                  Start Analysis
                </Link>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Popup Modal for related activities */}
      <AnimatePresence>
        {selectedActivityGroup && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
              onClick={() => setSelectedActivityGroup(null)}
            />
            {/* Popup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md mx-4"
            >
              <div className="glass-card rounded-3xl p-6 shadow-2xl border border-white/30 bg-white/95 backdrop-blur-xl max-h-[80vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-sm font-semibold text-gray-900">Related Activity</h3>
                  <button
                    onClick={() => setSelectedActivityGroup(null)}
                    className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                </div>

                {/* Activity cards */}
                <div className="space-y-3">
                  {groupedActivities
                    .find(g => g.main.id === selectedActivityGroup)
                    ?.related.map((activity, index) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.1 }}
                      className="group rounded-2xl p-4 ring-1 ring-gray-200/50 hover:ring-gray-300/50 hover:shadow-lg transition-all duration-200 bg-white/50"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                          activity.type === "upload"
                            ? "bg-purple-500/10 border-purple-400/30"
                            : activity.type === "goals"
                            ? "bg-amber-500/10 border-amber-400/30"
                            : activity.type === "analysis"
                            ? "bg-emerald-500/10 border-emerald-400/30"
                            : "bg-blue-500/10 border-blue-400/30"
                        }`}>
                          {getActivityIcon(activity.type, false)}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(activity.timestamp)}
                        </div>
                      </div>
                      <h4 className="text-sm font-medium text-gray-800 mb-1">
                        {activity.title}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {activity.description}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
