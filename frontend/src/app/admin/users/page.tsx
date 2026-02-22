"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  UserPlus,
  Search,
  Shield,
  ChevronDown,
  MoreVertical,
  Check,
  X,
  ArrowLeft,
  Building2,
  Mail,
  Briefcase,
} from "lucide-react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import ProtectedRoute from "@/components/ProtectedRoute";

interface UserData {
  id: string;
  email: string;
  name: string | null;
  role_name: string;
  role_level: number;
  department_id: string | null;
  department_name: string | null;
  job_title: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

interface Department {
  id: string;
  name: string;
  description: string | null;
}

interface Role {
  name: string;
  display_name: string;
  description: string;
  level: number;
}

const getRoleBadgeColor = (roleName: string) => {
  const roleColors: Record<string, string> = {
    "Super Administrator": "from-purple-500/20 to-pink-500/20 border-purple-400/40 text-purple-300",
    "Organization Admin": "from-blue-500/20 to-cyan-500/20 border-blue-400/40 text-blue-300",
    "Manager": "from-emerald-500/20 to-teal-500/20 border-emerald-400/40 text-emerald-300",
    "Analyst": "from-amber-500/20 to-orange-500/20 border-amber-400/40 text-amber-300",
    "Viewer": "from-gray-500/20 to-slate-500/20 border-gray-400/40 text-gray-300",
  };
  return roleColors[roleName] || roleColors["Analyst"];
};

function UserManagementContent() {
  const { state } = useApp();
  const [users, setUsers] = useState<UserData[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showRoleDropdown, setShowRoleDropdown] = useState<string | null>(null);

  // Invite form state
  const [inviteForm, setInviteForm] = useState({
    email: "",
    name: "",
    role_name: "ANALYST",
    department_id: "",
    job_title: "",
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${API_BASE}/users/?active_only=false`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${API_BASE}/users/roles`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRoles(data);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${API_BASE}/users/departments`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchUsers(), fetchRoles(), fetchDepartments()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteError("");

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${API_BASE}/users/invite`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...inviteForm,
          department_id: inviteForm.department_id || null,
        }),
      });

      if (response.ok) {
        setShowInviteModal(false);
        setInviteForm({
          email: "",
          name: "",
          role_name: "ANALYST",
          department_id: "",
          job_title: "",
        });
        await fetchUsers();
      } else {
        const data = await response.json();
        setInviteError(data.detail || "Failed to invite user");
      }
    } catch (error) {
      setInviteError("Network error. Please try again.");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${API_BASE}/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role_name: newRole }),
      });

      if (response.ok) {
        await fetchUsers();
      }
    } catch (error) {
      console.error("Error updating role:", error);
    }
    setShowRoleDropdown(null);
  };

  const handleToggleActive = async (userId: string, currentlyActive: boolean) => {
    try {
      const token = localStorage.getItem("auth_token");
      const endpoint = currentlyActive ? "deactivate" : "activate";
      const response = await fetch(`${API_BASE}/users/${userId}/${endpoint}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        await fetchUsers();
      }
    } catch (error) {
      console.error("Error toggling user status:", error);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.name && user.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-slate-900/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-3">
                  <Users className="h-7 w-7 text-blue-400" />
                  User Management
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                  Manage users in your organization
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-all"
            >
              <UserPlus className="h-5 w-5" />
              Invite User
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">
                    User
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">
                    Role
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">
                    Department
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">
                    Status
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">
                    Last Login
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-white/10">
                          <span className="text-sm font-medium">
                            {(user.name || user.email).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{user.name || "—"}</div>
                          <div className="text-sm text-gray-400">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative">
                        <button
                          onClick={() =>
                            setShowRoleDropdown(
                              showRoleDropdown === user.id ? null : user.id
                            )
                          }
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border bg-gradient-to-r ${getRoleBadgeColor(
                            user.role_name
                          )}`}
                        >
                          <Shield className="h-3.5 w-3.5" />
                          {user.role_name}
                          <ChevronDown className="h-3 w-3" />
                        </button>

                        {showRoleDropdown === user.id && (
                          <div className="absolute z-50 mt-2 w-48 bg-slate-800 border border-white/10 rounded-xl shadow-xl overflow-hidden">
                            {roles.map((role) => (
                              <button
                                key={role.name}
                                onClick={() => handleUpdateRole(user.id, role.name)}
                                className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/10 flex items-center justify-between"
                              >
                                {role.display_name}
                                {user.role_name === role.display_name && (
                                  <Check className="h-4 w-4 text-green-400" />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-300">
                        {user.department_name || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          user.is_active
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : "bg-red-500/20 text-red-400 border border-red-500/30"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            user.is_active ? "bg-green-400" : "bg-red-400"
                          }`}
                        />
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {formatDate(user.last_login)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleToggleActive(user.id, user.is_active)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          user.is_active
                            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                            : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                        }`}
                      >
                        {user.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>

            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No users found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-400" />
                Invite New User
              </h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleInviteUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={inviteForm.email}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, email: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500/50"
                    placeholder="user@company.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={inviteForm.name}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, name: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500/50"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Role
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <select
                    value={inviteForm.role_name}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, role_name: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500/50 appearance-none"
                  >
                    {roles.map((role) => (
                      <option key={role.name} value={role.name} className="bg-slate-800">
                        {role.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Department
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <select
                    value={inviteForm.department_id}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, department_id: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500/50 appearance-none"
                  >
                    <option value="" className="bg-slate-800">
                      No Department
                    </option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id} className="bg-slate-800">
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Job Title (Optional)
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={inviteForm.job_title}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, job_title: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500/50"
                    placeholder="Procurement Analyst"
                  />
                </div>
              </div>

              {inviteError && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  {inviteError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 py-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50"
                >
                  {inviteLoading ? "Sending..." : "Send Invite"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {showRoleDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowRoleDropdown(null)}
        />
      )}
    </div>
  );
}

export default function UserManagementPage() {
  return (
    <ProtectedRoute>
      <UserManagementContent />
    </ProtectedRoute>
  );
}
