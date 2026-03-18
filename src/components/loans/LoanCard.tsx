"use client";

import { LoanStatusBadge } from "./LoanStatusBadge";
import { formatCurrency } from "@/lib/utils/currency";
import type { LoanStatus } from "@prisma/client";

interface LoanCardProps {
  loanNumber: string;
  borrowerName: string;
  propertyAddress?: string;
  loanAmount: number;
  status: LoanStatus;
  interestRate: number;
}

export function LoanCard({
  loanNumber,
  borrowerName,
  propertyAddress,
  loanAmount,
  status,
  interestRate,
}: LoanCardProps) {
  return (
    <div className="rounded-lg border bg-white p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium">{loanNumber}</p>
          <p className="text-sm text-stone-500">
            {borrowerName}
          </p>
        </div>
        <LoanStatusBadge status={status} />
      </div>
      {propertyAddress && (
        <p className="mt-2 text-xs text-stone-500">{propertyAddress}</p>
      )}
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="font-medium">{formatCurrency(loanAmount)}</span>
        <span className="text-stone-500">{interestRate}%</span>
      </div>
    </div>
  );
}
