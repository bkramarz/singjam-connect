import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? user : null;
}

async function normalizeLocation(raw: string): Promise<string | null> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!key) return null;
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
    body: JSON.stringify({ input: raw, includedPrimaryTypes: ["locality", "sublocality"] }),
  });
  const json = await res.json();
  const top = json.suggestions?.[0]?.placePrediction?.structuredFormat;
  if (!top) return null;
  const main = top.mainText.text as string;
  const secondary = top.secondaryText?.text as string | undefined;
  return secondary ? `${main}, ${secondary.split(", ")[0]}` : main;
}

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: profiles, error } = await db
    .from("profiles")
    .select("id, neighborhood")
    .not("neighborhood", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = { updated: 0, skipped: 0, failed: 0 };

  for (const profile of profiles ?? []) {
    const raw: string = profile.neighborhood;
    try {
      const normalized = await normalizeLocation(raw);
      if (!normalized || normalized === raw) {
        results.skipped++;
        continue;
      }
      await db.from("profiles").update({ neighborhood: normalized }).eq("id", profile.id);
      results.updated++;
    } catch {
      results.failed++;
    }
    // Stay within Places API rate limits
    await new Promise((r) => setTimeout(r, 100));
  }

  return NextResponse.json({ ok: true, ...results });
}
