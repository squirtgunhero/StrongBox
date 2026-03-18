"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calculator, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";

interface PayoffCalculatorProps {
  loanId: string;
}

export function PayoffCalculator({ loanId }: PayoffCalculatorProps) {
  const [payoffDate, setPayoffDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["payoff", loanId, payoffDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/loans/${loanId}/payoff?payoffDate=${payoffDate}`
      );
      if (!res.ok) throw new Error("Failed to calculate payoff");
      return res.json();
    },
    enabled: !!loanId,
  });

  const payoff = data?.payoff;

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="h-4 w-4 text-stone-500" />
        <h3 className="text-sm font-semibold">Payoff Calculator</h3>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div>
          <label className="block text-xs text-stone-500 mb-1">Payoff Date</label>
          <input
            type="date"
            value={payoffDate}
            onChange={(e) => setPayoffDate(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="mt-5 rounded-md bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#162D4A] disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Calculate"}
        </button>
      </div>

      {payoff && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm py-1.5 border-b">
            <span className="text-stone-500">Current Balance</span>
            <span className="font-medium">{formatCurrency(payoff.currentBalance)}</span>
          </div>
          <div className="flex justify-between text-sm py-1.5 border-b">
            <span className="text-stone-500">
              Accrued Interest ({payoff.daysSinceLastPayment} days)
            </span>
            <span className="font-medium">{formatCurrency(payoff.accruedInterest)}</span>
          </div>
          <div className="flex justify-between text-sm py-1.5 border-b">
            <span className="text-stone-500">Per Diem</span>
            <span className="text-xs text-stone-400">{formatCurrency(payoff.perDiem)}/day</span>
          </div>
          {payoff.outstandingFees > 0 && (
            <div className="flex justify-between text-sm py-1.5 border-b">
              <span className="text-stone-500">Outstanding Fees</span>
              <span className="font-medium">{formatCurrency(payoff.outstandingFees)}</span>
            </div>
          )}
          {payoff.lateCharges > 0 && (
            <div className="flex justify-between text-sm py-1.5 border-b">
              <span className="text-stone-500">Late Charges</span>
              <span className="font-medium text-red-600">
                {formatCurrency(payoff.lateCharges)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm py-2 bg-stone-50 -mx-4 px-4 rounded-b-lg mt-3">
            <span className="font-semibold">Total Payoff</span>
            <span className="text-lg font-bold text-emerald-600">
              {formatCurrency(payoff.totalPayoff)}
            </span>
          </div>
          <p className="text-[10px] text-stone-400 text-right mt-1">
            Good through {formatDate(payoff.goodThrough)}
          </p>
        </div>
      )}
    </div>
  );
}
