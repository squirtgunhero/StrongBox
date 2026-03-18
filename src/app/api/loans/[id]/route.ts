import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";

export const GET = withAuth(async (request, ctx) => {
  const id = request.nextUrl.pathname.split("/").pop()!;

  const loan = await prisma.loan.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      borrower: true,
      guarantor: true,
      loanOfficer: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      processor: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      underwriter: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      property: true,
      draws: { orderBy: { drawNumber: "asc" } },
      payments: { orderBy: { dueDate: "asc" } },
      documents: { orderBy: { createdAt: "desc" } },
      tasks: { orderBy: { createdAt: "desc" } },
      capitalAllocations: {
        include: { capitalSource: { select: { id: true, name: true, type: true } } },
      },
      loanConditions: { orderBy: { createdAt: "asc" } },
      statusHistory: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  return NextResponse.json({ loan });
}, "view_all_loans");

export const PATCH = withAuth(async (request, ctx) => {
  const id = request.nextUrl.pathname.split("/").pop()!;
  const body = await request.json();

  const existing = await prisma.loan.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  // Remove fields that shouldn't be directly updated
  const { id: _id, organizationId: _orgId, loanNumber: _ln, ...updateData } = body;

  const loan = await prisma.loan.update({
    where: { id },
    data: updateData,
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "UPDATE",
    entityType: "Loan",
    entityId: loan.id,
    description: `Updated loan ${loan.loanNumber}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    before: existing as any,
    after: loan as any,
  });

  return NextResponse.json({ loan });
}, "edit_loans");
