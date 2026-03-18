"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Loader2,
  MoreHorizontal,
  Shield,
  UserCheck,
  UserX,
} from "lucide-react";
import { formatDate } from "@/lib/utils/dates";

interface UserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  phone: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  LOAN_OFFICER: "Loan Officer",
  PROCESSOR: "Processor",
  UNDERWRITER: "Underwriter",
  CLOSER: "Closer",
  ACCOUNTING: "Accounting",
  BORROWER: "Borrower",
  INVESTOR: "Investor",
  READ_ONLY: "Read Only",
};

const ROLES = Object.keys(ROLE_LABELS);

export default function UsersSettingsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json() as Promise<{ users: UserRecord[] }>;
    },
  });

  const createUser = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowForm(false);
    },
  });

  const updateUser = useMutation({
    mutationFn: async ({
      id,
      ...data
    }: Record<string, string | boolean> & { id: string }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditingUser(null);
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">User Management</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage team members and their roles
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Invite User
        </button>
      </div>

      {showForm && (
        <InviteUserForm
          onSubmit={(data) => createUser.mutate(data)}
          onCancel={() => setShowForm(false)}
          isLoading={createUser.isPending}
          error={createUser.error?.message}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onSubmit={(data) => updateUser.mutate({ id: editingUser.id, ...data })}
          onCancel={() => setEditingUser(null)}
          isLoading={updateUser.isPending}
        />
      )}

      <div className="rounded-lg border bg-white dark:bg-zinc-900 dark:border-zinc-800">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : !data?.users?.length ? (
          <div className="p-12 text-center">
            <Shield className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">No users yet</p>
            <p className="text-xs text-zinc-400 mt-1">
              Invite your first team member to get started
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-800">
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Email</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Role</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Last Login</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b last:border-0 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                >
                  <td className="px-4 py-3 font-medium">
                    {user.firstName} {user.lastName}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {user.isActive ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        <UserCheck className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                        <UserX className="h-3 w-3" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">
                    {user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditingUser(user)}
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function InviteUserForm({
  onSubmit,
  onCancel,
  isLoading,
  error,
}: {
  onSubmit: (data: Record<string, string>) => void;
  onCancel: () => void;
  isLoading: boolean;
  error?: string;
}) {
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "LOAN_OFFICER",
    phone: "",
  });

  return (
    <div className="mb-6 rounded-lg border bg-white p-6 dark:bg-zinc-900 dark:border-zinc-800">
      <h2 className="text-lg font-medium mb-4">Invite New User</h2>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700 dark:bg-red-950 dark:border-red-900 dark:text-red-400">
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(formData);
        }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            First Name
          </label>
          <input
            required
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Last Name
          </label>
          <input
            required
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Email
          </label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Role
          </label>
          <select
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700"
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Send Invite
          </button>
        </div>
      </form>
    </div>
  );
}

function EditUserModal({
  user,
  onSubmit,
  onCancel,
  isLoading,
}: {
  user: UserRecord;
  onSubmit: (data: Record<string, string | boolean>) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [role, setRole] = useState(user.role);
  const [isActive, setIsActive] = useState(user.isActive);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative z-50 w-full max-w-md rounded-lg border bg-white p-6 shadow-lg dark:bg-zinc-900 dark:border-zinc-800">
        <h2 className="text-lg font-semibold mb-1">
          Edit {user.firstName} {user.lastName}
        </h2>
        <p className="text-sm text-zinc-500 mb-4">{user.email}</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-zinc-300"
            />
            <label htmlFor="isActive" className="text-sm text-zinc-700 dark:text-zinc-300">
              Active
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit({ role, isActive })}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
