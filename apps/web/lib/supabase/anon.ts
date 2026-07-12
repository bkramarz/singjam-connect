import { createClient } from "@supabase/supabase-js";

// Cookie-free client for public reads in metadata/OG generation.
// Using supabaseServer() there would read cookies() and force the
// whole route into dynamic rendering, defeating ISR.
export function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
