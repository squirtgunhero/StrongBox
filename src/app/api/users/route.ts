import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit/logger";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum([
    "SUPER_ADMIN", "ADMIN", "LOAN_OFFICER", "PROCESSOR",
    "UNDERWRITER", "CLOSER", "ACCOUNTING", "BORROWER",
    "INVESTOR", "READ_ONLY",
  ]),
  phone: z.string().optional(),
});

export const GET = withAuth(async (_request, ctx) => {
  const users = await prisma.user.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { lastName: "asc" },
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
    },
  });

  return NextResponse.json({ users });
}, "manage_users");

export const POST = withAuth(async (request, ctx) => {
  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, firstName, lastName, role, phone } = parsed.data;

  // Check if user already exists in this org
  const existing = await prisma.user.findFirst({
    where: { organizationId: ctx.organizationId, email },
  });

  if (existing) {
    return NextResponse.json(
      { error: "A user with this email already exists" },
      { status: 409 }
    );
  }

  // Create Supabase auth user with a random password (they'll use magic link or reset)
  const tempPassword = crypto.randomUUID();
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message || "Failed to create auth user" },
      { status: 500 }
    );
  }

  // Create DB user
  const user = await prisma.user.create({
    data: {
      organizationId: ctx.organizationId,
      supabaseAuthId: authData.user.id,
      email,
      firstName,
      lastName,
      role: role as any,
      phone,
    },
  });

  // Send password reset email so the user can set their password
  await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "CREATE",
    entityType: "User",
    entityId: user.id,
    description: `Created user ${firstName} ${lastName} (${email}) with role ${role}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
  });

  return NextResponse.json({ user }, { status: 201 });
}, "manage_users");
