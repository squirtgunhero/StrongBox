import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { differenceInCalendarDays, subDays, startOfMonth, endOfMonth, format } from "date-fns";

// GET /api/reports?type=pipeline|portfolio|delinquency|investor|revenue&format=json|csv
export const GET = withAuth(async (request, ctx) => {
  const orgId = ctx.organizationId;
  const { searchParams } = request.nextUrl;
  const reportType = searchParams.get("type") || "portfolio";
  const outputFormat = searchParams.get("format") || "json";

  let reportData: any;
  let csvRows: string[][] = [];

  switch (reportType) {
    case "pipeline":
      reportData = await buildPipelineReport(orgId);
      csvRows = formatPipelineCsv(reportData);
      break;
    case "portfolio":
      reportData = await buildPortfolioReport(orgId);
      csvRows = formatPortfolioCsv(reportData);
      break;
    case "delinquency":
      reportData = await buildDelinquencyReport(orgId);
      csvRows = formatDelinquencyCsv(reportData);
      break;
    case "investor":
      reportData = await buildInvestorReport(orgId);
      csvRows = formatInvestorCsv(reportData);
      break;
    case "revenue":
      const months = parseInt(searchParams.get("months") || "12");
      reportData = await buildRevenueReport(orgId, months);
      csvRows = formatRevenueCsv(reportData);
      break;
    default:
      return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
  }

  if (outputFormat === "csv") {
    const csv = csvRows.map((row) => row.map(escapeCsv).join(",")).join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${reportType}-report-${format(new Date(), "yyyy-MM-dd")}.csv"`,
      },
    });
  }

  return NextResponse.json({ report: reportData, type: reportType, generatedAt: new Date().toISOString() });
}, "view_reports");

function escapeCsv(value: any): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ── Pipeline Report ──────────────────────────────────────────────────

async function buildPipelineReport(orgId: string) {
  const pipelineStatuses = [
    "LEAD", "APPLICATION", "PROCESSING", "UNDERWRITING",
    "CONDITIONAL_APPROVAL", "APPROVED", "CLOSING",
  ];

  const loans = await prisma.loan.findMany({
    where: { organizationId: orgId, status: { in: pipelineStatuses as any } },
    include: {
      borrower: { select: { firstName: true, lastName: true } },
      property: { select: { address: true, city: true, state: true } },
      loanOfficer: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const byStatus = pipelineStatuses.map((status) => {
    const statusLoans = loans.filter((l) => l.status === status);
    return {
      status,
      count: statusLoans.length,
      totalAmount: statusLoans.reduce((s, l) => s + Number(l.loanAmount), 0),
    };
  });

  const byOfficer = loans.reduce<Record<string, { name: string; count: number; amount: number }>>((acc, loan) => {
    const name = loan.loanOfficer
      ? `${loan.loanOfficer.firstName} ${loan.loanOfficer.lastName}`
      : "Unassigned";
    if (!acc[name]) acc[name] = { name, count: 0, amount: 0 };
    acc[name].count++;
    acc[name].amount += Number(loan.loanAmount);
    return acc;
  }, {});

  return {
    summary: {
      totalDeals: loans.length,
      totalAmount: loans.reduce((s, l) => s + Number(l.loanAmount), 0),
      avgLoanSize: loans.length > 0 ? loans.reduce((s, l) => s + Number(l.loanAmount), 0) / loans.length : 0,
    },
    byStatus,
    byOfficer: Object.values(byOfficer),
    loans: loans.map((l) => ({
      loanNumber: l.loanNumber,
      borrower: `${l.borrower.lastName}, ${l.borrower.firstName}`,
      property: l.property ? `${l.property.address}, ${l.property.city}` : "—",
      loanAmount: Number(l.loanAmount),
      status: l.status,
      loanOfficer: l.loanOfficer ? `${l.loanOfficer.firstName} ${l.loanOfficer.lastName}` : "—",
      daysInPipeline: differenceInCalendarDays(new Date(), l.createdAt),
      createdAt: l.createdAt,
    })),
  };
}

function formatPipelineCsv(data: any): string[][] {
  const header = ["Loan #", "Borrower", "Property", "Loan Amount", "Status", "Loan Officer", "Days in Pipeline", "Created"];
  const rows = data.loans.map((l: any) => [
    l.loanNumber, l.borrower, l.property, l.loanAmount.toFixed(2),
    l.status, l.loanOfficer, l.daysInPipeline, format(new Date(l.createdAt), "MM/dd/yyyy"),
  ]);
  return [header, ...rows];
}

// ── Portfolio Report ─────────────────────────────────────────────────

async function buildPortfolioReport(orgId: string) {
  const activeStatuses = ["FUNDED", "ACTIVE", "EXTENDED"];
  const loans = await prisma.loan.findMany({
    where: { organizationId: orgId, status: { in: activeStatuses as any } },
    include: {
      borrower: { select: { firstName: true, lastName: true } },
      property: { select: { address: true, city: true, state: true, propertyType: true } },
      loanOfficer: { select: { firstName: true, lastName: true } },
    },
    orderBy: { maturityDate: "asc" },
  });

  const now = new Date();
  const totalBalance = loans.reduce((s, l) => s + Number(l.currentBalance || l.loanAmount), 0);
  const totalOriginal = loans.reduce((s, l) => s + Number(l.loanAmount), 0);
  const avgRate = loans.length > 0
    ? loans.reduce((s, l) => s + Number(l.interestRate), 0) / loans.length
    : 0;

  const maturingIn30 = loans.filter((l) => l.maturityDate && differenceInCalendarDays(l.maturityDate, now) <= 30 && differenceInCalendarDays(l.maturityDate, now) >= 0);
  const maturingIn60 = loans.filter((l) => l.maturityDate && differenceInCalendarDays(l.maturityDate, now) <= 60 && differenceInCalendarDays(l.maturityDate, now) > 30);
  const maturingIn90 = loans.filter((l) => l.maturityDate && differenceInCalendarDays(l.maturityDate, now) <= 90 && differenceInCalendarDays(l.maturityDate, now) > 60);
  const pastMaturity = loans.filter((l) => l.maturityDate && differenceInCalendarDays(l.maturityDate, now) < 0);

  const byType = loans.reduce<Record<string, { type: string; count: number; balance: number }>>((acc, l) => {
    if (!acc[l.type]) acc[l.type] = { type: l.type, count: 0, balance: 0 };
    acc[l.type].count++;
    acc[l.type].balance += Number(l.currentBalance || l.loanAmount);
    return acc;
  }, {});

  return {
    summary: {
      activeLoans: loans.length,
      totalBalance,
      totalOriginal,
      weightedAvgRate: avgRate,
      avgLoanSize: loans.length > 0 ? totalBalance / loans.length : 0,
    },
    maturityBuckets: {
      within30: { count: maturingIn30.length, balance: maturingIn30.reduce((s, l) => s + Number(l.currentBalance || l.loanAmount), 0) },
      within60: { count: maturingIn60.length, balance: maturingIn60.reduce((s, l) => s + Number(l.currentBalance || l.loanAmount), 0) },
      within90: { count: maturingIn90.length, balance: maturingIn90.reduce((s, l) => s + Number(l.currentBalance || l.loanAmount), 0) },
      pastDue: { count: pastMaturity.length, balance: pastMaturity.reduce((s, l) => s + Number(l.currentBalance || l.loanAmount), 0) },
    },
    byType: Object.values(byType),
    loans: loans.map((l) => ({
      loanNumber: l.loanNumber,
      borrower: `${l.borrower.lastName}, ${l.borrower.firstName}`,
      property: l.property ? `${l.property.address}, ${l.property.city}` : "—",
      originalAmount: Number(l.loanAmount),
      currentBalance: Number(l.currentBalance || l.loanAmount),
      interestRate: Number(l.interestRate),
      status: l.status,
      fundingDate: l.fundingDate,
      maturityDate: l.maturityDate,
      daysToMaturity: l.maturityDate ? differenceInCalendarDays(l.maturityDate, now) : null,
      daysDelinquent: l.daysDelinquent,
      ltv: l.ltv ? Number(l.ltv) : null,
    })),
  };
}

function formatPortfolioCsv(data: any): string[][] {
  const header = ["Loan #", "Borrower", "Property", "Original Amount", "Current Balance", "Rate %", "Status", "Funding Date", "Maturity Date", "Days to Maturity", "Days Delinquent", "LTV"];
  const rows = data.loans.map((l: any) => [
    l.loanNumber, l.borrower, l.property, l.originalAmount.toFixed(2),
    l.currentBalance.toFixed(2), l.interestRate.toFixed(2), l.status,
    l.fundingDate ? format(new Date(l.fundingDate), "MM/dd/yyyy") : "",
    l.maturityDate ? format(new Date(l.maturityDate), "MM/dd/yyyy") : "",
    l.daysToMaturity ?? "", l.daysDelinquent, l.ltv ?? "",
  ]);
  return [header, ...rows];
}

// ── Delinquency Report ───────────────────────────────────────────────

async function buildDelinquencyReport(orgId: string) {
  const activeStatuses = ["FUNDED", "ACTIVE", "EXTENDED", "DEFAULT"];
  const loans = await prisma.loan.findMany({
    where: {
      organizationId: orgId,
      status: { in: activeStatuses as any },
      daysDelinquent: { gt: 0 },
    },
    include: {
      borrower: { select: { firstName: true, lastName: true, nsfCount: true, naughtyLevel: true } },
      property: { select: { address: true, city: true, state: true } },
      loanOfficer: { select: { firstName: true, lastName: true } },
    },
    orderBy: { daysDelinquent: "desc" },
  });

  // Also get overdue payments
  const overduePayments = await prisma.payment.findMany({
    where: {
      loan: { organizationId: orgId },
      status: { in: ["SCHEDULED", "PENDING"] },
      dueDate: { lt: new Date() },
    },
    include: {
      loan: {
        select: { loanNumber: true, borrower: { select: { firstName: true, lastName: true } } },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  // Aging buckets
  const bucket = (days: number) => {
    if (days <= 30) return "1-30";
    if (days <= 60) return "31-60";
    if (days <= 90) return "61-90";
    return "90+";
  };

  const buckets: Record<string, { range: string; count: number; balance: number }> = {
    "1-30": { range: "1-30 days", count: 0, balance: 0 },
    "31-60": { range: "31-60 days", count: 0, balance: 0 },
    "61-90": { range: "61-90 days", count: 0, balance: 0 },
    "90+": { range: "90+ days", count: 0, balance: 0 },
  };

  loans.forEach((l) => {
    const b = bucket(l.daysDelinquent);
    buckets[b].count++;
    buckets[b].balance += Number(l.currentBalance || l.loanAmount);
  });

  // Get total active portfolio for delinquency rate
  const totalActive = await prisma.loan.aggregate({
    where: { organizationId: orgId, status: { in: activeStatuses as any } },
    _count: true,
    _sum: { currentBalance: true, loanAmount: true },
  });

  const totalActiveBalance = Number(totalActive._sum.currentBalance || totalActive._sum.loanAmount || 0);
  const delinquentBalance = loans.reduce((s, l) => s + Number(l.currentBalance || l.loanAmount), 0);

  return {
    summary: {
      delinquentLoans: loans.length,
      delinquentBalance,
      totalActiveLoans: totalActive._count,
      totalActiveBalance,
      delinquencyRate: totalActiveBalance > 0 ? (delinquentBalance / totalActiveBalance) * 100 : 0,
      overduePayments: overduePayments.length,
    },
    agingBuckets: Object.values(buckets),
    loans: loans.map((l) => ({
      loanNumber: l.loanNumber,
      borrower: `${l.borrower.lastName}, ${l.borrower.firstName}`,
      property: l.property ? `${l.property.address}, ${l.property.city}` : "—",
      currentBalance: Number(l.currentBalance || l.loanAmount),
      daysDelinquent: l.daysDelinquent,
      agingBucket: bucket(l.daysDelinquent),
      interestRate: Number(l.interestRate),
      nsfCount: l.borrower.nsfCount,
      naughtyLevel: l.borrower.naughtyLevel,
      loanOfficer: l.loanOfficer ? `${l.loanOfficer.firstName} ${l.loanOfficer.lastName}` : "—",
      status: l.status,
    })),
  };
}

function formatDelinquencyCsv(data: any): string[][] {
  const header = ["Loan #", "Borrower", "Property", "Balance", "Days Delinquent", "Aging Bucket", "Rate %", "NSF Count", "Risk Level", "Loan Officer", "Status"];
  const rows = data.loans.map((l: any) => [
    l.loanNumber, l.borrower, l.property, l.currentBalance.toFixed(2),
    l.daysDelinquent, l.agingBucket, l.interestRate.toFixed(2),
    l.nsfCount, l.naughtyLevel, l.loanOfficer, l.status,
  ]);
  return [header, ...rows];
}

// ── Investor Report ──────────────────────────────────────────────────

async function buildInvestorReport(orgId: string) {
  const sources = await prisma.capitalSource.findMany({
    where: { organizationId: orgId },
    include: {
      allocations: {
        where: { isActive: true },
        include: {
          loan: {
            select: {
              loanNumber: true, status: true, loanAmount: true,
              interestRate: true, currentBalance: true, maturityDate: true,
              borrower: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const totalCapacity = sources.reduce((s, src) => s + Number(src.creditLimit || 0), 0);
  const totalDeployed = sources.reduce((s, src) => s + Number(src.totalDeployed || 0), 0);

  return {
    summary: {
      totalSources: sources.length,
      activeSources: sources.filter((s) => s.isActive).length,
      totalCapacity,
      totalDeployed,
      totalAvailable: totalCapacity - totalDeployed,
      utilization: totalCapacity > 0 ? (totalDeployed / totalCapacity) * 100 : 0,
    },
    sources: sources.map((src) => {
      const limit = Number(src.creditLimit || 0);
      const deployed = Number(src.totalDeployed || 0);
      return {
        name: src.name,
        type: src.type,
        bankName: src.bankName || "—",
        creditLimit: limit,
        deployed,
        available: limit - deployed,
        utilization: limit > 0 ? (deployed / limit) * 100 : 0,
        interestRate: src.interestRate ? Number(src.interestRate) : null,
        isActive: src.isActive,
        allocations: src.allocations.map((a) => ({
          loanNumber: a.loan.loanNumber,
          borrower: `${a.loan.borrower.lastName}, ${a.loan.borrower.firstName}`,
          amount: Number(a.amount),
          loanStatus: a.loan.status,
          loanRate: Number(a.loan.interestRate),
          maturityDate: a.loan.maturityDate,
        })),
      };
    }),
  };
}

function formatInvestorCsv(data: any): string[][] {
  const header = ["Source", "Type", "Bank", "Credit Limit", "Deployed", "Available", "Utilization %", "Rate %", "Active"];
  const rows = data.sources.map((s: any) => [
    s.name, s.type, s.bankName, s.creditLimit.toFixed(2),
    s.deployed.toFixed(2), s.available.toFixed(2),
    s.utilization.toFixed(1), s.interestRate?.toFixed(2) ?? "", s.isActive ? "Yes" : "No",
  ]);
  return [header, ...rows];
}

// ── Revenue Report ───────────────────────────────────────────────────

async function buildRevenueReport(orgId: string, months: number = 12) {
  const now = new Date();

  // Interest collected from paid payments
  const paidPayments = await prisma.payment.findMany({
    where: {
      loan: { organizationId: orgId },
      status: "PAID",
      paidDate: { gte: subDays(now, months * 30) },
    },
    select: {
      amount: true,
      interestAmount: true,
      principalAmount: true,
      paidDate: true,
      loan: { select: { loanNumber: true } },
    },
    orderBy: { paidDate: "desc" },
  });

  // Fee revenue from funded loans
  const fundedLoans = await prisma.loan.findMany({
    where: {
      organizationId: orgId,
      fundingDate: { gte: subDays(now, months * 30) },
    },
    select: {
      loanNumber: true,
      loanAmount: true,
      originationFee: true,
      originationFeeFlat: true,
      processingFee: true,
      underwritingFee: true,
      documentFee: true,
      wireFee: true,
      fundingDate: true,
    },
    orderBy: { fundingDate: "desc" },
  });

  // Monthly breakdown
  const monthlyData: Record<string, { month: string; interest: number; fees: number; principal: number; total: number }> = {};

  paidPayments.forEach((p) => {
    if (!p.paidDate) return;
    const key = format(p.paidDate, "yyyy-MM");
    if (!monthlyData[key]) monthlyData[key] = { month: key, interest: 0, fees: 0, principal: 0, total: 0 };
    monthlyData[key].interest += Number(p.interestAmount || 0);
    monthlyData[key].principal += Number(p.principalAmount || 0);
    monthlyData[key].total += Number(p.amount || 0);
  });

  fundedLoans.forEach((l) => {
    if (!l.fundingDate) return;
    const key = format(l.fundingDate, "yyyy-MM");
    if (!monthlyData[key]) monthlyData[key] = { month: key, interest: 0, fees: 0, principal: 0, total: 0 };
    const fees =
      Number(l.originationFeeFlat || 0) +
      Number(l.loanAmount) * Number(l.originationFee || 0) / 100 +
      Number(l.processingFee || 0) +
      Number(l.underwritingFee || 0) +
      Number(l.documentFee || 0) +
      Number(l.wireFee || 0);
    monthlyData[key].fees += fees;
    monthlyData[key].total += fees;
  });

  const monthlyBreakdown = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));

  const totalInterest = paidPayments.reduce((s, p) => s + Number(p.interestAmount || 0), 0);
  const totalFees = fundedLoans.reduce((l, loan) => {
    return l +
      Number(loan.originationFeeFlat || 0) +
      Number(loan.loanAmount) * Number(loan.originationFee || 0) / 100 +
      Number(loan.processingFee || 0) +
      Number(loan.underwritingFee || 0) +
      Number(loan.documentFee || 0) +
      Number(loan.wireFee || 0);
  }, 0);

  return {
    summary: {
      totalRevenue: totalInterest + totalFees,
      totalInterest,
      totalFees,
      loansFunded: fundedLoans.length,
      paymentsCollected: paidPayments.length,
      avgMonthlyRevenue: monthlyBreakdown.length > 0 ? (totalInterest + totalFees) / monthlyBreakdown.length : 0,
    },
    monthlyBreakdown,
    recentFees: fundedLoans.slice(0, 20).map((l) => ({
      loanNumber: l.loanNumber,
      loanAmount: Number(l.loanAmount),
      originationFee: Number(l.originationFeeFlat || 0) + Number(l.loanAmount) * Number(l.originationFee || 0) / 100,
      processingFee: Number(l.processingFee || 0),
      underwritingFee: Number(l.underwritingFee || 0),
      documentFee: Number(l.documentFee || 0),
      fundingDate: l.fundingDate,
    })),
  };
}

function formatRevenueCsv(data: any): string[][] {
  const header = ["Month", "Interest", "Fees", "Principal", "Total Revenue"];
  const rows = data.monthlyBreakdown.map((m: any) => [
    m.month, m.interest.toFixed(2), m.fees.toFixed(2), m.principal.toFixed(2), m.total.toFixed(2),
  ]);
  return [header, ...rows];
}
