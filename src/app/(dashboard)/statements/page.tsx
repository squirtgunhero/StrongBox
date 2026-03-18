"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Download,
  FileText,
  Calendar,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";

export default function StatementsPage() {
  const [investorId, setInvestorId] = useState("");
  const [period, setPeriod] = useState<"monthly" | "quarterly">("monthly");
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // Fetch investors (capital sources that have investor accounts)
  const { data: investorsData } = useQuery({
    queryKey: ["investors-list"],
    queryFn: async () => {
      const res = await fetch("/api/contacts?isInvestor=true&limit=200");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: statementData, isLoading } = useQuery({
    queryKey: ["statement", investorId, period, date],
    queryFn: async () => {
      const params = new URLSearchParams({ investorId, period, date });
      const res = await fetch(`/api/statements?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!investorId,
  });

  const investors = investorsData?.contacts || [];
  const statement = statementData;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Investor Statements</h1>
        <p className="text-sm text-zinc-500 mt-1">Generate and download investor statements</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Investor</label>
          <select
            value={investorId}
            onChange={(e) => setInvestorId(e.target.value)}
            className="rounded-md border bg-white px-3 py-2 text-sm min-w-[200px] dark:bg-zinc-900 dark:border-zinc-800"
          >
            <option value="">Select investor...</option>
            {investors.map((inv: any) => (
              <option key={inv.id} value={inv.id}>
                {inv.firstName} {inv.lastName}
                {inv.companyName ? ` (${inv.companyName})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Period</label>
          <div className="flex rounded-md border dark:border-zinc-700">
            {(["monthly", "quarterly"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3 py-2 text-xs font-medium capitalize first:rounded-l-md last:rounded-r-md",
                  period === p
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400"
                    : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Date</label>
          <input
            type="month"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border bg-white px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-800"
          />
        </div>

        {investorId && (
          <a
            href={`/api/statements?investorId=${investorId}&period=${period}&date=${date}&format=csv`}
            className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
          >
            <Download className="h-4 w-4" /> Export CSV
          </a>
        )}
      </div>

      {!investorId ? (
        <div className="rounded-lg border bg-white p-12 text-center dark:bg-zinc-900 dark:border-zinc-800">
          <FileText className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Select an investor to generate a statement</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : statement ? (
        <div className="space-y-6">
          {/* Statement Header */}
          <div className="rounded-lg border bg-white p-5 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Statement: {statement.period}</h2>
                <p className="text-xs text-zinc-500">Generated {new Date(statement.generatedAt).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-md bg-zinc-50 dark:bg-zinc-800 p-3">
                <p className="text-xs text-zinc-500">Total Committed</p>
                <p className="text-lg font-bold">{formatCurrency(statement.summary.totalCommitted)}</p>
              </div>
              <div className="rounded-md bg-brand-50 dark:bg-brand-950/30 p-3">
                <p className="text-xs text-zinc-500">Total Deployed</p>
                <p className="text-lg font-bold text-brand-600">{formatCurrency(statement.summary.totalDeployed)}</p>
              </div>
              <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 p-3">
                <p className="text-xs text-zinc-500">Total Distributed</p>
                <p className="text-lg font-bold text-emerald-600">{formatCurrency(statement.summary.totalDistributed)}</p>
              </div>
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-3">
                <p className="text-xs text-zinc-500">Period Interest</p>
                <p className="text-lg font-bold text-amber-600">{formatCurrency(statement.summary.periodInterest)}</p>
              </div>
            </div>
          </div>

          {/* Transactions */}
          {statement.transactions.length > 0 && (
            <div className="rounded-lg border bg-white dark:bg-zinc-900 dark:border-zinc-800">
              <div className="px-5 py-4 border-b dark:border-zinc-800">
                <h3 className="text-sm font-semibold">Transactions</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-800">
                    <th className="px-4 py-3 text-left font-medium text-zinc-500">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-500">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-500">Description</th>
                    <th className="px-4 py-3 text-right font-medium text-zinc-500">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.transactions.map((tx: any, i: number) => (
                    <tr key={i} className="border-b last:border-0 dark:border-zinc-800">
                      <td className="px-4 py-3 text-xs">{new Date(tx.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-medium">
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{tx.description || "—"}</td>
                      <td className={cn("px-4 py-3 text-right font-medium", tx.amount > 0 ? "text-emerald-600" : "text-red-600")}>
                        {tx.amount > 0 ? "+" : ""}{formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Portfolio */}
          {statement.portfolio.length > 0 && (
            <div className="rounded-lg border bg-white dark:bg-zinc-900 dark:border-zinc-800">
              <div className="px-5 py-4 border-b dark:border-zinc-800">
                <h3 className="text-sm font-semibold">Portfolio Allocations</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-800">
                    <th className="px-4 py-3 text-left font-medium text-zinc-500">Loan</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-500">Borrower</th>
                    <th className="px-4 py-3 text-right font-medium text-zinc-500">Allocation</th>
                    <th className="px-4 py-3 text-right font-medium text-zinc-500">Rate</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-500">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-500">Maturity</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.portfolio.map((p: any, i: number) => (
                    <tr key={i} className="border-b last:border-0 dark:border-zinc-800">
                      <td className="px-4 py-3 font-medium">{p.loanNumber}</td>
                      <td className="px-4 py-3 text-zinc-500">{p.borrower}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(p.allocationAmount)}</td>
                      <td className="px-4 py-3 text-right">{p.interestRate}%</td>
                      <td className="px-4 py-3">
                        <span className="text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5">
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {p.maturityDate ? new Date(p.maturityDate).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
