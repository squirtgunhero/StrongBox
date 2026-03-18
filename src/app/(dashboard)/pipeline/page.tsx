"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Kanban,
  List,
  Loader2,
  Plus,
  GripVertical,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils/currency";
import { LoanStatusBadge } from "@/components/loans/LoanStatusBadge";
import type { LoanStatus } from "@prisma/client";

const PIPELINE_COLUMNS: { status: string; label: string; color: string }[] = [
  { status: "LEAD", label: "Leads", color: "border-t-zinc-400" },
  { status: "APPLICATION", label: "Application", color: "border-t-brand-500" },
  { status: "PROCESSING", label: "Processing", color: "border-t-purple-500" },
  { status: "UNDERWRITING", label: "Underwriting", color: "border-t-indigo-500" },
  { status: "CONDITIONAL_APPROVAL", label: "Conditional", color: "border-t-amber-500" },
  { status: "APPROVED", label: "Approved", color: "border-t-emerald-500" },
  { status: "CLOSING", label: "Closing", color: "border-t-cyan-500" },
  { status: "FUNDED", label: "Funded", color: "border-t-green-500" },
];

type ViewMode = "kanban" | "table";

export default function PipelinePage() {
  const [view, setView] = useState<ViewMode>("kanban");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["pipeline-loans"],
    queryFn: async () => {
      const statuses = PIPELINE_COLUMNS.map((c) => c.status).join(",");
      const res = await fetch(`/api/loans?status=${statuses}&limit=500`);
      if (!res.ok) throw new Error("Failed to fetch pipeline");
      return res.json();
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({
      loanId,
      status,
    }: {
      loanId: string;
      status: string;
    }) => {
      const res = await fetch(`/api/loans/${loanId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-loans"] });
    },
  });

  const loansByStatus = PIPELINE_COLUMNS.map((col) => ({
    ...col,
    loans: (data?.loans || []).filter(
      (l: any) => l.status === col.status
    ),
    total: (data?.loans || [])
      .filter((l: any) => l.status === col.status)
      .reduce((sum: number, l: any) => sum + Number(l.loanAmount), 0),
  }));

  const allPipelineLoans = data?.loans || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {allPipelineLoans.length} loans &middot;{" "}
            {formatCurrencyCompact(
              allPipelineLoans.reduce(
                (s: number, l: any) => s + Number(l.loanAmount),
                0
              )
            )}{" "}
            total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-md border dark:border-zinc-700">
            <button
              onClick={() => setView("kanban")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-l-md transition-colors",
                view === "kanban"
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400"
                  : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              )}
            >
              <Kanban className="h-3.5 w-3.5" /> Board
            </button>
            <button
              onClick={() => setView("table")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-r-md border-l dark:border-zinc-700 transition-colors",
                view === "table"
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400"
                  : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              )}
            >
              <List className="h-3.5 w-3.5" /> Table
            </button>
          </div>
          <Link
            href="/loans/new"
            className="flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            <Plus className="h-4 w-4" /> New Loan
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : view === "kanban" ? (
        <KanbanView
          columns={loansByStatus}
          onStatusChange={(loanId, status) =>
            updateStatus.mutate({ loanId, status })
          }
        />
      ) : (
        <TableView loans={allPipelineLoans} />
      )}
    </div>
  );
}

function KanbanView({
  columns,
  onStatusChange,
}: {
  columns: {
    status: string;
    label: string;
    color: string;
    loans: any[];
    total: number;
  }[];
  onStatusChange: (loanId: string, status: string) => void;
}) {
  const [dragLoanId, setDragLoanId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 500 }}>
      {columns.map((col) => (
        <div
          key={col.status}
          className={cn(
            "flex-shrink-0 w-64 rounded-lg border border-t-4 bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800",
            col.color,
            dragOverCol === col.status && "ring-2 ring-brand-400"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverCol(col.status);
          }}
          onDragLeave={() => setDragOverCol(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverCol(null);
            if (dragLoanId) {
              onStatusChange(dragLoanId, col.status);
              setDragLoanId(null);
            }
          }}
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                {col.label}
              </span>
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 px-1.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                {col.loans.length}
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 font-medium">
              {formatCurrencyCompact(col.total)}
            </span>
          </div>

          <div className="p-2 space-y-2 min-h-[100px]">
            {col.loans.map((loan: any) => (
              <Link
                key={loan.id}
                href={`/loans/${loan.id}`}
                draggable
                onDragStart={(e) => {
                  setDragLoanId(loan.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDragLoanId(null);
                  setDragOverCol(null);
                }}
                className={cn(
                  "block rounded-md border bg-white p-3 text-left hover:shadow-sm transition-all cursor-grab active:cursor-grabbing dark:bg-zinc-800 dark:border-zinc-700",
                  dragLoanId === loan.id && "opacity-50"
                )}
              >
                <div className="flex items-start justify-between gap-1">
                  <p className="text-xs font-medium text-brand-600 dark:text-brand-400">
                    {loan.loanNumber}
                  </p>
                  <GripVertical className="h-3 w-3 text-zinc-300 flex-shrink-0 mt-0.5" />
                </div>
                <p className="text-sm font-medium mt-1 truncate">
                  {loan.borrower?.lastName}, {loan.borrower?.firstName}
                </p>
                {loan.property && (
                  <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
                    {loan.property.address}, {loan.property.city}
                  </p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-semibold">
                    {formatCurrency(loan.loanAmount)}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {Number(loan.interestRate).toFixed(1)}%
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TableView({ loans }: { loans: any[] }) {
  if (!loans.length) {
    return (
      <div className="rounded-lg border bg-white p-12 text-center dark:bg-zinc-900 dark:border-zinc-800">
        <FileText className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
        <p className="text-sm text-zinc-500">No loans in pipeline</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white dark:bg-zinc-900 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-800">
            <th className="px-4 py-3 text-left font-medium text-zinc-500">
              Loan #
            </th>
            <th className="px-4 py-3 text-left font-medium text-zinc-500">
              Borrower
            </th>
            <th className="px-4 py-3 text-left font-medium text-zinc-500">
              Property
            </th>
            <th className="px-4 py-3 text-left font-medium text-zinc-500">
              Amount
            </th>
            <th className="px-4 py-3 text-left font-medium text-zinc-500">
              Rate
            </th>
            <th className="px-4 py-3 text-left font-medium text-zinc-500">
              Status
            </th>
            <th className="px-4 py-3 text-left font-medium text-zinc-500">
              Loan Officer
            </th>
          </tr>
        </thead>
        <tbody>
          {loans.map((loan: any) => (
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
                {loan.borrower?.lastName}, {loan.borrower?.firstName}
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
