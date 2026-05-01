import { createClient } from "@supabase/supabase-js";

// Cookie-free anon client for public, cacheable server-side reads.
// Do not use for auth-gated queries.
export function supabasePublic() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
