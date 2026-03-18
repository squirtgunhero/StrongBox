import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";
import { sendNotification } from "@/lib/notifications/sender";

// GET /api/loans/[id]/conditions — list conditions for a loan
export const GET = withAuth(async (request, ctx) => {
  const segments = request.nextUrl.pathname.split("/");
  const loanId = segments[segments.length - 2]; // /api/loans/[id]/conditions

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, organizationId: ctx.organizationId },
  });

  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  const conditions = await prisma.loanCondition.findMany({
    where: { loanId },
    orderBy: [{ isCleared: "asc" }, { createdAt: "asc" }],
  });

  const summary = {
    total: conditions.length,
    cleared: conditions.filter((c) => c.isCleared).length,
    outstanding: conditions.filter((c) => !c.isCleared).length,
  };

  return NextResponse.json({ conditions, summary });
});

// POST /api/loans/[id]/conditions — add a condition
export const POST = withAuth(async (request, ctx) => {
  const segments = request.nextUrl.pathname.split("/");
  const loanId = segments[segments.length - 2];
  const body = await request.json();
  const { text, category, notes } = body;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "Condition text is required" }, { status: 400 });
  }

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, organizationId: ctx.organizationId },
  });

  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  const validCategories = [
    "Prior-to-approval",
    "Prior-to-closing",
    "Prior-to-funding",
  ];
  const condCategory = validCategories.includes(category) ? category : null;

  const condition = await prisma.loanCondition.create({
    data: {
      loanId,
      text: text.trim(),
      category: condCategory,
      notes: notes || null,
    },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "CREATE",
    entityType: "LoanCondition",
    entityId: condition.id,
    description: `Added condition to loan ${loan.loanNumber}: "${text}"`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    after: { text, category: condCategory, loanId } as any,
  });

  // Notify loan officer
  if (loan.loanOfficerId && loan.loanOfficerId !== ctx.user.id) {
    await sendNotification({
      userId: loan.loanOfficerId,
      type: "APPROVAL_NEEDED",
      title: "New Condition Added",
      message: `A new ${condCategory || ""} condition was added to ${loan.loanNumber}: "${text}"`,
      loanId,
      actionUrl: `/loans/${loanId}`,
    });
  }

  return NextResponse.json({ condition }, { status: 201 });
}, "edit_loans");
