"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Wallet, TrendingUp, Building2, DollarSign } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";

export default function PortalPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["portal"],
    queryFn: async () => {
      const res = await fetch("/api/portal?view=investor");
      if (!res.ok) throw new Error("Failed to load portal");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-white p-12 text-center dark:bg-zinc-900 dark:border-zinc-800">
        <p className="text-sm text-zinc-500">Unable to load portal data</p>
      </div>
    );
  }

  const account = data?.account || {};
  const portfolio = data?.portfolio || [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">
          Welcome{data?.investor ? `, ${data.investor.name}` : ""}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">Investor Dashboard</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-emerald-50 p-2 dark:bg-emerald-950">
              <Wallet className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Account Balance</p>
              <p className="text-xl font-bold">{formatCurrency(account.currentBalance || 0)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-brand-50 p-2 dark:bg-brand-950">
              <TrendingUp className="h-4 w-4 text-brand-500" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Deployed</p>
              <p className="text-xl font-bold">{formatCurrency(account.totalDeployed || 0)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-purple-50 p-2 dark:bg-purple-950">
              <DollarSign className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Interest Earned</p>
              <p className="text-xl font-bold text-emerald-600">{formatCurrency(account.totalInterestEarned || 0)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-50 p-2 dark:bg-amber-950">
              <Building2 className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Active Loans</p>
              <p className="text-xl font-bold">{account.activeLoanCount || portfolio.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Investments */}
      <div className="rounded-lg border bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-zinc-800">
          <h2 className="text-sm font-semibold">Active Investments</h2>
          <Link href="/portal/portfolio" className="text-xs text-brand-600 hover:text-brand-700">
            View All
          </Link>
        </div>
        {portfolio.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">No active investments</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-800">
                <th className="px-4 py-2.5 text-left font-medium text-zinc-500">Loan</th>
                <th className="px-4 py-2.5 text-left font-medium text-zinc-500">Property</th>
                <th className="px-4 py-2.5 text-right font-medium text-zinc-500">Investment</th>
                <th className="px-4 py-2.5 text-right font-medium text-zinc-500">Rate</th>
                <th className="px-4 py-2.5 text-left font-medium text-zinc-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.slice(0, 10).map((inv: any) => (
                <tr key={inv.loanNumber} className="border-b last:border-0 dark:border-zinc-800">
                  <td className="px-4 py-2.5 font-medium">{inv.loanNumber}</td>
                  <td className="px-4 py-2.5 text-xs text-zinc-500">{inv.property}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(inv.amount)}</td>
                  <td className="px-4 py-2.5 text-right text-xs">{inv.interestRate?.toFixed(2)}%</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent Transactions */}
      {data?.transactions && data.transactions.length > 0 && (
        <div className="mt-6 rounded-lg border bg-white dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center justify-between px-4 py-3 border-b dark:border-zinc-800">
            <h2 className="text-sm font-semibold">Recent Transactions</h2>
            <Link href="/portal/transactions" className="text-xs text-brand-600 hover:text-brand-700">
              View All
            </Link>
          </div>
          <div className="divide-y dark:divide-zinc-800">
            {data.transactions.slice(0, 5).map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{tx.type}</p>
                  <p className="text-xs text-zinc-500">{tx.description || "—"}</p>
                </div>
                <div className="text-right">
                  <p className={cn("text-sm font-medium", tx.amount > 0 ? "text-emerald-600" : "text-red-600")}>
                    {tx.amount > 0 ? "+" : ""}{formatCurrency(tx.amount)}
                  </p>
                  <p className="text-[10px] text-zinc-400">{new Date(tx.date).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
