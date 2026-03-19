"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Filter,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";
import { managers as sampleManagers, sampleLoans, savedLoanViews, type LoanRecord } from "@/lib/mock/operations";

type StageFilter = "All" | "Pipeline" | "Active" | "Funded" | "Matured" | "Delinquent";
type SortKey = "lastActivity" | "principalDesc" | "maturitySoon" | "ltvDesc";
type PaymentFilter = "All" | "Current" | "Due Soon" | "Late" | "Grace";

type ApiLoan = {
  id: string;
  loanNumber: string;
  type: string;
  status: string;
  loanAmount: number;
  interestRate: number;
  ltv?: number | null;
  maturityDate?: string | null;
  nextPaymentDue?: string | null;
  daysDelinquent?: number;
  createdAt: string;
  updatedAt: string;
  borrower?: { firstName?: string; lastName?: string; companyName?: string };
  property?: { address?: string; city?: string; state?: string };
  loanOfficer?: { firstName?: string; lastName?: string };
};

type ApiLoanDetail = {
  loan: {
    id: string;
    loanNumber: string;
    type: string;
    status: string;
    loanAmount: number;
    interestRate: number;
    ltv?: number | null;
    maturityDate?: string | null;
    nextPaymentDue?: string | null;
    borrower?: { firstName?: string; lastName?: string; companyName?: string };
    property?: { address?: string; city?: string; state?: string; propertyType?: string };
    loanOfficer?: { firstName?: string; lastName?: string };
    updatedAt: string;
    internalNotes?: string | null;
    documents?: Array<{ createdAt: string; name?: string | null }>;
    payments?: Array<{ amount: number; dueDate: string; status: string }>;
    statusHistory?: Array<{ createdAt: string; toStatus: string; reason?: string | null }>;
    loanConditions?: Array<{ name: string; isCleared: boolean }>;
  };
};

const stageFilters: StageFilter[] = ["All", "Pipeline", "Active", "Funded", "Matured", "Delinquent"];
const paymentFilters: PaymentFilter[] = ["All", "Current", "Due Soon", "Late", "Grace"];

const defaultAdvancedFilters = {
  manager: "All",
  paymentStatus: "All" as PaymentFilter,
  minPrincipal: "",
  maxPrincipal: "",
  minLtv: "",
  maxLtv: "",
  loanType: "All",
};

export default function LoansPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StageFilter>("All");
  const [savedView, setSavedView] = useState(savedLoanViews[0]);
  const [sortBy, setSortBy] = useState<SortKey>("lastActivity");
  const [advancedFilters, setAdvancedFilters] = useState(defaultAdvancedFilters);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["loan-workspace-live", search, statusFilter, savedView, sortBy, advancedFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "300");
      params.set("sortBy", sortBy === "principalDesc" ? "loanAmount" : sortBy === "maturitySoon" ? "maturityDate" : "updatedAt");
      params.set("sortOrder", sortBy === "maturitySoon" ? "asc" : "desc");
      if (search.trim()) params.set("search", search.trim());

      const statusQuery = stageFilterToApiStatus(statusFilter);
      if (statusQuery) params.set("status", statusQuery);

      const response = await fetch(`/api/loans?${params.toString()}`);
      if (!response.ok) throw new Error("Unable to fetch loans");

      const payload = (await response.json()) as { loans: ApiLoan[] };
      const mapped = payload.loans?.map(mapApiLoanToWorkspaceRow) ?? [];
      return applyLocalFiltersAndViews(mapped, advancedFilters, savedView, sortBy);
    },
  });

  const selectedLoanDetail = useQuery({
    queryKey: ["loan-detail-preview", selectedLoanId],
    queryFn: async () => {
      if (!selectedLoanId) return null;
      const response = await fetch(`/api/loans/${selectedLoanId}`);
      if (!response.ok) throw new Error("Unable to fetch loan detail");
      return (await response.json()) as ApiLoanDetail;
    },
    enabled: Boolean(selectedLoanId),
  });

  const loans = data?.length ? data : sampleLoans;

  const selectedLoan = useMemo(() => {
    const local = loans.find((loan) => loan.id === selectedLoanId) ?? null;
    const detail = selectedLoanDetail.data?.loan;
    if (!local || !detail) return local;

    return {
      ...local,
      notes: detail.internalNotes || local.notes,
      docsPending: detail.documents ? detail.documents.length : local.docsPending,
      nextPaymentAmount: detail.payments?.find((p) => ["SCHEDULED", "PENDING"].includes(p.status))?.amount || local.nextPaymentAmount,
      timeline:
        detail.statusHistory?.slice(0, 5).map((event) => ({
          date: formatDate(event.createdAt),
          event: `Status: ${event.toStatus}`,
          by: event.reason || "Workflow",
        })) || local.timeline,
    } as LoanRecord;
  }, [loans, selectedLoanId, selectedLoanDetail.data]);

  const managers = useMemo(() => {
    const fromRows = Array.from(new Set(loans.map((loan) => loan.manager).filter(Boolean)));
    return fromRows.length ? fromRows : sampleManagers;
  }, [loans]);

  const summary = useMemo(() => {
    const principal = loans.reduce((sum, loan) => sum + loan.principal, 0);
    const lateCount = loans.filter((loan) => loan.paymentStatus === "Late").length;
    const avgLtv = loans.length ? loans.reduce((sum, loan) => sum + loan.ltv, 0) / loans.length : 0;
    return { total: loans.length, principal, lateCount, avgLtv };
  }, [loans]);

  const allSelected = Boolean(loans.length) && selectedIds.length === loans.length;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(loans.map((loan) => loan.id));
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("All");
    setSavedView(savedLoanViews[0]);
    setSortBy("lastActivity");
    setAdvancedFilters(defaultAdvancedFilters);
  }

  return (
    <div className="elevate-in space-y-4 pb-8">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#111b2b] to-[#0f1623] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-blue-300/90">Portfolio Workspace</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">Loans</h2>
            <p className="mt-1 text-sm text-zinc-400">Live record management with underwriting and servicing controls.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/[0.08]">
              <Sparkles className="h-3.5 w-3.5" />
              Smart View
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#1f5bd6] to-[#2f88ff] px-3 py-2 text-xs font-semibold text-white transition hover:from-[#2d68df] hover:to-[#4493ff]">
              <Plus className="h-3.5 w-3.5" />
              New Loan
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatPill label="Visible Loans" value={summary.total.toString()} />
        <StatPill label="Principal Balance" value={formatCurrency(summary.principal)} />
        <StatPill label="Delinquent Count" value={summary.lateCount.toString()} tone={summary.lateCount > 0 ? "danger" : "neutral"} />
        <StatPill label="Average LTV" value={formatPercent(summary.avgLtv)} />
      </section>

      <section className="rounded-xl border border-white/10 bg-[#101926]/95 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[280px] grow">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Loan ID, borrower, property, manager"
              className="h-10 w-full rounded-lg border border-white/10 bg-[#0e1523] pl-9 pr-3 text-sm text-zinc-100 outline-none transition focus:border-blue-400"
            />
          </div>

          <SelectControl label="Saved View" value={savedView} options={savedLoanViews} onChange={(value) => setSavedView(value)} />

          <SelectControl
            label="Sort"
            value={sortBy}
            options={[
              { label: "Last activity", value: "lastActivity" },
              { label: "Principal high to low", value: "principalDesc" },
              { label: "Maturity soonest", value: "maturitySoon" },
              { label: "LTV high to low", value: "ltvDesc" },
            ]}
            onChange={(value) => setSortBy(value as SortKey)}
          />

          <button
            type="button"
            onClick={() => setShowFilterDrawer(true)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#0e1523] px-3 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.08]"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {stageFilters.map((stage) => (
            <button
              key={stage}
              type="button"
              onClick={() => setStatusFilter(stage)}
              className={
                statusFilter === stage
                  ? "rounded-full border border-blue-300/40 bg-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-200"
                  : "rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:text-zinc-200"
              }
            >
              {stage}
            </button>
          ))}
        </div>
      </section>

      {selectedIds.length > 0 ? (
        <section className="flex items-center justify-between rounded-xl border border-blue-300/25 bg-blue-500/10 px-4 py-2.5 text-xs text-blue-100">
          <p>{selectedIds.length} selected</p>
          <div className="flex items-center gap-2">
            <button className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 transition hover:bg-white/10">Assign manager</button>
            <button className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 transition hover:bg-white/10">Request docs</button>
            <button className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 transition hover:bg-white/10">Move stage</button>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-white/10 bg-[#101926]/95">
        {isLoading ? (
          <LoansLoadingState />
        ) : isError ? (
          <div className="p-10 text-center">
            <CircleAlert className="mx-auto h-8 w-8 text-red-300" />
            <p className="mt-2 text-sm font-medium text-zinc-100">Unable to load loans</p>
            <button type="button" onClick={() => void refetch()} className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 transition hover:bg-white/[0.1]">Retry</button>
          </div>
        ) : !loans.length ? (
          <div className="p-10 text-center">
            <Filter className="mx-auto h-8 w-8 text-zinc-500" />
            <p className="mt-2 text-sm font-medium text-zinc-100">No results for this view</p>
            <button type="button" onClick={clearFilters} className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 transition hover:bg-white/[0.1]">Reset filters</button>
          </div>
        ) : (
          <div className="max-h-[680px] overflow-auto">
            <table className="min-w-[1320px] w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10 bg-[#0f1724]">
                <tr>
                  <HeaderCell className="w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="h-3.5 w-3.5" />
                  </HeaderCell>
                  <HeaderCell>Loan ID</HeaderCell>
                  <HeaderCell>Borrower</HeaderCell>
                  <HeaderCell>Property</HeaderCell>
                  <HeaderCell>Loan Type</HeaderCell>
                  <HeaderCell>Stage</HeaderCell>
                  <HeaderCell>Principal</HeaderCell>
                  <HeaderCell>Rate</HeaderCell>
                  <HeaderCell>LTV</HeaderCell>
                  <HeaderCell>Maturity</HeaderCell>
                  <HeaderCell>Payment</HeaderCell>
                  <HeaderCell>Last Activity</HeaderCell>
                  <HeaderCell>Manager</HeaderCell>
                  <HeaderCell className="w-20 text-right">Actions</HeaderCell>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => {
                  const selected = selectedIds.includes(loan.id);
                  return (
                    <tr key={loan.id} className={selected ? "bg-blue-500/10" : "bg-transparent transition-colors hover:bg-white/[0.04]"}>
                      <BodyCell>
                        <input type="checkbox" checked={selected} onChange={() => toggleSelectOne(loan.id)} className="h-3.5 w-3.5" />
                      </BodyCell>
                      <BodyCell>
                        <button type="button" onClick={() => setSelectedLoanId(loan.id)} className="font-semibold text-blue-200 transition hover:text-blue-100">{loan.loanId}</button>
                      </BodyCell>
                      <BodyCell>
                        <p className="text-zinc-100">{loan.borrower}</p>
                        <p className="text-xs text-zinc-500">{loan.borrowerEntity}</p>
                      </BodyCell>
                      <BodyCell>{loan.property}</BodyCell>
                      <BodyCell>
                        <p className="text-zinc-200">{loan.loanType}</p>
                        <p className="text-xs text-zinc-500">{loan.propertyType}</p>
                      </BodyCell>
                      <BodyCell><span className={stageClassName(loan.stage)}>{loan.stage}</span></BodyCell>
                      <BodyCell className="font-medium text-zinc-100">{formatCurrency(loan.principal)}</BodyCell>
                      <BodyCell>{formatPercent(loan.interestRate)}</BodyCell>
                      <BodyCell><span className={loan.ltv >= 72 ? "text-amber-200" : "text-zinc-200"}>{loan.ltv}%</span></BodyCell>
                      <BodyCell>{formatDate(loan.maturityDate)}</BodyCell>
                      <BodyCell><span className={paymentClassName(loan.paymentStatus)}>{loan.paymentStatus}</span></BodyCell>
                      <BodyCell>{loan.lastActivity}</BodyCell>
                      <BodyCell>{loan.manager}</BodyCell>
                      <BodyCell className="text-right">
                        <div className="relative inline-flex items-center gap-1">
                          <button type="button" onClick={() => setSelectedLoanId(loan.id)} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-zinc-200 transition hover:bg-white/[0.08]">Open</button>
                          <button type="button" onClick={() => setOpenMenuId((current) => (current === loan.id ? null : loan.id))} className="rounded-md border border-white/10 bg-white/[0.03] p-1 text-zinc-400 transition hover:bg-white/[0.08] hover:text-zinc-200"><MoreHorizontal className="h-3.5 w-3.5" /></button>
                          {openMenuId === loan.id ? (
                            <div className="absolute right-0 top-8 z-20 w-36 rounded-lg border border-white/10 bg-[#121d2e] p-1 text-left shadow-2xl">
                              <button className="block w-full rounded-md px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-white/[0.08]">Edit</button>
                              <button className="block w-full rounded-md px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-white/[0.08]">Request docs</button>
                              <button className="block w-full rounded-md px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-white/[0.08]">Change stage</button>
                            </div>
                          ) : null}
                        </div>
                      </BodyCell>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AdvancedFilterDrawer open={showFilterDrawer} filters={advancedFilters} setFilters={setAdvancedFilters} onClose={() => setShowFilterDrawer(false)} managers={managers} />
      {selectedLoan ? <LoanDetailDrawer loan={selectedLoan} loadingDetail={selectedLoanDetail.isFetching} onClose={() => setSelectedLoanId(null)} /> : null}
    </div>
  );
}

function LoansLoadingState() {
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2 text-xs text-zinc-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading loans workspace</div>
      <div className="space-y-2">{Array.from({ length: 10 }).map((_, index) => <div key={index} className="h-10 animate-pulse rounded bg-white/[0.04]" />)}</div>
    </div>
  );
}

function HeaderCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={`border-b border-white/10 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 ${className ?? ""}`}>{children}</th>;
}

function BodyCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-b border-white/10 px-3 py-2.5 text-xs text-zinc-400 ${className ?? ""}`}>{children}</td>;
}

function StatPill({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "danger" }) {
  return (
    <article className="rounded-xl border border-white/10 bg-[#101926]/95 p-3.5">
      <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-500">{label}</p>
      <p className={tone === "danger" ? "mt-2 text-xl font-semibold text-red-200" : "mt-2 text-xl font-semibold text-zinc-100"}>{value}</p>
    </article>
  );
}

function SelectControl({ label, value, options, onChange }: { label: string; value: string; options: Array<string | { label: string; value: string }>; onChange: (value: string) => void }) {
  return (
    <label className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/10 bg-[#0e1523] px-2.5 text-xs text-zinc-300">
      <span className="text-zinc-500">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-full bg-transparent pr-5 text-zinc-200 outline-none">
        {options.map((option) => {
          const normalized = typeof option === "string" ? { label: option, value: option } : option;
          return <option key={normalized.value} value={normalized.value}>{normalized.label}</option>;
        })}
      </select>
      <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
    </label>
  );
}

function AdvancedFilterDrawer({
  open,
  filters,
  setFilters,
  onClose,
  managers,
}: {
  open: boolean;
  filters: typeof defaultAdvancedFilters;
  setFilters: React.Dispatch<React.SetStateAction<typeof defaultAdvancedFilters>>;
  onClose: () => void;
  managers: string[];
}) {
  if (!open) return null;

  return (
    <>
      <button type="button" onClick={onClose} className="fixed inset-0 z-30 bg-black/50" aria-label="Close filters" />
      <aside className="fixed right-0 top-0 z-40 h-screen w-full max-w-md border-l border-white/10 bg-[#101926] p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">Advanced Filters</h3>
          <button type="button" onClick={onClose} className="rounded-md border border-white/10 p-1.5 text-zinc-400 transition hover:bg-white/[0.08] hover:text-zinc-200"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-4 space-y-4 text-sm">
          <FilterField label="Manager">
            <select value={filters.manager} onChange={(event) => setFilters((current) => ({ ...current, manager: event.target.value }))} className="h-10 w-full rounded-lg border border-white/10 bg-[#0f1724] px-3 text-zinc-200 outline-none">
              <option value="All">All</option>
              {managers.map((manager) => <option key={manager} value={manager}>{manager}</option>)}
            </select>
          </FilterField>

          <FilterField label="Payment Status">
            <select value={filters.paymentStatus} onChange={(event) => setFilters((current) => ({ ...current, paymentStatus: event.target.value as PaymentFilter }))} className="h-10 w-full rounded-lg border border-white/10 bg-[#0f1724] px-3 text-zinc-200 outline-none">
              {paymentFilters.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </FilterField>

          <div className="grid grid-cols-2 gap-2">
            <FilterField label="Min Principal"><input value={filters.minPrincipal} onChange={(event) => setFilters((current) => ({ ...current, minPrincipal: event.target.value }))} placeholder="0" className="h-10 w-full rounded-lg border border-white/10 bg-[#0f1724] px-3 text-zinc-200 outline-none" /></FilterField>
            <FilterField label="Max Principal"><input value={filters.maxPrincipal} onChange={(event) => setFilters((current) => ({ ...current, maxPrincipal: event.target.value }))} placeholder="10000000" className="h-10 w-full rounded-lg border border-white/10 bg-[#0f1724] px-3 text-zinc-200 outline-none" /></FilterField>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <FilterField label="Min LTV"><input value={filters.minLtv} onChange={(event) => setFilters((current) => ({ ...current, minLtv: event.target.value }))} placeholder="0" className="h-10 w-full rounded-lg border border-white/10 bg-[#0f1724] px-3 text-zinc-200 outline-none" /></FilterField>
            <FilterField label="Max LTV"><input value={filters.maxLtv} onChange={(event) => setFilters((current) => ({ ...current, maxLtv: event.target.value }))} placeholder="100" className="h-10 w-full rounded-lg border border-white/10 bg-[#0f1724] px-3 text-zinc-200 outline-none" /></FilterField>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2">
          <button type="button" onClick={() => setFilters(defaultAdvancedFilters)} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 transition hover:bg-white/[0.1]">Reset</button>
          <button type="button" onClick={onClose} className="rounded-lg bg-[#2f88ff] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#4a98ff]">Apply filters</button>
        </div>
      </aside>
    </>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</span>{children}</label>;
}

function LoanDetailDrawer({ loan, loadingDetail, onClose }: { loan: LoanRecord; loadingDetail: boolean; onClose: () => void }) {
  return (
    <>
      <button type="button" onClick={onClose} className="fixed inset-0 z-30 bg-black/40" aria-label="Close loan details" />
      <aside className="fixed right-0 top-0 z-40 h-screen w-full max-w-xl overflow-y-auto border-l border-white/10 bg-[#101926] p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-blue-300">Loan Preview</p>
            <h3 className="mt-1 text-xl font-semibold text-white">{loan.loanId}</h3>
            <p className="text-sm text-zinc-400">{loan.borrower}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-white/10 p-1.5 text-zinc-400 transition hover:bg-white/[0.08] hover:text-zinc-200"><X className="h-4 w-4" /></button>
        </div>

        {loadingDetail ? <p className="mt-4 text-xs text-zinc-500">Loading live detail...</p> : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <PreviewPill label="Principal" value={formatCurrency(loan.principal)} />
          <PreviewPill label="Interest" value={formatPercent(loan.interestRate)} />
          <PreviewPill label="LTV" value={`${loan.ltv}%`} />
          <PreviewPill label="Maturity" value={formatDate(loan.maturityDate)} />
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <h4 className="text-sm font-semibold text-zinc-100">Borrower and Property</h4>
          <p className="mt-2 text-sm text-zinc-300">{loan.borrowerEntity}</p>
          <p className="mt-1 text-xs text-zinc-500">{loan.property}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span className={stageClassName(loan.stage)}>{loan.stage}</span>
            <span className={paymentClassName(loan.paymentStatus)}>{loan.paymentStatus}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5">Risk {loan.riskGrade}</span>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <h4 className="text-sm font-semibold text-zinc-100">Timeline</h4>
          <div className="mt-3 space-y-2.5">
            {loan.timeline.map((event) => (
              <div key={`${loan.id}-${event.date}-${event.event}`} className="flex items-start gap-2 text-xs">
                <div className="mt-1 h-2 w-2 rounded-full bg-blue-400" />
                <div>
                  <p className="text-zinc-200">{event.event}</p>
                  <p className="text-zinc-500">{event.date} · {event.by}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <h4 className="text-sm font-semibold text-zinc-100">Docs and Payment Summary</h4>
          <div className="mt-2 space-y-1.5 text-xs text-zinc-400">
            <p className="flex items-center justify-between"><span>Pending documents</span><span>{loan.docsPending}</span></p>
            <p className="flex items-center justify-between"><span>Next payment</span><span>{formatCurrency(loan.nextPaymentAmount)}</span></p>
            <p className="flex items-center justify-between"><span>Manager</span><span>{loan.manager}</span></p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <h4 className="text-sm font-semibold text-zinc-100">Internal Notes</h4>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">{loan.notes}</p>
        </div>

        <div className="mt-6 flex items-center gap-2">
          <button className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 transition hover:bg-white/[0.1]">Open full profile</button>
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-[#2f88ff] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#4a98ff]">Next action <ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </aside>
    </>
  );
}

function PreviewPill({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5"><p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">{label}</p><p className="mt-1 text-sm font-semibold text-zinc-100">{value}</p></div>;
}

function stageFilterToApiStatus(filter: StageFilter) {
  if (filter === "Pipeline") return "LEAD,APPLICATION,PROCESSING,UNDERWRITING,CONDITIONAL_APPROVAL,APPROVED,CLOSING";
  if (filter === "Active") return "ACTIVE,EXTENDED";
  if (filter === "Funded") return "FUNDED";
  if (filter === "Matured") return "PAYOFF_REQUESTED,PAID_OFF";
  if (filter === "Delinquent") return "DEFAULT,FORECLOSURE,REO";
  return "";
}

function mapApiLoanToWorkspaceRow(loan: ApiLoan): LoanRecord {
  const borrower = `${loan.borrower?.firstName || ""} ${loan.borrower?.lastName || ""}`.trim() || "Unknown Borrower";
  const property = loan.property?.address ? `${loan.property.address}, ${loan.property.city || ""} ${loan.property.state || ""}`.trim() : "Property pending";
  const manager = loan.loanOfficer ? `${loan.loanOfficer.firstName || ""} ${loan.loanOfficer.lastName || ""}`.trim() : "Unassigned";

  const maturityDate = loan.maturityDate || new Date(Date.now() + 180 * 86400000).toISOString();
  const paymentStatus: PaymentFilter =
    (loan.daysDelinquent || 0) > 0 || ["DEFAULT", "FORECLOSURE", "REO"].includes(loan.status)
      ? "Late"
      : loan.nextPaymentDue
        ? "Due Soon"
        : "Current";

  return {
    id: loan.id,
    loanId: loan.loanNumber,
    borrower,
    borrowerEntity: loan.borrower?.companyName || borrower,
    property,
    propertyType: "SFR",
    loanType: mapLoanType(loan.type),
    stage: mapLoanStage(loan.status),
    principal: Number(loan.loanAmount || 0),
    interestRate: Number(loan.interestRate || 0),
    ltv: Number(loan.ltv ?? 65),
    maturityDate,
    paymentStatus,
    lastActivity: `Updated ${formatDate(loan.updatedAt)}`,
    manager,
    riskGrade: Number(loan.ltv ?? 65) > 72 ? "C" : "B",
    docsPending: 0,
    nextPaymentAmount: Number(loan.loanAmount || 0) * (Number(loan.interestRate || 10) / 100 / 12),
    timeline: [{ date: formatDate(loan.createdAt), event: "Loan created", by: "System" }],
    notes: "Live loan data connected to StrongBox API.",
  };
}

function applyLocalFiltersAndViews(loans: LoanRecord[], filters: typeof defaultAdvancedFilters, view: string, sortBy: SortKey) {
  let working = loans.filter((loan) => {
    const managerOk = filters.manager === "All" || loan.manager === filters.manager;
    const paymentOk = filters.paymentStatus === "All" || loan.paymentStatus === filters.paymentStatus;

    const minPrincipal = filters.minPrincipal ? Number(filters.minPrincipal) : undefined;
    const maxPrincipal = filters.maxPrincipal ? Number(filters.maxPrincipal) : undefined;
    const minLtv = filters.minLtv ? Number(filters.minLtv) : undefined;
    const maxLtv = filters.maxLtv ? Number(filters.maxLtv) : undefined;

    const principalOk = (minPrincipal === undefined || loan.principal >= minPrincipal) && (maxPrincipal === undefined || loan.principal <= maxPrincipal);
    const ltvOk = (minLtv === undefined || loan.ltv >= minLtv) && (maxLtv === undefined || loan.ltv <= maxLtv);

    return managerOk && paymentOk && principalOk && ltvOk;
  });

  const now = new Date();
  if (view === "Today: Priority Follow-up") working = working.filter((loan) => loan.paymentStatus === "Due Soon" || loan.docsPending > 0 || loan.stage === "Underwriting");
  if (view === "Delinquency Watchlist") working = working.filter((loan) => loan.paymentStatus === "Late" || loan.stage === "Delinquent");
  if (view === "Funding This Week") working = working.filter((loan) => loan.stage === "Approved" || loan.stage === "Funded");
  if (view === "Maturing in 60 Days") {
    working = working.filter((loan) => {
      const maturity = new Date(loan.maturityDate).getTime();
      const days = (maturity - now.getTime()) / 86400000;
      return days >= 0 && days <= 60;
    });
  }
  if (view === "High LTV (>= 72%)") working = working.filter((loan) => loan.ltv >= 72);

  working.sort((a, b) => {
    if (sortBy === "principalDesc") return b.principal - a.principal;
    if (sortBy === "maturitySoon") return new Date(a.maturityDate).getTime() - new Date(b.maturityDate).getTime();
    if (sortBy === "ltvDesc") return b.ltv - a.ltv;
    return new Date(b.maturityDate).getTime() - new Date(a.maturityDate).getTime();
  });

  return working;
}

function mapLoanType(type: string): LoanRecord["loanType"] {
  if (["BRIDGE_FUNDING", "COMMERCIAL_BRIDGE", "MULTIFAMILY_BRIDGE"].includes(type)) return "Bridge";
  if (["FIX_AND_FLIP", "PURCHASE_PLUS_REHAB", "REHAB_ONLY"].includes(type)) return "Construction";
  if (["BRRRR"].includes(type)) return "Rental Portfolio";
  return "DSCR";
}

function mapLoanStage(status: string): LoanRecord["stage"] {
  if (["LEAD", "APPLICATION"].includes(status)) return "Application";
  if (["PROCESSING", "UNDERWRITING"].includes(status)) return "Underwriting";
  if (["CONDITIONAL_APPROVAL"].includes(status)) return "Conditional";
  if (["APPROVED", "CLOSING"].includes(status)) return "Approved";
  if (["FUNDED"].includes(status)) return "Funded";
  if (["ACTIVE", "EXTENDED"].includes(status)) return "Active";
  if (["PAYOFF_REQUESTED", "PAID_OFF"].includes(status)) return "Matured";
  if (["DEFAULT", "FORECLOSURE", "REO"].includes(status)) return "Delinquent";
  return "Lead";
}

function stageClassName(stage: LoanRecord["stage"]) {
  if (stage === "Delinquent") return "rounded-full border border-red-300/30 bg-red-500/15 px-2 py-0.5 text-[11px] text-red-200";
  if (stage === "Funded" || stage === "Active") return "rounded-full border border-emerald-300/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-200";
  if (stage === "Matured") return "rounded-full border border-zinc-300/20 bg-zinc-500/15 px-2 py-0.5 text-[11px] text-zinc-300";
  return "rounded-full border border-blue-300/30 bg-blue-500/15 px-2 py-0.5 text-[11px] text-blue-200";
}

function paymentClassName(paymentStatus: LoanRecord["paymentStatus"]) {
  if (paymentStatus === "Late") return "rounded-full border border-red-300/30 bg-red-500/15 px-2 py-0.5 text-[11px] text-red-200";
  if (paymentStatus === "Due Soon" || paymentStatus === "Grace") return "rounded-full border border-amber-300/30 bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-200";
  return "rounded-full border border-emerald-300/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-200";
}
