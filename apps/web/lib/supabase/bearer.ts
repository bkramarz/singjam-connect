import { createClient } from "@supabase/supabase-js";

// RLS-scoped client authenticated by a bearer access token instead of cookies.
// Used by API routes that the native app calls with `Authorization: Bearer <token>`.
export function supabaseFromBearer(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}
