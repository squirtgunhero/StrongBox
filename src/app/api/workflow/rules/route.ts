import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

// GET /api/workflow/rules — list workflow rules
export const GET = withAuth(async (request, ctx) => {
  const rules = await prisma.workflowRule.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ rules });
}, "manage_org_settings");

// POST /api/workflow/rules — create a new workflow rule
export const POST = withAuth(async (request, ctx) => {
  const body = await request.json();
  const { name, description, triggerEntity, triggerEvent, conditions, actions } = body;

  if (!name || !triggerEntity || !triggerEvent) {
    return NextResponse.json(
      { error: "name, triggerEntity, and triggerEvent are required" },
      { status: 400 }
    );
  }

  const validEntities = ["loan", "payment", "draw", "document", "contact"];
  if (!validEntities.includes(triggerEntity)) {
    return NextResponse.json({ error: `Invalid triggerEntity. Must be one of: ${validEntities.join(", ")}` }, { status: 400 });
  }

  const rule = await prisma.workflowRule.create({
    data: {
      organizationId: ctx.organizationId,
      name,
      description: description || null,
      triggerEntity,
      triggerEvent,
      conditions: conditions || {},
      actions: actions || [],
    },
  });

  return NextResponse.json({ rule }, { status: 201 });
}, "manage_org_settings");
