"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";

export default function AccountPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["portal"],
    queryFn: async () => {
      const res = await fetch("/api/portal?view=investor");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  const account = data?.account || {};
  const sources = data?.capitalSources || [];

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Capital Account</h1>

      {/* Account Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Current Balance", value: formatCurrency(account.currentBalance || 0) },
          { label: "Total Deployed", value: formatCurrency(account.totalDeployed || 0) },
          { label: "Total Returned", value: formatCurrency(account.totalReturned || 0) },
          { label: "Interest Earned", value: formatCurrency(account.totalInterestEarned || 0), color: "text-emerald-600" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg rounded-xl p-4">
            <p className="text-xs text-zinc-500">{item.label}</p>
            <p className={`text-xl font-bold mt-1 ${item.color || ""}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Capital Sources */}
      {sources.length > 0 && (
        <div className="rounded-lg rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">Capital Sources</h2>
          <div className="space-y-3">
            {sources.map((src: any) => {
              const utilization = src.creditLimit > 0 ? (src.deployed / src.creditLimit) * 100 : 0;
              return (
                <div key={src.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{src.name}</span>
                    <span className="text-xs text-zinc-500">
                      {formatCurrency(src.deployed)} / {formatCurrency(src.creditLimit)}
                    </span>
                  </div>
                  <div className="w-full bg-stone-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-[#3B82F6] transition-all"
                      style={{ width: `${Math.min(100, utilization)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1 text-right">
                    {formatCurrency(src.available)} available
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
