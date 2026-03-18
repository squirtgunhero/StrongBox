"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Download,
  Loader2,
  TrendingUp,
  AlertTriangle,
  Landmark,
  DollarSign,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";

type ReportType = "pipeline" | "portfolio" | "delinquency" | "investor" | "revenue";

const REPORT_TYPES: { value: ReportType; label: string; icon: typeof BarChart3; description: string }[] = [
  { value: "pipeline", label: "Pipeline", icon: TrendingUp, description: "Loans in origination pipeline by status and officer" },
  { value: "portfolio", label: "Portfolio", icon: BarChart3, description: "Active portfolio with maturity and balance analysis" },
  { value: "delinquency", label: "Delinquency", icon: AlertTriangle, description: "Delinquent loans with aging buckets" },
  { value: "investor", label: "Investor / Capital", icon: Landmark, description: "Capital sources, utilization, and allocations" },
  { value: "revenue", label: "Revenue", icon: DollarSign, description: "Interest income and fee revenue by month" },
];

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("portfolio");
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["report", reportType],
    queryFn: async () => {
      const res = await fetch(`/api/reports?type=${reportType}`);
      if (!res.ok) throw new Error("Failed to fetch report");
      return res.json();
    },
  });

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const res = await fetch(`/api/reports?type=${reportType}&format=csv`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportType}-report.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const report = data?.report;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-zinc-500 mt-1">Generate and export lending reports</p>
        </div>
        <button
          onClick={handleExportCsv}
          disabled={isExporting || isLoading}
          className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 disabled:opacity-50"
        >
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export CSV
        </button>
      </div>

      {/* Report Type Selector */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {REPORT_TYPES.map((rt) => {
          const Icon = rt.icon;
          return (
            <button
              key={rt.value}
              onClick={() => setReportType(rt.value)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                reportType === rt.value
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30 dark:border-brand-700"
                  : "bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800"
              )}
            >
              <Icon className={cn("h-4 w-4 mb-1.5", reportType === rt.value ? "text-brand-600" : "text-zinc-400")} />
              <p className={cn("text-sm font-medium", reportType === rt.value ? "text-brand-700 dark:text-brand-400" : "")}>{rt.label}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{rt.description}</p>
            </button>
          );
        })}
      </div>

      {/* Report Content */}
      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : !report ? (
        <div className="rounded-lg border bg-white p-12 text-center dark:bg-zinc-900 dark:border-zinc-800">
          <BarChart3 className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Select a report type to generate</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <ReportSummary type={reportType} report={report} />

          {/* Data Table */}
          <div className="mt-6 rounded-lg border bg-white dark:bg-zinc-900 dark:border-zinc-800">
            <ReportTable type={reportType} report={report} />
          </div>
        </>
      )}
    </div>
  );
}

function ReportSummary({ type, report }: { type: ReportType; report: any }) {
  const { summary } = report;

  const cards: { label: string; value: string; color?: string }[] = [];

  switch (type) {
    case "pipeline":
      cards.push(
        { label: "Active Deals", value: String(summary.totalDeals) },
        { label: "Pipeline Value", value: formatCurrency(summary.totalAmount) },
        { label: "Avg Loan Size", value: formatCurrency(summary.avgLoanSize) },
      );
      break;
    case "portfolio":
      cards.push(
        { label: "Active Loans", value: String(summary.activeLoans) },
        { label: "Outstanding Balance", value: formatCurrency(summary.totalBalance) },
        { label: "Avg Rate", value: `${summary.weightedAvgRate.toFixed(2)}%` },
        { label: "Avg Loan Size", value: formatCurrency(summary.avgLoanSize) },
      );
      break;
    case "delinquency":
      cards.push(
        { label: "Delinquent Loans", value: String(summary.delinquentLoans), color: summary.delinquentLoans > 0 ? "text-red-600" : "" },
        { label: "Delinquent Balance", value: formatCurrency(summary.delinquentBalance) },
        { label: "Delinquency Rate", value: `${summary.delinquencyRate.toFixed(1)}%`, color: summary.delinquencyRate > 5 ? "text-red-600" : "" },
        { label: "Overdue Payments", value: String(summary.overduePayments) },
      );
      break;
    case "investor":
      cards.push(
        { label: "Capital Sources", value: String(summary.totalSources) },
        { label: "Total Capacity", value: formatCurrency(summary.totalCapacity) },
        { label: "Deployed", value: formatCurrency(summary.totalDeployed) },
        { label: "Utilization", value: `${summary.utilization.toFixed(1)}%` },
      );
      break;
    case "revenue":
      cards.push(
        { label: "Total Revenue", value: formatCurrency(summary.totalRevenue) },
        { label: "Interest Income", value: formatCurrency(summary.totalInterest) },
        { label: "Fee Income", value: formatCurrency(summary.totalFees) },
        { label: "Avg Monthly", value: formatCurrency(summary.avgMonthlyRevenue) },
      );
      break;
  }

  return (
    <div className={cn("grid gap-4", `grid-cols-${Math.min(cards.length, 4)}`)}>
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">{card.label}</p>
          <p className={cn("text-xl font-bold mt-1", card.color)}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}

function ReportTable({ type, report }: { type: ReportType; report: any }) {
  switch (type) {
    case "pipeline":
      return (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-800">
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Loan #</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Borrower</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Property</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Amount</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Officer</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Days</th>
            </tr>
          </thead>
          <tbody>
            {report.loans.map((l: any) => (
              <tr key={l.loanNumber} className="border-b last:border-0 dark:border-zinc-800">
                <td className="px-4 py-3 font-medium text-brand-600 dark:text-brand-400">{l.loanNumber}</td>
                <td className="px-4 py-3">{l.borrower}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">{l.property}</td>
                <td className="px-4 py-3 text-right font-medium">{formatCurrency(l.loanAmount)}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-brand-50 dark:bg-brand-950 px-2 py-0.5 text-[10px] font-medium text-brand-600">
                    {l.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">{l.loanOfficer}</td>
                <td className="px-4 py-3 text-right text-xs text-zinc-500">{l.daysInPipeline}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );

    case "portfolio":
      return (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-800">
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Loan #</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Borrower</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Balance</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Rate</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Maturity</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Days Left</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">LTV</th>
            </tr>
          </thead>
          <tbody>
            {report.loans.map((l: any) => (
              <tr key={l.loanNumber} className={cn("border-b last:border-0 dark:border-zinc-800", l.daysToMaturity !== null && l.daysToMaturity < 0 && "bg-red-50/50 dark:bg-red-950/20")}>
                <td className="px-4 py-3 font-medium text-brand-600 dark:text-brand-400">{l.loanNumber}</td>
                <td className="px-4 py-3">{l.borrower}</td>
                <td className="px-4 py-3 text-right font-medium">{formatCurrency(l.currentBalance)}</td>
                <td className="px-4 py-3 text-right text-xs">{l.interestRate.toFixed(2)}%</td>
                <td className="px-4 py-3 text-right text-xs text-zinc-500">
                  {l.maturityDate ? new Date(l.maturityDate).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={cn("text-xs font-medium", l.daysToMaturity < 0 ? "text-red-600" : l.daysToMaturity <= 30 ? "text-amber-600" : "text-zinc-500")}>
                    {l.daysToMaturity ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-xs text-zinc-500">{l.ltv ? `${l.ltv.toFixed(1)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );

    case "delinquency":
      if (report.loans.length === 0) {
        return (
          <div className="p-12 text-center">
            <p className="text-sm text-emerald-600 font-medium">No delinquent loans</p>
          </div>
        );
      }
      return (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-800">
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Loan #</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Borrower</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Balance</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Days Late</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Bucket</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">NSFs</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Risk</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Officer</th>
            </tr>
          </thead>
          <tbody>
            {report.loans.map((l: any) => (
              <tr key={l.loanNumber} className="border-b last:border-0 dark:border-zinc-800">
                <td className="px-4 py-3 font-medium text-brand-600 dark:text-brand-400">{l.loanNumber}</td>
                <td className="px-4 py-3">{l.borrower}</td>
                <td className="px-4 py-3 text-right font-medium">{formatCurrency(l.currentBalance)}</td>
                <td className="px-4 py-3 text-right text-red-600 font-medium">{l.daysDelinquent}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-red-50 dark:bg-red-950 px-2 py-0.5 text-[10px] font-medium text-red-600">
                    {l.agingBucket}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-xs">{l.nsfCount}</td>
                <td className="px-4 py-3 text-xs">{l.naughtyLevel}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">{l.loanOfficer}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );

    case "investor":
      return (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-800">
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Source</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Type</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Bank</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Limit</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Deployed</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Available</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Util %</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Loans</th>
            </tr>
          </thead>
          <tbody>
            {report.sources.map((s: any) => (
              <tr key={s.name} className="border-b last:border-0 dark:border-zinc-800">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-medium">
                    {s.type.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">{s.bankName}</td>
                <td className="px-4 py-3 text-right font-medium">{formatCurrency(s.creditLimit)}</td>
                <td className="px-4 py-3 text-right text-xs">{formatCurrency(s.deployed)}</td>
                <td className="px-4 py-3 text-right text-xs text-emerald-600">{formatCurrency(s.available)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={cn("text-xs font-medium", s.utilization > 90 ? "text-red-600" : s.utilization > 70 ? "text-amber-600" : "")}>
                    {s.utilization.toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-xs text-zinc-500">{s.allocations.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );

    case "revenue":
      return (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-800">
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Month</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Interest</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Fees</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Principal</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Total Revenue</th>
            </tr>
          </thead>
          <tbody>
            {report.monthlyBreakdown.map((m: any) => (
              <tr key={m.month} className="border-b last:border-0 dark:border-zinc-800">
                <td className="px-4 py-3 font-medium">{m.month}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(m.interest)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(m.fees)}</td>
                <td className="px-4 py-3 text-right text-zinc-500">{formatCurrency(m.principal)}</td>
                <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatCurrency(m.total)}</td>
              </tr>
            ))}
            {report.monthlyBreakdown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-zinc-400 text-sm">
                  No revenue data for this period
                </td>
              </tr>
            )}
          </tbody>
        </table>
      );
  }
}
