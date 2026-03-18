"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  DollarSign,
  Users,
  FileText,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils/currency";
import { LoanStatusBadge } from "@/components/loans/LoanStatusBadge";
import { PipelineSummary } from "@/components/dashboard/PipelineSummary";
import { PortfolioMetrics } from "@/components/dashboard/PortfolioMetrics";
import { DelinquencyChart } from "@/components/dashboard/DelinquencyChart";
import { MaturityCalendar } from "@/components/dashboard/MaturityCalendar";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { DashboardSkeleton } from "@/components/shared/Skeleton";
import type { LoanStatus } from "@prisma/client";

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div>
      {/* Greeting */}
      <h2 className="text-2xl font-bold text-white mb-6">
        Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}
      </h2>

      {/* Bento Grid — Row 1: KPI stats + Maturity sidebar */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Left: 2x2 KPI cards */}
        <div className="col-span-2 grid grid-cols-2 gap-4">
          <MetricCard
            title="Active Portfolio"
            value={formatCurrencyCompact(data?.activePortfolio?.amount || 0)}
            subtitle={`${data?.activePortfolio?.count || 0} active loans`}
            icon={DollarSign}
            positive
          />
          <MetricCard
            title="Pipeline Value"
            value={formatCurrencyCompact(data?.pipeline?.amount || 0)}
            subtitle={`${data?.pipeline?.count || 0} in progress`}
            icon={TrendingUp}
            positive
          />
          <MetricCard
            title="Total Contacts"
            value={data?.totalContacts?.toString() || "0"}
            subtitle="Borrowers & investors"
            icon={Users}
          />
          <MetricCard
            title="Distressed"
            value={data?.distressed?.count?.toString() || "0"}
            subtitle={data?.distressed?.amount ? formatCurrencyCompact(data.distressed.amount) : "$0"}
            icon={AlertTriangle}
            negative={data?.distressed?.count > 0}
          />
        </div>

        {/* Right: Maturity Calendar (tall) */}
        <div className="row-span-1">
          <MaturityCalendar />
        </div>
      </div>

      {/* Bento Grid — Row 2: Pipeline + Portfolio + Delinquency */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <PipelineSummary />
        <PortfolioMetrics />
        <DelinquencyChart />
      </div>

      {/* Bento Grid — Row 3: Recent Loans + Activity */}
      <div className="grid grid-cols-3 gap-4">
        {/* Recent Loans — spans 2 cols */}
        <div className="col-span-2 rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Recent Loans</h3>
            <Link
              href="/loans"
              className="text-xs text-[#3B82F6] hover:text-blue-400 font-medium flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {(data?.recentLoans || []).length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="pb-2 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Loan #</th>
                  <th className="pb-2 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Borrower</th>
                  <th className="pb-2 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Property</th>
                  <th className="pb-2 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Amount</th>
                  <th className="pb-2 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentLoans.map((loan: any) => (
                  <tr
                    key={loan.id}
                    className="hover:bg-white/5 transition-colors"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td className="py-2.5">
                      <Link href={`/loans/${loan.id}`} className="font-medium text-[#3B82F6] hover:text-blue-400">
                        {loan.loanNumber}
                      </Link>
                    </td>
                    <td className="py-2.5 text-zinc-300">
                      {loan.borrower?.firstName} {loan.borrower?.lastName}
                    </td>
                    <td className="py-2.5 text-zinc-500 text-xs">
                      {loan.property ? `${loan.property.address}, ${loan.property.city}` : "-"}
                    </td>
                    <td className="py-2.5 font-medium font-mono text-white">
                      {formatCurrency(loan.loanAmount)}
                    </td>
                    <td className="py-2.5">
                      <LoanStatusBadge status={loan.status as LoanStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-8 text-center">
              <FileText className="h-8 w-8 text-zinc-600 mx-auto mb-2" strokeWidth={1} />
              <p className="text-sm text-zinc-500">No loans yet</p>
            </div>
          )}
        </div>

        {/* Right: Recent Activity */}
        <RecentActivity />
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  positive,
  negative,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{title}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5">
          <Icon className="h-4 w-4 text-zinc-400" />
        </div>
      </div>
      <p className="text-3xl font-bold font-mono text-white">{value}</p>
      <div className="flex items-center gap-1 mt-1">
        {positive && <ArrowUpRight className="h-3 w-3 text-emerald-400" />}
        {negative && <ArrowDownRight className="h-3 w-3 text-red-400" />}
        <p className={cn(
          "text-xs",
          positive ? "text-emerald-400" : negative ? "text-red-400" : "text-zinc-500"
        )}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}
