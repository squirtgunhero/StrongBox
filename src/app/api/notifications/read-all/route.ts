import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { markAllAsRead } from "@/lib/notifications/sender";

// POST /api/notifications/read-all — mark all notifications as read
export const POST = withAuth(async (request, ctx) => {
  await markAllAsRead(ctx.user.id);
  return NextResponse.json({ success: true });
});
