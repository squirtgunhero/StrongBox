"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Search, Loader2, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { TableSkeleton } from "@/components/shared/Skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";
import { LoanStatusBadge } from "@/components/loans/LoanStatusBadge";
import type { LoanStatus } from "@prisma/client";

const STATUS_FILTERS = [
  { key: "", label: "All" },
  { key: "LEAD,APPLICATION,PROCESSING,UNDERWRITING", label: "Pipeline" },
  { key: "ACTIVE,EXTENDED", label: "Active" },
  { key: "FUNDED", label: "Funded" },
  { key: "PAID_OFF", label: "Paid Off" },
  { key: "DEFAULT,FORECLOSURE,REO", label: "Distressed" },
];

export default function LoansPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["loans", { search, statusFilter, page }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", page.toString());
      params.set("limit", "25");
      const res = await fetch(`/api/loans?${params}`);
      if (!res.ok) throw new Error("Failed to fetch loans");
      return res.json();
    },
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Loans</h1>
        <Link
          href="/loans/new"
          className="flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Loan
        </Link>
      </div>

      <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search loans..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-9 rounded-md border bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700"
          />
        </div>
        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => { setStatusFilter(f.key); setPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                statusFilter === f.key
                  ? "bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-400"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-white dark:bg-zinc-900 dark:border-zinc-800">
        {isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : !data?.loans?.length ? (
          <div className="p-12 text-center">
            <FileText className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">No loans found</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-800">
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Loan #</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Borrower</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Property</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Rate</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">LO</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Created</th>
                </tr>
              </thead>
              <tbody>
                {data.loans.map((loan: any) => (
                  <tr
                    key={loan.id}
                    className="border-b last:border-0 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/loans/${loan.id}`}
                        className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
                      >
                        {loan.loanNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {loan.borrower.lastName}, {loan.borrower.firstName}
                      {loan.borrower.companyName && (
                        <p className="text-xs text-zinc-400">{loan.borrower.companyName}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {loan.property
                        ? `${loan.property.address}, ${loan.property.city} ${loan.property.state}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatCurrency(loan.loanAmount)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {Number(loan.interestRate).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3">
                      <LoanStatusBadge status={loan.status as LoanStatus} />
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {loan.loanOfficer
                        ? `${loan.loanOfficer.firstName} ${loan.loanOfficer.lastName}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {formatDate(loan.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3 dark:border-zinc-800">
                <p className="text-xs text-zinc-500">
                  {(page - 1) * data.limit + 1}-{Math.min(page * data.limit, data.total)} of {data.total}
                </p>
                <div className="flex gap-1">
                  <button disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded p-1 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded p-1 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
