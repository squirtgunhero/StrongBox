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
      <div className="rounded-lg border border-stone-200 bg-white p-6">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
        </div>
      </div>
    );
  }

  const report = data?.report;
  if (!report) return null;

  const { summary, maturityBuckets, byType } = report;

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-stone-900">Portfolio</h3>
        <Link href="/reports?type=portfolio" className="text-xs text-[#1E3A5F] hover:text-[#162D4A]">
          View Report
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-2xl font-bold text-stone-900">{summary.activeLoans}</p>
          <p className="text-xs text-stone-500">Active Loans</p>
        </div>
        <div>
          <p className="text-2xl font-bold font-mono text-stone-900">{formatCurrency(summary.totalBalance)}</p>
          <p className="text-xs text-stone-500">Outstanding Balance</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
        <div className="rounded-md bg-stone-50 p-2">
          <p className="text-stone-500">Avg Loan Size</p>
          <p className="font-semibold font-mono">{formatCurrency(summary.avgLoanSize)}</p>
        </div>
        <div className="rounded-md bg-stone-50 p-2">
          <p className="text-stone-500">Avg Rate</p>
          <p className="font-semibold">{summary.weightedAvgRate.toFixed(2)}%</p>
        </div>
      </div>

      {/* Maturity warnings */}
      {(maturityBuckets.within30.count > 0 || maturityBuckets.pastDue.count > 0) && (
        <div className="space-y-1 text-xs">
          {maturityBuckets.pastDue.count > 0 && (
            <div className="flex items-center justify-between text-red-600 bg-red-50/30 rounded px-2 py-1.5">
              <span>{maturityBuckets.pastDue.count} past maturity</span>
              <span className="font-medium font-mono">{formatCurrency(maturityBuckets.pastDue.balance)}</span>
            </div>
          )}
          {maturityBuckets.within30.count > 0 && (
            <div className="flex items-center justify-between text-amber-600 bg-amber-50/30 rounded px-2 py-1.5">
              <span>{maturityBuckets.within30.count} maturing in 30 days</span>
              <span className="font-medium font-mono">{formatCurrency(maturityBuckets.within30.balance)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
