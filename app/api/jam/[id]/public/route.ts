import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Returns private jam data to unauthenticated users who hold a valid invite token.
// All fetches use the admin client to bypass RLS — only called after token validation.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jamId } = await params;
  const token = new URL(req.url).searchParams.get("invite");
  if (!token) return NextResponse.json({ error: "Missing invite token" }, { status: 400 });

  const admin = supabaseAdmin();

  const { data: invite } = await admin
    .from("jam_invites")
    .select("id")
    .eq("jam_id", jamId)
    .eq("token", token)
    .maybeSingle();
  if (!invite) return NextResponse.json({ error: "Invalid invite token" }, { status: 403 });

  const [jamRes, genresRes, themesRes, countRes, flagRes] = await Promise.all([
    admin
      .from("jams")
      .select("id, name, visibility, starts_at, ends_at, neighborhood, full_address, notes, tickets_url, image_url, image_focal_point, capacity, host_user_id, guests_can_invite")
      .eq("id", jamId)
      .maybeSingle(),
    admin.from("jam_genres").select("genres(name)").eq("jam_id", jamId),
    admin.from("jam_themes").select("themes(name)").eq("jam_id", jamId),
    admin.from("jam_rsvps").select("id", { count: "exact", head: true }).eq("jam_id", jamId).eq("status", "attending"),
    admin.from("feature_flags").select("enabled").eq("key", "jam_invites").maybeSingle(),
  ]);

  if (!jamRes.data) return NextResponse.json({ error: "Jam not found" }, { status: 404 });

  const hostRes = await admin
    .from("profiles")
    .select("display_name, username")
    .eq("id", jamRes.data.host_user_id)
    .maybeSingle();

  return NextResponse.json({
    jam: jamRes.data,
    genres: ((genresRes.data ?? []) as any[]).map((g: any) => g.genres?.name).filter(Boolean),
    themes: ((themesRes.data ?? []) as any[]).map((t: any) => t.themes?.name).filter(Boolean),
    attendingCount: countRes.count ?? 0,
    host: (hostRes.data as any)?.display_name ?? (hostRes.data as any)?.username ?? null,
    hostUsername: (hostRes.data as any)?.username ?? null,
    invitesEnabled: flagRes.data?.enabled ?? true,
  });
}
