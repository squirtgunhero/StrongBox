import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(async (request, ctx) => {
  const url = new URL(request.url);
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");
  const action = url.searchParams.get("action");
  const userId = url.searchParams.get("userId");
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "50");

  const where: Record<string, unknown> = {
    organizationId: ctx.organizationId,
  };

  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (action) where.action = action;
  if (userId) where.userId = userId;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    }),
    prisma.auditLog.count({ where: where as any }),
  ]);

  return NextResponse.json({ logs, total, page, limit });
}, "manage_users");
