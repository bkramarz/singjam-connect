"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import JamCard, { type JamCardData } from "@/components/JamCard";
import JamRsvpButton from "@/components/JamRsvpButton";
import JamInvitePanel from "@/components/JamInvitePanel";
import JamInviteResponse from "@/components/JamInviteResponse";
import JamInviteList from "@/components/JamInviteList";
import JamHostActions from "@/components/JamHostActions";
import JamSharedSongs from "@/components/JamSharedSongs";
import JamAttendeeList from "@/components/JamAttendeeList";

type InviteEntry = {
  id: string;
  invited_user_id: string | null;
  invitee_email: string | null;
  status: string;
  display_name?: string | null;
  last_name?: string | null;
  username?: string | null;
};

type JamState =
  | { status: "loading" }
  | { status: "not_found" }
  | {
      status: "ready";
      jam: any;
      jamCardData: JamCardData;
      userId: string | null;
      rsvpStatus: "attending" | "waitlist" | "cancelled" | null;
      waitlistPosition: number | null;
      attendingCount: number;
      pendingInvite: boolean;
      isOfficial: boolean;
      isHost: boolean;
      hasFullAccess: boolean;
      showRsvp: boolean;
      canInvite: boolean;
      invitesEnabled: boolean;
      inviteList: InviteEntry[];
      alreadyInvitedIds: string[];
    };

export default function JamContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const inviteToken = searchParams.get("invite") ?? undefined;

  const [state, setState] = useState<JamState>({ status: "loading" });
  const supabase = supabaseBrowser();

  useEffect(() => {
    (async () => {
      setState({ status: "loading" });

      const [
        { data: { user } },
        jamRes,
        genresRes,
        themesRes,
        countRes,
        flagRes,
      ] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("jams")
          .select("id, name, visibility, starts_at, ends_at, neighborhood, full_address, notes, tickets_url, image_url, image_focal_point, capacity, host_user_id, guests_can_invite")
          .eq("id", id)
          .maybeSingle(),
        supabase.from("jam_genres").select("genres(name)").eq("jam_id", id),
        supabase.from("jam_themes").select("themes(name)").eq("jam_id", id),
        supabase.from("jam_rsvps").select("id", { count: "exact", head: true }).eq("jam_id", id).eq("status", "attending"),
        supabase.from("feature_flags").select("enabled").eq("key", "jam_invites").maybeSingle(),
      ]);

      const jam = jamRes.data;

      if (!jam) {
        if (!user && inviteToken) {
          router.push(`/auth?next=/jam/${id}&invite=${inviteToken}`);
          return;
        }
        setState({ status: "not_found" });
        return;
      }

      const userId = user?.id ?? null;
      const genres = ((genresRes.data ?? []) as any[]).map((g: any) => g.genres?.name).filter(Boolean) as string[];
      const themes = ((themesRes.data ?? []) as any[]).map((t: any) => t.themes?.name).filter(Boolean) as string[];
      const attendingCount = countRes.count ?? 0;
      const invitesEnabled = flagRes.data?.enabled ?? true;

      const [hostRes, rsvpRes, inviteRes] = await Promise.all([
        supabase.from("profiles").select("display_name, username").eq("id", jam.host_user_id).maybeSingle(),
        userId
          ? supabase.from("jam_rsvps").select("status, waitlist_position").eq("jam_id", id).eq("user_id", userId).maybeSingle()
          : Promise.resolve({ data: null }),
        userId
          ? supabase.from("jam_invites").select("status").eq("jam_id", id).eq("invited_user_id", userId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const hostLabel = (hostRes.data as any)?.display_name ?? (hostRes.data as any)?.username ?? null;
      const hostUsername = (hostRes.data as any)?.username ?? null;
      const rsvpStatus = (rsvpRes.data?.status as any) ?? null;
      const waitlistPosition = rsvpRes.data?.waitlist_position ?? null;
      const pendingInvite = inviteRes.data?.status === "pending";

      const isOfficial = jam.visibility === "official";
      const isAttending = rsvpStatus === "attending";
      const isHost = jam.host_user_id === userId;
      const hasFullAccess = isOfficial || isAttending || isHost;
      const showRsvp = !isOfficial && !!userId && !pendingInvite && !isHost;
      const canInvite = !!userId && !isOfficial && (isHost || (isAttending && jam.guests_can_invite));

      let inviteList: InviteEntry[] = [];
      let alreadyInvitedIds: string[] = [];

      if (isHost) {
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
              id: inv.id,
              invited_user_id: inv.invited_user_id,
              invitee_email: inv.invitee_email,
              status: inv.status,
              ...(inv.invited_user_id ? profileMap.get(inv.invited_user_id) : {}),
            }));
        }
      }

      const jamCardData: JamCardData = {
        name: jam.name,
        visibility: jam.visibility as any,
        starts_at: jam.starts_at,
        ends_at: jam.ends_at,
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

      setState({
        status: "ready",
        jam,
        jamCardData,
        userId,
        rsvpStatus,
        waitlistPosition,
        attendingCount,
        pendingInvite,
        isOfficial,
        isHost,
        hasFullAccess,
        showRsvp,
        canInvite,
        invitesEnabled,
        inviteList,
        alreadyInvitedIds,
      });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (state.status === "loading") return null;
  if (state.status === "not_found") return <p className="text-sm text-zinc-500">Jam not found.</p>;

  const {
    jam,
    jamCardData,
    userId,
    rsvpStatus,
    waitlistPosition,
    attendingCount,
    pendingInvite,
    isOfficial,
    isHost,
    showRsvp,
    canInvite,
    invitesEnabled,
    inviteList,
    alreadyInvitedIds,
  } = state;

  return (
    <div className="space-y-4">
      {pendingInvite && rsvpStatus !== "attending" && <JamInviteResponse jamId={id} />}
      <JamCard
        jam={jamCardData}
        actions={
          <>
            {showRsvp && (
              <JamRsvpButton
                jamId={id}
                initialStatus={rsvpStatus}
                initialWaitlistPosition={waitlistPosition}
                attendingCount={attendingCount}
                capacity={jam.capacity}
              />
            )}
            {!userId && !isOfficial && (
              <Link
                href={`/auth?next=/jam/${id}${inviteToken ? `&invite=${inviteToken}` : ""}`}
                className="inline-block rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-400 transition-colors"
              >
                Sign in to RSVP
              </Link>
            )}
          </>
        }
      />
      {userId && <JamSharedSongs jamId={id} />}
      {!isOfficial && <JamAttendeeList jamId={id} hostId={jam.host_user_id} />}
      {canInvite && invitesEnabled && (
        <JamInvitePanel
          jamId={id}
          alreadyInvitedIds={alreadyInvitedIds}
        />
      )}
      {isHost && <JamInviteList invites={inviteList} />}
      {isHost && <JamHostActions jamId={id} />}
    </div>
  );
}
