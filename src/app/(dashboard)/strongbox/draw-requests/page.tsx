"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrencyCompact } from "@/lib/utils/currency";

type DrawRequest = {
  id: string;
  status: string;
  amount_requested: number;
  approved_amount: number | null;
  exception_flag: boolean;
  loan: {
    id: string;
    loan_status: string;
    borrower: { legal_name: string };
    property: { full_address: string | null } | null;
  };
};

export default function StrongboxDrawRequestPage() {
  const [approvalAmount, setApprovalAmount] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const qc = useQueryClient();

  const query = useQuery<{ drawRequests: DrawRequest[] }>({
    queryKey: ["strongbox-draw-requests"],
    queryFn: async () => {
      const res = await fetch("/api/strongbox/draw-requests");
      if (!res.ok) throw new Error("Failed to load draw requests");
      return res.json();
    },
  });

  const action = useMutation({
    mutationFn: async (payload: { drawRequestId: string; status: "under_review" | "approved" | "rejected" | "funded"; approvedAmount?: number; adminOverrideEnabled?: boolean }) => {
      const res = await fetch("/api/strongbox/draw-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      return data;
    },
    onSuccess: () => {
      setSelectedId(null);
      setApprovalAmount("");
      qc.invalidateQueries({ queryKey: ["strongbox-draw-requests"] });
      qc.invalidateQueries({ queryKey: ["strongbox-dashboard"] });
    },
  });

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-black/10 bg-white p-4">
        <h1 className="text-2xl font-semibold text-black">Draw Request Workflow</h1>
        <p className="text-sm text-zinc-600">Validate active-loan eligibility and enforce remaining rehab-fund limits unless admin override is enabled.</p>
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-4">
        {query.isLoading ? (
          <p className="text-sm text-zinc-500">Loading draw requests...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 bg-zinc-50 text-xs uppercase tracking-[0.12em] text-zinc-500">
                  <th className="px-3 py-2 text-left">Borrower</th>
                  <th className="px-3 py-2 text-left">Property</th>
                  <th className="px-3 py-2 text-left">Loan Status</th>
                  <th className="px-3 py-2 text-left">Request</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Exception</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {(query.data?.drawRequests || []).map((draw) => (
                  <tr key={draw.id} className="border-b border-black/10 last:border-0">
                    <td className="px-3 py-2">{draw.loan.borrower.legal_name}</td>
                    <td className="px-3 py-2 text-zinc-600">{draw.loan.property?.full_address || "-"}</td>
                    <td className="px-3 py-2 capitalize">{draw.loan.loan_status.toLowerCase()}</td>
                    <td className="px-3 py-2">{formatCurrencyCompact(draw.amount_requested)}</td>
                    <td className="px-3 py-2 capitalize">{draw.status.toLowerCase()}</td>
                    <td className="px-3 py-2">{draw.exception_flag ? "Yes" : "No"}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => {
                          setSelectedId(draw.id);
                          setApprovalAmount(String(draw.amount_requested));
                        }}
                        className="rounded-md border border-black/20 px-2 py-1 text-xs"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedId && (
        <section className="rounded-xl border border-black/10 bg-white p-4">
          <h2 className="text-sm font-semibold text-black">Approval Actions</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              Approved Amount
              <input
                value={approvalAmount}
                onChange={(e) => setApprovalAmount(e.target.value)}
                className="rounded-md border border-black/20 px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={overrideEnabled} onChange={(e) => setOverrideEnabled(e.target.checked)} />
              Admin override
            </label>
          </div>

          {action.isError && <p className="mt-2 text-sm text-red-500">{action.error.message}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            <button className="rounded-md bg-zinc-900 px-3 py-2 text-xs text-white" onClick={() => action.mutate({ drawRequestId: selectedId, status: "under_review" })}>Mark Under Review</button>
            <button
              className="rounded-md bg-emerald-700 px-3 py-2 text-xs text-white"
              onClick={() =>
                action.mutate({
                  drawRequestId: selectedId,
                  status: "approved",
                  approvedAmount: Number(approvalAmount),
                  adminOverrideEnabled: overrideEnabled,
                })
              }
            >
              Approve
            </button>
            <button className="rounded-md bg-red-700 px-3 py-2 text-xs text-white" onClick={() => action.mutate({ drawRequestId: selectedId, status: "rejected" })}>Reject</button>
            <button
              className="rounded-md bg-blue-700 px-3 py-2 text-xs text-white"
              onClick={() =>
                action.mutate({
                  drawRequestId: selectedId,
                  status: "funded",
                  approvedAmount: Number(approvalAmount),
                  adminOverrideEnabled: overrideEnabled,
                })
              }
            >
              Mark Funded
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
