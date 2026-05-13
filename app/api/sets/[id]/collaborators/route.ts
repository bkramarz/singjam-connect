import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: setId } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { collaboratorId, role } = await req.json();
  if (!collaboratorId || !role) {
    return NextResponse.json({ error: "Missing collaboratorId or role" }, { status: 400 });
  }
  if (role !== "editor" && role !== "viewer") {
    return NextResponse.json({ error: "role must be editor or viewer" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: set } = await admin
    .from("sets")
    .select("owner_user_id")
    .eq("id", setId)
    .maybeSingle();
  if (!set) return NextResponse.json({ error: "Set not found" }, { status: 404 });
  if ((set as any).owner_user_id !== user.id) {
    return NextResponse.json({ error: "Only the set owner can change roles" }, { status: 403 });
  }

  const { error } = await admin
    .from("set_collaborators")
    .update({ role, status: "accepted" })
    .eq("id", collaboratorId)
    .eq("set_id", setId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
