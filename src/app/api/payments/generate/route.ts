import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";
import { generateIOSchedule } from "@/lib/payments/schedule";
import Decimal from "decimal.js";

// POST /api/payments/generate — generate payment schedule for a loan
export const POST = withAuth(async (request, ctx) => {
  const body = await request.json();
  const { loanId, firstPaymentDate } = body;

  if (!loanId) {
    return NextResponse.json({ error: "loanId is required" }, { status: 400 });
  }

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, organizationId: ctx.organizationId },
  });

  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  // Check if payments already exist
  const existingCount = await prisma.payment.count({ where: { loanId } });
  if (existingCount > 0) {
    return NextResponse.json(
      { error: "Payment schedule already exists. Delete existing payments first." },
      { status: 409 }
    );
  }

  const startDate = firstPaymentDate
    ? new Date(firstPaymentDate)
    : loan.firstPaymentDate || new Date();

  const schedule = generateIOSchedule({
    loanAmount: new Decimal(loan.loanAmount.toString()),
    annualRate: new Decimal(loan.interestRate.toString()),
    termMonths: loan.termMonths,
    firstPaymentDate: startDate,
  });

  // Bulk create payment records
  const payments = await prisma.$transaction(
    schedule.map((p) =>
      prisma.payment.create({
        data: {
          loanId,
          amount: p.amount.toNumber(),
          principalAmount: p.principalAmount.toNumber(),
          interestAmount: p.interestAmount.toNumber(),
          dueDate: p.dueDate,
          status: "SCHEDULED",
        },
      })
    )
  );

  // Update loan with first payment and next payment dates
  await prisma.loan.update({
    where: { id: loanId },
    data: {
      firstPaymentDate: startDate,
      nextPaymentDue: startDate,
      currentBalance: loan.loanAmount,
    },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "GENERATE_SCHEDULE",
    entityType: "Payment",
    entityId: loanId,
    description: `Generated ${payments.length}-month IO payment schedule for loan ${loan.loanNumber}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    after: { paymentCount: payments.length, firstPaymentDate: startDate.toISOString() } as any,
  });

  return NextResponse.json({ payments, count: payments.length }, { status: 201 });
}, "record_payments");
