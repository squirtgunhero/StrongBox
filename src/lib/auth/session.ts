import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

export interface SessionUser {
  authUser: { id: string; email: string };
  dbUser: User;
}

/**
 * Get the currently authenticated user with their database profile.
 * Returns null if not authenticated or no DB user record exists.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.email) return null;

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: authUser.id },
  });

  if (!dbUser) return null;

  return {
    authUser: { id: authUser.id, email: authUser.email },
    dbUser,
  };
}

/**
 * Require authentication — throws redirect if not authenticated.
 */
export async function requireAuth(): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session) {
    const { redirect } = await import("next/navigation");
    redirect("/login") as never;
  }
  return session as SessionUser;
}
