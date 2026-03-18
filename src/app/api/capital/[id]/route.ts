import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";

// GET /api/capital/[id]
export const GET = withAuth(async (request, ctx) => {
  const id = request.nextUrl.pathname.split("/").pop()!;

  const source = await prisma.capitalSource.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      allocations: {
        include: {
          loan: {
            select: {
              id: true,
              loanNumber: true,
              status: true,
              loanAmount: true,
              borrower: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  if (!source) {
    return NextResponse.json({ error: "Capital source not found" }, { status: 404 });
  }

  return NextResponse.json({ capitalSource: source });
}, "manage_capital");

// PATCH /api/capital/[id]
export const PATCH = withAuth(async (request, ctx) => {
  const id = request.nextUrl.pathname.split("/").pop()!;
  const body = await request.json();

  const source = await prisma.capitalSource.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });

  if (!source) {
    return NextResponse.json({ error: "Capital source not found" }, { status: 404 });
  }

  const allowedFields = [
    "name",
    "creditLimit",
    "interestRate",
    "expirationDate",
    "bankName",
    "accountNumber",
    "preferredReturn",
    "contactId",
    "notes",
    "isActive",
  ];

  const updateData: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (["creditLimit", "interestRate", "preferredReturn"].includes(field)) {
        updateData[field] = body[field] !== null ? parseFloat(body[field]) : null;
      } else if (field === "expirationDate") {
        updateData[field] = body[field] ? new Date(body[field]) : null;
      } else {
        updateData[field] = body[field];
      }
    }
  }

  const updated = await prisma.capitalSource.update({
    where: { id },
    data: updateData,
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "UPDATE",
    entityType: "CapitalSource",
    entityId: id,
    description: `Updated capital source: ${source.name}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    before: source as any,
    after: updateData as any,
  });

  return NextResponse.json({ capitalSource: updated });
}, "manage_capital");

// DELETE /api/capital/[id]
export const DELETE = withAuth(async (request, ctx) => {
  const id = request.nextUrl.pathname.split("/").pop()!;

  const source = await prisma.capitalSource.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });

  if (!source) {
    return NextResponse.json({ error: "Capital source not found" }, { status: 404 });
  }

  // Check for active allocations
  const activeAllocations = await prisma.capitalAllocation.count({
    where: { capitalSourceId: id, isActive: true },
  });

  if (activeAllocations > 0) {
    return NextResponse.json(
      { error: "Cannot delete capital source with active allocations. Deactivate it instead." },
      { status: 409 }
    );
  }

  await prisma.capitalSource.delete({ where: { id } });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "DELETE",
    entityType: "CapitalSource",
    entityId: id,
    description: `Deleted capital source: ${source.name}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    before: { name: source.name, type: source.type } as any,
  });

  return NextResponse.json({ success: true });
}, "manage_capital");
