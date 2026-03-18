import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";
import { z } from "zod";

const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z
    .enum([
      "SUPER_ADMIN", "ADMIN", "LOAN_OFFICER", "PROCESSOR",
      "UNDERWRITER", "CLOSER", "ACCOUNTING", "BORROWER",
      "INVESTOR", "READ_ONLY",
    ])
    .optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const GET = withAuth(async (request, ctx) => {
  const id = request.nextUrl.pathname.split("/").pop()!;

  const user = await prisma.user.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      phone: true,
      avatarUrl: true,
      lastLoginAt: true,
      createdAt: true,
      settings: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}, "manage_users");

export const PATCH = withAuth(async (request, ctx) => {
  const id = request.nextUrl.pathname.split("/").pop()!;
  const body = await request.json();
  const parsed = updateUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });

  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: parsed.data as any,
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "UPDATE",
    entityType: "User",
    entityId: user.id,
    description: `Updated user ${user.firstName} ${user.lastName}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    before: existing as any,
    after: user as any,
  });

  return NextResponse.json({ user });
}, "manage_users");
