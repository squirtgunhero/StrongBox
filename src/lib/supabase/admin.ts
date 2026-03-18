import { createClient } from "@supabase/supabase-js";

// Service role client — use only in server-side code.
// This bypasses RLS policies.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
