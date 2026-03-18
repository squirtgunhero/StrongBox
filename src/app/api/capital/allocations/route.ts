import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";

// POST /api/capital/allocations — allocate capital to a loan
export const POST = withAuth(async (request, ctx) => {
  const body = await request.json();
  const { loanId, capitalSourceId, amount, percentage } = body;

  if (!loanId || !capitalSourceId || !amount) {
    return NextResponse.json(
      { error: "loanId, capitalSourceId, and amount are required" },
      { status: 400 }
    );
  }

  const [loan, source] = await Promise.all([
    prisma.loan.findFirst({
      where: { id: loanId, organizationId: ctx.organizationId },
    }),
    prisma.capitalSource.findFirst({
      where: { id: capitalSourceId, organizationId: ctx.organizationId },
    }),
  ]);

  if (!loan) return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  if (!source) return NextResponse.json({ error: "Capital source not found" }, { status: 404 });

  // Check for existing allocation
  const existing = await prisma.capitalAllocation.findUnique({
    where: { loanId_capitalSourceId: { loanId, capitalSourceId } },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Allocation already exists for this loan/source pair" },
      { status: 409 }
    );
  }

  const parsedAmount = parseFloat(amount);

  const allocation = await prisma.capitalAllocation.create({
    data: {
      loanId,
      capitalSourceId,
      amount: parsedAmount,
      percentage: percentage ? parseFloat(percentage) : null,
      isActive: true,
      deployedAt: new Date(),
    },
    include: {
      loan: { select: { loanNumber: true } },
      capitalSource: { select: { name: true } },
    },
  });

  // Update capital source deployed amount
  await prisma.capitalSource.update({
    where: { id: capitalSourceId },
    data: { totalDeployed: { increment: parsedAmount } },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "CREATE",
    entityType: "CapitalAllocation",
    entityId: allocation.id,
    description: `Allocated $${parsedAmount.toLocaleString()} from ${source.name} to loan ${loan.loanNumber}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    after: { amount: parsedAmount, capitalSourceId, loanId } as any,
  });

  return NextResponse.json({ allocation }, { status: 201 });
}, "manage_capital");
