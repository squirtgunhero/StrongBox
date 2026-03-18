import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { calculatePayoff, dailyRate } from "@/lib/loans/calculations";
import { differenceInCalendarDays } from "date-fns";
import Decimal from "decimal.js";

// GET /api/loans/[id]/payoff — calculate payoff quote
export const GET = withAuth(async (request, ctx) => {
  const segments = request.nextUrl.pathname.split("/");
  const id = segments[segments.length - 2]; // /api/loans/[id]/payoff
  const { searchParams } = request.nextUrl;
  const payoffDateStr = searchParams.get("payoffDate");
  const payoffDate = payoffDateStr ? new Date(payoffDateStr) : new Date();

  const loan = await prisma.loan.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });

  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  // Find the last paid payment to calculate accrued interest from
  const lastPayment = await prisma.payment.findFirst({
    where: { loanId: id, status: "PAID" },
    orderBy: { paidDate: "desc" },
    select: { paidDate: true },
  });

  const lastPaymentDate = lastPayment?.paidDate || loan.fundingDate || loan.createdAt;
  const daysSinceLastPayment = differenceInCalendarDays(payoffDate, lastPaymentDate);

  // Get outstanding fees (late charges from unpaid payments)
  const unpaidPayments = await prisma.payment.findMany({
    where: { loanId: id, status: { in: ["SCHEDULED", "PENDING", "LATE"] } },
    select: { lateCharge: true, feeAmount: true },
  });

  const outstandingFees = unpaidPayments.reduce(
    (sum, p) => sum + Number(p.feeAmount || 0),
    0
  );
  const lateCharges = unpaidPayments.reduce(
    (sum, p) => sum + Number(p.lateCharge || 0),
    0
  );

  const currentBalance = new Decimal(loan.currentBalance.toString() || loan.loanAmount.toString());
  const annualRate = new Decimal(loan.interestRate.toString());
  const perDiem = currentBalance.mul(dailyRate(annualRate)).toDecimalPlaces(2);

  const payoffAmount = calculatePayoff({
    currentBalance,
    annualRate,
    daysSinceLastPayment: Math.max(0, daysSinceLastPayment),
    outstandingFees: new Decimal(outstandingFees),
    lateCharges: new Decimal(lateCharges),
    processingFee: new Decimal(0),
    escrowCredits: new Decimal(0),
  });

  const accruedInterest = currentBalance
    .mul(dailyRate(annualRate))
    .mul(Math.max(0, daysSinceLastPayment))
    .toDecimalPlaces(2);

  return NextResponse.json({
    payoff: {
      payoffDate: payoffDate.toISOString(),
      currentBalance: currentBalance.toNumber(),
      accruedInterest: accruedInterest.toNumber(),
      daysSinceLastPayment: Math.max(0, daysSinceLastPayment),
      perDiem: perDiem.toNumber(),
      outstandingFees,
      lateCharges,
      processingFee: 0,
      escrowCredits: 0,
      totalPayoff: payoffAmount.toNumber(),
      goodThrough: payoffDate.toISOString(),
    },
  });
}, "view_payments");
