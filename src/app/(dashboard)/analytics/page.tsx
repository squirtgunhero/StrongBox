"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Users,
  MapPin,
  TrendingUp,
  Activity,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";

type AnalyticsType = "officer_performance" | "geographic" | "revenue_forecast" | "loan_performance" | "default_probability";

const ANALYTICS_TYPES: { value: AnalyticsType; label: string; icon: typeof BarChart3; description: string }[] = [
  { value: "officer_performance", label: "Loan Officers", icon: Users, description: "Performance metrics by loan officer" },
  { value: "geographic", label: "Geographic", icon: MapPin, description: "Portfolio concentration by location" },
  { value: "revenue_forecast", label: "Revenue Forecast", icon: TrendingUp, description: "Projected interest income" },
  { value: "loan_performance", label: "Loan Performance", icon: Activity, description: "Performance metrics by loan type" },
  { value: "default_probability", label: "Default Risk", icon: BarChart3, description: "Default probability modeling" },
];

export default function AnalyticsPage() {
  const [type, setType] = useState<AnalyticsType>("officer_performance");

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", type],
    queryFn: async () => {
      const url = type === "default_probability"
        ? "/api/analytics/default-probability"
        : `/api/analytics?type=${type}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-stone-500 mt-1">Advanced portfolio and performance analytics</p>
      </div>

      {/* Type Selector */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {ANALYTICS_TYPES.map((at) => {
          const Icon = at.icon;
          return (
            <button
              key={at.value}
              onClick={() => setType(at.value)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                type === at.value
                  ? "border-[#1E3A5F] bg-[#EFF4F9] "
                  : "bg-white hover:bg-stone-50"
              )}
            >
              <Icon className={cn("h-4 w-4 mb-1.5", type === at.value ? "text-[#1E3A5F]" : "text-stone-400")} />
              <p className="text-sm font-medium">{at.label}</p>
              <p className="text-[10px] text-stone-500 mt-0.5">{at.description}</p>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
        </div>
      ) : data ? (
        <AnalyticsContent type={type} data={data} />
      ) : null}
    </div>
  );
}

function AnalyticsContent({ type, data }: { type: AnalyticsType; data: any }) {
  switch (type) {
    case "officer_performance":
      return <OfficerPerformance data={data} />;
    case "geographic":
      return <GeographicConcentration data={data} />;
    case "revenue_forecast":
      return <RevenueForecast data={data} />;
    case "loan_performance":
      return <LoanPerformance data={data} />;
    case "default_probability":
      return <DefaultProbability data={data} />;
  }
}

function OfficerPerformance({ data }: { data: any }) {
  const officers = data.officers || [];
  return (
    <div className="rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-stone-50">
            <th className="px-4 py-3 text-left font-medium text-stone-500">Loan Officer</th>
            <th className="px-4 py-3 text-right font-medium text-stone-500">Pipeline</th>
            <th className="px-4 py-3 text-right font-medium text-stone-500">Funded (12mo)</th>
            <th className="px-4 py-3 text-right font-medium text-stone-500">Volume</th>
            <th className="px-4 py-3 text-right font-medium text-stone-500">Delinquent</th>
            <th className="px-4 py-3 text-right font-medium text-stone-500">Revenue</th>
            <th className="px-4 py-3 text-right font-medium text-stone-500">Avg/Month</th>
          </tr>
        </thead>
        <tbody>
          {officers.map((o: any) => (
            <tr key={o.id} className="border-b last:border-0">
              <td className="px-4 py-3 font-medium">{o.name}</td>
              <td className="px-4 py-3 text-right">{o.pipelineCount}</td>
              <td className="px-4 py-3 text-right">{o.fundedCount}</td>
              <td className="px-4 py-3 text-right font-medium">{formatCurrency(o.fundedVolume)}</td>
              <td className="px-4 py-3 text-right">
                <span className={cn(o.delinquentCount > 0 ? "text-red-600 font-medium" : "")}>
                  {o.delinquentCount}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-emerald-600 font-medium">{formatCurrency(o.totalRevenue)}</td>
              <td className="px-4 py-3 text-right text-xs text-stone-500">{o.avgFundedPerMonth.toFixed(1)}</td>
            </tr>
          ))}
          {officers.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-12 text-center text-stone-400">No loan officers found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function GeographicConcentration({ data }: { data: any }) {
  const maxBalance = Math.max(...(data.byState || []).map((s: any) => s.balance), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-stone-500">Total Loans</p>
          <p className="text-xl font-bold">{data.totalLoans}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-stone-500">Total Balance</p>
          <p className="text-xl font-bold">{formatCurrency(data.totalBalance)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-stone-500">States</p>
          <p className="text-xl font-bold">{(data.byState || []).length}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* By State */}
        <div className="rounded-lg border bg-white p-5">
          <h3 className="text-sm font-semibold mb-4">By State</h3>
          <div className="space-y-2">
            {(data.byState || []).map((s: any) => (
              <div key={s.state}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="font-medium">{s.state}</span>
                  <span className="text-stone-500">{s.count} loans — {s.concentration.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2">
                  <div
                    className={cn("h-2 rounded-full transition-all", s.concentration > 50 ? "bg-red-500" : s.concentration > 25 ? "bg-amber-500" : "bg-[#1E3A5F]")}
                    style={{ width: `${(s.balance / maxBalance) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By City */}
        <div className="rounded-lg border bg-white p-5">
          <h3 className="text-sm font-semibold mb-4">Top Cities</h3>
          <div className="space-y-1.5">
            {(data.byCity || []).slice(0, 10).map((c: any) => (
              <div key={`${c.city}-${c.state}`} className="flex items-center justify-between text-xs">
                <span>{c.city}, {c.state}</span>
                <div className="text-right">
                  <span className="font-medium">{formatCurrency(c.balance)}</span>
                  <span className="text-stone-400 ml-2">({c.concentration.toFixed(1)}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RevenueForecast({ data }: { data: any }) {
  const forecast = data.forecast || [];
  const portfolio = data.currentPortfolio || {};
  const maxRevenue = Math.max(...forecast.map((f: any) => f.projectedInterest), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-stone-500">Active Loans</p>
          <p className="text-xl font-bold">{portfolio.loans}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-stone-500">Portfolio Balance</p>
          <p className="text-xl font-bold">{formatCurrency(portfolio.balance)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-stone-500">Avg Rate</p>
          <p className="text-xl font-bold">{portfolio.avgRate?.toFixed(2)}%</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-stone-500">Monthly Projected</p>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(portfolio.monthlyProjectedInterest)}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-5">
        <h3 className="text-sm font-semibold mb-4">6-Month Revenue Forecast</h3>
        <div className="space-y-3">
          {forecast.map((f: any) => (
            <div key={f.month}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium">{f.month}</span>
                <span>
                  {formatCurrency(f.projectedInterest)} — {f.activeLoans} loans
                </span>
              </div>
              <div className="w-full bg-stone-100 rounded-full h-3">
                <div
                  className="h-3 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${(f.projectedInterest / maxRevenue) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoanPerformance({ data }: { data: any }) {
  const summary = data.summary || {};
  const byType = data.byType || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Loans", value: String(summary.totalLoans) },
          { label: "Total Volume", value: formatCurrency(summary.totalVolume) },
          { label: "Total Revenue", value: formatCurrency(summary.totalRevenue), color: "text-emerald-600" },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border bg-white p-4">
            <p className="text-xs text-stone-500">{c.label}</p>
            <p className={cn("text-xl font-bold", c.color)}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-stone-500">Paid Off</p>
          <p className="text-xl font-bold text-emerald-600">{summary.paidOffCount}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-stone-500">Defaults</p>
          <p className={cn("text-xl font-bold", summary.defaultCount > 0 ? "text-red-600" : "")}>{summary.defaultCount}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-stone-500">Avg Payoff Time</p>
          <p className="text-xl font-bold">{summary.avgPayoffDays ? `${Math.round(summary.avgPayoffDays)}d` : "—"}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-stone-50">
              <th className="px-4 py-3 text-left font-medium text-stone-500">Loan Type</th>
              <th className="px-4 py-3 text-right font-medium text-stone-500">Count</th>
              <th className="px-4 py-3 text-right font-medium text-stone-500">Volume</th>
              <th className="px-4 py-3 text-right font-medium text-stone-500">Avg Rate</th>
              <th className="px-4 py-3 text-right font-medium text-stone-500">Delinquent</th>
            </tr>
          </thead>
          <tbody>
            {byType.map((t: any) => (
              <tr key={t.type} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{t.type.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 text-right">{t.count}</td>
                <td className="px-4 py-3 text-right font-medium">{formatCurrency(t.volume)}</td>
                <td className="px-4 py-3 text-right text-xs">{t.avgRate.toFixed(2)}%</td>
                <td className="px-4 py-3 text-right">
                  <span className={cn(t.delinquentCount > 0 ? "text-red-600 font-medium" : "")}>
                    {t.delinquentCount}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DefaultProbability({ data }: { data: any }) {
  const summary = data.portfolioSummary || {};
  const scoredLoans = data.scoredLoans || [];
  const riskByLTV = data.riskByLTV || [];
  const riskByDelinquency = data.riskByDelinquency || [];

  const riskColors: Record<string, string> = {
    HIGH: "text-red-600 bg-red-50",
    MEDIUM: "text-amber-600 bg-amber-50",
    LOW: "text-[#1E3A5F] bg-[#EFF4F9]",
    MINIMAL: "text-emerald-600 bg-emerald-50",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-stone-500">Historical Default Rate</p>
          <p className={cn("text-xl font-bold", summary.historicalDefaultRate > 5 ? "text-red-600" : "")}>{summary.historicalDefaultRate?.toFixed(2)}%</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-stone-500">High Risk Loans</p>
          <p className="text-xl font-bold text-red-600">{summary.highRiskLoans}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-stone-500">High Risk Exposure</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(summary.highRiskExposure)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-white p-5">
          <h3 className="text-sm font-semibold mb-3">Default Rate by LTV</h3>
          <div className="space-y-2">
            {riskByLTV.map((r: any) => (
              <div key={r.label} className="flex items-center justify-between text-xs">
                <span className="font-medium">{r.label}</span>
                <div className="text-right">
                  <span className={cn(r.rate > 10 ? "text-red-600" : "")}>{r.rate.toFixed(1)}%</span>
                  <span className="text-stone-400 ml-2">({r.count} loans, {r.defaults} defaults)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-5">
          <h3 className="text-sm font-semibold mb-3">Default Rate by Delinquency</h3>
          <div className="space-y-2">
            {riskByDelinquency.map((r: any) => (
              <div key={r.label} className="flex items-center justify-between text-xs">
                <span className="font-medium">{r.label}</span>
                <div className="text-right">
                  <span className={cn(r.rate > 10 ? "text-red-600" : "")}>{r.rate.toFixed(1)}%</span>
                  <span className="text-stone-400 ml-2">({r.count} loans)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white">
        <div className="px-5 py-4 border-b">
          <h3 className="text-sm font-semibold">Loan Risk Scores</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-stone-50">
              <th className="px-4 py-3 text-left font-medium text-stone-500">Loan</th>
              <th className="px-4 py-3 text-left font-medium text-stone-500">Borrower</th>
              <th className="px-4 py-3 text-right font-medium text-stone-500">Balance</th>
              <th className="px-4 py-3 text-right font-medium text-stone-500">LTV</th>
              <th className="px-4 py-3 text-right font-medium text-stone-500">Days Del.</th>
              <th className="px-4 py-3 text-right font-medium text-stone-500">Score</th>
              <th className="px-4 py-3 text-left font-medium text-stone-500">Level</th>
              <th className="px-4 py-3 text-left font-medium text-stone-500">Factors</th>
            </tr>
          </thead>
          <tbody>
            {scoredLoans.slice(0, 30).map((loan: any) => (
              <tr key={loan.loanNumber} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{loan.loanNumber}</td>
                <td className="px-4 py-3 text-stone-500">{loan.borrower}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(loan.balance)}</td>
                <td className="px-4 py-3 text-right">{loan.ltv.toFixed(1)}%</td>
                <td className="px-4 py-3 text-right">{loan.daysDelinquent}</td>
                <td className="px-4 py-3 text-right font-bold">{loan.riskScore}</td>
                <td className="px-4 py-3">
                  <span className={cn("text-xs font-medium rounded-full px-2 py-0.5", riskColors[loan.riskLevel] || "")}>
                    {loan.riskLevel}
                  </span>
                </td>
                <td className="px-4 py-3 text-[10px] text-stone-400 max-w-[200px] truncate">{loan.factors.join(", ")}</td>
              </tr>
            ))}
            {scoredLoans.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-stone-400">No active loans to score</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
