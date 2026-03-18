import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

// GET /api/notifications — list notifications for current user
export const GET = withAuth(async (request, ctx) => {
  const { searchParams } = request.nextUrl;
  const unreadOnly = searchParams.get("unreadOnly") === "true";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "30");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    userId: ctx.user.id,
  };

  if (unreadOnly) {
    where.isRead = false;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where: where as any }),
    prisma.notification.count({
      where: { userId: ctx.user.id, isRead: false },
    }),
  ]);

  return NextResponse.json({
    notifications,
    total,
    unreadCount,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});
