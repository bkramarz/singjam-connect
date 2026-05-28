import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("q")?.trim() ?? "";
  const q = raw.startsWith("@") ? raw.slice(1) : raw;

  if (q.length < 2) return NextResponse.json([]);

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // When the query has multiple words, also match display_name + last_name together
  const parts = q.split(/\s+/);
  let filter = `username.ilike.%${q}%,display_name.ilike.%${q}%,last_name.ilike.%${q}%`;
  if (parts.length >= 2) {
    filter += `,and(display_name.ilike.%${parts[0]}%,last_name.ilike.%${parts.slice(1).join(" ")}%)`;
  }

  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, last_name, avatar_url")
    .or(filter)
    .neq("id", user.id)
    .limit(10);

  return NextResponse.json(data ?? []);
}
