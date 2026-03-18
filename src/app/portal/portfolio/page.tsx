"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Building2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";

export default function PortfolioPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["portal"],
    queryFn: async () => {
      const res = await fetch("/api/portal?view=investor");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const portfolio = data?.portfolio || [];

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Portfolio</h1>

      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      ) : portfolio.length === 0 ? (
        <div className="rounded-xl p-12 text-center">
          <Building2 className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No active investments</p>
        </div>
      ) : (
        <div className="space-y-3">
          {portfolio.map((inv: any) => (
            <div key={inv.loanNumber} className="rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold">{inv.loanNumber}</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">{inv.property}</p>
                  {inv.borrower && <p className="text-xs text-zinc-500">{inv.borrower}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{formatCurrency(inv.amount)}</p>
                  <p className="text-xs text-zinc-500">{inv.interestRate?.toFixed(2)}% rate</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="inline-flex items-center rounded-full bg-emerald-50950 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                  {inv.status}
                </span>
                {inv.maturityDate && (
                  <span className="text-zinc-500">
                    Matures: {new Date(inv.maturityDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
