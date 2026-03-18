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
      <div className="rounded-lg border border-stone-200 bg-white p-6">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
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
    <div className="rounded-lg border border-stone-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-stone-400" />
          <h3 className="text-sm font-semibold text-stone-900">Maturity Calendar</h3>
        </div>
        <Link href="/reports?type=portfolio" className="text-xs text-[#1E3A5F] hover:text-[#162D4A]">
          View All
        </Link>
      </div>

      {/* Summary buckets */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: "Past Due", data: maturityBuckets.pastDue, color: "text-red-600" },
          { label: "< 30d", data: maturityBuckets.within30, color: "text-amber-600" },
          { label: "< 60d", data: maturityBuckets.within60, color: "text-[#1E3A5F]" },
          { label: "< 90d", data: maturityBuckets.within90, color: "text-stone-600" },
        ].map((b) => (
          <div key={b.label} className="text-center">
            <p className={cn("text-lg font-bold font-mono", b.data.count > 0 ? b.color : "text-stone-300")}>{b.data.count}</p>
            <p className="text-[10px] text-stone-500">{b.label}</p>
          </div>
        ))}
      </div>

      {/* Upcoming list */}
      {upcomingMaturities.length === 0 ? (
        <p className="text-xs text-stone-400 text-center py-4">No upcoming maturities</p>
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
                  isPast && "bg-red-50/50"
                )}
              >
                <div className="flex items-center gap-2">
                  {isPast && <AlertTriangle className="h-3 w-3 text-red-500" />}
                  <span className="font-medium text-stone-900">{loan.loanNumber}</span>
                  <span className="text-stone-400">{loan.borrower}</span>
                </div>
                <span className={cn("font-medium", isPast ? "text-red-600" : isUrgent ? "text-amber-600" : "text-stone-600")}>
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
