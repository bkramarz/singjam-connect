import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { key, enabled } = await req.json();
  await supabase
    .from("feature_flags")
    .upsert({ key, enabled }, { onConflict: "key" });

  return NextResponse.json({ ok: true });
}
