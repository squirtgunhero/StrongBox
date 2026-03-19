"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  GripVertical,
  Kanban,
  List,
  Loader2,
  Plus,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
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
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils/currency";

const PIPELINE_COLUMNS: { status: string; label: string; color: string }[] = [
  { status: "LEAD", label: "Leads", color: "#7d8da8" },
  { status: "APPLICATION", label: "Application", color: "#5b8dff" },
  { status: "PROCESSING", label: "Processing", color: "#8d7bff" },
  { status: "UNDERWRITING", label: "Underwriting", color: "#4f9fff" },
  { status: "CONDITIONAL_APPROVAL", label: "Conditional", color: "#e8aa5a" },
  { status: "APPROVED", label: "Approved", color: "#4cd3a2" },
  { status: "CLOSING", label: "Closing", color: "#5fd0e6" },
  { status: "FUNDED", label: "Funded", color: "#34d399" },
];

type ViewMode = "kanban" | "table";

type LoanRow = {
  id: string;
  loanNumber: string;
  status: string;
  loanAmount: number;
  interestRate: number;
  borrower?: { firstName?: string; lastName?: string };
  property?: { address?: string; city?: string; state?: string };
  loanOfficer?: { firstName?: string; lastName?: string };
};

export default function PipelinePage() {
  const [view, setView] = useState<ViewMode>("kanban");
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery<{ loans: LoanRow[] }>({
    queryKey: ["pipeline-loans-live"],
    queryFn: async () => {
      const statuses = PIPELINE_COLUMNS.map((c) => c.status).join(",");
      const response = await fetch(`/api/loans?status=${statuses}&limit=500`);
      if (!response.ok) throw new Error("Failed to fetch pipeline");
      return response.json();
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ loanId, status }: { loanId: string; status: string }) => {
      const response = await fetch(`/api/loans/${loanId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-loans-live"] });
    },
  });

  const loansByStatus = useMemo(() => {
    const rows = data?.loans || [];
    return PIPELINE_COLUMNS.map((column) => ({
      ...column,
      loans: rows.filter((loan) => loan.status === column.status),
      total: rows.filter((loan) => loan.status === column.status).reduce((sum, loan) => sum + Number(loan.loanAmount), 0),
    }));
  }, [data]);

  const summary = useMemo(() => {
    const rows = data?.loans || [];
    const total = rows.length;
    const amount = rows.reduce((sum, loan) => sum + Number(loan.loanAmount), 0);
    const funded = rows.filter((loan) => loan.status === "FUNDED").length;
    const conversion = total ? (funded / total) * 100 : 0;
    return { total, amount, conversion };
  }, [data]);

  const chartData = loansByStatus.map((column) => ({ stage: column.label, loans: column.loans.length, volume: Number((column.total / 1_000_000).toFixed(2)) }));

  return (
    <div className="elevate-in space-y-4 pb-8">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#111b2b] to-[#0f1623] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-blue-300/90">Origination Workflow</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">Pipeline</h2>
            <p className="mt-1 text-sm text-zinc-400">Move deals from intake to funding with drag-and-drop status management.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-white/10 bg-[#0e1523] p-1">
              <button onClick={() => setView("kanban")} className={cn("inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs", view === "kanban" ? "bg-blue-500/25 text-blue-100" : "text-zinc-400 hover:text-zinc-200")}>
                <Kanban className="h-3.5 w-3.5" />Board
              </button>
              <button onClick={() => setView("table")} className={cn("inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs", view === "table" ? "bg-blue-500/25 text-blue-100" : "text-zinc-400 hover:text-zinc-200")}>
                <List className="h-3.5 w-3.5" />Table
              </button>
            </div>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#1f5bd6] to-[#2f88ff] px-3 py-2 text-xs font-semibold text-white transition hover:from-[#2d68df] hover:to-[#4493ff]"><Plus className="h-3.5 w-3.5" />New Loan</button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <SummaryCard label="Pipeline Deals" value={String(summary.total)} />
        <SummaryCard label="Pipeline Volume" value={formatCurrencyCompact(summary.amount)} />
        <SummaryCard label="Funded Conversion" value={`${summary.conversion.toFixed(1)}%`} />
      </section>

      <section className="rounded-xl border border-white/10 bg-[#101926]/95 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">Stage Distribution</h3>
          <TrendingUp className="h-4 w-4 text-zinc-500" />
        </div>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid stroke="#1f2a3f" vertical={false} />
              <XAxis dataKey="stage" tick={{ fill: "#6f7f99", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fill: "#6f7f99", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: "#6f7f99", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#111b2b", border: "1px solid #26344d", borderRadius: 10 }} />
              <Bar yAxisId="left" dataKey="loans" fill="#2f88ff" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="volume" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {isLoading ? (
        <div className="rounded-xl border border-white/10 bg-[#101926]/95 p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-zinc-500" /></div>
      ) : isError ? (
        <div className="rounded-xl border border-red-300/25 bg-red-500/10 p-6 text-center">
          <p className="text-sm text-zinc-100">Unable to load pipeline</p>
          <button onClick={() => void refetch()} className="mt-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-zinc-200">Retry</button>
        </div>
      ) : view === "kanban" ? (
        <KanbanView columns={loansByStatus} onStatusChange={(loanId, status) => updateStatus.mutate({ loanId, status })} />
      ) : (
        <TableView loans={data?.loans || []} />
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-white/10 bg-[#101926]/95 p-3.5">
      <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-zinc-100">{value}</p>
    </article>
  );
}

function KanbanView({
  columns,
  onStatusChange,
}: {
  columns: Array<{ status: string; label: string; color: string; loans: LoanRow[]; total: number }>;
  onStatusChange: (loanId: string, status: string) => void;
}) {
  const [dragLoanId, setDragLoanId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 500 }}>
      {columns.map((column) => (
        <div
          key={column.status}
          className={cn("w-72 shrink-0 rounded-xl border border-white/10 bg-[#101926]/95", dragOverCol === column.status && "ring-2 ring-blue-400/40")}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOverCol(column.status);
          }}
          onDragLeave={() => setDragOverCol(null)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOverCol(null);
            if (dragLoanId) onStatusChange(dragLoanId, column.status);
            setDragLoanId(null);
          }}
        >
          <div className="border-b border-white/10 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-400">{column.label}</p>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-zinc-300">{column.loans.length}</span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">{formatCurrencyCompact(column.total)}</p>
          </div>

          <div className="space-y-2 p-2.5">
            {column.loans.map((loan) => (
              <Link
                key={loan.id}
                href={`/loans/${loan.id}`}
                draggable
                onDragStart={() => setDragLoanId(loan.id)}
                onDragEnd={() => setDragLoanId(null)}
                className={cn("block rounded-lg border border-white/10 bg-white/[0.02] p-3 transition hover:bg-white/[0.06]", dragLoanId === loan.id && "opacity-60")}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-blue-200">{loan.loanNumber}</p>
                  <GripVertical className="mt-0.5 h-3.5 w-3.5 text-zinc-600" />
                </div>
                <p className="mt-1 text-sm text-zinc-100">{loan.borrower?.lastName}, {loan.borrower?.firstName}</p>
                <p className="mt-0.5 truncate text-[11px] text-zinc-500">{loan.property?.address}, {loan.property?.city}</p>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-100">{formatCurrency(loan.loanAmount)}</span>
                  <span className="text-zinc-400">{Number(loan.interestRate).toFixed(2)}%</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TableView({ loans }: { loans: LoanRow[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-white/10 bg-[#101926]/95">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-[#0f1724]">
            <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.15em] text-zinc-500">Loan</th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.15em] text-zinc-500">Borrower</th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.15em] text-zinc-500">Property</th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.15em] text-zinc-500">Amount</th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.15em] text-zinc-500">Status</th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.15em] text-zinc-500">Owner</th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-[0.15em] text-zinc-500">Open</th>
          </tr>
        </thead>
        <tbody>
          {loans.map((loan) => (
            <tr key={loan.id} className="border-b border-white/10 text-xs text-zinc-300 transition hover:bg-white/[0.04]">
              <td className="px-4 py-3 text-zinc-100">{loan.loanNumber}</td>
              <td className="px-4 py-3">{loan.borrower?.lastName}, {loan.borrower?.firstName}</td>
              <td className="px-4 py-3 text-zinc-500">{loan.property?.address}, {loan.property?.city}</td>
              <td className="px-4 py-3 text-zinc-100">{formatCurrency(loan.loanAmount)}</td>
              <td className="px-4 py-3">{loan.status.replaceAll("_", " ")}</td>
              <td className="px-4 py-3">{loan.loanOfficer?.firstName} {loan.loanOfficer?.lastName}</td>
              <td className="px-4 py-3 text-right"><Link href={`/loans/${loan.id}`} className="inline-flex items-center gap-1 text-blue-200 hover:text-blue-100">Open <ArrowRight className="h-3.5 w-3.5" /></Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
