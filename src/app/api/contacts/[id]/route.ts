import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";
import { contactSchema } from "@/lib/utils/validators";

export const GET = withAuth(async (request, ctx) => {
  const id = request.nextUrl.pathname.split("/").pop()!;

  const contact = await prisma.contact.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      loans: {
        select: {
          id: true,
          loanNumber: true,
          status: true,
          loanAmount: true,
          type: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      guaranteedLoans: {
        select: {
          id: true,
          loanNumber: true,
          status: true,
          loanAmount: true,
        },
      },
      documents: {
        select: {
          id: true,
          fileName: true,
          category: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      communications: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  return NextResponse.json({ contact });
});

export const PATCH = withAuth(async (request, ctx) => {
  const id = request.nextUrl.pathname.split("/").pop()!;
  const body = await request.json();
  const parsed = contactSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.contact.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const contact = await prisma.contact.update({
    where: { id },
    data: parsed.data,
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "UPDATE",
    entityType: "Contact",
    entityId: contact.id,
    description: `Updated contact ${contact.firstName} ${contact.lastName}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    before: existing as any,
    after: contact as any,
  });

  return NextResponse.json({ contact });
});

export const DELETE = withAuth(async (request, ctx) => {
  const id = request.nextUrl.pathname.split("/").pop()!;

  const existing = await prisma.contact.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: { _count: { select: { loans: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  if (existing._count.loans > 0) {
    return NextResponse.json(
      { error: "Cannot delete a contact with active loans. Deactivate instead." },
      { status: 400 }
    );
  }

  await prisma.contact.update({
    where: { id },
    data: { isActive: false },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "DELETE",
    entityType: "Contact",
    entityId: id,
    description: `Deactivated contact ${existing.firstName} ${existing.lastName}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
  });

  return NextResponse.json({ success: true });
}, "manage_users");
