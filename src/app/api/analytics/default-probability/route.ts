import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { differenceInCalendarDays } from "date-fns";

// GET /api/analytics/default-probability — default probability modeling
export const GET = withAuth(async (request, ctx) => {
  const orgId = ctx.organizationId;

  // Get all historical loans for modeling
  const loans = await prisma.loan.findMany({
    where: {
      organizationId: orgId,
      status: { in: ["FUNDED", "ACTIVE", "EXTENDED", "PAID_OFF", "DEFAULT"] as any },
    },
    select: {
      id: true,
      loanNumber: true,
      type: true,
      loanAmount: true,
      currentBalance: true,
      interestRate: true,
      ltv: true,
      termMonths: true,
      daysDelinquent: true,
      status: true,
      fundingDate: true,
      maturityDate: true,
      payoffDate: true,
      borrower: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      property: {
        select: { state: true, propertyType: true },
      },
    },
  });

  const totalLoans = loans.length;
  const defaultedLoans = loans.filter((l) => l.status === "DEFAULT");
  const defaultRate = totalLoans > 0 ? (defaultedLoans.length / totalLoans) * 100 : 0;

  // Risk factors based on historical data
  const riskByLTV: Record<string, { count: number; defaults: number; rate: number }> = {};
  const riskByType: Record<string, { count: number; defaults: number; rate: number }> = {};
  const riskByDelinquency: Record<string, { count: number; defaults: number; rate: number }> = {};

  loans.forEach((loan) => {
    // LTV buckets
    const ltv = Number(loan.ltv || 0);
    const ltvBucket =
      ltv <= 60 ? "0-60%" : ltv <= 70 ? "60-70%" : ltv <= 80 ? "70-80%" : ltv <= 90 ? "80-90%" : "90%+";
    if (!riskByLTV[ltvBucket]) riskByLTV[ltvBucket] = { count: 0, defaults: 0, rate: 0 };
    riskByLTV[ltvBucket].count++;
    if (loan.status === "DEFAULT") riskByLTV[ltvBucket].defaults++;

    // Type
    const type = loan.type;
    if (!riskByType[type]) riskByType[type] = { count: 0, defaults: 0, rate: 0 };
    riskByType[type].count++;
    if (loan.status === "DEFAULT") riskByType[type].defaults++;

    // Delinquency status
    const delBucket =
      loan.daysDelinquent === 0
        ? "Current"
        : loan.daysDelinquent <= 30
        ? "1-30 Days"
        : loan.daysDelinquent <= 60
        ? "31-60 Days"
        : loan.daysDelinquent <= 90
        ? "61-90 Days"
        : "90+ Days";
    if (!riskByDelinquency[delBucket])
      riskByDelinquency[delBucket] = { count: 0, defaults: 0, rate: 0 };
    riskByDelinquency[delBucket].count++;
    if (loan.status === "DEFAULT") riskByDelinquency[delBucket].defaults++;
  });

  // Calculate rates
  const calculateRates = (data: Record<string, { count: number; defaults: number; rate: number }>) => {
    Object.values(data).forEach((v) => {
      v.rate = v.count > 0 ? (v.defaults / v.count) * 100 : 0;
    });
    return Object.entries(data).map(([key, val]) => ({ label: key, ...val }));
  };

  // Score active loans for default probability
  const activeLoans = loans.filter((l) =>
    ["FUNDED", "ACTIVE", "EXTENDED"].includes(l.status)
  );

  const scoredLoans = activeLoans.map((loan) => {
    let riskScore = 0;
    const factors: string[] = [];

    // LTV risk (higher LTV = higher risk)
    const ltv = Number(loan.ltv || 0);
    if (ltv > 90) { riskScore += 30; factors.push("Very high LTV (>90%)"); }
    else if (ltv > 80) { riskScore += 20; factors.push("High LTV (>80%)"); }
    else if (ltv > 70) { riskScore += 10; factors.push("Moderate LTV (>70%)"); }

    // Delinquency risk
    if (loan.daysDelinquent > 90) { riskScore += 40; factors.push("90+ days delinquent"); }
    else if (loan.daysDelinquent > 60) { riskScore += 30; factors.push("60+ days delinquent"); }
    else if (loan.daysDelinquent > 30) { riskScore += 20; factors.push("30+ days delinquent"); }
    else if (loan.daysDelinquent > 0) { riskScore += 10; factors.push("Currently delinquent"); }

    // Maturity risk
    if (loan.maturityDate) {
      const daysToMaturity = differenceInCalendarDays(loan.maturityDate, new Date());
      if (daysToMaturity < 0) { riskScore += 25; factors.push("Past maturity"); }
      else if (daysToMaturity < 30) { riskScore += 15; factors.push("Maturity within 30 days"); }
      else if (daysToMaturity < 60) { riskScore += 5; factors.push("Maturity within 60 days"); }
    }

    // Balance to loan amount ratio (loan not paying down)
    const balanceRatio = Number(loan.currentBalance) / Number(loan.loanAmount);
    if (balanceRatio > 1.05) { riskScore += 15; factors.push("Balance exceeds loan amount"); }

    // Cap at 100
    riskScore = Math.min(riskScore, 100);

    const riskLevel =
      riskScore >= 70 ? "HIGH" : riskScore >= 40 ? "MEDIUM" : riskScore >= 15 ? "LOW" : "MINIMAL";

    return {
      loanNumber: loan.loanNumber,
      borrower: `${loan.borrower.firstName} ${loan.borrower.lastName}`,
      type: loan.type,
      balance: Number(loan.currentBalance),
      ltv,
      daysDelinquent: loan.daysDelinquent,
      riskScore,
      riskLevel,
      defaultProbability: Math.min(riskScore * 0.8, 95), // Rough estimate
      factors,
    };
  });

  // Portfolio risk summary
  const totalAtRisk = scoredLoans.filter((l) => l.riskLevel === "HIGH").length;
  const totalExposure = scoredLoans
    .filter((l) => l.riskLevel === "HIGH")
    .reduce((s, l) => s + l.balance, 0);
  const avgRiskScore =
    scoredLoans.length > 0
      ? scoredLoans.reduce((s, l) => s + l.riskScore, 0) / scoredLoans.length
      : 0;

  return NextResponse.json({
    type: "default_probability",
    portfolioSummary: {
      totalLoans: totalLoans,
      historicalDefaultRate: defaultRate,
      activeLoans: activeLoans.length,
      highRiskLoans: totalAtRisk,
      highRiskExposure: totalExposure,
      avgRiskScore,
    },
    riskByLTV: calculateRates(riskByLTV),
    riskByType: calculateRates(riskByType),
    riskByDelinquency: calculateRates(riskByDelinquency),
    scoredLoans: scoredLoans.sort((a, b) => b.riskScore - a.riskScore),
  });
}, "view_reports");
