"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  ChartNoAxesCombined,
  CircleAlert,
  Flag,
  MapPinned,
  ShieldCheck,
  TableProperties,
} from "lucide-react";
import {
  StrongboxClosedProjectsByYearRow,
  StrongboxExposureByMarketRow,
  StrongboxExposureByStateRow,
  StrongboxLoanTypeSummaryRow,
  StrongboxReportActiveExposureRow,
  StrongboxTax1098PrepRow,
  StrongboxUpcomingLoanRow,
} from "@/types";
import { formatCurrencyCompact } from "@/lib/utils/currency";

type ReportResponse<T> = {
  view: string;
  rowCount: number;
  pageRowCount: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  filters: Record<string, string | null>;
  summary: Record<string, unknown> | null;
  availableFilters: {
    states: string[];
    markets: string[];
    loanTypes: string[];
  } | null;
  data: T[];
};

type ReportsPayload = {
  activeExposure: ReportResponse<StrongboxReportActiveExposureRow>;
  exposureByState: ReportResponse<StrongboxExposureByStateRow>;
  exposureByMarket: ReportResponse<StrongboxExposureByMarketRow>;
  loanTypeSummary: ReportResponse<StrongboxLoanTypeSummaryRow>;
  upcomingLoans: ReportResponse<StrongboxUpcomingLoanRow>;
  closedProjectsByYear: ReportResponse<StrongboxClosedProjectsByYearRow>;
  taxPrepReview: ReportResponse<StrongboxTax1098PrepRow>;
};

const VIEW_MAP = {
  activeExposure: "report_active_exposure",
  exposureByState: "report_exposure_by_state",
  exposureByMarket: "report_exposure_by_market",
  loanTypeSummary: "report_loan_type_summary",
  upcomingLoans: "report_upcoming_loans",
  closedProjectsByYear: "report_closed_projects_by_year",
  taxPrepReview: "report_1098_prep",
} as const;

function asNumber(value: string | number | null | undefined) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPercent(value: string | number | null | undefined) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return `${(numeric * 100).toFixed(1)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function riskBadges(row: StrongboxReportActiveExposureRow) {
  const badges: string[] = [];
  if (asNumber(row.ltv) > 0.75) badges.push("High LTV");
  if (row.days_to_maturity != null && row.days_to_maturity <= 30) badges.push("Matures <30d");
  if (!row.market_name || row.market_name === "Unmapped") badges.push("Unmapped");
  return badges;
}

function buildQuery(params: Record<string, string | number | null | undefined>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && String(value).trim() !== "") {
      searchParams.set(key, String(value));
    }
  });
  return searchParams.toString();
}

function Pager({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between border-t border-black/8 pt-4 text-sm text-zinc-600">
      <p>Page {page} of {totalPages}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="rounded-xl border border-black/10 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="rounded-xl border border-black/10 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function StrongboxReportsPage() {
  const [borrower, setBorrower] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [marketFilter, setMarketFilter] = useState("all");
  const [loanTypeFilter, setLoanTypeFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [activePage, setActivePage] = useState(1);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [taxPage, setTaxPage] = useState(1);

  const resetPages = () => {
    setActivePage(1);
    setUpcomingPage(1);
    setTaxPage(1);
  };

  const sharedFilters = {
    state: stateFilter === "all" ? null : stateFilter,
    market: marketFilter === "all" ? null : marketFilter,
    loanType: loanTypeFilter === "all" ? null : loanTypeFilter,
    borrower: borrower || null,
    fromDate: fromDate || null,
    toDate: toDate || null,
  };

  const reportsQuery = useQuery<ReportsPayload>({
    queryKey: ["strongbox-reports", sharedFilters, activePage, upcomingPage, taxPage],
    queryFn: async () => {
      const entries = await Promise.all(
        Object.entries(VIEW_MAP).map(async ([key, view]) => {
          const limit = key === "activeExposure" ? 16 : key === "upcomingLoans" ? 10 : key === "taxPrepReview" ? 10 : 50;
          const page = key === "activeExposure" ? activePage : key === "upcomingLoans" ? upcomingPage : key === "taxPrepReview" ? taxPage : 1;
          const query = buildQuery({ view, page, limit, ...sharedFilters });
          const res = await fetch(`/api/strongbox/reports?${query}`);
          if (!res.ok) throw new Error(`Failed to load ${view}`);
          return [key, (await res.json()) as ReportResponse<unknown>] as const;
        })
      );

      return Object.fromEntries(entries) as ReportsPayload;
    },
  });

  const activeExposure = reportsQuery.data?.activeExposure;
  const exposureByState = reportsQuery.data?.exposureByState;
  const exposureByMarket = reportsQuery.data?.exposureByMarket;
  const loanTypeSummary = reportsQuery.data?.loanTypeSummary;
  const upcomingLoans = reportsQuery.data?.upcomingLoans;
  const closedProjects = reportsQuery.data?.closedProjectsByYear;
  const taxPrepReview = reportsQuery.data?.taxPrepReview;

  const stateOptions = activeExposure?.availableFilters?.states || [];
  const marketOptions = activeExposure?.availableFilters?.markets || [];
  const loanTypeOptions = activeExposure?.availableFilters?.loanTypes || [];
  const maxClosedProjects = Math.max(...((closedProjects?.data || []).map((row) => row.count)), 1);

  const totalExposure = asNumber(activeExposure?.summary?.total_exposure as string | number | null | undefined);
  const flaggedExposure = asNumber(activeExposure?.summary?.flagged_count as string | number | null | undefined);
  const upcomingFunding = asNumber(upcomingLoans?.summary?.cash_needed_total as string | number | null | undefined);
  const taxFlags = asNumber(taxPrepReview?.summary?.flagged_count as string | number | null | undefined);
  const stateCount = asNumber(activeExposure?.summary?.state_count as string | number | null | undefined);
  const marketCount = asNumber(activeExposure?.summary?.market_count as string | number | null | undefined);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[30px] border border-black/10 bg-[radial-gradient(circle_at_top_left,_rgba(195,55,50,0.12),_transparent_32%),linear-gradient(135deg,#0f172a_0%,#1f2937_38%,#faf7f2_38%,#faf7f2_100%)] p-6 shadow-[0_28px_70px_-40px_rgba(15,23,42,0.45)]">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl space-y-3 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#F7B6B3]">StrongBox Reporting</p>
            <h1 className="text-3xl font-semibold tracking-tight">Operational exposure with server-side filters</h1>
            <p className="text-sm leading-6 text-white/75">
              The reporting workspace now filters and paginates on the server, so large portfolios stay responsive while the existing StrongBox sections remain dense and operational.
            </p>
          </div>
          <div className="grid min-w-[320px] flex-1 grid-cols-2 gap-3 xl:max-w-[560px]">
            <article className="rounded-2xl border border-white/10 bg-white/10 p-4 text-white backdrop-blur-sm">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/60"><ChartNoAxesCombined className="h-4 w-4" /> Active exposure</div>
              <p className="mt-3 text-3xl font-semibold">{formatCurrencyCompact(totalExposure)}</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/10 p-4 text-white backdrop-blur-sm">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/60"><CircleAlert className="h-4 w-4" /> Flagged loans</div>
              <p className="mt-3 text-3xl font-semibold">{flaggedExposure}</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/10 p-4 text-white backdrop-blur-sm">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/60"><CalendarClock className="h-4 w-4" /> Upcoming funding</div>
              <p className="mt-3 text-3xl font-semibold">{formatCurrencyCompact(upcomingFunding)}</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/10 p-4 text-white backdrop-blur-sm">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/60"><Flag className="h-4 w-4" /> 1098 review</div>
              <p className="mt-3 text-3xl font-semibold">{taxFlags}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_24px_40px_-36px_rgba(15,23,42,0.45)]">
        <div className="grid gap-3 lg:grid-cols-[1.1fr_repeat(3,minmax(0,0.72fr))] xl:grid-cols-[1.1fr_repeat(5,minmax(0,0.72fr))]">
          <input
            value={borrower}
            onChange={(event) => {
              setBorrower(event.target.value);
              resetPages();
            }}
            placeholder="Search borrower"
            className="rounded-2xl border border-black/10 bg-[#faf8f5] px-4 py-3 text-sm outline-none transition focus:border-[#C33732]/40"
          />
          <select
            value={stateFilter}
            onChange={(event) => {
              setStateFilter(event.target.value);
              resetPages();
            }}
            className="rounded-2xl border border-black/10 bg-[#faf8f5] px-4 py-3 text-sm outline-none"
          >
            <option value="all">All states</option>
            {stateOptions.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
          <select
            value={marketFilter}
            onChange={(event) => {
              setMarketFilter(event.target.value);
              resetPages();
            }}
            className="rounded-2xl border border-black/10 bg-[#faf8f5] px-4 py-3 text-sm outline-none"
          >
            <option value="all">All markets</option>
            {marketOptions.map((market) => (
              <option key={market} value={market}>{market}</option>
            ))}
          </select>
          <select
            value={loanTypeFilter}
            onChange={(event) => {
              setLoanTypeFilter(event.target.value);
              resetPages();
            }}
            className="rounded-2xl border border-black/10 bg-[#faf8f5] px-4 py-3 text-sm outline-none"
          >
            <option value="all">All loan types</option>
            {loanTypeOptions.map((loanType) => (
              <option key={loanType} value={loanType}>{loanType}</option>
            ))}
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              resetPages();
            }}
            className="rounded-2xl border border-black/10 bg-[#faf8f5] px-4 py-3 text-sm outline-none"
          />
          <input
            type="date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              resetPages();
            }}
            className="rounded-2xl border border-black/10 bg-[#faf8f5] px-4 py-3 text-sm outline-none"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-zinc-500">
          <span>{stateCount} states</span>
          <span>{marketCount} markets</span>
          <span>{activeExposure?.rowCount || 0} active loans matched</span>
        </div>
      </section>

      {reportsQuery.isLoading ? (
        <section className="rounded-[24px] border border-black/10 bg-white p-8 text-sm text-zinc-500">Loading StrongBox reports...</section>
      ) : (
        <>
          <section id="active-exposure" className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_24px_40px_-36px_rgba(15,23,42,0.45)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Report View</p>
                <h2 className="mt-1 text-2xl font-semibold text-zinc-950">Active exposure</h2>
              </div>
              <Link href="/strongbox/loans" className="inline-flex items-center gap-2 rounded-2xl border border-black/10 px-3 py-2 text-sm font-medium text-zinc-900 transition hover:border-black/20 hover:bg-zinc-50">
                Loan ledger <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-black/10 bg-[#faf8f5] text-left text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    <th className="px-3 py-3">Borrower</th>
                    <th className="px-3 py-3">Property</th>
                    <th className="px-3 py-3">State</th>
                    <th className="px-3 py-3">Market</th>
                    <th className="px-3 py-3">Loan Type</th>
                    <th className="px-3 py-3">Principal</th>
                    <th className="px-3 py-3">LTV</th>
                    <th className="px-3 py-3">Maturity</th>
                    <th className="px-3 py-3">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeExposure?.data || []).map((row) => (
                    <tr key={row.id} className="border-b border-black/6 last:border-0">
                      <td className="px-3 py-3 font-medium text-zinc-950">{row.borrower}</td>
                      <td className="px-3 py-3 text-zinc-600">{row.property || "-"}</td>
                      <td className="px-3 py-3 text-zinc-600">{row.state || "-"}</td>
                      <td className="px-3 py-3 text-zinc-600">{row.market_name || "-"}</td>
                      <td className="px-3 py-3 text-zinc-600">{row.loan_type || "-"}</td>
                      <td className="px-3 py-3 font-medium text-zinc-950">{formatCurrencyCompact(asNumber(row.principal_total))}</td>
                      <td className="px-3 py-3 text-zinc-600">{formatPercent(row.ltv)}</td>
                      <td className="px-3 py-3 text-zinc-600">{formatDate(row.maturity_date)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {riskBadges(row).length === 0 ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">Stable</span>
                          ) : (
                            riskBadges(row).map((badge) => (
                              <span key={`${row.id}-${badge}`} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">{badge}</span>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={activeExposure?.page || 1} totalPages={activeExposure?.totalPages || 1} onPageChange={setActivePage} />
          </section>

          <section id="geo-exposure" className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_24px_40px_-36px_rgba(15,23,42,0.45)]">
              <div className="mb-4 flex items-center gap-2">
                <MapPinned className="h-4 w-4 text-[#C33732]" />
                <h2 className="text-xl font-semibold text-zinc-950">Exposure by state</h2>
              </div>
              <div className="space-y-3">
                {(exposureByState?.data || []).map((row) => (
                  <div key={row.state} className="rounded-2xl border border-black/8 bg-[#faf8f5] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{row.state}</p>
                        <p className="mt-2 text-2xl font-semibold text-zinc-950">{formatCurrencyCompact(asNumber(row.total_exposure))}</p>
                      </div>
                      <div className="text-right text-sm text-zinc-500">
                        <p>{row.active_loan_count} active loans</p>
                        <p className="mt-1">Avg LTV {formatPercent(row.average_ltv)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_24px_40px_-36px_rgba(15,23,42,0.45)]">
              <div className="mb-4 flex items-center gap-2">
                <TableProperties className="h-4 w-4 text-[#C33732]" />
                <h2 className="text-xl font-semibold text-zinc-950">Exposure by market</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/10 bg-[#faf8f5] text-left text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      <th className="px-3 py-3">Market</th>
                      <th className="px-3 py-3">Active Loans</th>
                      <th className="px-3 py-3 text-right">Exposure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(exposureByMarket?.data || []).map((row) => (
                      <tr key={row.market_name} className="border-b border-black/6 last:border-0">
                        <td className="px-3 py-3 font-medium text-zinc-950">{row.market_name}</td>
                        <td className="px-3 py-3 text-zinc-600">{row.active_loan_count}</td>
                        <td className="px-3 py-3 text-right font-medium text-zinc-950">{formatCurrencyCompact(asNumber(row.total_exposure))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>

          <section id="loan-types" className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_24px_40px_-36px_rgba(15,23,42,0.45)]">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#C33732]" />
              <h2 className="text-xl font-semibold text-zinc-950">Loan type summary</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {(loanTypeSummary?.data || []).map((row) => (
                <article key={row.loan_type} className="rounded-2xl border border-black/8 bg-[#faf8f5] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{row.loan_type}</p>
                  <p className="mt-3 text-2xl font-semibold text-zinc-950">{formatCurrencyCompact(asNumber(row.active_principal_total))}</p>
                  <p className="mt-1 text-sm text-zinc-500">{row.active_count} active loans</p>
                </article>
              ))}
            </div>
          </section>

          <section id="upcoming-loans" className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_24px_40px_-36px_rgba(15,23,42,0.45)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Report View</p>
                <h2 className="mt-1 text-2xl font-semibold text-zinc-950">Upcoming loans</h2>
              </div>
              <p className="text-sm text-zinc-500">Cash needed now {formatCurrencyCompact(upcomingFunding)}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b border-black/10 bg-[#faf8f5] text-left text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    <th className="px-3 py-3">Borrower</th>
                    <th className="px-3 py-3">Property</th>
                    <th className="px-3 py-3">Funding Date</th>
                    <th className="px-3 py-3">Total Loan</th>
                    <th className="px-3 py-3">Draw Reserve</th>
                    <th className="px-3 py-3">Cash Needed</th>
                    <th className="px-3 py-3">Title Company</th>
                  </tr>
                </thead>
                <tbody>
                  {(upcomingLoans?.data || []).map((row) => (
                    <tr key={row.id} className="border-b border-black/6 last:border-0">
                      <td className="px-3 py-3 font-medium text-zinc-950">{row.borrower}</td>
                      <td className="px-3 py-3 text-zinc-600">{row.property || "-"}</td>
                      <td className="px-3 py-3 text-zinc-600">{formatDate(row.target_funding_date)}</td>
                      <td className="px-3 py-3 font-medium text-zinc-950">{formatCurrencyCompact(asNumber(row.total_loan))}</td>
                      <td className="px-3 py-3 text-zinc-600">{formatCurrencyCompact(asNumber(row.draw_reserve))}</td>
                      <td className="px-3 py-3 font-medium text-[#C33732]">{formatCurrencyCompact(asNumber(row.cash_needed_now))}</td>
                      <td className="px-3 py-3 text-zinc-600">{row.title_company || "Missing"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={upcomingLoans?.page || 1} totalPages={upcomingLoans?.totalPages || 1} onPageChange={setUpcomingPage} />
          </section>

          <section id="closed-projects" className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_24px_40px_-36px_rgba(15,23,42,0.45)]">
            <div className="mb-4 flex items-center gap-2">
              <ChartNoAxesCombined className="h-4 w-4 text-[#C33732]" />
              <h2 className="text-xl font-semibold text-zinc-950">Closed projects by year</h2>
            </div>
            <div className="space-y-3">
              {(closedProjects?.data || []).map((row) => (
                <article key={row.year} className="rounded-2xl border border-black/8 bg-[#faf8f5] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{row.year}</p>
                      <p className="mt-2 text-xl font-semibold text-zinc-950">{row.count} closed projects</p>
                    </div>
                    <div className="text-right text-sm text-zinc-500">
                      <p>{formatCurrencyCompact(asNumber(row.principal_total))} principal</p>
                      <p className="mt-1">Avg hold {Number(row.average_hold_years || 0).toFixed(2)}y</p>
                    </div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#C33732] to-[#EAAFA8]" style={{ width: `${(row.count / maxClosedProjects) * 100}%` }} />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="tax-prep" className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_24px_40px_-36px_rgba(15,23,42,0.45)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Report View</p>
                <h2 className="mt-1 text-2xl font-semibold text-zinc-950">1098 prep review</h2>
              </div>
              <Link href="/strongbox/review" className="inline-flex items-center gap-2 rounded-2xl border border-black/10 px-3 py-2 text-sm font-medium text-zinc-900 transition hover:border-black/20 hover:bg-zinc-50">
                Open remediation <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-black/10 bg-[#faf8f5] text-left text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    <th className="px-3 py-3">Borrower</th>
                    <th className="px-3 py-3">2022 Closed</th>
                    <th className="px-3 py-3">2023 Closed</th>
                    <th className="px-3 py-3">Active/Cashout</th>
                    <th className="px-3 py-3">Total Loans</th>
                    <th className="px-3 py-3">Latest Property</th>
                    <th className="px-3 py-3">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {(taxPrepReview?.data || []).map((row) => (
                    <tr key={row.id} className="border-b border-black/6 last:border-0">
                      <td className="px-3 py-3 font-medium text-zinc-950">{row.borrower}</td>
                      <td className="px-3 py-3 text-zinc-600">{row.loans_closed_2022_count}</td>
                      <td className="px-3 py-3 text-zinc-600">{row.loans_closed_2023_count}</td>
                      <td className="px-3 py-3 text-zinc-600">{row.active_or_cashout_count}</td>
                      <td className="px-3 py-3 text-zinc-600">{row.total_loan_count}</td>
                      <td className="px-3 py-3 text-zinc-600">{row.latest_property || "-"}</td>
                      <td className="px-3 py-3">
                        {row.review_flag ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                            Needs review <ArrowRight className="h-3 w-3" />
                          </span>
                        ) : (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">Clear</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={taxPrepReview?.page || 1} totalPages={taxPrepReview?.totalPages || 1} onPageChange={setTaxPage} />
          </section>
        </>
      )}
    </div>
  );
}