import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";
import { sendNotification } from "@/lib/notifications/sender";
import { PaymentStatus } from "@prisma/client";

// GET /api/payments — list payments with filters
export const GET = withAuth(async (request, ctx) => {
  const { searchParams } = request.nextUrl;
  const loanId = searchParams.get("loanId");
  const status = searchParams.get("status");
  const overdue = searchParams.get("overdue");
  const upcoming = searchParams.get("upcoming"); // days
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    loan: { organizationId: ctx.organizationId },
  };

  if (loanId) where.loanId = loanId;
  if (status && Object.values(PaymentStatus).includes(status as PaymentStatus)) {
    where.status = status;
  }

  if (overdue === "true") {
    where.dueDate = { lt: new Date() };
    where.status = { in: ["SCHEDULED", "PENDING"] };
  }

  if (upcoming) {
    const days = parseInt(upcoming);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    where.dueDate = { gte: new Date(), lte: futureDate };
    where.status = { in: ["SCHEDULED", "PENDING"] };
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: where as any,
      orderBy: { dueDate: "asc" },
      skip,
      take: limit,
      include: {
        loan: {
          select: {
            id: true,
            loanNumber: true,
            borrower: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.payment.count({ where: where as any }),
  ]);

  // Summary stats
  const [overdueCount, upcomingCount, paidThisMonth] = await Promise.all([
    prisma.payment.count({
      where: {
        loan: { organizationId: ctx.organizationId },
        dueDate: { lt: new Date() },
        status: { in: ["SCHEDULED", "PENDING"] },
      },
    }),
    prisma.payment.count({
      where: {
        loan: { organizationId: ctx.organizationId },
        dueDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 30 * 86400000),
        },
        status: { in: ["SCHEDULED", "PENDING"] },
      },
    }),
    prisma.payment.count({
      where: {
        loan: { organizationId: ctx.organizationId },
        status: "PAID",
        paidDate: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
  ]);

  return NextResponse.json({
    payments,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    summary: { overdueCount, upcomingCount, paidThisMonth },
  });
}, "view_payments");

// POST /api/payments — record a payment
export const POST = withAuth(async (request, ctx) => {
  const body = await request.json();
  const {
    loanId,
    paymentId,
    amount,
    paymentMethod,
    referenceNumber,
    checkNumber,
    paidDate,
    notes,
    isNSF,
  } = body;

  if (!loanId || !amount) {
    return NextResponse.json(
      { error: "loanId and amount are required" },
      { status: 400 }
    );
  }

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, organizationId: ctx.organizationId },
    include: {
      borrower: { select: { id: true, firstName: true, lastName: true, nsfCount: true } },
    },
  });

  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  // If recording against an existing scheduled payment
  if (paymentId) {
    const existing = await prisma.payment.findFirst({
      where: { id: paymentId, loanId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Payment record not found" },
        { status: 404 }
      );
    }

    if (isNSF) {
      // Handle NSF
      const nsfFee = parseFloat(body.nsfFee || "50");
      const updated = await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: "NSF",
          isNSF: true,
          nsfDate: new Date(),
          nsfFee,
          paidDate: paidDate ? new Date(paidDate) : new Date(),
          paymentMethod,
          referenceNumber,
          notes,
        },
      });

      // Update borrower naughty metrics
      await prisma.contact.update({
        where: { id: loan.borrowerId },
        data: {
          nsfCount: { increment: 1 },
          naughtyLevel: { increment: 10 },
        },
      });

      // Update loan fee balance
      await prisma.loan.update({
        where: { id: loanId },
        data: { totalFeesPaid: { increment: nsfFee } },
      });

      await writeAuditLog({
        organizationId: ctx.organizationId,
        action: "NSF",
        entityType: "Payment",
        entityId: paymentId,
        description: `NSF on loan ${loan.loanNumber} — $${parsedAmount}`,
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        after: { status: "NSF", nsfFee, amount: parsedAmount } as any,
      });

      return NextResponse.json({ payment: updated });
    }

    // Normal payment recording
    const isPaidInFull = parsedAmount >= Number(existing.amount);
    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: isPaidInFull ? "PAID" : "PARTIAL",
        amount: parsedAmount,
        interestAmount: parsedAmount, // IO loans: entire payment is interest
        paidDate: paidDate ? new Date(paidDate) : new Date(),
        postedDate: new Date(),
        paymentMethod,
        referenceNumber,
        checkNumber,
        notes,
      },
    });

    // Update loan totals
    await prisma.loan.update({
      where: { id: loanId },
      data: {
        totalInterestPaid: { increment: parsedAmount },
        daysDelinquent: 0,
      },
    });

    await writeAuditLog({
      organizationId: ctx.organizationId,
      action: "RECORD_PAYMENT",
      entityType: "Payment",
      entityId: paymentId,
      description: `Recorded payment of $${parsedAmount.toFixed(2)} on loan ${loan.loanNumber}`,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      after: { status: updated.status, amount: parsedAmount, paymentMethod } as any,
    });

    return NextResponse.json({ payment: updated });
  }

  // Create a new ad-hoc payment (not against a scheduled payment)
  const payment = await prisma.payment.create({
    data: {
      loanId,
      amount: parsedAmount,
      principalAmount: 0,
      interestAmount: parsedAmount,
      dueDate: paidDate ? new Date(paidDate) : new Date(),
      paidDate: paidDate ? new Date(paidDate) : new Date(),
      postedDate: new Date(),
      status: "PAID",
      paymentMethod,
      referenceNumber,
      checkNumber,
      notes,
    },
  });

  await prisma.loan.update({
    where: { id: loanId },
    data: { totalInterestPaid: { increment: parsedAmount } },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "RECORD_PAYMENT",
    entityType: "Payment",
    entityId: payment.id,
    description: `Recorded ad-hoc payment of $${parsedAmount.toFixed(2)} on loan ${loan.loanNumber}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    after: { amount: parsedAmount, paymentMethod } as any,
  });

  return NextResponse.json({ payment }, { status: 201 });
}, "record_payments");
