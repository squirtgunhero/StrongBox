"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ConditionsDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["conditions-dashboard"],
    queryFn: async () => {
      // Fetch all active loans to get conditions
      const res = await fetch("/api/loans?status=CONDITIONAL_APPROVAL,APPROVED,PROCESSING,UNDERWRITING&limit=200");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const loans = (data?.loans || []).filter(
    (l: any) => l.loanConditions && l.loanConditions.length > 0
  );

  const allConditions = loans.flatMap((l: any) =>
    (l.loanConditions || []).map((c: any) => ({
      ...c,
      loanNumber: l.loanNumber,
      loanId: l.id,
      borrowerName: `${l.borrower?.firstName || ""} ${l.borrower?.lastName || ""}`.trim(),
    }))
  );

  const outstanding = allConditions.filter((c: any) => !c.isCleared);
  const cleared = allConditions.filter((c: any) => c.isCleared);

  const byCategory: Record<string, any[]> = {};
  outstanding.forEach((c: any) => {
    const cat = c.category || "Uncategorized";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(c);
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Underwriting Conditions</h1>
        <p className="text-sm text-zinc-500 mt-1">Track and manage conditions across all active loans</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl p-4">
          <p className="text-xs text-zinc-500">Total Conditions</p>
          <p className="text-2xl font-bold">{allConditions.length}</p>
        </div>
        <div className="rounded-xl p-4">
          <p className="text-xs text-zinc-500">Outstanding</p>
          <p className="text-2xl font-bold text-amber-600">{outstanding.length}</p>
        </div>
        <div className="rounded-xl p-4">
          <p className="text-xs text-zinc-500">Cleared</p>
          <p className="text-2xl font-bold text-emerald-600">{cleared.length}</p>
        </div>
        <div className="rounded-xl p-4">
          <p className="text-xs text-zinc-500">Loans with Conditions</p>
          <p className="text-2xl font-bold">{loans.length}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      ) : outstanding.length === 0 && cleared.length === 0 ? (
        <div className="rounded-xl p-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No conditions found across active loans</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Outstanding by Category */}
          {Object.entries(byCategory).map(([category, conditions]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                {category}
                <span className="text-xs text-zinc-500 font-normal">({conditions.length})</span>
              </h3>
              <div className="rounded-lg border bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-white/5">
                      <th className="px-4 py-3 text-left font-medium text-zinc-500">Condition</th>
                      <th className="px-4 py-3 text-left font-medium text-zinc-500">Loan</th>
                      <th className="px-4 py-3 text-left font-medium text-zinc-500">Borrower</th>
                      <th className="px-4 py-3 text-left font-medium text-zinc-500">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conditions.map((c: any) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                            <span>{c.text}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/loans/${c.loanId}`}
                            className="text-[#3B82F6] hover:text-blue-400"
                          >
                            {c.loanNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-zinc-500">{c.borrowerName}</td>
                        <td className="px-4 py-3 text-xs text-zinc-500">{c.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Cleared */}
          {cleared.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Cleared
                <span className="text-xs text-zinc-500 font-normal">({cleared.length})</span>
              </h3>
              <div className="rounded-lg border bg-white opacity-70">
                <div className="max-h-60 overflow-y-auto">
                  {cleared.map((c: any) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between px-4 py-2 border-b last:border-0 text-sm"
                    >
                      <span className="line-through text-zinc-500">{c.text}</span>
                      <Link
                        href={`/loans/${c.loanId}`}
                        className="text-xs text-[#3B82F6]"
                      >
                        {c.loanNumber}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
