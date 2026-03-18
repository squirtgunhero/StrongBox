import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

// GET /api/workflow/rules/[id]
export const GET = withAuth(async (request, ctx) => {
  const id = request.nextUrl.pathname.split("/").pop()!;

  const rule = await prisma.workflowRule.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });

  if (!rule) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  return NextResponse.json({ rule });
}, "manage_org_settings");

// PATCH /api/workflow/rules/[id]
export const PATCH = withAuth(async (request, ctx) => {
  const id = request.nextUrl.pathname.split("/").pop()!;
  const body = await request.json();

  const existing = await prisma.workflowRule.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  const allowedFields = ["name", "description", "isActive", "triggerEntity", "triggerEvent", "conditions", "actions"];
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  const rule = await prisma.workflowRule.update({
    where: { id },
    data: updates,
  });

  return NextResponse.json({ rule });
}, "manage_org_settings");

// DELETE /api/workflow/rules/[id]
export const DELETE = withAuth(async (request, ctx) => {
  const id = request.nextUrl.pathname.split("/").pop()!;

  const existing = await prisma.workflowRule.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  await prisma.workflowRule.delete({ where: { id } });

  return NextResponse.json({ success: true });
}, "manage_org_settings");
