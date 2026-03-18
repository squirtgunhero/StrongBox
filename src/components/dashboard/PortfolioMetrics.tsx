"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils/currency";

export function PortfolioMetrics() {
  const { data, isLoading } = useQuery({
    queryKey: ["report", "portfolio-widget"],
    queryFn: async () => {
      const res = await fetch("/api/reports?type=portfolio");
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

  const { summary, maturityBuckets, byType } = report;

  return (
    <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Portfolio</h3>
        <Link href="/reports?type=portfolio" className="text-xs text-[#3B82F6] hover:text-blue-400">
          View Report
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-2xl font-bold text-white">{summary.activeLoans}</p>
          <p className="text-xs text-zinc-500">Active Loans</p>
        </div>
        <div>
          <p className="text-2xl font-bold font-mono text-white">{formatCurrency(summary.totalBalance)}</p>
          <p className="text-xs text-zinc-500">Outstanding Balance</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
        <div className="rounded-md bg-white/5 p-2">
          <p className="text-zinc-500">Avg Loan Size</p>
          <p className="font-semibold font-mono text-white">{formatCurrency(summary.avgLoanSize)}</p>
        </div>
        <div className="rounded-md bg-white/5 p-2">
          <p className="text-zinc-500">Avg Rate</p>
          <p className="font-semibold text-white">{summary.weightedAvgRate.toFixed(2)}%</p>
        </div>
      </div>

      {/* Maturity warnings */}
      {(maturityBuckets.within30.count > 0 || maturityBuckets.pastDue.count > 0) && (
        <div className="space-y-1 text-xs">
          {maturityBuckets.pastDue.count > 0 && (
            <div className="flex items-center justify-between text-red-400 bg-red-500/10 rounded px-2 py-1.5">
              <span>{maturityBuckets.pastDue.count} past maturity</span>
              <span className="font-medium font-mono">{formatCurrency(maturityBuckets.pastDue.balance)}</span>
            </div>
          )}
          {maturityBuckets.within30.count > 0 && (
            <div className="flex items-center justify-between text-amber-400 bg-amber-500/10 rounded px-2 py-1.5">
              <span>{maturityBuckets.within30.count} maturing in 30 days</span>
              <span className="font-medium font-mono">{formatCurrency(maturityBuckets.within30.balance)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
