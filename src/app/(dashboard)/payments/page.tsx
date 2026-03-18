"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  DollarSign,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Loader2,
  Search,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, isOverdue } from "@/lib/utils/dates";

type StatusTab = "" | "SCHEDULED" | "PAID" | "LATE" | "NSF" | "PARTIAL";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  SCHEDULED: { label: "Scheduled", color: "text-[#1E3A5F]", bg: "bg-[#EFF4F9]" },
  PENDING: { label: "Pending", color: "text-amber-600", bg: "bg-amber-50950" },
  PAID: { label: "Paid", color: "text-emerald-600", bg: "bg-emerald-50950" },
  LATE: { label: "Late", color: "text-red-600", bg: "bg-red-50950" },
  NSF: { label: "NSF", color: "text-red-700", bg: "bg-red-100950" },
  WAIVED: { label: "Waived", color: "text-stone-500", bg: "bg-stone-100" },
  PARTIAL: { label: "Partial", color: "text-amber-600", bg: "bg-amber-50950" },
};

export default function PaymentsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusTab>("");
  const [page, setPage] = useState(1);

  const queryParams = new URLSearchParams();
  if (statusFilter) queryParams.set("status", statusFilter);
  queryParams.set("page", String(page));
  queryParams.set("limit", "30");

  const { data, isLoading } = useQuery({
    queryKey: ["payments", statusFilter, page],
    queryFn: async () => {
      const res = await fetch(`/api/payments?${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
  });

  const payments = data?.payments || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const summary = data?.summary || { overdueCount: 0, upcomingCount: 0, paidThisMonth: 0 };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Payments</h1>
          <p className="text-sm text-stone-500 mt-1">{total} total payments</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-red-50 p-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{summary.overdueCount}</p>
              <p className="text-xs text-stone-500">Overdue</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-50 p-2">
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{summary.upcomingCount}</p>
              <p className="text-xs text-stone-500">Due in 30 days</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-emerald-50 p-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{summary.paidThisMonth}</p>
              <p className="text-xs text-stone-500">Paid this month</p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        {[
          { value: "" as StatusTab, label: "All" },
          { value: "SCHEDULED" as StatusTab, label: "Scheduled" },
          { value: "PAID" as StatusTab, label: "Paid" },
          { value: "LATE" as StatusTab, label: "Late" },
          { value: "NSF" as StatusTab, label: "NSF" },
          { value: "PARTIAL" as StatusTab, label: "Partial" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatusFilter(tab.value);
              setPage(1);
            }}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors whitespace-nowrap",
              statusFilter === tab.value
                ? "bg-[#EFF4F9] text-[#162D4A] border-[#C5D9EC] "
                : "text-stone-500 border-stone-200 hover:bg-stone-50"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Payments Table */}
      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
        </div>
      ) : payments.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <DollarSign className="h-10 w-10 text-stone-300 mx-auto mb-3" />
          <p className="text-sm text-stone-500">No payments found</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-stone-50">
                <th className="px-4 py-3 text-left font-medium text-stone-500">Loan</th>
                <th className="px-4 py-3 text-left font-medium text-stone-500">Borrower</th>
                <th className="px-4 py-3 text-left font-medium text-stone-500">Due Date</th>
                <th className="px-4 py-3 text-right font-medium text-stone-500">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-stone-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-stone-500">Paid Date</th>
                <th className="px-4 py-3 text-left font-medium text-stone-500">Method</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment: any) => {
                const cfg = STATUS_CONFIG[payment.status] || STATUS_CONFIG.SCHEDULED;
                const overdue =
                  isOverdue(payment.dueDate) &&
                  ["SCHEDULED", "PENDING"].includes(payment.status);

                return (
                  <tr
                    key={payment.id}
                    className={cn(
                      "border-b last:border-0 hover:bg-stone-50",
                      overdue && "bg-red-50/50950/20"
                    )}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/loans/${payment.loan?.id}`}
                        className="font-medium text-[#1E3A5F] hover:text-[#162D4A]"
                      >
                        {payment.loan?.loanNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-stone-500">
                      {payment.loan?.borrower?.lastName}, {payment.loan?.borrower?.firstName}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs", overdue && "text-red-600 font-medium")}>
                        {overdue && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                        {formatDate(payment.dueDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                          cfg.color,
                          cfg.bg
                        )}
                      >
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-500">
                      {payment.paidDate ? formatDate(payment.paidDate) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-500">
                      {payment.paymentMethod || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-stone-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-xs rounded border disabled:opacity-50700"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 text-xs rounded border disabled:opacity-50700"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
