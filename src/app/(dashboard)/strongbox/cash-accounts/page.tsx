"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock4, Landmark, Search, Wallet } from "lucide-react";
import { formatCurrencyCompact } from "@/lib/utils/currency";

type CashAccount = {
  id: string;
  account_name: string;
  current_balance: number | string;
  updated_on: string;
  notes: string | null;
};

type CashAccountsResponse = {
  accounts: CashAccount[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  sort: string;
  summary: {
    totalBalance: number;
    accountCount: number;
    staleCount: number;
    recentCount: number;
    positiveCount: number;
    nonPositiveCount: number;
    latestUpdatedOn: string | null;
  };
};

function buildQuery(params: Record<string, string | number>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => searchParams.set(key, String(value)));
  return searchParams.toString();
}

function formatUpdatedLabel(value: string) {
  const updatedAt = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - updatedAt.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (!Number.isFinite(diffDays) || diffDays < 0) return "Updated today";
  if (diffDays === 0) return "Updated today";
  if (diffDays === 1) return "Updated 1 day ago";
  return `Updated ${diffDays} days ago`;
}

export default function StrongboxCashAccountsPage() {
  const [search, setSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("all");
  const [freshness, setFreshness] = useState("all");
  const [sort, setSort] = useState("updated_desc");
  const [page, setPage] = useState(1);
  const [freshnessThreshold] = useState(() => Date.now() - 7 * 24 * 60 * 60 * 1000);

  const query = useQuery<CashAccountsResponse>({
    queryKey: ["strongbox-cash-accounts", search, balanceFilter, freshness, sort, page],
    queryFn: async () => {
      const res = await fetch(`/api/strongbox/cash-accounts?${buildQuery({ search, balance: balanceFilter, freshness, sort, page, limit: 20 })}`);
      if (!res.ok) throw new Error("Failed to load cash accounts");
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-black/10 bg-[radial-gradient(circle_at_top_left,_rgba(195,55,50,0.12),_transparent_34%),linear-gradient(180deg,#ffffff_0%,#fbf7f3_100%)] p-6 shadow-[0_28px_60px_-44px_rgba(15,23,42,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#C33732]">StrongBox Cash</p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Cash account balances</h1>
            <p className="max-w-3xl text-sm leading-6 text-zinc-600">
              Operational list of imported cash balances with freshness controls for treasury review and snapshot validation.
            </p>
          </div>
          <div className="grid min-w-[280px] flex-1 grid-cols-2 gap-3 xl:max-w-[480px]">
            <article className="rounded-2xl border border-black/8 bg-white/90 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500"><Wallet className="h-4 w-4 text-[#C33732]" /> Total balance</div>
              <p className="mt-3 text-3xl font-semibold text-zinc-950">{formatCurrencyCompact(query.data?.summary.totalBalance || 0)}</p>
            </article>
            <article className="rounded-2xl border border-black/8 bg-white/90 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500"><Landmark className="h-4 w-4 text-[#C33732]" /> Accounts in scope</div>
              <p className="mt-3 text-3xl font-semibold text-zinc-950">{query.data?.summary.accountCount || 0}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[22px] border border-black/10 bg-white p-4 shadow-[0_20px_30px_-28px_rgba(15,23,42,0.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Recent Updates</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">{query.data?.summary.recentCount || 0}</p>
          <p className="mt-1 text-sm text-zinc-500">Updated in the last 7 days</p>
        </article>
        <article className="rounded-[22px] border border-black/10 bg-white p-4 shadow-[0_20px_30px_-28px_rgba(15,23,42,0.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Stale Accounts</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">{query.data?.summary.staleCount || 0}</p>
          <p className="mt-1 text-sm text-zinc-500">Need refreshed balance input</p>
        </article>
        <article className="rounded-[22px] border border-black/10 bg-white p-4 shadow-[0_20px_30px_-28px_rgba(15,23,42,0.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Positive Balance</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">{query.data?.summary.positiveCount || 0}</p>
          <p className="mt-1 text-sm text-zinc-500">Treasury-ready accounts</p>
        </article>
        <article className="rounded-[22px] border border-black/10 bg-white p-4 shadow-[0_20px_30px_-28px_rgba(15,23,42,0.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Latest Refresh</p>
          <p className="mt-2 text-lg font-semibold text-zinc-950">{query.data?.summary.latestUpdatedOn ? new Date(query.data.summary.latestUpdatedOn).toLocaleDateString() : "No data"}</p>
          <p className="mt-1 text-sm text-zinc-500">Most recent account update</p>
        </article>
      </section>

      <section className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_24px_40px_-36px_rgba(15,23,42,0.45)]">
        <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          <label className="flex items-center gap-3 rounded-2xl border border-black/10 bg-[#faf8f5] px-4 py-3">
            <Search className="h-4 w-4 text-zinc-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search account name"
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
          <select
            value={balanceFilter}
            onChange={(event) => {
              setBalanceFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-black/10 bg-[#faf8f5] px-4 py-3 text-sm outline-none"
          >
            <option value="all">All balances</option>
            <option value="positive">Positive only</option>
            <option value="nonpositive">Zero / negative</option>
          </select>
          <select
            value={freshness}
            onChange={(event) => {
              setFreshness(event.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-black/10 bg-[#faf8f5] px-4 py-3 text-sm outline-none"
          >
            <option value="all">All freshness</option>
            <option value="recent">Updated in 7 days</option>
            <option value="stale">Stale over 7 days</option>
          </select>
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-black/10 bg-[#faf8f5] px-4 py-3 text-sm outline-none"
          >
            <option value="updated_desc">Newest updated</option>
            <option value="updated_asc">Oldest updated</option>
            <option value="balance_desc">Highest balance</option>
            <option value="balance_asc">Lowest balance</option>
            <option value="name_asc">Account name A-Z</option>
            <option value="name_desc">Account name Z-A</option>
          </select>
        </div>
      </section>

      <section className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_24px_40px_-36px_rgba(15,23,42,0.45)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Treasury Ledger</p>
            <h2 className="mt-1 text-2xl font-semibold text-zinc-950">Account balances</h2>
          </div>
          <p className="text-sm text-zinc-500">{query.data?.total || 0} accounts</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-[#faf8f5] text-left text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                <th className="px-3 py-3">Account</th>
                <th className="px-3 py-3">Balance</th>
                <th className="px-3 py-3">Updated</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {(query.data?.accounts || []).map((account) => (
                <tr key={account.id} className="border-b border-black/6 last:border-0">
                  <td className="px-3 py-3">
                    <div>
                      <p className="font-medium text-zinc-950">{account.account_name}</p>
                      <p className="mt-1 text-xs text-zinc-500">{account.id.slice(0, 8)}</p>
                    </div>
                  </td>
                  <td className="px-3 py-3 font-medium text-zinc-950">{formatCurrencyCompact(Number(account.current_balance || 0))}</td>
                  <td className="px-3 py-3 text-zinc-600">
                    <div>
                      <p>{new Date(account.updated_on).toLocaleDateString()}</p>
                      <p className="mt-1 text-xs text-zinc-500">{formatUpdatedLabel(account.updated_on)}</p>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${new Date(account.updated_on).getTime() >= freshnessThreshold ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                      <Clock4 className="mr-1 h-3.5 w-3.5" />
                      {new Date(account.updated_on).getTime() >= freshnessThreshold ? "Fresh" : "Stale"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-zinc-600">{account.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!query.isLoading && (query.data?.accounts || []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-[#faf8f5] px-4 py-8 text-center text-sm text-zinc-500">
            No cash accounts matched the current filters.
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