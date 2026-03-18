"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  LEAD: { label: "Lead", color: "bg-stone-400" },
  APPLICATION: { label: "App", color: "bg-[#93B4D4]" },
  PROCESSING: { label: "Proc", color: "bg-indigo-400" },
  UNDERWRITING: { label: "UW", color: "bg-purple-400" },
  CONDITIONAL_APPROVAL: { label: "Cond", color: "bg-amber-400" },
  APPROVED: { label: "Appr", color: "bg-emerald-400" },
  CLOSING: { label: "Close", color: "bg-green-500" },
};

export function PipelineSummary() {
  const { data, isLoading } = useQuery({
    queryKey: ["report", "pipeline-widget"],
    queryFn: async () => {
      const res = await fetch("/api/reports?type=pipeline");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        </div>
      </div>
    );
  }

  const report = data?.report;
  if (!report) return null;

  return (
    <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Pipeline</h3>
        <Link href="/reports?type=pipeline" className="text-xs text-[#3B82F6] hover:text-blue-400">
          View Report
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-2xl font-bold text-white">{report.summary.totalDeals}</p>
          <p className="text-xs text-zinc-500">Active Deals</p>
        </div>
        <div>
          <p className="text-2xl font-bold font-mono text-white">{formatCurrency(report.summary.totalAmount)}</p>
          <p className="text-xs text-zinc-500">Pipeline Value</p>
        </div>
      </div>

      {/* Status funnel */}
      <div className="space-y-1.5">
        {report.byStatus
          .filter((s: any) => s.count > 0)
          .map((s: any) => {
            const cfg = STATUS_LABELS[s.status] || { label: s.status, color: "bg-stone-400" };
            const pct = report.summary.totalAmount > 0 ? (s.totalAmount / report.summary.totalAmount) * 100 : 0;
            return (
              <div key={s.status} className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 w-10 text-right">{cfg.label}</span>
                <div className="flex-1 bg-white/10 rounded-full h-2">
                  <div
                    className={cn("h-2 rounded-full transition-all", cfg.color)}
                    style={{ width: `${Math.max(4, pct)}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium text-zinc-400 w-5 text-right">{s.count}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
