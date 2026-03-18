"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Hammer,
  Plus,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";

export default function PortalDrawsPage() {
  const [showRequest, setShowRequest] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["portal"],
    queryFn: async () => {
      const res = await fetch("/api/portal?view=borrower");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const loans = data?.loans || [];
  const allDraws = loans.flatMap((l: any) =>
    (l.draws || []).map((d: any) => ({
      ...d,
      loanNumber: l.loanNumber,
      loanId: l.id,
    }))
  );

  // Only loans with rehab budget can have draws
  const drawEligibleLoans = loans.filter(
    (l: any) =>
      l.rehabBudget &&
      Number(l.rehabBudget) > 0 &&
      ["FUNDED", "ACTIVE", "EXTENDED"].includes(l.status)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Draw Requests</h1>
        {drawEligibleLoans.length > 0 && (
          <button
            onClick={() => setShowRequest(true)}
            className="flex items-center gap-2 rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
          >
            <Plus className="h-4 w-4" /> New Draw Request
          </button>
        )}
      </div>

      {showRequest && (
        <DrawRequestForm
          loans={drawEligibleLoans}
          onClose={() => setShowRequest(false)}
          onSubmitted={() => {
            queryClient.invalidateQueries({ queryKey: ["portal"] });
            setShowRequest(false);
          }}
        />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      ) : allDraws.length === 0 ? (
        <div className="rounded-xl p-12 text-center">
          <Hammer className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No draw requests yet</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-white/5">
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Draw #</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Loan</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Requested</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Approved</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {allDraws.map((draw: any) => (
                <tr key={draw.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">#{draw.drawNumber}</td>
                  <td className="px-4 py-3 text-zinc-500">{draw.loanNumber}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(draw.amountRequested)}</td>
                  <td className="px-4 py-3 text-right">
                    {draw.amountApproved ? formatCurrency(draw.amountApproved) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <DrawStatusBadge status={draw.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {draw.submittedAt ? new Date(draw.submittedAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DrawStatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: typeof CheckCircle2; color: string }> = {
    SUBMITTED: { icon: Clock, color: "text-amber-600 bg-amber-50" },
    UNDER_REVIEW: { icon: Clock, color: "text-[#3B82F6] bg-blue-500/10" },
    APPROVED: { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
    FUNDED: { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
    REJECTED: { icon: XCircle, color: "text-red-600 bg-red-50" },
  };

  const { icon: Icon, color } = config[status] || config.SUBMITTED;

  return (
    <span className={cn("flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5", color)}>
      <Icon className="h-3 w-3" /> {status}
    </span>
  );
}

function DrawRequestForm({
  loans,
  onClose,
  onSubmitted,
}: {
  loans: any[];
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [loanId, setLoanId] = useState(loans[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const submitDraw = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/draws", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanId,
          amountRequested: parseFloat(amount),
          description,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit");
      }
      return res.json();
    },
    onSuccess: onSubmitted,
  });

  return (
    <div className="rounded-xl p-5 mb-6">
      <h2 className="text-sm font-semibold mb-4">New Draw Request</h2>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Loan</label>
          <select
            value={loanId}
            onChange={(e) => setLoanId(e.target.value)}
            className="w-full rounded-md px-3 py-2 text-sm"
          >
            {loans.map((l: any) => (
              <option key={l.id} value={l.id}>
                {l.loanNumber} — Budget: {formatCurrency(l.rehabBudget)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-xs font-medium text-zinc-500 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Describe the work completed..."
          className="w-full rounded-md px-3 py-2 text-sm"
        />
      </div>
      {submitDraw.error && (
        <p className="text-xs text-red-600 mb-3">{submitDraw.error.message}</p>
      )}
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-white/5 rounded-md"
        >
          Cancel
        </button>
        <button
          onClick={() => submitDraw.mutate()}
          disabled={!amount || submitDraw.isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#3B82F6] hover:bg-blue-600 rounded-md disabled:opacity-50"
        >
          {submitDraw.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Hammer className="h-4 w-4" />
          )}
          Submit Draw Request
        </button>
      </div>
    </div>
  );
}
