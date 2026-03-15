import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// NOTE: This is a lightweight server client. For full SSR auth with cookies,
// we’d typically use @supabase/ssr. For MVP, we keep it simple.
export async function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, { auth: { persistSession: false } });
}

export async function getSessionServer() {
  // With the lightweight client above, we can’t read session from cookies reliably.
  // For now: treat session as unknown on server; pages that require auth will still
  // work client-side after redirect from magic link.
  // If you want true SSR auth, we’ll switch to @supabase/ssr.
  return null as any;
}
