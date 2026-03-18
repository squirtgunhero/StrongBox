"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Play, ToggleLeft, ToggleRight, Clock, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableSkeleton } from "@/components/shared/Skeleton";

const REPORT_TYPES = [
  { id: "portfolio_summary", name: "Portfolio Summary", description: "Active loans overview with totals" },
  { id: "delinquency", name: "Delinquency Report", description: "All delinquent loans sorted by severity" },
  { id: "maturity", name: "Maturity Report", description: "Loans maturing within 90 days" },
  { id: "payment_collection", name: "Payment Collection", description: "Last 30 days of payments received" },
];

const SCHEDULE_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export default function ScheduledReportsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [reportType, setReportType] = useState("");
  const [schedule, setSchedule] = useState("weekly");
  const [recipientInput, setRecipientInput] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["scheduled-reports"],
    queryFn: async () => {
      const res = await fetch("/api/reports/scheduled");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const createSchedule = useMutation({
    mutationFn: async () => {
      const recipients = recipientInput.split(",").map((e) => e.trim()).filter(Boolean);
      const res = await fetch("/api/reports/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name,
          reportType,
          schedule,
          recipients,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
      setShowForm(false);
      setName("");
      setReportType("");
      setRecipientInput("");
    },
  });

  const runReport = useMutation({
    mutationFn: async (scheduleId: string) => {
      const res = await fetch("/api/reports/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run", scheduleId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const toggleSchedule = useMutation({
    mutationFn: async (scheduleId: string) => {
      const res = await fetch("/api/reports/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", scheduleId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] }),
  });

  const deleteSchedule = useMutation({
    mutationFn: async (scheduleId: string) => {
      const res = await fetch("/api/reports/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", scheduleId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] }),
  });

  if (isLoading) return <TableSkeleton rows={3} cols={4} />;

  const schedules = data?.schedules || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Scheduled Reports</h1>
          <p className="text-sm text-stone-500 mt-1">
            Automatically email reports on a schedule
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-md bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#162D4A] transition-colors"
        >
          <Plus className="h-4 w-4" /> New Schedule
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border bg-white p-5 mb-6">
          <h3 className="text-sm font-semibold mb-4">New Scheduled Report</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Weekly Portfolio Summary"
                className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]"
              >
                <option value="">Select report type...</option>
                {REPORT_TYPES.map((rt) => (
                  <option key={rt.id} value={rt.id}>{rt.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Schedule</label>
              <select
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]"
              >
                {SCHEDULE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Recipients (comma-separated emails)
              </label>
              <input
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                placeholder="admin@stronginvestor.com, ops@stronginvestor.com"
                className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => createSchedule.mutate()}
              disabled={!name || !reportType || !recipientInput || createSchedule.isPending}
              className="flex items-center gap-2 rounded-md bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#162D4A] disabled:opacity-50 transition-colors"
            >
              {createSchedule.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Schedule
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-stone-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {schedules.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <Clock className="h-10 w-10 text-stone-300 mx-auto mb-3" />
          <p className="text-sm text-stone-500">No scheduled reports configured</p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((s: any) => (
            <div
              key={s.id}
              className="rounded-lg border bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full",
                        s.isActive ? "bg-green-500" : "bg-stone-300"
                      )}
                    />
                    <p className="text-sm font-semibold">{s.name}</p>
                    <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                      {s.schedule}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    {REPORT_TYPES.find((rt) => rt.id === s.reportType)?.name || s.reportType}
                    {" — "}
                    <Mail className="h-3 w-3 inline" /> {s.recipients?.join(", ")}
                  </p>
                  {s.lastRunAt && (
                    <p className="text-[10px] text-stone-400 mt-0.5">
                      Last run: {new Date(s.lastRunAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => runReport.mutate(s.id)}
                    disabled={runReport.isPending}
                    className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-stone-50"
                  >
                    {runReport.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    Run Now
                  </button>
                  <button
                    onClick={() => toggleSchedule.mutate(s.id)}
                    className="p-1.5 rounded-md hover:bg-stone-100"
                  >
                    {s.isActive ? (
                      <ToggleRight className="h-5 w-5 text-green-500" />
                    ) : (
                      <ToggleLeft className="h-5 w-5 text-stone-400" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this scheduled report?")) {
                        deleteSchedule.mutate(s.id);
                      }
                    }}
                    className="p-1.5 rounded-md hover:bg-red-50 text-stone-400 hover:text-red-600950"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
