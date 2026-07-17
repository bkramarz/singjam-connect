import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";

const ALLOWED_FIELDS = ["youtube_url", "spotify_url", "chord_chart_url"] as const;
type AllowedField = (typeof ALLOWED_FIELDS)[number];
// song_editor may only touch chord_chart_url; youtube/spotify stay admin-only.
const SONG_EDITOR_FIELDS: readonly AllowedField[] = ["chord_chart_url"];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: songId } = await params;
  const auth = await requireRole("admin", "song_editor");
  if (!auth.ok) return auth.response;

  const allowedForRole = auth.role === "admin" ? ALLOWED_FIELDS : SONG_EDITOR_FIELDS;

  const body = await req.json();
  const updates: Partial<Record<AllowedField, string | null>> = {};

  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      if (!allowedForRole.includes(field)) {
        return NextResponse.json({ error: `Not permitted to set ${field}` }, { status: 403 });
      }
      const val = body[field];
      updates[field] = typeof val === "string" && val.trim() ? val.trim() : null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { error } = await admin.from("songs").update(updates).eq("id", songId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
