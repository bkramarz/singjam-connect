import { createClient } from "@supabase/supabase-js";
import { buildIcs } from "@/lib/ics";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jamId } = await params;

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: jam } = await admin
    .from("jams")
    .select("name, starts_at, ends_at, full_address, neighborhood")
    .eq("id", jamId)
    .single();

  if (!jam || !jam.starts_at) {
    return new Response("Not found", { status: 404 });
  }

  const location = jam.full_address ?? jam.neighborhood ?? null;
  const ics = buildIcs({
    uid: `jam-${jamId}@singjam`,
    title: jam.name ?? "SingJam",
    startsAt: jam.starts_at,
    endsAt: jam.ends_at ?? null,
    location,
    description: location ? `Location: ${location}` : null,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="singjam-${jamId}.ics"`,
    },
  });
}
