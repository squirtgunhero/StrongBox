"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Plus,
  Calendar,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, isOverdue } from "@/lib/utils/dates";

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "text-[#3B82F6] bg-blue-500/10",
  PENDING: "text-amber-600 bg-amber-50950",
  PAID: "text-emerald-600 bg-emerald-50950",
  LATE: "text-red-600 bg-red-50950",
  NSF: "text-red-400 bg-red-100950",
  WAIVED: "text-zinc-500 bg-white/10",
  PARTIAL: "text-amber-600 bg-amber-50950",
};

export default function LoanPaymentsPage() {
  const { id } = useParams();
  const [showRecord, setShowRecord] = useState<string | null>(null);
  const [recordAmount, setRecordAmount] = useState("");
  const [recordMethod, setRecordMethod] = useState("ACH");
  const [recordRef, setRecordRef] = useState("");
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split("T")[0]);
  const queryClient = useQueryClient();

  const { data: loanData } = useQuery({
    queryKey: ["loan", id],
    queryFn: async () => {
      const res = await fetch(`/api/loans/${id}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["payments", id],
    queryFn: async () => {
      const res = await fetch(`/api/payments?loanId=${id}&limit=100`);
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
  });

  const generateSchedule = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/payments/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loanId: id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate schedule");
      }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payments", id] }),
  });

  const recordPayment = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to record payment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments", id] });
      setShowRecord(null);
      setRecordAmount("");
      setRecordRef("");
    },
  });

  const loan = loanData?.loan;
  const payments = data?.payments || [];
  const paidCount = payments.filter((p: any) => p.status === "PAID").length;
  const overdueCount = payments.filter(
    (p: any) => isOverdue(p.dueDate) && ["SCHEDULED", "PENDING"].includes(p.status)
  ).length;
  const totalPaid = payments
    .filter((p: any) => p.status === "PAID")
    .reduce((s: number, p: any) => s + Number(p.amount), 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/loans/${id}`}
          className="rounded-md p-2 text-zinc-500 hover:text-zinc-400 hover:bg-white/5"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">
            Payments {loan ? `— ${loan.loanNumber}` : ""}
          </h1>
          <p className="text-sm text-zinc-500">
            {paidCount}/{payments.length} paid
            {overdueCount > 0 && (
              <span className="text-red-600 ml-2">{overdueCount} overdue</span>
            )}
          </p>
        </div>

        {payments.length === 0 && (
          <button
            onClick={() => generateSchedule.mutate()}
            disabled={generateSchedule.isPending}
            className="flex items-center gap-2 rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {generateSchedule.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Calendar className="h-4 w-4" />
            )}
            Generate Schedule
          </button>
        )}
      </div>

      {/* Summary Stats */}
      {payments.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="rounded-lg rounded-xl p-3">
            <p className="text-xs text-zinc-500">Total Payments</p>
            <p className="text-lg font-bold">{payments.length}</p>
          </div>
          <div className="rounded-lg rounded-xl p-3">
            <p className="text-xs text-zinc-500">Paid</p>
            <p className="text-lg font-bold text-emerald-600">{paidCount}</p>
          </div>
          <div className="rounded-lg rounded-xl p-3">
            <p className="text-xs text-zinc-500">Total Collected</p>
            <p className="text-lg font-bold">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="rounded-lg rounded-xl p-3">
            <p className="text-xs text-zinc-500">Overdue</p>
            <p className={cn("text-lg font-bold", overdueCount > 0 ? "text-red-600" : "")}>
              {overdueCount}
            </p>
          </div>
        </div>
      )}

      {/* Payment Schedule Table */}
      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      ) : payments.length === 0 ? (
        <div className="rounded-lg rounded-xl p-12 text-center">
          <Calendar className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-500 mb-2">No payment schedule</p>
          <p className="text-xs text-zinc-500">
            Generate a payment schedule to start tracking payments
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-white/5">
                <th className="px-4 py-3 text-left font-medium text-zinc-500">#</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Due Date</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Interest</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Principal</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Total</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Paid Date</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment: any, idx: number) => {
                const overdue =
                  isOverdue(payment.dueDate) &&
                  ["SCHEDULED", "PENDING"].includes(payment.status);
                const statusColor = STATUS_COLORS[payment.status] || "";

                return (
                  <tr
                    key={payment.id}
                    className={cn(
                      "border-b last:border-0",
                      overdue && "bg-red-50/50950/20"
                    )}
                  >
                    <td className="px-4 py-3 text-zinc-500 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs", overdue && "text-red-600 font-medium")}>
                        {overdue && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                        {formatDate(payment.dueDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      {formatCurrency(payment.interestAmount)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      {Number(payment.principalAmount) > 0
                        ? formatCurrency(payment.principalAmount)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                          statusColor
                        )}
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {payment.paidDate ? formatDate(payment.paidDate) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {["SCHEDULED", "PENDING", "LATE"].includes(payment.status) && (
                        <>
                          {showRecord === payment.id ? (
                            <div className="flex items-center gap-2 justify-end">
                              <input
                                type="number"
                                step="0.01"
                                value={recordAmount || Number(payment.amount).toFixed(2)}
                                onChange={(e) => setRecordAmount(e.target.value)}
                                className="w-24 rounded border px-2 py-1 text-xs"
                              />
                              <select
                                value={recordMethod}
                                onChange={(e) => setRecordMethod(e.target.value)}
                                className="rounded border px-2 py-1 text-xs"
                              >
                                <option>ACH</option>
                                <option>Wire</option>
                                <option>Check</option>
                                <option>Cash</option>
                              </select>
                              <button
                                onClick={() =>
                                  recordPayment.mutate({
                                    loanId: id,
                                    paymentId: payment.id,
                                    amount: recordAmount || Number(payment.amount).toFixed(2),
                                    paymentMethod: recordMethod,
                                    referenceNumber: recordRef || undefined,
                                    paidDate: recordDate,
                                  })
                                }
                                disabled={recordPayment.isPending}
                                className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700"
                              >
                                Record
                              </button>
                              <button
                                onClick={() => setShowRecord(null)}
                                className="text-zinc-500 hover:text-zinc-400"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setShowRecord(payment.id);
                                setRecordAmount(Number(payment.amount).toFixed(2));
                              }}
                              className="text-xs text-[#3B82F6] hover:text-blue-400"
                            >
                              Record Payment
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {generateSchedule.isError && (
        <p className="text-sm text-red-600 mt-2">{(generateSchedule.error as Error).message}</p>
      )}
    </div>
  );
}
