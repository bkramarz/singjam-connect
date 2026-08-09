import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseFromBearer } from "@/lib/supabase/bearer";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Ticket tiers for a jam. Reads are open to anyone who can see the jam; writes
// are host or co-host only. Authorization runs here with the admin client rather
// than through RLS, matching how set-list permissions already work in this repo.

async function getUser(req: Request) {
  const supabase = await supabaseServer();
  let user = (await supabase.auth.getUser()).data.user ?? null;
  if (!user) {
    const bearer = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (bearer) user = (await supabaseFromBearer(bearer).auth.getUser()).data.user ?? null;
  }
  return user;
}

async function canManage(jamId: string, userId: string) {
  const admin = supabaseAdmin();
  const { data: jam } = await admin.from("jams").select("host_user_id").eq("id", jamId).maybeSingle();
  if (!jam) return { ok: false as const, status: 404 };
  if (jam.host_user_id === userId) return { ok: true as const };

  const { data: cohost } = await admin
    .from("jam_cohosts")
    .select("id")
    .eq("jam_id", jamId)
    .eq("user_id", userId)
    .maybeSingle();

  return cohost ? { ok: true as const } : { ok: false as const, status: 403 };
}

// Sold counts come from the same function the reservation path uses, so the
// number a buyer sees is the number the oversell guard enforces.
async function withAvailability(jamId: string) {
  const admin = supabaseAdmin();
  const { data: types } = await admin
    .from("ticket_types")
    .select("id, name, description, price_cents, currency, quantity, sales_start_at, sales_end_at, sort_order")
    .eq("jam_id", jamId)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  const rows = types ?? [];
  const sold = await Promise.all(
    rows.map((t) => admin.rpc("ticket_type_sold_count", { type_id: t.id }))
  );

  const now = Date.now();
  return rows.map((t, i) => {
    const soldCount = (sold[i].data as number) ?? 0;
    const remaining = t.quantity === null ? null : Math.max(0, t.quantity - soldCount);
    const notYetOpen = t.sales_start_at ? now < new Date(t.sales_start_at).getTime() : false;
    const closed = t.sales_end_at ? now > new Date(t.sales_end_at).getTime() : false;
    return {
      ...t,
      sold: soldCount,
      remaining,
      on_sale: !notYetOpen && !closed && remaining !== 0,
      not_yet_open: notYetOpen,
      closed,
    };
  });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: jamId } = await params;

  // Readable by anyone who can read the jam — let the jams RLS policy decide
  // rather than restating the visibility rules here.
  const supabase = await supabaseServer();
  const { data: jam } = await supabase.from("jams").select("id").eq("id", jamId).maybeSingle();
  if (!jam) return NextResponse.json({ error: "Jam not found" }, { status: 404 });

  return NextResponse.json({ ticket_types: await withAvailability(jamId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: jamId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await canManage(jamId, user.id);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 404 ? "Jam not found" : "Only the host can manage tickets" },
      { status: auth.status }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const priceCents = Number(body?.price_cents);

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!Number.isInteger(priceCents) || priceCents < 0) {
    return NextResponse.json({ error: "Price must be a whole number of cents" }, { status: 400 });
  }
  if (body?.quantity != null && (!Number.isInteger(body.quantity) || body.quantity < 1)) {
    return NextResponse.json({ error: "Quantity must be a positive whole number" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("ticket_types")
    .insert({
      jam_id: jamId,
      name,
      description: body?.description?.trim() || null,
      price_cents: priceCents,
      quantity: body?.quantity ?? null,
      sales_start_at: body?.sales_start_at || null,
      sales_end_at: body?.sales_end_at || null,
      sort_order: Number.isInteger(body?.sort_order) ? body.sort_order : 0,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: data.id });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: jamId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await canManage(jamId, user.id);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 404 ? "Jam not found" : "Only the host can manage tickets" },
      { status: auth.status }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!body?.id) return NextResponse.json({ error: "Ticket type id required" }, { status: 400 });

  const admin = supabaseAdmin();

  // Dropping capacity below what is already sold would silently invalidate
  // tickets people have paid for, so refuse rather than accept it.
  if (body.quantity != null) {
    const { data: sold } = await admin.rpc("ticket_type_sold_count", { type_id: body.id });
    if ((sold as number) > body.quantity) {
      return NextResponse.json(
        { error: `${sold} already sold — capacity cannot go below that` },
        { status: 409 }
      );
    }
  }

  const patch: Record<string, unknown> = {};
  for (const f of ["name", "description", "price_cents", "quantity", "sales_start_at", "sales_end_at", "sort_order"]) {
    if (f in body) patch[f] = body[f];
  }

  const { error } = await admin
    .from("ticket_types")
    .update(patch)
    .eq("id", body.id)
    .eq("jam_id", jamId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: jamId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await canManage(jamId, user.id);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 404 ? "Jam not found" : "Only the host can manage tickets" },
      { status: auth.status }
    );
  }

  const typeId = new URL(req.url).searchParams.get("type_id");
  if (!typeId) return NextResponse.json({ error: "type_id required" }, { status: 400 });

  const admin = supabaseAdmin();

  // tickets.ticket_type_id is ON DELETE RESTRICT, so Postgres would reject this
  // anyway — but a clear message beats a foreign-key error surfacing in the UI.
  const { data: sold } = await admin.rpc("ticket_type_sold_count", { type_id: typeId });
  if ((sold as number) > 0) {
    return NextResponse.json(
      { error: `${sold} ticket(s) sold — close sales instead of deleting` },
      { status: 409 }
    );
  }

  const { error } = await admin.from("ticket_types").delete().eq("id", typeId).eq("jam_id", jamId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
