"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, isOverdue } from "@/lib/utils/dates";

type StatusTab = "" | "SCHEDULED" | "PAID" | "LATE" | "NSF" | "PARTIAL";

type PaymentRow = {
  id: string;
  amount: number;
  dueDate: string;
  paidDate?: string | null;
  status: string;
  paymentMethod?: string | null;
  loan?: { id: string; loanNumber: string; borrower?: { firstName?: string; lastName?: string } };
};

type PaymentsResponse = {
  payments: PaymentRow[];
  total: number;
  page: number;
  totalPages: number;
  summary: { overdueCount: number; upcomingCount: number; paidThisMonth: number };
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  SCHEDULED: { label: "Scheduled", color: "text-blue-200", bg: "bg-blue-500/20" },
  PENDING: { label: "Pending", color: "text-amber-200", bg: "bg-amber-500/20" },
  PAID: { label: "Paid", color: "text-emerald-200", bg: "bg-emerald-500/20" },
  LATE: { label: "Late", color: "text-red-200", bg: "bg-red-500/20" },
  NSF: { label: "NSF", color: "text-red-200", bg: "bg-red-500/20" },
  WAIVED: { label: "Waived", color: "text-zinc-300", bg: "bg-zinc-500/20" },
  PARTIAL: { label: "Partial", color: "text-amber-200", bg: "bg-amber-500/20" },
};

export default function PaymentsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusTab>("");
  const [page, setPage] = useState(1);

  const query = useQuery<PaymentsResponse>({
    queryKey: ["payments-live", statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("limit", "40");
      const response = await fetch(`/api/payments?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch payments");
      return response.json();
    },
  });

  const payments = query.data?.payments || [];
  const summary = query.data?.summary || { overdueCount: 0, upcomingCount: 0, paidThisMonth: 0 };

  const chartData = useMemo(() => {
    const buckets: Record<string, number> = { Scheduled: 0, Pending: 0, Paid: 0, Late: 0, NSF: 0, Partial: 0 };
    payments.forEach((payment) => {
      const key = STATUS_CONFIG[payment.status]?.label || "Scheduled";
      buckets[key] = (buckets[key] || 0) + Number(payment.amount || 0);
    });
    return Object.entries(buckets).map(([status, value]) => ({ status, amount: Number((value / 1_000).toFixed(1)) }));
  }, [payments]);

  return (
    <div className="elevate-in space-y-4 pb-8">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#111b2b] to-[#0f1623] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-blue-300/90">Servicing</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">Payments</h2>
            <p className="mt-1 text-sm text-zinc-400">Monitor due schedules, posted cash, and delinquency across the portfolio.</p>
          </div>
          <button
            onClick={() => void query.refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/[0.08]"
          >
            <RefreshCw className={query.isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />Refresh
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <SummaryCard label="Overdue" value={String(summary.overdueCount)} icon={<AlertTriangle className="h-4 w-4 text-red-300" />} tone="danger" />
        <SummaryCard label="Due in 30 Days" value={String(summary.upcomingCount)} icon={<Clock className="h-4 w-4 text-amber-300" />} tone="warning" />
        <SummaryCard label="Paid This Month" value={String(summary.paidThisMonth)} icon={<CheckCircle2 className="h-4 w-4 text-emerald-300" />} tone="success" />
      </section>

      <section className="rounded-xl border border-white/10 bg-[#101926]/95 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">Payment Amount by Status ($K)</h3>
          <DollarSign className="h-4 w-4 text-zinc-500" />
        </div>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid stroke="#1f2a3f" vertical={false} />
              <XAxis dataKey="status" tick={{ fill: "#6f7f99", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6f7f99", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#111b2b", border: "1px solid #26344d", borderRadius: 10 }} />
              <Bar dataKey="amount" fill="#2f88ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="flex items-center gap-2 overflow-x-auto">
        {[
          { value: "" as StatusTab, label: "All" },
          { value: "SCHEDULED" as StatusTab, label: "Scheduled" },
          { value: "PAID" as StatusTab, label: "Paid" },
          { value: "LATE" as StatusTab, label: "Late" },
          { value: "NSF" as StatusTab, label: "NSF" },
          { value: "PARTIAL" as StatusTab, label: "Partial" },
        ].map((tab) => (
          <button
            key={tab.value || "all"}
            onClick={() => {
              setStatusFilter(tab.value);
              setPage(1);
            }}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition",
              statusFilter === tab.value
                ? "border-blue-300/40 bg-blue-500/20 text-blue-200"
                : "border-white/10 bg-white/[0.02] text-zinc-400 hover:text-zinc-200"
            )}
          >
            {tab.label}
          </button>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-white/10 bg-[#101926]/95">
        {query.isLoading ? (
          <div className="p-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-zinc-500" /></div>
        ) : query.isError ? (
          <div className="p-10 text-center">
            <p className="text-sm text-zinc-100">Unable to load payments</p>
            <button onClick={() => void query.refetch()} className="mt-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-zinc-200">Retry</button>
          </div>
        ) : payments.length === 0 ? (
          <div className="p-10 text-center">
            <Calendar className="mx-auto h-8 w-8 text-zinc-500" />
            <p className="mt-2 text-sm text-zinc-100">No payments found</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-[#0f1724]">
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.15em] text-zinc-500">Loan</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.15em] text-zinc-500">Borrower</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.15em] text-zinc-500">Due Date</th>
                  <th className="px-4 py-3 text-right text-xs uppercase tracking-[0.15em] text-zinc-500">Amount</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.15em] text-zinc-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.15em] text-zinc-500">Paid Date</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.15em] text-zinc-500">Method</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const config = STATUS_CONFIG[payment.status] || STATUS_CONFIG.SCHEDULED;
                  const overdue = isOverdue(payment.dueDate) && ["SCHEDULED", "PENDING"].includes(payment.status);

                  return (
                    <tr key={payment.id} className={cn("border-b border-white/10 text-xs text-zinc-300 transition hover:bg-white/[0.04]", overdue && "bg-red-500/10")}>
                      <td className="px-4 py-3 text-blue-200">{payment.loan?.loanNumber || "-"}</td>
                      <td className="px-4 py-3">{payment.loan?.borrower?.lastName}, {payment.loan?.borrower?.firstName}</td>
                      <td className="px-4 py-3"><span className={overdue ? "text-red-200" : "text-zinc-300"}>{formatDate(payment.dueDate)}</span></td>
                      <td className="px-4 py-3 text-right text-zinc-100">{formatCurrency(payment.amount)}</td>
                      <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[10px]", config.color, config.bg)}>{config.label}</span></td>
                      <td className="px-4 py-3 text-zinc-500">{payment.paidDate ? formatDate(payment.paidDate) : "-"}</td>
                      <td className="px-4 py-3 text-zinc-500">{payment.paymentMethod || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {query.data && query.data.totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-xs text-zinc-400">
                <p>Page {query.data.page} of {query.data.totalPages}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded border border-white/10 px-3 py-1 disabled:opacity-50">Previous</button>
                  <button onClick={() => setPage((p) => Math.min(query.data?.totalPages || p, p + 1))} disabled={page >= (query.data?.totalPages || 1)} className="rounded border border-white/10 px-3 py-1 disabled:opacity-50">Next</button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "danger" | "warning" | "success";
}) {
  const toneClass = tone === "danger" ? "text-red-200" : tone === "warning" ? "text-amber-200" : "text-emerald-200";
  return (
    <article className="rounded-xl border border-white/10 bg-[#101926]/95 p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-500">{label}</p>
        {icon}
      </div>
      <p className={`mt-2 text-xl font-semibold ${toneClass}`}>{value}</p>
    </article>
  );
}
