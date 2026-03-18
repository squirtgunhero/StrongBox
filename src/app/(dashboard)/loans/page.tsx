"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, FileText, ChevronLeft, ChevronRight } from "lucide-react";
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
  const router = useRouter();
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
      <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search loans..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full h-9 rounded-md border border-stone-200 bg-white pl-9 pr-3 text-sm text-stone-900 outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] placeholder:text-stone-400"
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
                    ? "bg-[#EFF4F9] text-[#1E3A5F]"
                    : "text-stone-500 hover:bg-stone-100"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <Link
          href="/loans/new"
          className="flex items-center gap-2 rounded-md bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#162D4A] transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Loan
        </Link>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white">
        {isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : !data?.loans?.length ? (
          <div className="p-12 text-center">
            <FileText className="h-10 w-10 text-stone-300 mx-auto mb-3" strokeWidth={1} />
            <p className="text-sm text-stone-500">No loans found</p>
            <Link
              href="/loans/new"
              className="inline-flex items-center gap-1 mt-3 text-sm text-[#1E3A5F] hover:text-[#162D4A] font-medium"
            >
              <Plus className="h-3.5 w-3.5" /> Create your first loan
            </Link>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Loan #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Borrower</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Property</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Rate</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">LO</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody>
                {data.loans.map((loan: any) => (
                  <tr
                    key={loan.id}
                    onClick={() => router.push(`/loans/${loan.id}`)}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-[#1E3A5F]">
                        {loan.loanNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      {loan.borrower.lastName}, {loan.borrower.firstName}
                      {loan.borrower.companyName && (
                        <p className="text-xs text-stone-400">{loan.borrower.companyName}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-500 text-xs">
                      {loan.property
                        ? `${loan.property.address}, ${loan.property.city} ${loan.property.state}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 font-medium font-mono text-stone-900">
                      {formatCurrency(loan.loanAmount)}
                    </td>
                    <td className="px-4 py-3 text-stone-500 font-mono">
                      {Number(loan.interestRate).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3">
                      <LoanStatusBadge status={loan.status as LoanStatus} />
                    </td>
                    <td className="px-4 py-3 text-stone-500 text-xs">
                      {loan.loanOfficer
                        ? `${loan.loanOfficer.firstName} ${loan.loanOfficer.lastName}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-stone-500 text-xs">
                      {formatDate(loan.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3">
                <p className="text-xs text-stone-500">
                  {(page - 1) * data.limit + 1}-{Math.min(page * data.limit, data.total)} of {data.total}
                </p>
                <div className="flex gap-1">
                  <button disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded p-1 hover:bg-stone-100 disabled:opacity-30">
                    <ChevronLeft className="h-4 w-4 text-stone-500" />
                  </button>
                  <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded p-1 hover:bg-stone-100 disabled:opacity-30">
                    <ChevronRight className="h-4 w-4 text-stone-500" />
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
