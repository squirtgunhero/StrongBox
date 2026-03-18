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
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <KPICard
          title="Active Portfolio"
          value={formatCurrencyCompact(data?.activePortfolio?.amount || 0)}
          subtitle={`${data?.activePortfolio?.count || 0} loans`}
          icon={DollarSign}
          iconColor="text-emerald-600 bg-emerald-50"
        />
        <KPICard
          title="Pipeline"
          value={formatCurrencyCompact(data?.pipeline?.amount || 0)}
          subtitle={`${data?.pipeline?.count || 0} in progress`}
          icon={TrendingUp}
          iconColor="text-[#1E3A5F] bg-[#EFF4F9]"
        />
        <KPICard
          title="Contacts"
          value={data?.totalContacts?.toString() || "0"}
          subtitle="Active contacts"
          icon={Users}
          iconColor="text-purple-600 bg-purple-50"
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
          iconColor={
            data?.distressed?.count > 0
              ? "text-red-600 bg-red-50"
              : "text-emerald-600 bg-emerald-50"
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
      <div className="rounded-lg border border-stone-200 bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-stone-900">Recent Loans</h2>
          <Link
            href="/loans"
            className="text-xs text-[#1E3A5F] hover:text-[#162D4A] font-medium flex items-center gap-1"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {(data?.recentLoans || []).length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="pb-2 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Loan #</th>
                <th className="pb-2 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Borrower</th>
                <th className="pb-2 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Property</th>
                <th className="pb-2 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Amount</th>
                <th className="pb-2 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentLoans.map((loan: any) => (
                <tr
                  key={loan.id}
                  className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors"
                >
                  <td className="py-2.5">
                    <Link
                      href={`/loans/${loan.id}`}
                      className="font-medium text-[#1E3A5F] hover:text-[#162D4A]"
                    >
                      {loan.loanNumber}
                    </Link>
                  </td>
                  <td className="py-2.5 text-stone-700">
                    {loan.borrower?.firstName} {loan.borrower?.lastName}
                  </td>
                  <td className="py-2.5 text-stone-500 text-xs">
                    {loan.property
                      ? `${loan.property.address}, ${loan.property.city}`
                      : "-"}
                  </td>
                  <td className="py-2.5 font-medium font-mono text-stone-900">
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
            <FileText className="h-8 w-8 text-stone-300 mx-auto mb-2" strokeWidth={1} />
            <p className="text-sm text-stone-500">No loans yet</p>
          </div>
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
  iconColor,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
  iconColor: string;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-stone-500">{title}</p>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", iconColor)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-semibold font-mono mt-2 text-stone-900">{value}</p>
      <p className="text-xs text-stone-400 mt-0.5">{subtitle}</p>
    </div>
  );
}
