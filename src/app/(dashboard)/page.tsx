"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Loader2,
  TrendingUp,
  DollarSign,
  Users,
  FileText,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Link
          href="/loans/new"
          className="flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          <FileText className="h-4 w-4" /> New Loan
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <KPICard
          title="Active Portfolio"
          value={formatCurrencyCompact(data?.activePortfolio?.amount || 0)}
          subtitle={`${data?.activePortfolio?.count || 0} loans`}
          icon={DollarSign}
          color="text-green-600 bg-green-50 dark:bg-green-950"
        />
        <KPICard
          title="Pipeline"
          value={formatCurrencyCompact(data?.pipeline?.amount || 0)}
          subtitle={`${data?.pipeline?.count || 0} in progress`}
          icon={TrendingUp}
          color="text-brand-600 bg-brand-50 dark:bg-brand-950"
        />
        <KPICard
          title="Contacts"
          value={data?.totalContacts?.toString() || "0"}
          subtitle="Active contacts"
          icon={Users}
          color="text-purple-600 bg-purple-50 dark:bg-purple-950"
        />
        <KPICard
          title="Distressed"
          value={data?.distressed?.count?.toString() || "0"}
          subtitle={
            data?.distressed?.amount
              ? formatCurrencyCompact(data.distressed.amount)
              : "$0"
          }
          icon={AlertTriangle}
          color={
            data?.distressed?.count > 0
              ? "text-red-600 bg-red-50 dark:bg-red-950"
              : "text-green-600 bg-green-50 dark:bg-green-950"
          }
        />
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3 mb-6">
        <PipelineSummary />
        <PortfolioMetrics />
        <DelinquencyChart />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mb-6">
        <MaturityCalendar />
        <RecentActivity />
      </div>

      {/* Recent Loans */}
      <div className="rounded-lg border bg-white p-5 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Recent Loans</h2>
          <Link
            href="/loans"
            className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {(data?.recentLoans || []).length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b dark:border-zinc-800">
                <th className="pb-2 text-left font-medium text-zinc-500 text-xs">Loan #</th>
                <th className="pb-2 text-left font-medium text-zinc-500 text-xs">Borrower</th>
                <th className="pb-2 text-left font-medium text-zinc-500 text-xs">Property</th>
                <th className="pb-2 text-left font-medium text-zinc-500 text-xs">Amount</th>
                <th className="pb-2 text-left font-medium text-zinc-500 text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentLoans.map((loan: any) => (
                <tr
                  key={loan.id}
                  className="border-b last:border-0 dark:border-zinc-800"
                >
                  <td className="py-2.5">
                    <Link
                      href={`/loans/${loan.id}`}
                      className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
                    >
                      {loan.loanNumber}
                    </Link>
                  </td>
                  <td className="py-2.5">
                    {loan.borrower?.firstName} {loan.borrower?.lastName}
                  </td>
                  <td className="py-2.5 text-zinc-500 text-xs">
                    {loan.property
                      ? `${loan.property.address}, ${loan.property.city}`
                      : "-"}
                  </td>
                  <td className="py-2.5 font-medium">
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
          <p className="text-sm text-zinc-400 text-center py-4">
            No loans yet
          </p>
        )}
      </div>
    </div>
  );
}

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
  color: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-500">{title}</p>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", color)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-semibold mt-2">{value}</p>
      <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>
    </div>
  );
}
