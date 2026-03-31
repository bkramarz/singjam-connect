import { supabaseServer } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import JamCard from "@/components/JamCard";
import JamRsvpButton from "@/components/JamRsvpButton";

export default async function JamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const [jamRes, genresRes, themesRes] = await Promise.all([
    supabase
      .from("jams")
      .select("id, name, visibility, starts_at, ends_at, neighborhood, full_address, notes, tickets_url, image_url, capacity, host_user_id")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("jam_genres").select("genres(name)").eq("jam_id", id),
    supabase.from("jam_themes").select("themes(name)").eq("jam_id", id),
  ]);

  const jam = jamRes.data;
  if (!jam) notFound();

  // Fetch host profile separately to avoid nested join nulling the whole row
  const { data: hostProfile } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", jam.host_user_id)
    .maybeSingle();

  const hostLabel = (hostProfile as any)?.display_name ?? (hostProfile as any)?.username ?? null;
  const genres = ((genresRes.data ?? []) as any[]).map((g: any) => g.genres?.name).filter(Boolean) as string[];
  const themes = ((themesRes.data ?? []) as any[]).map((t: any) => t.themes?.name).filter(Boolean) as string[];

  // RSVP state
  let rsvpStatus: "attending" | "waitlist" | "cancelled" | null = null;
  let waitlistPosition: number | null = null;
  let attendingCount = 0;

  const { count } = await supabase
    .from("jam_rsvps")
    .select("id", { count: "exact", head: true })
    .eq("jam_id", id)
    .eq("status", "attending");
  attendingCount = count ?? 0;

  if (user) {
    const { data: rsvp } = await supabase
      .from("jam_rsvps")
      .select("status, waitlist_position")
      .eq("jam_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    rsvpStatus = (rsvp?.status as any) ?? null;
    waitlistPosition = rsvp?.waitlist_position ?? null;
  }

  const isOfficial = jam.visibility === "official";
  const isAttending = rsvpStatus === "attending";
  const hasFullAccess = isOfficial || isAttending || jam.host_user_id === user?.id;

  const showRsvp = !isOfficial && user;

  return (
    <JamCard
      jam={{
        name: jam.name,
        visibility: jam.visibility as any,
        starts_at: jam.starts_at,
        ends_at: jam.ends_at,
        neighborhood: jam.neighborhood,
        full_address: (jam as any).full_address,
        notes: jam.notes,
        tickets_url: jam.tickets_url,
        image_url: (jam as any).image_url,
        genres,
        themes,
        host: hostLabel,
        capacity: (jam as any).capacity,
        hasFullAccess,
      }}
      actions={
        showRsvp ? (
          <JamRsvpButton
            jamId={id}
            initialStatus={rsvpStatus}
            initialWaitlistPosition={waitlistPosition}
            attendingCount={attendingCount}
            capacity={(jam as any).capacity}
          />
        ) : undefined
      }
    />
  );
}
