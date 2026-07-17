import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

type SupabaseServer = Awaited<ReturnType<typeof supabaseServer>>;

type AuthSuccess = { ok: true; supabase: SupabaseServer; user: User; role?: string };
type AuthFailure = { ok: false; response: NextResponse };

export async function requireRole(
  ...roles: string[]
): Promise<AuthSuccess | AuthFailure> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !roles.includes(profile.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, supabase, user, role: profile.role };
}

export async function requireAuth(): Promise<AuthSuccess | AuthFailure> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true, supabase, user };
}

export function requireAdmin() {
  return requireRole("admin");
}
