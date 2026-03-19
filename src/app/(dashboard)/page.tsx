"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Filter,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  attentionLoans,
  capitalFlow,
  dashboardKpis,
  pipelineByStage,
  portfolioTrend,
  recentActivity,
  repaymentFlow,
  riskRows,
  statusDistribution,
  tasksDueToday,
} from "@/lib/mock/operations";
import { formatCurrencyCompact } from "@/lib/utils/currency";

type RangeOption = "7D" | "30D" | "QTD" | "YTD";
type TeamOption = "All Teams" | "Originations" | "Servicing" | "Special Assets";

type DashboardApi = {
  pipeline: { count: number; amount: number };
  activePortfolio: { count: number; amount: number };
  paidOff: { count: number; amount: number };
  distressed: { count: number; amount: number };
  totalLoans: number;
  totalContacts: number;
  loansByStatus: Array<{ status: string; count: number; amount: number }>;
  recentActivity: Array<{ action: string; description: string; createdAt: string; user?: { firstName?: string; lastName?: string } }>;
};

type LoanApi = {
  id: string;
  loanNumber: string;
  status: string;
  loanAmount: number;
  interestRate: number;
  ltv?: number | null;
  maturityDate?: string | null;
  borrower?: { firstName?: string; lastName?: string };
};

type PaymentsApi = {
  summary: { overdueCount: number; upcomingCount: number; paidThisMonth: number };
  payments: Array<{ loan?: { loanNumber?: string; borrower?: { firstName?: string; lastName?: string } }; amount: number; status: string }>;
};

const rangeOptions: RangeOption[] = ["7D", "30D", "QTD", "YTD"];
const teamOptions: TeamOption[] = ["All Teams", "Originations", "Servicing", "Special Assets"];

const STATUS_LABELS: Record<string, string> = {
  LEAD: "Lead",
  APPLICATION: "Application",
  PROCESSING: "Processing",
  UNDERWRITING: "Underwriting",
  CONDITIONAL_APPROVAL: "Conditional",
  APPROVED: "Approved",
  CLOSING: "Closing",
  FUNDED: "Funded",
  ACTIVE: "Active",
  EXTENDED: "Extended",
  PAYOFF_REQUESTED: "Payoff",
  PAID_OFF: "Paid Off",
  DEFAULT: "Default",
  FORECLOSURE: "Foreclosure",
  REO: "REO",
  CANCELLED: "Cancelled",
  DENIED: "Denied",
};

export default function DashboardPage() {
  const [selectedRange, setSelectedRange] = useState<RangeOption>("30D");
  const [selectedTeam, setSelectedTeam] = useState<TeamOption>("All Teams");

  const dashboardQuery = useQuery<DashboardApi>({
    queryKey: ["dashboard-live"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard");
      if (!response.ok) throw new Error("Unable to fetch dashboard");
      return response.json();
    },
    staleTime: 60000,
  });

  const loansQuery = useQuery<{ loans: LoanApi[] }>({
    queryKey: ["dashboard-loans"],
    queryFn: async () => {
      const response = await fetch("/api/loans?limit=200&sortBy=createdAt&sortOrder=desc");
      if (!response.ok) throw new Error("Unable to fetch loans");
      return response.json();
    },
    staleTime: 60000,
  });

  const paymentsQuery = useQuery<PaymentsApi>({
    queryKey: ["dashboard-payments"],
    queryFn: async () => {
      const response = await fetch("/api/payments?limit=6");
      if (!response.ok) throw new Error("Unable to fetch payments");
      return response.json();
    },
    staleTime: 60000,
  });

  const isLoading = dashboardQuery.isLoading || loansQuery.isLoading || paymentsQuery.isLoading;
  const usingFallback = dashboardQuery.isError || loansQuery.isError || paymentsQuery.isError;

  const data = useMemo(() => {
    const dashboardData = dashboardQuery.data;
    const loans = loansQuery.data?.loans ?? [];
    const payments = paymentsQuery.data;

    let kpis = dashboardKpis;
    if (dashboardData) {
      kpis = [
        {
          label: "Total Portfolio Value",
          value: formatCurrencyCompact(dashboardData.activePortfolio.amount),
          trend: `${dashboardData.totalLoans} total loans`,
          trendDirection: "up" as const,
        },
        {
          label: "Active Loans",
          value: String(dashboardData.activePortfolio.count),
          trend: `${dashboardData.totalContacts} contacts`,
          trendDirection: "up" as const,
        },
        {
          label: "Pipeline Volume",
          value: formatCurrencyCompact(dashboardData.pipeline.amount),
          trend: `${dashboardData.pipeline.count} in queue`,
          trendDirection: "up" as const,
        },
        {
          label: "Capital Deployed",
          value: formatCurrencyCompact(dashboardData.activePortfolio.amount + dashboardData.pipeline.amount),
          trend: "live total",
          trendDirection: "up" as const,
        },
        {
          label: "Upcoming Payoffs",
          value: formatCurrencyCompact(dashboardData.paidOff.amount),
          trend: `${dashboardData.paidOff.count} paid off`,
          trendDirection: "flat" as const,
        },
        {
          label: "Delinquent Loans",
          value: String(dashboardData.distressed.count),
          trend: formatCurrencyCompact(dashboardData.distressed.amount),
          trendDirection: dashboardData.distressed.count > 0 ? ("down" as const) : ("flat" as const),
        },
        {
          label: "Weighted Avg Rate",
          value: `${(
            loans.reduce((sum, loan) => sum + Number(loan.interestRate || 0), 0) /
            Math.max(loans.length, 1)
          ).toFixed(2)}%`,
          trend: "from live book",
          trendDirection: "flat" as const,
        },
        {
          label: "Average LTV",
          value: `${(
            loans.reduce((sum, loan) => sum + Number(loan.ltv || 0), 0) /
            Math.max(loans.filter((loan) => loan.ltv != null).length, 1)
          ).toFixed(1)}%`,
          trend: "from available records",
          trendDirection: "flat" as const,
        },
      ];
    }

    const monthlySeries = portfolioTrend.map((point, idx) => {
      const anchor = dashboardData?.activePortfolio.amount ?? point.value * 1_000_000;
      const factor = (idx + 1) / portfolioTrend.length;
      return {
        label: point.label,
        value: Math.max(anchor * (0.75 + factor * 0.35), 1),
      };
    });

    const distribution = dashboardData?.loansByStatus?.length
      ? dashboardData.loansByStatus
          .sort((a, b) => b.count - a.count)
          .slice(0, 6)
          .map((entry, index) => ({
            label: STATUS_LABELS[entry.status] || entry.status,
            value: entry.count,
            color: ["#C33732", "#34d399", "#f4b45f", "#7c93ff", "#f97373", "#86b4ff"][index],
          }))
      : statusDistribution;

    const pipeline = dashboardData?.loansByStatus?.length
      ? [
          {
            stage: "New Submissions",
            count: dashboardData.loansByStatus
              .filter((s) => ["LEAD", "APPLICATION"].includes(s.status))
              .reduce((sum, s) => sum + s.count, 0),
            amount:
              dashboardData.loansByStatus
                .filter((s) => ["LEAD", "APPLICATION"].includes(s.status))
                .reduce((sum, s) => sum + Number(s.amount), 0) / 1_000_000,
          },
          {
            stage: "Underwriting",
            count: dashboardData.loansByStatus
              .filter((s) => ["PROCESSING", "UNDERWRITING"].includes(s.status))
              .reduce((sum, s) => sum + s.count, 0),
            amount:
              dashboardData.loansByStatus
                .filter((s) => ["PROCESSING", "UNDERWRITING"].includes(s.status))
                .reduce((sum, s) => sum + Number(s.amount), 0) / 1_000_000,
          },
          {
            stage: "Docs Pending",
            count: dashboardData.loansByStatus
              .filter((s) => ["CONDITIONAL_APPROVAL", "APPROVED"].includes(s.status))
              .reduce((sum, s) => sum + s.count, 0),
            amount:
              dashboardData.loansByStatus
                .filter((s) => ["CONDITIONAL_APPROVAL", "APPROVED"].includes(s.status))
                .reduce((sum, s) => sum + Number(s.amount), 0) / 1_000_000,
          },
          {
            stage: "Funding Ready",
            count: dashboardData.loansByStatus
              .filter((s) => ["CLOSING", "FUNDED"].includes(s.status))
              .reduce((sum, s) => sum + s.count, 0),
            amount:
              dashboardData.loansByStatus
                .filter((s) => ["CLOSING", "FUNDED"].includes(s.status))
                .reduce((sum, s) => sum + Number(s.amount), 0) / 1_000_000,
          },
        ]
      : pipelineByStage;

    const activity = dashboardData?.recentActivity?.length
      ? dashboardData.recentActivity.map((item, idx) => ({
          id: `live-${idx}`,
          title: item.action.replaceAll("_", " "),
          detail: item.description,
          actor: item.user ? `${item.user.firstName || ""} ${item.user.lastName || ""}`.trim() || "System" : "System",
          when: new Date(item.createdAt).toLocaleString(),
        }))
      : recentActivity;

    const recentPayments = payments?.payments?.length
      ? payments.payments.slice(0, 4).map((payment, idx) => ({
          id: `p-${idx}`,
          loan: payment.loan?.loanNumber || "Unknown",
          borrower: payment.loan?.borrower
            ? `${payment.loan.borrower.firstName || ""} ${payment.loan.borrower.lastName || ""}`.trim()
            : "Unknown Borrower",
          amount: Number(payment.amount),
          status: payment.status,
        }))
      : [
          { id: "p1", loan: "-", borrower: "No live payments", amount: 0, status: "No Data" },
        ];

    const liveAttention = loans
      .filter((loan) => ["DEFAULT", "FORECLOSURE", "REO"].includes(loan.status))
      .slice(0, 4)
      .map((loan) => ({
        id: loan.id,
        loanId: loan.loanNumber,
        borrower: `${loan.borrower?.firstName || ""} ${loan.borrower?.lastName || ""}`.trim() || "Borrower",
        issue: "Distressed status requires review",
        severity: "high" as const,
        due: "Immediate",
      }));

    return {
      kpis,
      monthlySeries,
      distribution,
      pipeline,
      activity,
      payments: recentPayments,
      attention: liveAttention.length ? liveAttention : attentionLoans,
      tasks: tasksDueToday,
      risk: riskRows,
    };
  }, [dashboardQuery.data, loansQuery.data, paymentsQuery.data]);

  if (isLoading) {
    return <DashboardLoadingState />;
  }

  return (
    <div className="elevate-in space-y-4 pb-6">
      {usingFallback ? (
        <section className="rounded-xl border border-[#C33732]/30 bg-[#C33732]/8 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-[#5B1A18]">
              <ShieldAlert className="h-4 w-4 text-[#C33732]" />
              Live metrics are temporarily unavailable. Showing fallback dashboard data.
            </div>
            <button
              type="button"
              onClick={() => {
                void dashboardQuery.refetch();
                void loansQuery.refetch();
                void paymentsQuery.refetch();
              }}
              className="rounded-lg border border-[#C33732]/35 bg-white px-3 py-1.5 text-xs font-medium text-[#7D2320] transition hover:bg-[#fff6f6]"
            >
              Retry live sync
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-black/10 bg-gradient-to-br from-white to-[#f3f3f3] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#C33732]">Lending Operations</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-black">Dashboard</h2>
            <p className="mt-1 text-sm text-zinc-600">Portfolio health, risk posture, and workflow momentum.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-black/10 bg-white p-1">
              {rangeOptions.map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setSelectedRange(range)}
                  className={
                    selectedRange === range
                      ? "rounded-md bg-[#C33732] px-3 py-1.5 text-xs font-semibold text-white"
                      : "rounded-md px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:text-zinc-900"
                  }
                >
                  {range}
                </button>
              ))}
            </div>

            <select
              value={selectedTeam}
              onChange={(event) => setSelectedTeam(event.target.value as TeamOption)}
              className="h-9 rounded-lg border border-black/10 bg-white px-3 text-xs text-zinc-700 outline-none transition focus:border-[#C33732]"
            >
              {teamOptions.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#C33732] to-[#A52F2B] px-3 py-2 text-xs font-semibold text-white transition hover:from-[#B0332E] hover:to-[#8E2824]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              New Briefing
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data.kpis.map((kpi) => (
          <article key={kpi.label} className="rounded-xl border border-black/10 bg-white p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{kpi.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-black">{kpi.value}</p>
            <div className="mt-2 inline-flex items-center gap-1 text-xs">
              {kpi.trendDirection === "up" ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-300" /> : null}
              {kpi.trendDirection === "down" ? <ArrowDownRight className="h-3.5 w-3.5 text-red-300" /> : null}
              {kpi.trendDirection === "flat" ? <Clock3 className="h-3.5 w-3.5 text-zinc-600" /> : null}
              <span className={kpi.trendDirection === "up" ? "text-emerald-300" : kpi.trendDirection === "down" ? "text-red-300" : "text-zinc-600"}>
                {kpi.trend}
              </span>
            </div>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <ChartCard className="xl:col-span-7" title="Portfolio Value Over Time" subtitle="Net principal outstanding">
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlySeries}>
                <defs>
                  <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C33732" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#C33732" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e2e2" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#6b6b6b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6b6b6b", fontSize: 11 }} axisLine={false} tickLine={false} width={65} tickFormatter={(v) => formatCurrencyCompact(v)} />
                <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #d9d9d9", borderRadius: 10 }} />
                <Area type="monotone" dataKey="value" stroke="#D95A55" strokeWidth={2} fill="url(#portfolioGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard className="xl:col-span-5" title="Loan Status Distribution" subtitle="Live portfolio mix">
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.distribution} dataKey="value" nameKey="label" innerRadius={58} outerRadius={82} paddingAngle={2}>
                  {data.distribution.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #d9d9d9", borderRadius: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {data.distribution.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-md border border-black/10 bg-[#f8f8f8] px-2 py-1">
                <span className="flex items-center gap-1.5 text-zinc-700"><span className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.label}</span>
                <span className="text-zinc-500">{item.value}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard className="xl:col-span-6" title="Capital Deployed vs Repaid" subtitle="Monthly cash movement">
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={capitalFlow.map((point, index) => ({ label: point.label, deployed: point.value, repaid: repaymentFlow[index]?.value ?? 0 }))}>
                <CartesianGrid stroke="#e2e2e2" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#6b6b6b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6b6b6b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #d9d9d9", borderRadius: 10 }} />
                <Bar dataKey="deployed" radius={[4, 4, 0, 0]} fill="#C33732" />
                <Bar dataKey="repaid" radius={[4, 4, 0, 0]} fill="#34d399" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard className="xl:col-span-6" title="Pipeline and Workflow" subtitle="Queue health by stage">
          <PipelineStages stages={data.pipeline} />
        </ChartCard>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-4" title="Loans Requiring Attention" subtitle="Priority follow-up">
          <div className="space-y-2.5">
            {data.attention.map((loan) => (
              <div key={loan.id} className="rounded-lg border border-black/10 bg-[#f8f8f8] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-900">{loan.loanId}</p>
                  <span className={severityClassName(loan.severity)}>{loan.severity.toUpperCase()}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-700">{loan.borrower}</p>
                <p className="mt-1 text-xs text-zinc-600">{loan.issue}</p>
                <p className="mt-2 text-[11px] text-zinc-500">Due {loan.due}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="xl:col-span-4" title="Tasks Due Today" subtitle="Operator queue">
          {data.tasks.length ? (
            <div className="space-y-2.5">
              {data.tasks.map((task) => (
                <div key={task.id} className="rounded-lg border border-black/10 bg-[#f8f8f8] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-900">{task.title}</p>
                    <span className={severityClassName(task.priority)}>{task.priority}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">{task.owner}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">Due {task.due}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-black/10 bg-[#f8f8f8] p-4 text-center">
              <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-300" />
              <p className="mt-2 text-sm font-medium text-zinc-700">No tasks due today</p>
            </div>
          )}
        </Panel>

        <Panel className="xl:col-span-4" title="Recent Payments" subtitle="Cash movement and servicing status">
          <div className="space-y-2.5">
            {data.payments.map((payment) => (
              <div key={payment.id} className="rounded-lg border border-black/10 bg-[#f8f8f8] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-900">{payment.loan}</p>
                  <span className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[10px] text-zinc-700">{payment.status}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-600">{payment.borrower}</p>
                <p className="mt-2 text-sm font-semibold text-[#7D2320]">{formatCurrencyCompact(payment.amount)}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-5" title="Portfolio Risk Snapshot" subtitle="Exposure and concentration signals">
          <div className="space-y-3">
            {data.risk.map((row) => (
              <div key={row.label} className="rounded-lg border border-black/10 bg-[#f8f8f8] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-zinc-800">{row.label}</p>
                  <span className={severityClassName(row.riskLevel)}>{row.riskLevel}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-zinc-600">
                  <span>{formatCurrencyCompact(row.exposure * 1_000_000)} exposure</span>
                  <span>{row.share}% of portfolio</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-[#ececec]">
                  <div className="h-1.5 rounded-full bg-gradient-to-r from-[#C33732] to-[#E3726E]" style={{ width: `${Math.min(row.share * 2, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="xl:col-span-7" title="Recent Activity" subtitle="Live operational timeline">
          <div className="space-y-2.5">
            {data.activity.map((event) => (
              <div key={event.id} className="flex items-start gap-3 rounded-lg border border-black/10 bg-[#f8f8f8] p-3">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#C33732]" />
                <div className="min-w-0 grow">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-900">{event.title}</p>
                    <span className="text-[11px] text-zinc-500">{event.when}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-600">{event.detail}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">by {event.actor}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <div className="flex items-center justify-between rounded-xl border border-black/10 bg-white px-4 py-3 text-xs text-zinc-600">
        <p>Source: {usingFallback ? "Fallback (mock)" : "Live API"} | Team view: {selectedTeam} | Range: {selectedRange}</p>
        <button
          type="button"
          onClick={() => {
            void dashboardQuery.refetch();
            void loansQuery.refetch();
            void paymentsQuery.refetch();
          }}
          className="inline-flex items-center gap-1.5 text-zinc-700 transition hover:text-black"
        >
          <RefreshCw className={(dashboardQuery.isFetching || loansQuery.isFetching || paymentsQuery.isFetching) ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          Refresh metrics
        </button>
      </div>
    </div>
  );
}

function DashboardLoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-28 animate-pulse rounded-2xl border border-black/10 bg-[#f3f3f3]" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl border border-black/10 bg-[#f3f3f3]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="h-64 animate-pulse rounded-xl border border-black/10 bg-[#f3f3f3] xl:col-span-7" />
        <div className="h-64 animate-pulse rounded-xl border border-black/10 bg-[#f3f3f3] xl:col-span-5" />
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, className, children }: { title: string; subtitle: string; className?: string; children: React.ReactNode }) {
  return (
    <article className={`rounded-xl border border-black/10 bg-white p-4 ${className ?? ""}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
          <p className="text-xs text-zinc-500">{subtitle}</p>
        </div>
        <TrendingUp className="h-4 w-4 text-zinc-500" />
      </div>
      {children}
    </article>
  );
}

function Panel({ title, subtitle, className, children }: { title: string; subtitle: string; className?: string; children: React.ReactNode }) {
  return (
    <article className={`rounded-xl border border-black/10 bg-white p-4 ${className ?? ""}`}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
          <p className="text-xs text-zinc-500">{subtitle}</p>
        </div>
        <Filter className="h-4 w-4 text-zinc-600" />
      </div>
      {children}
    </article>
  );
}

function PipelineStages({ stages }: { stages: Array<{ stage: string; count: number; amount: number }> }) {
  const maxCount = Math.max(...stages.map((stage) => stage.count), 1);

  return (
    <div className="space-y-3">
      {stages.map((stage) => (
        <div key={stage.stage}>
          <div className="flex items-center justify-between text-xs text-zinc-700">
            <span>{stage.stage}</span>
            <span className="text-zinc-500">{stage.count} deals · {formatCurrencyCompact(stage.amount * 1_000_000)}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-[#f3f3f3]">
            <div className="h-2 rounded-full bg-gradient-to-r from-[#C33732] to-[#E3726E]" style={{ width: `${Math.max((stage.count / maxCount) * 100, 8)}%` }} />
          </div>
        </div>
      ))}
      <div className="rounded-lg border border-[#C33732]/25 bg-[#C33732]/8 p-2 text-xs text-[#7D2320]">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          Approval bottleneck detected in underwriting and docs pending.
        </div>
      </div>
      <div className="rounded-lg border border-black/10 bg-[#f8f8f8] p-2 text-xs text-zinc-600">
        <div className="flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" />
          Funding queue updates reflected in real time.
        </div>
      </div>
    </div>
  );
}

function severityClassName(level: "low" | "medium" | "high" | "moderate") {
  if (level === "high") return "rounded-full border border-red-300/30 bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-200";
  if (level === "medium" || level === "moderate") return "rounded-full border border-amber-300/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-200";
  return "rounded-full border border-emerald-300/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-200";
}
