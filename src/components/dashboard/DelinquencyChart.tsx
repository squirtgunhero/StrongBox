"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";

const BUCKET_COLORS = ["bg-amber-400", "bg-orange-400", "bg-red-400", "bg-red-600"];

export function DelinquencyChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["report", "delinquency-widget"],
    queryFn: async () => {
      const res = await fetch("/api/reports?type=delinquency");
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

  const { summary, agingBuckets } = report;
  const maxBalance = Math.max(...agingBuckets.map((b: any) => b.balance), 1);

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-stone-900">Delinquency</h3>
          {summary.delinquentLoans > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
              <AlertTriangle className="h-3 w-3" />
              {summary.delinquentLoans}
            </span>
          )}
        </div>
        <Link href="/reports?type=delinquency" className="text-xs text-[#1E3A5F] hover:text-[#162D4A]">
          View Report
        </Link>
      </div>

      {summary.delinquentLoans === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-emerald-600 font-medium">No delinquent loans</p>
          <p className="text-xs text-stone-400 mt-1">Portfolio is current</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <p className="text-2xl font-bold font-mono text-red-600">{summary.delinquencyRate.toFixed(1)}%</p>
              <p className="text-xs text-stone-500">Delinquency Rate</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-stone-900">{formatCurrency(summary.delinquentBalance)}</p>
              <p className="text-xs text-stone-500">Delinquent Balance</p>
            </div>
          </div>

          {/* Aging bar chart */}
          <div className="space-y-2">
            {agingBuckets.map((bucket: any, i: number) => (
              <div key={bucket.range}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-stone-500">{bucket.range}</span>
                  <span className="font-medium font-mono">
                    {bucket.count} — {formatCurrency(bucket.balance)}
                  </span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2">
                  <div
                    className={cn("h-2 rounded-full transition-all", BUCKET_COLORS[i])}
                    style={{ width: `${(bucket.balance / maxBalance) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
