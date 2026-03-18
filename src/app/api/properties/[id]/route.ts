import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";
import { propertySchema } from "@/lib/utils/validators";

export const GET = withAuth(async (request, ctx) => {
  const id = request.nextUrl.pathname.split("/").pop()!;

  const property = await prisma.property.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      loan: {
        select: {
          id: true,
          loanNumber: true,
          status: true,
          loanAmount: true,
          interestRate: true,
          termMonths: true,
          borrower: {
            select: { id: true, firstName: true, lastName: true, companyName: true },
          },
        },
      },
      documents: {
        select: { id: true, fileName: true, category: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  return NextResponse.json({ property });
}, "view_all_loans");

export const PATCH = withAuth(async (request, ctx) => {
  const id = request.nextUrl.pathname.split("/").pop()!;
  const body = await request.json();
  const parsed = propertySchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.property.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const property = await prisma.property.update({
    where: { id },
    data: parsed.data as any,
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "UPDATE",
    entityType: "Property",
    entityId: property.id,
    description: `Updated property ${property.address}, ${property.city} ${property.state}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    before: existing as any,
    after: property as any,
  });

  return NextResponse.json({ property });
}, "create_loans");
