import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { differenceInCalendarDays, subMonths, format, startOfMonth } from "date-fns";

// GET /api/analytics?type=officer_performance|geographic|revenue_forecast|loan_performance
export const GET = withAuth(async (request, ctx) => {
  const orgId = ctx.organizationId;
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type") || "officer_performance";

  switch (type) {
    case "officer_performance":
      return NextResponse.json(await officerPerformance(orgId));
    case "geographic":
      return NextResponse.json(await geographicConcentration(orgId));
    case "revenue_forecast":
      return NextResponse.json(await revenueForecast(orgId));
    case "loan_performance":
      return NextResponse.json(await loanPerformance(orgId));
    default:
      return NextResponse.json({ error: "Invalid analytics type" }, { status: 400 });
  }
}, "view_reports");

async function officerPerformance(orgId: string) {
  const officers = await prisma.user.findMany({
    where: { organizationId: orgId, role: "LOAN_OFFICER", isActive: true },
    select: { id: true, firstName: true, lastName: true },
  });

  const results = await Promise.all(
    officers.map(async (officer) => {
      const [pipeline, funded, delinquent, totalRevenue] = await Promise.all([
        prisma.loan.count({
          where: {
            organizationId: orgId,
            loanOfficerId: officer.id,
            status: { in: ["LEAD", "APPLICATION", "PROCESSING", "UNDERWRITING", "CONDITIONAL_APPROVAL", "APPROVED", "CLOSING"] as any },
          },
        }),
        prisma.loan.findMany({
          where: {
            organizationId: orgId,
            loanOfficerId: officer.id,
            fundingDate: { gte: subMonths(new Date(), 12) },
          },
          select: { loanAmount: true, fundingDate: true },
        }),
        prisma.loan.count({
          where: {
            organizationId: orgId,
            loanOfficerId: officer.id,
            daysDelinquent: { gt: 0 },
            status: { in: ["FUNDED", "ACTIVE", "EXTENDED"] as any },
          },
        }),
        prisma.loan.aggregate({
          where: {
            organizationId: orgId,
            loanOfficerId: officer.id,
            status: { in: ["FUNDED", "ACTIVE", "EXTENDED", "PAID_OFF"] as any },
          },
          _sum: { totalInterestPaid: true, totalFeesPaid: true },
        }),
      ]);

      const fundedVolume = funded.reduce((s, l) => s + Number(l.loanAmount), 0);
      const avgDaysToClose = funded.length > 0
        ? funded.reduce((s, l) => s + (l.fundingDate ? differenceInCalendarDays(l.fundingDate, new Date()) : 0), 0) / funded.length
        : 0;

      return {
        id: officer.id,
        name: `${officer.firstName} ${officer.lastName}`,
        pipelineCount: pipeline,
        fundedCount: funded.length,
        fundedVolume,
        delinquentCount: delinquent,
        totalRevenue: Number(totalRevenue._sum.totalInterestPaid || 0) + Number(totalRevenue._sum.totalFeesPaid || 0),
        avgFundedPerMonth: funded.length > 0 ? funded.length / 12 : 0,
      };
    })
  );

  return {
    type: "officer_performance",
    officers: results.sort((a, b) => b.fundedVolume - a.fundedVolume),
  };
}

async function geographicConcentration(orgId: string) {
  const loans = await prisma.loan.findMany({
    where: {
      organizationId: orgId,
      status: { in: ["FUNDED", "ACTIVE", "EXTENDED"] as any },
      property: { isNot: null },
    },
    select: {
      loanAmount: true,
      currentBalance: true,
      property: { select: { state: true, city: true, county: true } },
    },
  });

  const byState: Record<string, { state: string; count: number; balance: number }> = {};
  const byCity: Record<string, { city: string; state: string; count: number; balance: number }> = {};

  loans.forEach((l) => {
    const state = l.property?.state || "Unknown";
    const city = l.property?.city || "Unknown";
    const balance = Number(l.currentBalance || l.loanAmount);

    if (!byState[state]) byState[state] = { state, count: 0, balance: 0 };
    byState[state].count++;
    byState[state].balance += balance;

    const cityKey = `${city}, ${state}`;
    if (!byCity[cityKey]) byCity[cityKey] = { city, state, count: 0, balance: 0 };
    byCity[cityKey].count++;
    byCity[cityKey].balance += balance;
  });

  const totalBalance = loans.reduce((s, l) => s + Number(l.currentBalance || l.loanAmount), 0);

  return {
    type: "geographic",
    totalLoans: loans.length,
    totalBalance,
    byState: Object.values(byState)
      .map((s) => ({ ...s, concentration: totalBalance > 0 ? (s.balance / totalBalance) * 100 : 0 }))
      .sort((a, b) => b.balance - a.balance),
    byCity: Object.values(byCity)
      .map((c) => ({ ...c, concentration: totalBalance > 0 ? (c.balance / totalBalance) * 100 : 0 }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 20),
  };
}

async function revenueForecast(orgId: string) {
  // Get active loans to project future interest income
  const activeLoans = await prisma.loan.findMany({
    where: {
      organizationId: orgId,
      status: { in: ["FUNDED", "ACTIVE", "EXTENDED"] as any },
    },
    select: {
      loanAmount: true,
      currentBalance: true,
      interestRate: true,
      maturityDate: true,
      termMonths: true,
    },
  });

  // Project next 6 months of interest income
  const now = new Date();
  const forecast = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(now, -i - 1);
    const monthKey = format(startOfMonth(month), "yyyy-MM");

    // Estimate which loans will still be active
    const activeInMonth = activeLoans.filter((l) => {
      if (!l.maturityDate) return true;
      return l.maturityDate >= month;
    });

    const monthlyInterest = activeInMonth.reduce((s, l) => {
      const balance = Number(l.currentBalance || l.loanAmount);
      const rate = Number(l.interestRate);
      return s + (balance * rate / 100 / 12);
    }, 0);

    return {
      month: monthKey,
      projectedInterest: monthlyInterest,
      activeLoans: activeInMonth.length,
      portfolioBalance: activeInMonth.reduce((s, l) => s + Number(l.currentBalance || l.loanAmount), 0),
    };
  });

  // Historical last 6 months
  const historical = await prisma.payment.groupBy({
    by: ["status"],
    where: {
      loan: { organizationId: orgId },
      status: "PAID",
      paidDate: { gte: subMonths(now, 6) },
    },
    _sum: { interestAmount: true, amount: true },
    _count: true,
  });

  return {
    type: "revenue_forecast",
    forecast,
    currentPortfolio: {
      loans: activeLoans.length,
      balance: activeLoans.reduce((s, l) => s + Number(l.currentBalance || l.loanAmount), 0),
      avgRate: activeLoans.length > 0
        ? activeLoans.reduce((s, l) => s + Number(l.interestRate), 0) / activeLoans.length
        : 0,
      monthlyProjectedInterest: forecast[0]?.projectedInterest || 0,
    },
  };
}

async function loanPerformance(orgId: string) {
  const activeStatuses = ["FUNDED", "ACTIVE", "EXTENDED", "PAID_OFF", "DEFAULT"] as const;

  const loans = await prisma.loan.findMany({
    where: { organizationId: orgId, status: { in: activeStatuses as any } },
    select: {
      id: true,
      loanNumber: true,
      type: true,
      loanAmount: true,
      currentBalance: true,
      interestRate: true,
      totalInterestPaid: true,
      totalFeesPaid: true,
      daysDelinquent: true,
      status: true,
      fundingDate: true,
      maturityDate: true,
      payoffDate: true,
      termMonths: true,
    },
  });

  const now = new Date();

  const byType: Record<string, { type: string; count: number; volume: number; avgRate: number; delinquentCount: number }> = {};
  let totalRevenue = 0;
  const payoffTimes: number[] = [];

  loans.forEach((l) => {
    const type = l.type;
    if (!byType[type]) byType[type] = { type, count: 0, volume: 0, avgRate: 0, delinquentCount: 0 };
    byType[type].count++;
    byType[type].volume += Number(l.loanAmount);
    byType[type].avgRate += Number(l.interestRate);
    if (l.daysDelinquent > 0) byType[type].delinquentCount++;

    totalRevenue += Number(l.totalInterestPaid) + Number(l.totalFeesPaid);

    if (l.payoffDate && l.fundingDate) {
      payoffTimes.push(differenceInCalendarDays(l.payoffDate, l.fundingDate));
    }
  });

  // Finalize averages
  Object.values(byType).forEach((t) => {
    t.avgRate = t.count > 0 ? t.avgRate / t.count : 0;
  });

  return {
    type: "loan_performance",
    summary: {
      totalLoans: loans.length,
      totalVolume: loans.reduce((s, l) => s + Number(l.loanAmount), 0),
      totalRevenue,
      avgPayoffDays: payoffTimes.length > 0 ? payoffTimes.reduce((s, d) => s + d, 0) / payoffTimes.length : null,
      paidOffCount: loans.filter((l) => l.status === "PAID_OFF").length,
      defaultCount: loans.filter((l) => l.status === "DEFAULT").length,
    },
    byType: Object.values(byType).sort((a, b) => b.volume - a.volume),
  };
}
