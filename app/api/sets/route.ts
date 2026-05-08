import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [ownedRes, collabRes] = await Promise.all([
    supabase
      .from("sets")
      .select("id, name, description, created_at, owner_user_id")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("set_collaborators")
      .select("set_id, sets(id, name, description, created_at, owner_user_id)")
      .eq("user_id", user.id)
      .eq("status", "accepted"),
  ]);

  const owned = (ownedRes.data ?? []) as any[];
  const collaborating = ((collabRes.data ?? []) as any[])
    .map((r) => r.sets)
    .filter(Boolean)
    .filter((s: any) => s.owner_user_id !== user.id);

  return NextResponse.json({ owned, collaborating });
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("sets")
    .insert({ name: name.trim(), description: description?.trim() || null, owner_user_id: user.id })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: (data as any).id });
}
