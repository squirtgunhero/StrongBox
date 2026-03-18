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
          <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <ArrowRightLeft className="h-10 w-10 text-stone-300 mx-auto mb-3" />
          <p className="text-sm text-stone-500">No transactions yet</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-stone-50">
                <th className="px-4 py-3 text-left font-medium text-stone-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-stone-500">Type</th>
                <th className="px-4 py-3 text-left font-medium text-stone-500">Description</th>
                <th className="px-4 py-3 text-left font-medium text-stone-500">Reference</th>
                <th className="px-4 py-3 text-right font-medium text-stone-500">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx: any) => (
                <tr key={tx.id} className="border-b last:border-0">
                  <td className="px-4 py-3 text-xs">{new Date(tx.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium">
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500">{tx.description || "—"}</td>
                  <td className="px-4 py-3 text-xs text-stone-400">{tx.referenceNumber || "—"}</td>
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
