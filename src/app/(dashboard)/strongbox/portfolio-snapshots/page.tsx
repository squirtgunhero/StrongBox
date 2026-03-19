"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, ChartColumn, Clock4, Landmark, Wallet } from "lucide-react";
import { formatCurrencyCompact } from "@/lib/utils/currency";

type Snapshot = {
  id: string;
  snapshot_date: string;
  total_loans_out: number | string | null;
  total_company_cash: number | string | null;
  total_draw_reserve: number | string | null;
  loc_business_balance: number | string | null;
  current_cash_balance: number | string | null;
};

type SnapshotResponse = {
  snapshots: Snapshot[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  sort: string;
  summary: {
    latestSnapshotDate: string | null;
    earliestSnapshotDate: string | null;
    latestLoansOut: number;
    latestCompanyCash: number;
    latestDrawReserve: number;
    latestLocBalance: number;
    latestCurrentCash: number;
  };
};

function buildQuery(params: Record<string, string | number>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (String(value).trim() !== "") searchParams.set(key, String(value));
  });
  return searchParams.toString();
}

export default function StrongboxPortfolioSnapshotsPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState("date_desc");
  const [page, setPage] = useState(1);

  const query = useQuery<SnapshotResponse>({
    queryKey: ["strongbox-portfolio-snapshots", fromDate, toDate, sort, page],
    queryFn: async () => {
      const res = await fetch(`/api/strongbox/portfolio-snapshots?${buildQuery({ fromDate, toDate, sort, page, limit: 18 })}`);
      if (!res.ok) throw new Error("Failed to load portfolio snapshots");
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-black/10 bg-[radial-gradient(circle_at_top_left,_rgba(195,55,50,0.12),_transparent_34%),linear-gradient(180deg,#ffffff_0%,#fbf7f3_100%)] p-6 shadow-[0_28px_60px_-44px_rgba(15,23,42,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#C33732]">StrongBox Snapshots</p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Portfolio history</h1>
            <p className="max-w-3xl text-sm leading-6 text-zinc-600">
              Historical portfolio snapshots for loans out, company cash, draw reserve, LOC usage, and current cash.
            </p>
          </div>
          <div className="grid min-w-[280px] flex-1 grid-cols-2 gap-3 xl:max-w-[520px]">
            <article className="rounded-2xl border border-black/8 bg-white/90 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500"><ChartColumn className="h-4 w-4 text-[#C33732]" /> Loans out</div>
              <p className="mt-3 text-3xl font-semibold text-zinc-950">{formatCurrencyCompact(query.data?.summary.latestLoansOut || 0)}</p>
            </article>
            <article className="rounded-2xl border border-black/8 bg-white/90 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500"><Camera className="h-4 w-4 text-[#C33732]" /> Latest cash</div>
              <p className="mt-3 text-3xl font-semibold text-zinc-950">{formatCurrencyCompact(query.data?.summary.latestCurrentCash || 0)}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[22px] border border-black/10 bg-white p-4 shadow-[0_20px_30px_-28px_rgba(15,23,42,0.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Company Cash</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">{formatCurrencyCompact(query.data?.summary.latestCompanyCash || 0)}</p>
          <p className="mt-1 text-sm text-zinc-500">Latest imported checkpoint</p>
        </article>
        <article className="rounded-[22px] border border-black/10 bg-white p-4 shadow-[0_20px_30px_-28px_rgba(15,23,42,0.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Draw Reserve</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">{formatCurrencyCompact(query.data?.summary.latestDrawReserve || 0)}</p>
          <p className="mt-1 text-sm text-zinc-500">Reserve held across live portfolio</p>
        </article>
        <article className="rounded-[22px] border border-black/10 bg-white p-4 shadow-[0_20px_30px_-28px_rgba(15,23,42,0.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">LOC Balance</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">{formatCurrencyCompact(query.data?.summary.latestLocBalance || 0)}</p>
          <p className="mt-1 text-sm text-zinc-500">Current business line usage</p>
        </article>
        <article className="rounded-[22px] border border-black/10 bg-white p-4 shadow-[0_20px_30px_-28px_rgba(15,23,42,0.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Date Range</p>
          <p className="mt-2 text-lg font-semibold text-zinc-950">{query.data?.summary.earliestSnapshotDate ? new Date(query.data.summary.earliestSnapshotDate).toLocaleDateString() : "-"}</p>
          <p className="mt-1 text-sm text-zinc-500">through {query.data?.summary.latestSnapshotDate ? new Date(query.data.summary.latestSnapshotDate).toLocaleDateString() : "-"}</p>
        </article>
      </section>

      <section className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_24px_40px_-36px_rgba(15,23,42,0.45)]">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1); }} className="rounded-2xl border border-black/10 bg-[#faf8f5] px-4 py-3 text-sm outline-none" />
          <input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(1); }} className="rounded-2xl border border-black/10 bg-[#faf8f5] px-4 py-3 text-sm outline-none" />
          <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} className="rounded-2xl border border-black/10 bg-[#faf8f5] px-4 py-3 text-sm outline-none">
            <option value="date_desc">Newest snapshot</option>
            <option value="date_asc">Oldest snapshot</option>
            <option value="loans_out_desc">Highest loans out</option>
            <option value="company_cash_desc">Highest company cash</option>
            <option value="current_cash_desc">Highest current cash</option>
          </select>
          <div className="rounded-2xl border border-black/10 bg-[#faf8f5] px-4 py-3 text-sm text-zinc-600">{query.data?.summary.latestSnapshotDate ? new Date(query.data.summary.latestSnapshotDate).toLocaleDateString() : "No snapshots"}</div>
          <div className="rounded-2xl border border-black/10 bg-[#faf8f5] px-4 py-3 text-sm text-zinc-600">{query.data?.total || 0} snapshots</div>
        </div>
      </section>

      <section className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_24px_40px_-36px_rgba(15,23,42,0.45)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Historical Ledger</p>
            <h2 className="mt-1 text-2xl font-semibold text-zinc-950">Snapshot timeline</h2>
          </div>
          <p className="flex items-center gap-2 text-sm text-zinc-500"><Clock4 className="h-4 w-4" /> Browse imported portfolio checkpoints</p>
        </div>
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-black/8 bg-[#faf8f5] px-4 py-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500"><Landmark className="h-4 w-4 text-[#C33732]" /> Company cash</div>
            <p className="mt-2 text-lg font-semibold text-zinc-950">{formatCurrencyCompact(query.data?.summary.latestCompanyCash || 0)}</p>
          </div>
          <div className="rounded-2xl border border-black/8 bg-[#faf8f5] px-4 py-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500"><ChartColumn className="h-4 w-4 text-[#C33732]" /> Draw reserve</div>
            <p className="mt-2 text-lg font-semibold text-zinc-950">{formatCurrencyCompact(query.data?.summary.latestDrawReserve || 0)}</p>
          </div>
          <div className="rounded-2xl border border-black/8 bg-[#faf8f5] px-4 py-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500"><Wallet className="h-4 w-4 text-[#C33732]" /> Current cash</div>
            <p className="mt-2 text-lg font-semibold text-zinc-950">{formatCurrencyCompact(query.data?.summary.latestCurrentCash || 0)}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-[#faf8f5] text-left text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                <th className="px-3 py-3">Snapshot Date</th>
                <th className="px-3 py-3">Loans Out</th>
                <th className="px-3 py-3">Company Cash</th>
                <th className="px-3 py-3">Draw Reserve</th>
                <th className="px-3 py-3">LOC Balance</th>
                <th className="px-3 py-3">Current Cash</th>
              </tr>
            </thead>
            <tbody>
              {(query.data?.snapshots || []).map((snapshot) => (
                <tr key={snapshot.id} className="border-b border-black/6 last:border-0">
                  <td className="px-3 py-3">
                    <div>
                      <p className="font-medium text-zinc-950">{new Date(snapshot.snapshot_date).toLocaleDateString()}</p>
                      <p className="mt-1 text-xs text-zinc-500">Snapshot checkpoint</p>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-zinc-600">{formatCurrencyCompact(Number(snapshot.total_loans_out || 0))}</td>
                  <td className="px-3 py-3 text-zinc-600">{formatCurrencyCompact(Number(snapshot.total_company_cash || 0))}</td>
                  <td className="px-3 py-3 text-zinc-600">{formatCurrencyCompact(Number(snapshot.total_draw_reserve || 0))}</td>
                  <td className="px-3 py-3 text-zinc-600">{formatCurrencyCompact(Number(snapshot.loc_business_balance || 0))}</td>
                  <td className="px-3 py-3 font-medium text-zinc-950">{formatCurrencyCompact(Number(snapshot.current_cash_balance || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!query.isLoading && (query.data?.snapshots || []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-[#faf8f5] px-4 py-8 text-center text-sm text-zinc-500">
            No portfolio snapshots matched the selected date range.
          </div>
        ) : null}
        {(query.data?.totalPages || 1) > 1 ? (
          <div className="mt-4 flex items-center justify-between border-t border-black/8 pt-4 text-sm text-zinc-600">
            <p>Page {query.data?.page || 1} of {query.data?.totalPages || 1}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="rounded-xl border border-black/10 px-3 py-2 disabled:opacity-40">Previous</button>
              <button type="button" onClick={() => setPage((current) => Math.min(query.data?.totalPages || 1, current + 1))} disabled={page >= (query.data?.totalPages || 1)} className="rounded-xl border border-black/10 px-3 py-2 disabled:opacity-40">Next</button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}