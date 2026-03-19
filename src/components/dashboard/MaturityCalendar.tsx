"use client";

import { useQuery } from "@tanstack/react-query";
import { Calendar, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";

export function MaturityCalendar() {
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

  const upcomingMaturities = report.loans
    .filter((l: any) => l.maturityDate && l.daysToMaturity !== null)
    .sort((a: any, b: any) => (a.daysToMaturity ?? 999) - (b.daysToMaturity ?? 999))
    .slice(0, 8);

  const { maturityBuckets } = report;

  return (
    <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-zinc-500" />
          <h3 className="text-sm font-semibold text-zinc-900">Maturity Calendar</h3>
        </div>
        <Link href="/reports?type=portfolio" className="text-xs text-[#C33732] hover:text-[#A52F2B]">
          View All
        </Link>
      </div>

      {/* Summary buckets */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: "Past Due", data: maturityBuckets.pastDue, color: "text-red-400" },
          { label: "< 30d", data: maturityBuckets.within30, color: "text-amber-400" },
          { label: "< 60d", data: maturityBuckets.within60, color: "text-[#C33732]" },
          { label: "< 90d", data: maturityBuckets.within90, color: "text-zinc-600" },
        ].map((b) => (
          <div key={b.label} className="text-center">
            <p className={cn("text-lg font-bold font-mono", b.data.count > 0 ? b.color : "text-zinc-700")}>{b.data.count}</p>
            <p className="text-[10px] text-zinc-500">{b.label}</p>
          </div>
        ))}
      </div>

      {/* Upcoming list */}
      {upcomingMaturities.length === 0 ? (
        <p className="text-xs text-zinc-500 text-center py-4">No upcoming maturities</p>
      ) : (
        <div className="space-y-1.5">
          {upcomingMaturities.map((loan: any) => {
            const isPast = loan.daysToMaturity < 0;
            const isUrgent = loan.daysToMaturity <= 30 && loan.daysToMaturity >= 0;
            return (
              <div
                key={loan.loanNumber}
                className={cn(
                  "flex items-center justify-between text-xs rounded px-2 py-1.5",
                  isPast ? "bg-red-500/10" : "bg-[#f3f3f3]"
                )}
              >
                <div className="flex items-center gap-2">
                  {isPast && <AlertTriangle className="h-3 w-3 text-red-500" />}
                  <span className="font-medium text-zinc-900">{loan.loanNumber}</span>
                  <span className="text-zinc-500">{loan.borrower}</span>
                </div>
                <span className={cn("font-medium", isPast ? "text-red-500" : isUrgent ? "text-amber-600" : "text-zinc-700")}>
                  {isPast ? `${Math.abs(loan.daysToMaturity)}d past` : `${loan.daysToMaturity}d`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
