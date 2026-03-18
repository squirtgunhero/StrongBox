import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";
import { CapitalSourceType } from "@prisma/client";

// GET /api/capital — list capital sources with portfolio totals
export const GET = withAuth(async (request, ctx) => {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type");
  const includeAllocations = searchParams.get("includeAllocations") === "true";

  const where: Record<string, unknown> = {
    organizationId: ctx.organizationId,
  };

  if (type && Object.values(CapitalSourceType).includes(type as CapitalSourceType)) {
    where.type = type;
  }

  const capitalSources = await prisma.capitalSource.findMany({
    where: where as any,
    orderBy: { name: "asc" },
    include: includeAllocations
      ? {
          allocations: {
            where: { isActive: true },
            include: {
              loan: {
                select: { id: true, loanNumber: true, status: true, loanAmount: true },
              },
            },
          },
        }
      : undefined,
  });

  const totals = capitalSources.reduce(
    (acc, cs) => ({
      totalLimit: acc.totalLimit + Number(cs.creditLimit || 0),
      totalDeployed: acc.totalDeployed + Number(cs.totalDeployed || 0),
      totalAvailable:
        acc.totalAvailable +
        (Number(cs.creditLimit || 0) - Number(cs.totalDeployed || 0)),
    }),
    { totalLimit: 0, totalDeployed: 0, totalAvailable: 0 }
  );

  return NextResponse.json({ capitalSources, totals });
}, "manage_capital");

// POST /api/capital — create a capital source
export const POST = withAuth(async (request, ctx) => {
  const body = await request.json();
  const {
    name,
    type,
    creditLimit,
    interestRate,
    expirationDate,
    bankName,
    accountNumber,
    preferredReturn,
    contactId,
    notes,
  } = body;

  if (!name || !type) {
    return NextResponse.json(
      { error: "Name and type are required" },
      { status: 400 }
    );
  }

  if (!Object.values(CapitalSourceType).includes(type as CapitalSourceType)) {
    return NextResponse.json({ error: "Invalid capital source type" }, { status: 400 });
  }

  const source = await prisma.capitalSource.create({
    data: {
      organizationId: ctx.organizationId,
      name,
      type: type as CapitalSourceType,
      creditLimit: creditLimit ? parseFloat(creditLimit) : null,
      interestRate: interestRate ? parseFloat(interestRate) : null,
      expirationDate: expirationDate ? new Date(expirationDate) : null,
      bankName,
      accountNumber,
      preferredReturn: preferredReturn ? parseFloat(preferredReturn) : null,
      contactId: contactId || null,
      notes,
      currentBalance: 0,
      totalCommitted: 0,
      totalDeployed: 0,
    },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "CREATE",
    entityType: "CapitalSource",
    entityId: source.id,
    description: `Created capital source: ${name} (${type})`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    after: { name, type, creditLimit } as any,
  });

  return NextResponse.json({ capitalSource: source }, { status: 201 });
}, "manage_capital");
