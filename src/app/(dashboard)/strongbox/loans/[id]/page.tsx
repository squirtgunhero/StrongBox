"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrencyCompact } from "@/lib/utils/currency";

type LoanDetail = {
  id: string;
  loan_stage: string;
  loan_status: string;
  loan_type: string | null;
  principal_total: number | null;
  purchase_amount: number | null;
  rehab_amount: number | null;
  ltv: number | null;
  arv: number | null;
  interest_rate: number | null;
  maturity_date: string | null;
  payoff_date: string | null;
  title_company: string | null;
  title_contact: string | null;
  terms_text: string | null;
  notes: string | null;
  borrower: { id: string; legal_name: string; email: string | null; phone: string | null };
  property: { full_address: string; city: string | null; state: string | null; zip: string | null; market_name: string | null } | null;
  draw_requests: Array<{ id: string; status: string; amount_requested: number; approved_amount: number | null; created_at: string }>;
};

const tabs = ["Overview", "Property", "Financials", "Draws", "Documents", "Timeline", "Notes"] as const;

export default function StrongboxLoanDetailPage() {
  const params = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Overview");

  const loanQuery = useQuery<{ loan: LoanDetail }>({
    queryKey: ["strongbox-loan", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/strongbox/loans/${params.id}`);
      if (!res.ok) throw new Error("Failed to load loan");
      return res.json();
    },
  });

  const loan = loanQuery.data?.loan;

  const drawTotals = useMemo(() => {
    const draws = loan?.draw_requests || [];
    const requested = draws.reduce((sum, d) => sum + Number(d.amount_requested || 0), 0);
    const approved = draws.reduce((sum, d) => sum + Number(d.approved_amount || 0), 0);
    return { requested, approved };
  }, [loan?.draw_requests]);

  if (loanQuery.isLoading) return <p className="text-sm text-zinc-500">Loading loan...</p>;
  if (!loan) return <p className="text-sm text-red-500">Loan not found.</p>;

  return (
    <div className="space-y-4">
      <Link href="/strongbox" className="text-sm text-zinc-500 hover:text-black">Back to StrongBox dashboard</Link>

      <section className="rounded-xl border border-black/10 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-black">{loan.borrower.legal_name}</h1>
            <p className="text-sm text-zinc-600">{loan.property?.full_address || "No property address"}</p>
            <p className="mt-1 text-xs text-zinc-500">Stage: {loan.loan_stage.toLowerCase()} | Status: {loan.loan_status.toLowerCase()}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500">Principal Total</p>
            <p className="text-xl font-semibold text-black">{formatCurrencyCompact(Number(loan.principal_total || 0))}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-black/10 bg-white">
        <div className="flex flex-wrap gap-5 border-b border-black/10 px-4 py-3 text-sm">
          {tabs.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={activeTab === tab ? "font-semibold text-[#C33732]" : "text-zinc-600"}>
              {tab}
            </button>
          ))}
        </div>

        <div className="p-4 text-sm text-zinc-700">
          {activeTab === "Overview" && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <p>Loan Type: {loan.loan_type || "-"}</p>
              <p>Interest Rate: {loan.interest_rate ?? "-"}</p>
              <p>Maturity Date: {loan.maturity_date ? new Date(loan.maturity_date).toLocaleDateString() : "-"}</p>
              <p>Payoff Date: {loan.payoff_date ? new Date(loan.payoff_date).toLocaleDateString() : "-"}</p>
              <p>Title Company: {loan.title_company || "-"}</p>
              <p>Title Contact: {loan.title_contact || "-"}</p>
            </div>
          )}

          {activeTab === "Property" && (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <p>Address: {loan.property?.full_address || "-"}</p>
              <p>City: {loan.property?.city || "-"}</p>
              <p>State: {loan.property?.state || "-"}</p>
              <p>Zip: {loan.property?.zip || "-"}</p>
              <p>Market: {loan.property?.market_name || "Unmapped"}</p>
            </div>
          )}

          {activeTab === "Financials" && (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <p>Principal: {formatCurrencyCompact(Number(loan.principal_total || 0))}</p>
              <p>Purchase: {formatCurrencyCompact(Number(loan.purchase_amount || 0))}</p>
              <p>Rehab: {formatCurrencyCompact(Number(loan.rehab_amount || 0))}</p>
              <p>ARV: {formatCurrencyCompact(Number(loan.arv || 0))}</p>
              <p>LTV: {loan.ltv != null ? `${(Number(loan.ltv) * 100).toFixed(2)}%` : "-"}</p>
              <p>Total Draw Requested: {formatCurrencyCompact(drawTotals.requested)}</p>
              <p>Total Draw Approved: {formatCurrencyCompact(drawTotals.approved)}</p>
            </div>
          )}

          {activeTab === "Draws" && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-black/10 text-xs uppercase tracking-[0.12em] text-zinc-500">
                    <th className="px-2 py-2 text-left">Date</th>
                    <th className="px-2 py-2 text-left">Status</th>
                    <th className="px-2 py-2 text-left">Requested</th>
                    <th className="px-2 py-2 text-left">Approved</th>
                  </tr>
                </thead>
                <tbody>
                  {loan.draw_requests.map((draw) => (
                    <tr key={draw.id} className="border-b border-black/10 last:border-0">
                      <td className="px-2 py-2">{new Date(draw.created_at).toLocaleDateString()}</td>
                      <td className="px-2 py-2 capitalize">{draw.status.toLowerCase()}</td>
                      <td className="px-2 py-2">{formatCurrencyCompact(draw.amount_requested)}</td>
                      <td className="px-2 py-2">{formatCurrencyCompact(Number(draw.approved_amount || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "Documents" && <p>Document integration ready for normalized upload linkage.</p>}
          {activeTab === "Timeline" && <p>Timeline includes import source, stage changes, draw actions, and payoff updates.</p>}
          {activeTab === "Notes" && <p>{loan.notes || "No notes."}</p>}
        </div>
      </section>
    </div>
  );
}
