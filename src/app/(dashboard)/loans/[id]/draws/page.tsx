"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Loader2,
  HardHat,
  CheckCircle2,
  Clock,
  XCircle,
  DollarSign,
  X,
  Eye,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, formatRelative } from "@/lib/utils/dates";

const DRAW_STATUS: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  DRAFT: { label: "Draft", color: "text-stone-500 bg-stone-100", icon: Clock },
  SUBMITTED: { label: "Submitted", color: "text-[#1E3A5F] bg-[#EFF4F9]", icon: Clock },
  UNDER_REVIEW: { label: "Under Review", color: "text-purple-600 bg-purple-50950", icon: Eye },
  APPROVED: { label: "Approved", color: "text-emerald-600 bg-emerald-50950", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", color: "text-red-600 bg-red-50950", icon: XCircle },
  FUNDED: { label: "Funded", color: "text-green-600 bg-green-50950", icon: DollarSign },
  CANCELLED: { label: "Cancelled", color: "text-stone-400 bg-stone-100", icon: XCircle },
};

export default function LoanDrawsPage() {
  const { id } = useParams();
  const [showCreate, setShowCreate] = useState(false);
  const [amount, setAmount] = useState("");
  const [work, setWork] = useState("");
  const [percent, setPercent] = useState("");
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
    queryKey: ["draws", id],
    queryFn: async () => {
      const res = await fetch(`/api/draws?loanId=${id}`);
      if (!res.ok) throw new Error("Failed to fetch draws");
      return res.json();
    },
  });

  const createDraw = useMutation({
    mutationFn: async (drawData: Record<string, unknown>) => {
      const res = await fetch("/api/draws", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(drawData),
      });
      if (!res.ok) throw new Error("Failed to create draw");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["draws", id] });
      setShowCreate(false);
      setAmount("");
      setWork("");
      setPercent("");
    },
  });

  const updateDraw = useMutation({
    mutationFn: async ({ drawId, ...data }: { drawId: string; [key: string]: any }) => {
      const res = await fetch(`/api/draws/${drawId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update draw");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["draws", id] }),
  });

  const loan = loanData?.loan;
  const draws = data?.draws || [];
  const totalFunded = draws
    .filter((d: any) => d.status === "FUNDED")
    .reduce((s: number, d: any) => s + Number(d.amountApproved || d.amountRequested), 0);
  const rehabBudget = Number(loan?.rehabBudget || 0);
  const remaining = rehabBudget - totalFunded;
  const usedPercent = rehabBudget > 0 ? (totalFunded / rehabBudget) * 100 : 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/loans/${id}`}
          className="rounded-md p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">
            Draws {loan ? `— ${loan.loanNumber}` : ""}
          </h1>
          <p className="text-sm text-stone-500">{draws.length} draw requests</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-md bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#162D4A]"
        >
          <Plus className="h-4 w-4" /> New Draw
        </button>
      </div>

      {/* Budget Progress */}
      {rehabBudget > 0 && (
        <div className="rounded-lg border bg-white p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Rehab Budget</h3>
            <span className="text-sm font-medium">{formatCurrency(rehabBudget)}</span>
          </div>
          <div className="w-full bg-stone-200 rounded-full h-2">
            <div
              className={cn(
                "h-2 rounded-full transition-all",
                usedPercent > 90 ? "bg-red-500" : usedPercent > 70 ? "bg-amber-500" : "bg-emerald-500"
              )}
              style={{ width: `${Math.min(100, usedPercent)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-stone-500">
            <span>Funded: {formatCurrency(totalFunded)} ({usedPercent.toFixed(0)}%)</span>
            <span>Remaining: {formatCurrency(remaining)}</span>
          </div>
        </div>
      )}

      {/* New Draw Form */}
      {showCreate && (
        <div className="rounded-lg border bg-white p-4 mb-4">
          <h3 className="text-sm font-semibold mb-3">Submit Draw Request</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Amount Requested</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Work Completed</label>
              <input
                type="text"
                value={work}
                onChange={(e) => setWork(e.target.value)}
                placeholder="Description of completed work"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">% Complete</label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                placeholder="0"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() =>
                createDraw.mutate({
                  loanId: id,
                  amountRequested: amount,
                  workCompleted: work || undefined,
                  percentComplete: percent || undefined,
                })
              }
              disabled={!amount || createDraw.isPending}
              className="rounded-md bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#162D4A] disabled:opacity-50"
            >
              Submit Draw
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-md border px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Draws List */}
      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
        </div>
      ) : draws.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <HardHat className="h-10 w-10 text-stone-300 mx-auto mb-3" />
          <p className="text-sm text-stone-500">No draw requests yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {draws.map((draw: any) => {
            const statusCfg = DRAW_STATUS[draw.status] || DRAW_STATUS.DRAFT;
            const StatusIcon = statusCfg.icon;

            return (
              <div
                key={draw.id}
                className="rounded-lg border bg-white p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-stone-100 p-2">
                      <HardHat className="h-4 w-4 text-stone-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold">Draw #{draw.drawNumber}</h4>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                            statusCfg.color
                          )}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {statusCfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Requested {formatRelative(draw.createdAt)}
                        {draw.workCompleted && ` — ${draw.workCompleted}`}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(draw.amountRequested)}</p>
                    {draw.amountApproved && Number(draw.amountApproved) !== Number(draw.amountRequested) && (
                      <p className="text-xs text-emerald-600">
                        Approved: {formatCurrency(draw.amountApproved)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Inspection Info */}
                {draw.inspectionDate && (
                  <div className="mt-3 pt-3 border-t text-xs text-stone-500">
                    Inspection: {formatDate(draw.inspectionDate)} by {draw.inspectorName || "—"}
                    {draw.inspectionPassed !== null && (
                      <span className={draw.inspectionPassed ? "text-emerald-600 ml-2" : "text-red-600 ml-2"}>
                        {draw.inspectionPassed ? "Passed" : "Failed"}
                      </span>
                    )}
                  </div>
                )}

                {draw.percentComplete && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                      <span>Project Completion</span>
                      <span>{Number(draw.percentComplete).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-stone-200 rounded-full h-1.5700">
                      <div
                        className="h-1.5 rounded-full bg-[#1E3A5F]"
                        style={{ width: `${Math.min(100, Number(draw.percentComplete))}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {["SUBMITTED", "UNDER_REVIEW"].includes(draw.status) && (
                  <div className="mt-3 pt-3 border-t flex items-center gap-2">
                    {draw.status === "SUBMITTED" && (
                      <button
                        onClick={() => updateDraw.mutate({ drawId: draw.id, status: "UNDER_REVIEW" })}
                        className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                      >
                        Start Review
                      </button>
                    )}
                    {draw.status === "UNDER_REVIEW" && (
                      <>
                        <button
                          onClick={() => updateDraw.mutate({ drawId: draw.id, status: "APPROVED" })}
                          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateDraw.mutate({ drawId: draw.id, status: "REJECTED", rejectionReason: "Insufficient documentation" })}
                          className="text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                )}
                {draw.status === "APPROVED" && (
                  <div className="mt-3 pt-3 border-t">
                    <button
                      onClick={() => updateDraw.mutate({ drawId: draw.id, status: "FUNDED" })}
                      className="text-xs text-green-600 hover:text-green-700 font-medium"
                    >
                      Mark as Funded
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
