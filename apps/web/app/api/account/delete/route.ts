import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { deleteContact } from "@/lib/activecampaign";

export async function DELETE(req: NextRequest) {
  try {
    const admin = supabaseAdmin();
    const supabase = await supabaseServer();
    let user = (await supabase.auth.getUser()).data.user ?? null;
    if (!user) {
      const bearer = req.headers.get("Authorization")?.replace("Bearer ", "");
      if (bearer) user = (await admin.auth.getUser(bearer)).data.user ?? null;
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.email) {
      await deleteContact(user.email).catch(() => {});
    }

    const { error } = await admin.auth.admin.deleteUser(user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
