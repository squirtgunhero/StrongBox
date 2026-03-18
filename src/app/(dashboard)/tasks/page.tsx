"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Plus,
  Loader2,
  User,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, isOverdue } from "@/lib/utils/dates";

type ViewTab = "my" | "team";

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  URGENT: { label: "Urgent", color: "text-red-600 bg-red-50 dark:bg-red-950" },
  HIGH: { label: "High", color: "text-orange-600 bg-orange-50 dark:bg-orange-950" },
  MEDIUM: { label: "Medium", color: "text-brand-600 bg-brand-50 dark:bg-brand-950" },
  LOW: { label: "Low", color: "text-zinc-500 bg-zinc-100 dark:bg-zinc-800" },
};

const STATUS_ICONS: Record<string, { icon: typeof Circle; color: string }> = {
  PENDING: { icon: Circle, color: "text-zinc-400" },
  IN_PROGRESS: { icon: Clock, color: "text-brand-500" },
  COMPLETED: { icon: CheckCircle2, color: "text-emerald-500" },
  CANCELLED: { icon: X, color: "text-zinc-400" },
  BLOCKED: { icon: AlertTriangle, color: "text-red-500" },
};

export default function TasksPage() {
  const [view, setView] = useState<ViewTab>("my");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("MEDIUM");
  const [newDueDate, setNewDueDate] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["tasks", view, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ view });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/tasks?${params}`);
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
  });

  const createTask = useMutation({
    mutationFn: async (task: { title: string; priority: string; dueDate?: string }) => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
      });
      if (!res.ok) throw new Error("Failed to create task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setNewTitle("");
      setNewDueDate("");
      setShowCreate(false);
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; status?: string }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update task");
      return res.json();
    },
    onMutate: async ({ id, status: newStatus }) => {
      const qk = ["tasks", view, statusFilter];
      await queryClient.cancelQueries({ queryKey: qk });
      const previous = queryClient.getQueryData(qk);
      queryClient.setQueryData(qk, (old: any) => {
        if (!old?.tasks) return old;
        return {
          ...old,
          tasks: old.tasks.map((t: any) =>
            t.id === id ? { ...t, status: newStatus || t.status } : t
          ),
        };
      });
      return { previous, qk };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.qk, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const tasks = data?.tasks || [];
  const overdueCount = data?.overdueCount || 0;
  const total = data?.total || 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {total} tasks
            {overdueCount > 0 && (
              <span className="text-red-600 font-medium ml-2">
                {overdueCount} overdue
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Task
        </button>
      </div>

      {/* View Tabs + Filter */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex rounded-md border dark:border-zinc-700">
          {([
            { key: "my" as ViewTab, label: "My Tasks", icon: User },
            { key: "team" as ViewTab, label: "Team", icon: Users },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-r last:border-r-0 dark:border-zinc-700 first:rounded-l-md last:rounded-r-md",
                view === tab.key
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400"
                  : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border bg-white px-3 py-1.5 text-xs dark:bg-zinc-900 dark:border-zinc-800"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">To Do</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="BLOCKED">Blocked</option>
        </select>
      </div>

      {/* Quick Create */}
      {showCreate && (
        <div className="rounded-lg border bg-white p-4 mb-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task title..."
              className="flex-1 rounded-md border bg-white px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTitle.trim()) {
                  createTask.mutate({
                    title: newTitle.trim(),
                    priority: newPriority,
                    dueDate: newDueDate || undefined,
                  });
                }
              }}
            />
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              className="rounded-md border bg-white px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="rounded-md border bg-white px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700"
            />
            <button
              onClick={() => {
                if (newTitle.trim()) {
                  createTask.mutate({
                    title: newTitle.trim(),
                    priority: newPriority,
                    dueDate: newDueDate || undefined,
                  });
                }
              }}
              disabled={!newTitle.trim() || createTask.isPending}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Task List */}
      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center dark:bg-zinc-900 dark:border-zinc-800">
          <CheckCircle2 className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No tasks found</p>
        </div>
      ) : (
        <div className="space-y-1">
          {tasks.map((task: any) => {
            const statusCfg = STATUS_ICONS[task.status] || STATUS_ICONS.PENDING;
            const StatusIcon = statusCfg.icon;
            const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM;
            const overdue =
              task.dueDate &&
              isOverdue(task.dueDate) &&
              task.status !== "COMPLETED" &&
              task.status !== "CANCELLED";

            return (
              <div
                key={task.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border bg-white px-4 py-3 transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800/50",
                  overdue && "border-red-200 dark:border-red-900"
                )}
              >
                <button
                  onClick={() => {
                    const next =
                      task.status === "COMPLETED"
                        ? "PENDING"
                        : task.status === "PENDING"
                        ? "IN_PROGRESS"
                        : "COMPLETED";
                    updateTask.mutate({ id: task.id, status: next });
                  }}
                  className={cn("flex-shrink-0", statusCfg.color)}
                >
                  <StatusIcon className="h-5 w-5" />
                </button>

                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      task.status === "COMPLETED" && "line-through text-zinc-400"
                    )}
                  >
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {task.loan && (
                      <Link
                        href={`/loans/${task.loan.id}`}
                        className="text-[11px] text-brand-600 hover:text-brand-700 dark:text-brand-400"
                      >
                        {task.loan.loanNumber}
                      </Link>
                    )}
                    {task.assignee && (
                      <span className="text-[11px] text-zinc-400">
                        {task.assignee.firstName} {task.assignee.lastName}
                      </span>
                    )}
                    {task.isAutoGenerated && (
                      <span className="text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                        auto
                      </span>
                    )}
                  </div>
                </div>

                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                    priorityCfg.color
                  )}
                >
                  {priorityCfg.label}
                </span>

                {task.dueDate && (
                  <span
                    className={cn(
                      "text-xs whitespace-nowrap",
                      overdue ? "text-red-600 font-medium" : "text-zinc-400"
                    )}
                  >
                    {overdue && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                    {formatDate(task.dueDate)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
