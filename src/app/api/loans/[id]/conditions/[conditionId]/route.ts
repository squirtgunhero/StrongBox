import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";

// PATCH /api/loans/[id]/conditions/[conditionId] — clear or waive a condition
export const PATCH = withAuth(async (request, ctx) => {
  const segments = request.nextUrl.pathname.split("/");
  const conditionId = segments[segments.length - 1];
  const loanId = segments[segments.length - 3];
  const body = await request.json();

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, organizationId: ctx.organizationId },
  });

  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  const condition = await prisma.loanCondition.findFirst({
    where: { id: conditionId, loanId },
  });

  if (!condition) {
    return NextResponse.json({ error: "Condition not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.isCleared !== undefined) {
    updateData.isCleared = body.isCleared;
    if (body.isCleared) {
      updateData.clearedById = ctx.user.id;
      updateData.clearedAt = new Date();
    } else {
      updateData.clearedById = null;
      updateData.clearedAt = null;
    }
  }

  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.text !== undefined) updateData.text = body.text;
  if (body.category !== undefined) updateData.category = body.category;

  const updated = await prisma.loanCondition.update({
    where: { id: conditionId },
    data: updateData,
  });

  const action = body.isCleared ? "Cleared" : "Updated";
  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "UPDATE",
    entityType: "LoanCondition",
    entityId: conditionId,
    description: `${action} condition on loan ${loan.loanNumber}: "${condition.text}"`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    before: { isCleared: condition.isCleared, notes: condition.notes } as any,
    after: updateData as any,
  });

  return NextResponse.json({ condition: updated });
}, "edit_loans");

// DELETE /api/loans/[id]/conditions/[conditionId]
export const DELETE = withAuth(async (request, ctx) => {
  const segments = request.nextUrl.pathname.split("/");
  const conditionId = segments[segments.length - 1];
  const loanId = segments[segments.length - 3];

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, organizationId: ctx.organizationId },
  });

  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  const condition = await prisma.loanCondition.findFirst({
    where: { id: conditionId, loanId },
  });

  if (!condition) {
    return NextResponse.json({ error: "Condition not found" }, { status: 404 });
  }

  await prisma.loanCondition.delete({ where: { id: conditionId } });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "DELETE",
    entityType: "LoanCondition",
    entityId: conditionId,
    description: `Removed condition from loan ${loan.loanNumber}: "${condition.text}"`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    before: { text: condition.text, category: condition.category } as any,
  });

  return NextResponse.json({ success: true });
}, "edit_loans");
