import type { Metadata } from "next";
import { cache } from "react";
import { getServerSupabase, getServerUser } from "@/lib/supabase/cached";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { claimJamInvite } from "@/lib/claimJamInvite";
import { formatJamDate } from "@/lib/formatJamTime";
import JamView, { type InviteEntry } from "@/components/JamView";
import { type JamCardData } from "@/components/JamCard";

// Private jams are unlisted, not access-controlled (migration 160): holding
// the link is what grants a view, so the jam itself is read with the admin
// client. Listings stay RLS-scoped, which is what keeps them undiscoverable.
const getJam = cache(async (id: string) => {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("jams")
    .select("id, name, visibility, starts_at, ends_at, timezone, neighborhood, full_address, notes, tickets_url, image_url, image_focal_point, capacity, host_user_id, guests_can_invite, profiles(display_name, last_name, username)")
    .eq("id", id)
    .maybeSingle();
  return data as any;
});

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const jam = await getJam(id);
  if (!jam) return { title: "Jam" };
  const name = jam.name ?? "Jam";
  const host = jam.profiles?.display_name ?? jam.profiles?.username ?? null;
  const date = formatJamDate(jam.starts_at, jam.timezone);
  const parts = [date, jam.neighborhood, host ? `Hosted by ${host}` : null].filter(Boolean);
  const description = parts.length
    ? `${parts.join(" · ")}. RSVP and jam together on SingJam.`
    : "An upcoming jam on SingJam. RSVP and join the music.";
  return {
    title: name,
    description,
    openGraph: { title: name, description },
  };
}

export default async function JamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const { id } = await params;
  const { invite } = await searchParams;

  const supabase = await getServerSupabase();
  const admin = supabaseAdmin();
  const user = await getServerUser();

  // Record the guest against the host's invite before reading their own rows
  // below, so the accept/decline banner is right on the first paint.
  if (invite && user) await claimJamInvite(invite, user.id);

  // Jam-scoped reads go through the admin client for the same reason getJam
  // does: the link is the credential. The per-user reads below stay RLS-scoped.
  const [jam, genresRes, themesRes, countRes, flagRes] = await Promise.all([
    getJam(id),
    admin.from("jam_genres").select("genres(name)").eq("jam_id", id),
    admin.from("jam_themes").select("themes(name)").eq("jam_id", id),
    admin.from("jam_rsvps").select("id", { count: "exact", head: true }).eq("jam_id", id).eq("status", "attending"),
    supabase.from("feature_flags").select("enabled").eq("key", "jam_invites").maybeSingle(),
  ]);

  if (!jam) return <p className="text-sm text-zinc-500">Jam not found.</p>;

  const userId = user?.id ?? null;
  const genres = ((genresRes.data ?? []) as any[]).map((g: any) => g.genres?.name).filter(Boolean) as string[];
  const themes = ((themesRes.data ?? []) as any[]).map((t: any) => t.themes?.name).filter(Boolean) as string[];
  const attendingCount = countRes.count ?? 0;
  const invitesEnabled = flagRes.data?.enabled ?? true;

  const [rsvpRes, inviteRes, cohostRes] = await Promise.all([
    userId
      ? supabase.from("jam_rsvps").select("status, waitlist_position").eq("jam_id", id).eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
    userId
      ? supabase.from("jam_invites").select("status").eq("jam_id", id).eq("invited_user_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
    userId
      ? supabase.from("jam_cohosts").select("user_id").eq("jam_id", id).eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const hostLabel = [jam.profiles?.display_name, jam.profiles?.last_name].filter(Boolean).join(" ") || jam.profiles?.username || null;
  const hostUsername = jam.profiles?.username ?? null;
  const rsvpStatus = ((rsvpRes.data as any)?.status as "attending" | "waitlist" | "cancelled" | undefined) ?? null;
  const waitlistPosition = (rsvpRes.data as any)?.waitlist_position ?? null;
  const pendingInvite = (inviteRes.data as any)?.status === "pending";

  const isOfficial = jam.visibility === "official";
  const isAttending = rsvpStatus === "attending";
  const isHost = jam.host_user_id === userId;
  const isCoHost = !!cohostRes.data;
  const hasFullAccess = isOfficial || isAttending || isHost || isCoHost;
  const showRsvp = !isOfficial && !!userId && !pendingInvite && !isHost;
  const canInvite = !!userId && !isOfficial && (isHost || isCoHost || (isAttending && jam.guests_can_invite));

  let inviteList: InviteEntry[] = [];
  let alreadyInvitedIds: string[] = [];

  if (isHost || isCoHost) {
    const { data: rawInvites } = await supabase
      .from("jam_invites")
      .select("id, invited_user_id, invitee_email, status")
      .eq("jam_id", id)
      .order("created_at", { ascending: true });

    if (rawInvites && rawInvites.length > 0) {
      const memberIds = (rawInvites as any[]).map((i: any) => i.invited_user_id).filter(Boolean);
      const profileMap = new Map<string, any>();

      if (memberIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, last_name, username")
          .in("id", memberIds);
        for (const p of (profiles ?? []) as any[]) {
          profileMap.set(p.id, p);
        }
      }

      alreadyInvitedIds = (rawInvites as any[]).map((i: any) => i.invited_user_id).filter(Boolean);
      inviteList = (rawInvites as any[])
        .filter((inv: any) => inv.status !== "accepted" && (inv.invited_user_id || inv.invitee_email))
        .map((inv: any) => ({
          invited_user_id: inv.invited_user_id,
          invitee_email: inv.invitee_email,
          status: inv.status,
          ...(inv.invited_user_id ? profileMap.get(inv.invited_user_id) : {}),
          id: inv.id,
        }));
    }
  }

  const jamCardData: JamCardData = {
    id: jam.id,
    name: jam.name,
    visibility: jam.visibility,
    starts_at: jam.starts_at,
    ends_at: jam.ends_at,
    timezone: jam.timezone,
    neighborhood: jam.neighborhood,
    full_address: jam.full_address,
    notes: jam.notes,
    tickets_url: jam.tickets_url,
    image_url: jam.image_url,
    image_focal_point: jam.image_focal_point,
    genres,
    themes,
    host: hostLabel,
    hostUsername,
    capacity: jam.capacity,
    hasFullAccess,
  };

  return (
    <JamView
      jamId={id}
      data={{
        jam: { name: jam.name, capacity: jam.capacity, host_user_id: jam.host_user_id },
        jamCardData,
        userId,
        rsvpStatus,
        waitlistPosition,
        attendingCount,
        pendingInvite,
        isOfficial,
        isHost,
        isCoHost,
        hasFullAccess,
        showRsvp,
        canInvite,
        invitesEnabled,
        inviteList,
        alreadyInvitedIds,
      }}
    />
  );
}
