import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";
import { sendNotification } from "@/lib/notifications/sender";
import { DrawStatus } from "@prisma/client";

// GET /api/draws — list draws with filters
export const GET = withAuth(async (request, ctx) => {
  const { searchParams } = request.nextUrl;
  const loanId = searchParams.get("loanId");
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    loan: { organizationId: ctx.organizationId },
  };

  if (loanId) where.loanId = loanId;
  if (status && Object.values(DrawStatus).includes(status as DrawStatus)) {
    where.status = status;
  }

  const [draws, total] = await Promise.all([
    prisma.draw.findMany({
      where: where as any,
      orderBy: [{ createdAt: "desc" }],
      skip,
      take: limit,
      include: {
        loan: {
          select: {
            id: true,
            loanNumber: true,
            rehabBudget: true,
            borrower: { select: { firstName: true, lastName: true } },
          },
        },
        documents: { select: { id: true, fileName: true, fileType: true } },
      },
    }),
    prisma.draw.count({ where: where as any }),
  ]);

  return NextResponse.json({
    draws,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

// POST /api/draws — create a draw request
export const POST = withAuth(async (request, ctx) => {
  const body = await request.json();
  const {
    loanId,
    amountRequested,
    workCompleted,
    percentComplete,
    remainingTimeline,
  } = body;

  if (!loanId || !amountRequested) {
    return NextResponse.json(
      { error: "loanId and amountRequested are required" },
      { status: 400 }
    );
  }

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, organizationId: ctx.organizationId },
  });

  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  // Get the next draw number
  const lastDraw = await prisma.draw.findFirst({
    where: { loanId },
    orderBy: { drawNumber: "desc" },
    select: { drawNumber: true },
  });
  const drawNumber = (lastDraw?.drawNumber || 0) + 1;

  // Calculate remaining budget
  const totalApproved = await prisma.draw.aggregate({
    where: { loanId, status: { in: ["APPROVED", "FUNDED"] } },
    _sum: { amountApproved: true },
  });
  const totalUsed = Number(totalApproved._sum.amountApproved || 0);
  const rehabBudget = Number(loan.rehabBudget || 0);
  const remainingBudget = rehabBudget - totalUsed;

  const draw = await prisma.draw.create({
    data: {
      loanId,
      drawNumber,
      amountRequested: parseFloat(amountRequested),
      status: "SUBMITTED",
      workCompleted,
      percentComplete: percentComplete ? parseFloat(percentComplete) : null,
      remainingBudget,
      remainingTimeline,
      submittedAt: new Date(),
    },
    include: {
      loan: { select: { id: true, loanNumber: true } },
    },
  });

  // Notify admins
  const admins = await prisma.user.findMany({
    where: {
      organizationId: ctx.organizationId,
      role: { in: ["SUPER_ADMIN", "ADMIN"] },
      isActive: true,
    },
    select: { id: true },
  });

  for (const admin of admins) {
    await sendNotification({
      userId: admin.id,
      type: "DRAW_SUBMITTED",
      title: "New Draw Request",
      message: `Draw #${drawNumber} for $${parseFloat(amountRequested).toLocaleString()} on loan ${loan.loanNumber}`,
      loanId,
      actionUrl: `/loans/${loanId}`,
    });
  }

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "CREATE",
    entityType: "Draw",
    entityId: draw.id,
    description: `Submitted draw #${drawNumber} for $${parseFloat(amountRequested).toLocaleString()} on loan ${loan.loanNumber}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    after: { drawNumber, amountRequested, status: "SUBMITTED" } as any,
  });

  return NextResponse.json({ draw }, { status: 201 });
});
