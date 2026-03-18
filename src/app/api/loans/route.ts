import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";
import { generateLoanNumber } from "@/lib/loans/loanNumber";
import { loanCreateSchema } from "@/lib/utils/validators";
import Decimal from "decimal.js";

export const GET = withAuth(async (request, ctx) => {
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status");
  const loanOfficerId = url.searchParams.get("loanOfficerId");
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const sortBy = url.searchParams.get("sortBy") || "createdAt";
  const sortOrder = url.searchParams.get("sortOrder") || "desc";

  const where: Record<string, unknown> = {
    organizationId: ctx.organizationId,
  };

  if (search) {
    where.OR = [
      { loanNumber: { contains: search, mode: "insensitive" } },
      { borrower: { firstName: { contains: search, mode: "insensitive" } } },
      { borrower: { lastName: { contains: search, mode: "insensitive" } } },
      { property: { address: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (status) {
    const statuses = status.split(",");
    where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
  }

  if (loanOfficerId) where.loanOfficerId = loanOfficerId;

  const [loans, total] = await Promise.all([
    prisma.loan.findMany({
      where: where as any,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        borrower: {
          select: { id: true, firstName: true, lastName: true, companyName: true },
        },
        property: {
          select: { id: true, address: true, city: true, state: true },
        },
        loanOfficer: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    }),
    prisma.loan.count({ where: where as any }),
  ]);

  return NextResponse.json({ loans, total, page, limit });
}, "view_all_loans");

export const POST = withAuth(async (request, ctx) => {
  const body = await request.json();
  const parsed = loanCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { borrowerId, type, loanAmount, interestRate, termMonths, ...rest } =
    parsed.data;

  // Verify borrower belongs to this org
  const borrower = await prisma.contact.findFirst({
    where: { id: borrowerId, organizationId: ctx.organizationId },
  });

  if (!borrower) {
    return NextResponse.json(
      { error: "Borrower not found" },
      { status: 404 }
    );
  }

  const loanNumber = await generateLoanNumber(ctx.organizationId);

  // Create property if provided
  let propertyId: string | undefined;
  if (body.property) {
    const property = await prisma.property.create({
      data: {
        organizationId: ctx.organizationId,
        address: body.property.address,
        city: body.property.city,
        state: body.property.state,
        zip: body.property.zip,
        propertyType: body.property.propertyType || "SFR",
        yearBuilt: body.property.yearBuilt,
        squareFeet: body.property.squareFeet,
        bedrooms: body.property.bedrooms,
        bathrooms: body.property.bathrooms,
      },
    });
    propertyId = property.id;
  }

  const loan = await prisma.loan.create({
    data: {
      organizationId: ctx.organizationId,
      loanNumber,
      borrowerId,
      loanOfficerId: ctx.user.id,
      type: type as any,
      loanAmount: new Decimal(loanAmount),
      interestRate: new Decimal(interestRate),
      termMonths,
      purchasePrice: rest.purchasePrice
        ? new Decimal(rest.purchasePrice)
        : undefined,
      rehabBudget: rest.rehabBudget
        ? new Decimal(rest.rehabBudget)
        : undefined,
      exitStrategy: rest.exitStrategy as any,
      propertyId,
      status: "LEAD",
    },
    include: {
      borrower: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  // Create initial status history entry
  await prisma.loanStatusHistory.create({
    data: {
      loanId: loan.id,
      toStatus: "LEAD",
      changedById: ctx.user.id,
      reason: "Loan created",
    },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "CREATE",
    entityType: "Loan",
    entityId: loan.id,
    description: `Created loan ${loanNumber} for ${loan.borrower.firstName} ${loan.borrower.lastName}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
  });

  return NextResponse.json({ loan }, { status: 201 });
}, "create_loans");
