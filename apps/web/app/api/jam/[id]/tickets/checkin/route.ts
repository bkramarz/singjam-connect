import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseFromBearer } from "@/lib/supabase/bearer";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Door check-in. Host or co-host only, same as the guest list it's driven from.

type AuthResult =
  | { ok: true; user: { id: string }; admin: ReturnType<typeof supabaseAdmin> }
  | { ok: false; response: NextResponse };

async function authorize(req: Request, jamId: string): Promise<AuthResult> {
  const supabase = await supabaseServer();
  let user = (await supabase.auth.getUser()).data.user ?? null;
  if (!user) {
    const bearer = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (bearer) user = (await supabaseFromBearer(bearer).auth.getUser()).data.user ?? null;
  }
  if (!user) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const admin = supabaseAdmin();
  const { data: jam } = await admin.from("jams").select("host_user_id").eq("id", jamId).maybeSingle();
  if (!jam) return { ok: false, response: NextResponse.json({ error: "Jam not found" }, { status: 404 }) };

  if (jam.host_user_id !== user.id) {
    const { data: cohost } = await admin
      .from("jam_cohosts")
      .select("id")
      .eq("jam_id", jamId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!cohost) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Only the host can check guests in" }, { status: 403 }),
      };
    }
  }
  return { ok: true, user, admin };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: jamId } = await params;
  const auth = await authorize(req, jamId);
  if (!auth.ok) return auth.response;
  const { user, admin } = auth;

  let ticketId: string;
  try {
    ticketId = (await req.json())?.ticket_id;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!ticketId) return NextResponse.json({ error: "ticket_id required" }, { status: 400 });

  // Scoped to this jam so a ticket id from another event can't be checked in here.
  const { data: ticket } = await admin
    .from("tickets")
    .select("id, checked_in_at")
    .eq("id", ticketId)
    .eq("jam_id", jamId)
    .maybeSingle();

  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  // Already in: report it rather than erroring. Someone scanning a queue needs
  // to know this is a duplicate, not that something broke — and a second tap
  // must not overwrite the original arrival time.
  if (ticket.checked_in_at) {
    return NextResponse.json({ already_checked_in: true, checked_in_at: ticket.checked_in_at });
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("tickets")
    .update({ checked_in_at: now, checked_in_by: user.id })
    .eq("id", ticketId)
    .is("checked_in_at", null); // concurrent taps: first one wins

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ already_checked_in: false, checked_in_at: now });
}

// Undo. Doors are chaotic and people get checked in by mistake.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: jamId } = await params;
  const auth = await authorize(req, jamId);
  if (!auth.ok) return auth.response;
  const { admin } = auth;

  const ticketId = new URL(req.url).searchParams.get("ticket_id");
  if (!ticketId) return NextResponse.json({ error: "ticket_id required" }, { status: 400 });

  const { error } = await admin
    .from("tickets")
    .update({ checked_in_at: null, checked_in_by: null })
    .eq("id", ticketId)
    .eq("jam_id", jamId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
