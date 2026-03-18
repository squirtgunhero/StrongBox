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
      <div className="rounded-lg border border-stone-200 bg-white p-6">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
        </div>
      </div>
    );
  }

  const report = data?.report;
  if (!report) return null;

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-stone-900">Pipeline</h3>
        <Link href="/reports?type=pipeline" className="text-xs text-[#1E3A5F] hover:text-[#162D4A]">
          View Report
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-2xl font-bold text-stone-900">{report.summary.totalDeals}</p>
          <p className="text-xs text-stone-500">Active Deals</p>
        </div>
        <div>
          <p className="text-2xl font-bold font-mono text-stone-900">{formatCurrency(report.summary.totalAmount)}</p>
          <p className="text-xs text-stone-500">Pipeline Value</p>
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
                <span className="text-[10px] text-stone-500 w-10 text-right">{cfg.label}</span>
                <div className="flex-1 bg-stone-100 rounded-full h-2">
                  <div
                    className={cn("h-2 rounded-full transition-all", cfg.color)}
                    style={{ width: `${Math.max(4, pct)}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium w-5 text-right">{s.count}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
