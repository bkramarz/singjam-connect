import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isUserRole } from "@/lib/userRoles";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { role } = await req.json().catch(() => ({ role: undefined }));
  if (!isUserRole(role)) {
    return NextResponse.json({ error: "Unknown role" }, { status: 400 });
  }
  if (id === auth.user.id) {
    return NextResponse.json(
      { error: "You can't change your own role — ask another admin." },
      { status: 400 }
    );
  }

  // profiles has no admin-write policy for other people's rows, so this runs
  // through the service role after the requireAdmin check above.
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({ ok: true, role });
}
