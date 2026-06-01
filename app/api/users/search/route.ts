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

  const { data } = await supabase.rpc("search_users", {
    search_query: q,
    exclude_user_id: user.id,
  });

  return NextResponse.json(data ?? []);
}
