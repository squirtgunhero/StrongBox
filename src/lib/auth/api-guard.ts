import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { hasPermission, type Permission } from "./roles";
import type { User } from "@prisma/client";

interface AuthContext {
  authUserId: string;
  user: User;
  organizationId: string;
}

type ApiHandler = (
  request: NextRequest,
  context: AuthContext
) => Promise<NextResponse>;

/**
 * Wraps an API route handler with authentication and optional permission checks.
 */
export function withAuth(handler: ApiHandler, requiredPermission?: Permission) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseAuthId: authUser.id },
    });

    if (!dbUser || !dbUser.isActive) {
      return NextResponse.json(
        { error: "User not found or inactive" },
        { status: 403 }
      );
    }

    if (requiredPermission && !hasPermission(dbUser.role, requiredPermission)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    return handler(request, {
      authUserId: authUser.id,
      user: dbUser,
      organizationId: dbUser.organizationId,
    });
  };
}
