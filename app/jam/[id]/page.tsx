import { supabaseServer } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import JamCard from "@/components/JamCard";
import JamRsvpButton from "@/components/JamRsvpButton";
import JamInvitePanel from "@/components/JamInvitePanel";
import JamInviteResponse from "@/components/JamInviteResponse";
import JamInviteList from "@/components/JamInviteList";
import JamHostActions from "@/components/JamHostActions";

export default async function JamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const [jamRes, genresRes, themesRes] = await Promise.all([
    supabase
      .from("jams")
      .select("id, name, visibility, starts_at, ends_at, neighborhood, full_address, notes, tickets_url, image_url, image_focal_point, capacity, host_user_id, guests_can_invite")
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

  let pendingInvite = false;

  if (user) {
    const [rsvpRes, inviteRes] = await Promise.all([
      supabase
        .from("jam_rsvps")
        .select("status, waitlist_position")
        .eq("jam_id", id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("jam_invites")
        .select("status")
        .eq("jam_id", id)
        .eq("invited_user_id", user.id)
        .maybeSingle(),
    ]);
    rsvpStatus = (rsvpRes.data?.status as any) ?? null;
    waitlistPosition = rsvpRes.data?.waitlist_position ?? null;
    pendingInvite = inviteRes.data?.status === "pending";
  }

  const isOfficial = jam.visibility === "official";
  const isAttending = rsvpStatus === "attending";
  const isHost = jam.host_user_id === user?.id;
  const hasFullAccess = isOfficial || isAttending || isHost;

  // Don't show the RSVP button alongside the invite banner — accepting the
  // invite auto-RSVPs, so showing both would be confusing.
  const showRsvp = !isOfficial && user && !pendingInvite && !isHost;

  // Fetch all invites for the jam so the host can track response status.
  let inviteList: { id: string; invited_user_id: string | null; invitee_email: string | null; status: string; display_name?: string | null; username?: string | null }[] = [];
  if (isHost) {
    const { data: rawInvites } = await supabase
      .from("jam_invites")
      .select("id, invited_user_id, invitee_email, status")
      .eq("jam_id", id)
      .order("created_at", { ascending: true });

    if (rawInvites && rawInvites.length > 0) {
      const memberIds = (rawInvites as any[])
        .map((i: any) => i.invited_user_id)
        .filter(Boolean);

      const profileMap = new Map<string, { display_name: string | null; username: string | null }>();
      if (memberIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username")
          .in("id", memberIds);
        for (const p of (profiles ?? []) as any[]) {
          profileMap.set(p.id, { display_name: p.display_name, username: p.username });
        }
      }

      inviteList = (rawInvites as any[]).map((inv: any) => ({
        id: inv.id,
        invited_user_id: inv.invited_user_id,
        invitee_email: inv.invitee_email,
        status: inv.status,
        ...(inv.invited_user_id ? profileMap.get(inv.invited_user_id) : {}),
      }));
    }
  }
  // Community jams: any attendee can invite. Private jams: only if guests_can_invite.
  const canInvite = user && !isOfficial && (
    isHost ||
    (isAttending && (jam.visibility === "community" || (jam as any).guests_can_invite))
  );

  return (
    <div className="space-y-4">
    {pendingInvite && !isAttending && <JamInviteResponse jamId={id} />}
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
        image_focal_point: (jam as any).image_focal_point,
        genres,
        themes,
        host: hostLabel,
        capacity: (jam as any).capacity,
        hasFullAccess,
      }}
      actions={
        <>
          {showRsvp && (
            <JamRsvpButton
              jamId={id}
              initialStatus={rsvpStatus}
              initialWaitlistPosition={waitlistPosition}
              attendingCount={attendingCount}
              capacity={(jam as any).capacity}
            />
          )}
        </>
      }
    />
    {canInvite && <JamInvitePanel jamId={id} />}
    {isHost && <JamInviteList invites={inviteList} />}
    {isHost && <JamHostActions jamId={id} />}
    </div>
  );
}
