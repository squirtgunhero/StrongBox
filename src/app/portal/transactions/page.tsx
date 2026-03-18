"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";

export default function TransactionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["portal"],
    queryFn: async () => {
      const res = await fetch("/api/portal?view=investor");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const transactions = data?.transactions || [];

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Transactions</h1>

      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center dark:bg-zinc-900 dark:border-zinc-800">
          <ArrowRightLeft className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No transactions yet</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white dark:bg-zinc-900 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-800">
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Type</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Description</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Reference</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx: any) => (
                <tr key={tx.id} className="border-b last:border-0 dark:border-zinc-800">
                  <td className="px-4 py-3 text-xs">{new Date(tx.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-medium">
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{tx.description || "—"}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{tx.referenceNumber || "—"}</td>
                  <td className={cn("px-4 py-3 text-right font-medium", tx.amount > 0 ? "text-emerald-600" : "text-red-600")}>
                    {tx.amount > 0 ? "+" : ""}{formatCurrency(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
