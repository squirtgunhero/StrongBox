import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { markAsRead } from "@/lib/notifications/sender";

// PATCH /api/notifications/[id]/read — mark a notification as read
export const PATCH = withAuth(async (request, ctx) => {
  const segments = request.nextUrl.pathname.split("/");
  const id = segments[segments.length - 2]; // /api/notifications/[id]/read

  try {
    const notification = await markAsRead(id);
    return NextResponse.json({ notification });
  } catch {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }
});
