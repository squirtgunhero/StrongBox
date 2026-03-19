"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrencyCompact } from "@/lib/utils/currency";

type DashboardResponse = {
  currentCash: number;
  loansOut: number;
  activeExposure: number;
  totalCompanyCash: number;
  drawReserve: number;
  fundingPressure: number;
  upcomingFundingNeed: number;
  pendingDrawRequests: number;
  maturitiesIn30Days: number;
  activeLoanCount: number;
  snapshotAsOf: string | null;
};

type LoanRow = {
  id: string;
  loan_stage: string;
  loan_status: string;
  principal_total: number | null;
  title_company: string | null;
  maturity_date: string | null;
  borrower: { legal_name: string };
  property: { full_address: string | null; state: string | null; market_name: string | null } | null;
};

type DrawRow = {
  id: string;
  status: string;
  amount_requested: number;
  loan: { id: string; borrower: { legal_name: string } };
};

type RiskResponse = {
  flaggedLoans: Array<{
    loanId: string;
    borrower: string;
    property: string | null;
    flags: string[];
  }>;
};

export default function StrongboxDashboardPage() {
  const [stageFilter, setStageFilter] = useState("all");

  const dashboardQuery = useQuery<DashboardResponse>({
    queryKey: ["strongbox-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/strongbox/dashboard");
      if (!res.ok) throw new Error("Failed to load dashboard summary");
      return res.json();
    },
  });

  const loansQuery = useQuery<{ loans: LoanRow[] }>({
    queryKey: ["strongbox-loans", stageFilter],
    queryFn: async () => {
      const stageParam = stageFilter === "all" ? "" : `&stage=${stageFilter}`;
      const res = await fetch(`/api/strongbox/loans?limit=200${stageParam}`);
      if (!res.ok) throw new Error("Failed to load loans");
      return res.json();
    },
  });

  const drawsQuery = useQuery<{ drawRequests: DrawRow[] }>({
    queryKey: ["strongbox-pending-draws"],
    queryFn: async () => {
      const res = await fetch("/api/strongbox/draw-requests?status=requested");
      if (!res.ok) throw new Error("Failed to load draw requests");
      return res.json();
    },
  });

  const riskQuery = useQuery<RiskResponse>({
    queryKey: ["strongbox-risk-flags"],
    queryFn: async () => {
      const res = await fetch("/api/strongbox/risk-flags");
      if (!res.ok) throw new Error("Failed to load risk flags");
      return res.json();
    },
  });

  const cards = useMemo(() => {
    const d = dashboardQuery.data;
    if (!d) return [];

    return [
      { label: "Current Cash", value: formatCurrencyCompact(d.currentCash), detail: d.snapshotAsOf ? `Snapshot ${new Date(d.snapshotAsOf).toLocaleDateString()}` : "Live cash accounts" },
      { label: "Loans Out", value: formatCurrencyCompact(d.loansOut) },
      { label: "Active Exposure", value: formatCurrencyCompact(d.activeExposure) },
      { label: "Draw Reserve", value: formatCurrencyCompact(d.drawReserve) },
      { label: "Funding Pressure", value: formatCurrencyCompact(d.fundingPressure), tone: d.fundingPressure > 0 ? "warning" : "normal" },
      { label: "Upcoming Funding Need", value: formatCurrencyCompact(d.upcomingFundingNeed) },
      { label: "Pending Draw Requests", value: String(d.pendingDrawRequests) },
      { label: "Maturities in 30 Days", value: String(d.maturitiesIn30Days) },
    ];
  }, [dashboardQuery.data]);

  const loading = dashboardQuery.isLoading || loansQuery.isLoading || drawsQuery.isLoading;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-black/10 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[#C33732]">StrongBox</p>
            <h1 className="text-2xl font-semibold text-black">Private Lending Operations</h1>
            <p className="text-sm text-zinc-600">Workbook logic is normalized into operational entities, workflows, and reports.</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Link href="/strongbox/loans" className="rounded-md border border-black/15 px-3 py-2 hover:bg-zinc-50">Loans</Link>
            <Link href="/strongbox/borrowers" className="rounded-md border border-black/15 px-3 py-2 hover:bg-zinc-50">Borrowers</Link>
            <Link href="/strongbox/draw-requests" className="rounded-md border border-black/15 px-3 py-2 hover:bg-zinc-50">Draw Workflow</Link>
            <Link href="/strongbox/cash-accounts" className="rounded-md border border-black/15 px-3 py-2 hover:bg-zinc-50">Cash Accounts</Link>
            <Link href="/strongbox/portfolio-snapshots" className="rounded-md border border-black/15 px-3 py-2 hover:bg-zinc-50">Snapshots</Link>
            <Link href="/strongbox/reports" className="rounded-md border border-black/15 px-3 py-2 hover:bg-zinc-50">Reporting</Link>
            <Link href="/strongbox/review" className="rounded-md border border-black/15 px-3 py-2 hover:bg-zinc-50">Remediation</Link>
            <Link href="/strongbox/import" className="rounded-md border border-black/15 px-3 py-2 hover:bg-zinc-50">Import</Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <article key={card.label} className="rounded-xl border border-black/10 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{card.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${card.tone === "warning" ? "text-[#C33732]" : "text-black"}`}>{card.value}</p>
            {card.detail ? <p className="mt-1 text-xs text-zinc-500">{card.detail}</p> : null}
          </article>
        ))}
      </section>

      {dashboardQuery.data && dashboardQuery.data.fundingPressure > 0 ? (
        <section className="rounded-xl border border-[#C33732]/20 bg-[#FFF5F4] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#C33732]">Funding Pressure</p>
              <p className="mt-1 text-sm text-zinc-700">
                Current cash and snapshots indicate a shortfall of {formatCurrencyCompact(dashboardQuery.data.fundingPressure)} against upcoming funding need plus draw reserve coverage.
              </p>
            </div>
            <p className="text-sm font-semibold text-[#C33732]">Total company cash {formatCurrencyCompact(dashboardQuery.data.totalCompanyCash)}</p>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-black/10 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-black">Active Loan Metrics</h2>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="rounded-md border border-black/15 px-2 py-1 text-xs"
          >
            <option value="all">All Stages</option>
            <option value="application">Applications</option>
            <option value="upcoming">Upcoming</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 bg-zinc-50 text-xs uppercase tracking-[0.12em] text-zinc-500">
                  <th className="px-3 py-2 text-left">Borrower</th>
                  <th className="px-3 py-2 text-left">Property</th>
                  <th className="px-3 py-2 text-left">Stage</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Principal</th>
                  <th className="px-3 py-2 text-left">Maturity</th>
                  <th className="px-3 py-2 text-right">Open</th>
                </tr>
              </thead>
              <tbody>
                {(loansQuery.data?.loans || []).slice(0, 20).map((loan) => (
                  <tr key={loan.id} className="border-b border-black/10 last:border-0">
                    <td className="px-3 py-2">{loan.borrower.legal_name}</td>
                    <td className="px-3 py-2 text-zinc-600">{loan.property?.full_address || "-"}</td>
                    <td className="px-3 py-2 capitalize">{loan.loan_stage.toLowerCase()}</td>
                    <td className="px-3 py-2 capitalize">{loan.loan_status.toLowerCase()}</td>
                    <td className="px-3 py-2">{formatCurrencyCompact(Number(loan.principal_total || 0))}</td>
                    <td className="px-3 py-2 text-zinc-600">{loan.maturity_date ? new Date(loan.maturity_date).toLocaleDateString() : "-"}</td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/strongbox/loans/${loan.id}`} className="text-[#C33732] hover:text-[#A52F2B]">Detail</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-black">Pending Draw Requests</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-zinc-50 text-xs uppercase tracking-[0.12em] text-zinc-500">
                <th className="px-3 py-2 text-left">Borrower</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Requested</th>
                <th className="px-3 py-2 text-right">Workflow</th>
              </tr>
            </thead>
            <tbody>
              {(drawsQuery.data?.drawRequests || []).slice(0, 12).map((draw) => (
                <tr key={draw.id} className="border-b border-black/10 last:border-0">
                  <td className="px-3 py-2">{draw.loan.borrower.legal_name}</td>
                  <td className="px-3 py-2 capitalize">{draw.status.toLowerCase()}</td>
                  <td className="px-3 py-2">{formatCurrencyCompact(draw.amount_requested)}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href="/strongbox/draw-requests" className="text-[#C33732] hover:text-[#A52F2B]">Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-black">Risk Flags</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-zinc-50 text-xs uppercase tracking-[0.12em] text-zinc-500">
                <th className="px-3 py-2 text-left">Borrower</th>
                <th className="px-3 py-2 text-left">Property</th>
                <th className="px-3 py-2 text-left">Flags</th>
                <th className="px-3 py-2 text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {(riskQuery.data?.flaggedLoans || []).slice(0, 20).map((row) => (
                <tr key={row.loanId} className="border-b border-black/10 last:border-0">
                  <td className="px-3 py-2">{row.borrower}</td>
                  <td className="px-3 py-2 text-zinc-600">{row.property || "-"}</td>
                  <td className="px-3 py-2 text-zinc-600">{row.flags.join(", ")}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/strongbox/loans/${row.loanId}`} className="text-[#C33732] hover:text-[#A52F2B]">Detail</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
