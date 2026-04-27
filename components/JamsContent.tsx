"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { FormattedDate, FormattedTime } from "@/components/FormattedTime";
import { supabaseBrowser } from "@/lib/supabase/client";
import Tooltip from "@/components/Tooltip";

type RsvpStatus = "attending" | "waitlist" | "cancelled";

type JamsData = {
  userId: string | null;
  invitesEnabled: boolean;
  isAdmin: boolean;
  allJams: any[];
  rsvpByJam: Map<string, any>;
  inviteByJam: Map<string, any>;
  genresByJam: Map<string, string[]>;
  themesByJam: Map<string, string[]>;
  profileById: Map<string, { label: string; username: string | null }>;
};

function RsvpBadge({ status, waitlistPosition }: { status: RsvpStatus; waitlistPosition?: number | null }) {
  if (status === "attending") {
    return <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Attending</span>;
  }
  if (status === "waitlist") {
    return (
      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        Waitlisted{waitlistPosition != null ? ` #${waitlistPosition}` : ""}
      </span>
    );
  }
  return null;
}

function JamListCard({ jam, tags, hostLabel, hostUsername, isOfficial, rsvp, isInvited, isHosting }: {
  jam: any;
  tags: string[];
  hostLabel?: string | null;
  hostUsername?: string | null;
  isOfficial: boolean;
  rsvp?: { status: RsvpStatus; waitlist_position?: number | null } | null;
  isInvited?: boolean;
  isHosting?: boolean;
}) {
  const inner = (
    <div className={`flex overflow-hidden rounded-2xl border bg-white transition-colors ${isOfficial ? "border-amber-200 hover:border-amber-300" : "border-zinc-200 hover:border-zinc-300"}`}>
      {jam.image_url ? (
        <div className="relative shrink-0 w-24 sm:w-32 overflow-hidden">
          <Image src={jam.image_url} alt={jam.name ?? "Event"} fill className="object-cover" sizes="128px" unoptimized />
        </div>
      ) : jam.starts_at ? (
        <div className={`shrink-0 w-20 flex flex-col items-center justify-center border-r px-2 py-4 ${isOfficial ? "bg-amber-50 border-amber-200" : "bg-zinc-50 border-zinc-100"}`}>
          <span className={`text-xs font-semibold uppercase tracking-wide ${isOfficial ? "text-amber-500" : "text-zinc-400"}`}>
            <FormattedDate iso={jam.starts_at} options={{ weekday: "short" }} />
          </span>
          <span className="text-3xl font-bold text-zinc-900 leading-none">
            <FormattedDate iso={jam.starts_at} options={{ day: "numeric" }} />
          </span>
          <span className={`text-xs font-semibold uppercase tracking-wide ${isOfficial ? "text-amber-500" : "text-zinc-400"}`}>
            <FormattedDate iso={jam.starts_at} options={{ month: "short" }} />
          </span>
        </div>
      ) : null}

      <div className="flex-1 min-w-0 p-4">
        {isOfficial && (
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-500 mb-0.5">Official SingJam event</p>
        )}
        <div className="flex items-center gap-2">
          <p className="flex-1 font-semibold text-zinc-900 truncate">{jam.name ?? (isOfficial ? "SingJam event" : "Community jam")}</p>
          {isInvited && !rsvp && (
            <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">Invited</span>
          )}
          {rsvp && <RsvpBadge status={rsvp.status} waitlistPosition={rsvp.waitlist_position} />}
          {isHosting && (
            <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">Hosting</span>
          )}
        </div>
        {jam.starts_at && (
          <p className="text-xs text-zinc-500 mt-0.5">
            <FormattedDate iso={jam.starts_at} options={{ weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }} />
            {jam.ends_at && <> – <FormattedTime iso={jam.ends_at} /></>}
          </p>
        )}
        {jam.neighborhood && <p className="text-xs text-zinc-400 mt-0.5">{jam.neighborhood}</p>}
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.map((t) => (
              <span key={t} className={`rounded-full px-2 py-0.5 text-xs ${isOfficial ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-600"}`}>{t}</span>
            ))}
          </div>
        )}
        {!isOfficial && !isHosting && hostLabel && (
          <p className="mt-2 text-xs text-zinc-400">
            Hosted by <span className="font-medium text-zinc-500">{hostLabel}</span>
            {hostUsername && <span className="ml-1">@{hostUsername}</span>}
          </p>
        )}
        {isOfficial && (
          <div className="mt-2 flex flex-wrap gap-3">
            <Link href={`/jam/${jam.id}`} className="text-xs font-medium text-zinc-500 hover:text-zinc-700">
              View details →
            </Link>
            {jam.tickets_url && (
              <a href={jam.tickets_url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-amber-600 hover:text-amber-500">
                Get tickets ↗
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (isOfficial) return <div>{inner}</div>;
  return <Link href={`/jam/${jam.id}`} className="block">{inner}</Link>;
}

export default function JamsContent() {
  const [data, setData] = useState<JamsData | null>(null);
  const supabase = supabaseBrowser();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user.id ?? null;

      const [flagRes, adminRes, jamsRes, rsvpsRes, invitesRes] = await Promise.all([
        supabase.from("feature_flags").select("enabled").eq("key", "jam_invites").maybeSingle(),
        userId
          ? supabase.from("profiles").select("is_admin").eq("id", userId).single()
          : Promise.resolve({ data: null }),
        supabase
          .from("jams")
          .select("id, name, starts_at, ends_at, neighborhood, tickets_url, image_url, visibility, host_user_id")
          .gte("starts_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
          .order("starts_at", { ascending: true, nullsFirst: false })
          .limit(100),
        userId
          ? supabase.from("jam_rsvps").select("jam_id, status, waitlist_position").eq("user_id", userId)
          : Promise.resolve({ data: [] }),
        userId
          ? supabase.from("jam_invites").select("jam_id, status").eq("invited_user_id", userId)
          : Promise.resolve({ data: [] }),
      ]);

      const allJams = (jamsRes.data ?? []) as any[];
      const jamIds = allJams.map((j) => j.id);
      const hostIds = [...new Set(allJams.map((j) => j.host_user_id).filter(Boolean))] as string[];

      const [genresRes, themesRes, profilesRes] = await Promise.all([
        jamIds.length > 0
          ? supabase.from("jam_genres").select("jam_id, genres(name)").in("jam_id", jamIds)
          : Promise.resolve({ data: [] }),
        jamIds.length > 0
          ? supabase.from("jam_themes").select("jam_id, themes(name)").in("jam_id", jamIds)
          : Promise.resolve({ data: [] }),
        hostIds.length > 0
          ? supabase.from("profiles").select("id, display_name, username").in("id", hostIds)
          : Promise.resolve({ data: [] }),
      ]);

      const rsvpByJam = new Map(((rsvpsRes.data ?? []) as any[]).map((r) => [r.jam_id, r]));
      const inviteByJam = new Map(((invitesRes.data ?? []) as any[]).map((i) => [i.jam_id, i]));
      const genresByJam = new Map<string, string[]>();
      const themesByJam = new Map<string, string[]>();
      const profileById = new Map<string, { label: string; username: string | null }>();

      for (const row of (genresRes.data ?? []) as any[]) {
        const name = row.genres?.name;
        if (!name) continue;
        const arr = genresByJam.get(row.jam_id) ?? [];
        arr.push(name);
        genresByJam.set(row.jam_id, arr);
      }
      for (const row of (themesRes.data ?? []) as any[]) {
        const name = row.themes?.name;
        if (!name) continue;
        const arr = themesByJam.get(row.jam_id) ?? [];
        arr.push(name);
        themesByJam.set(row.jam_id, arr);
      }
      for (const p of (profilesRes.data ?? []) as any[]) {
        profileById.set(p.id, { label: p.display_name ?? p.username ?? null, username: p.username ?? null });
      }

      setData({
        userId,
        invitesEnabled: flagRes.data?.enabled ?? true,
        isAdmin: (adminRes.data as any)?.is_admin ?? false,
        allJams,
        rsvpByJam,
        inviteByJam,
        genresByJam,
        themesByJam,
        profileById,
      });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) return null;

  const { userId, invitesEnabled, isAdmin, allJams, rsvpByJam, inviteByJam, genresByJam, themesByJam, profileById } = data;

  function cardProps(jam: any, opts: { isOfficial?: boolean; isHosting?: boolean } = {}) {
    return {
      jam,
      tags: [...(genresByJam.get(jam.id) ?? []), ...(themesByJam.get(jam.id) ?? [])],
      hostLabel: profileById.get(jam.host_user_id)?.label ?? null,
      hostUsername: profileById.get(jam.host_user_id)?.username ?? null,
      isOfficial: opts.isOfficial ?? false,
      isHosting: opts.isHosting ?? false,
      rsvp: (rsvpByJam.get(jam.id) as any) ?? null,
      isInvited: (inviteByJam.get(jam.id) as any)?.status === "pending",
    };
  }

  const officialJams = allJams.filter((j) => j.visibility === "official");
  const pendingInviteJams = userId
    ? allJams.filter((j) => j.host_user_id !== userId && (inviteByJam.get(j.id) as any)?.status === "pending")
    : [];
  const hostingJams = userId
    ? allJams.filter((j) => j.visibility !== "official" && j.host_user_id === userId)
    : [];
  const communityJams = userId
    ? allJams.filter((j) =>
        j.visibility === "community" &&
        j.host_user_id !== userId &&
        (inviteByJam.get(j.id) as any)?.status !== "pending"
      )
    : [];
  const privateJams = userId
    ? allJams.filter((j) => {
        if (j.visibility !== "private" || j.host_user_id === userId) return false;
        const s = (inviteByJam.get(j.id) as any)?.status;
        return s === "accepted" || s === "declined";
      })
    : [];

  const isEmpty =
    officialJams.length === 0 &&
    pendingInviteJams.length === 0 &&
    hostingJams.length === 0 &&
    communityJams.length === 0 &&
    privateJams.length === 0;

  return (
    <div className="space-y-8">
      <div className="flex justify-end -mt-16 sm:-mt-14">
        {userId && (invitesEnabled || isAdmin) && (
          <Link href="/jam/new" className="self-start rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400 transition-colors sm:self-auto">
            Post a jam
          </Link>
        )}
        {userId && !invitesEnabled && !isAdmin && (
          <Tooltip message="Jam posting is currently unavailable">
            <span className="self-start rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-300 cursor-not-allowed sm:self-auto">
              Post a jam
            </span>
          </Tooltip>
        )}
      </div>

      {officialJams.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Upcoming SingJam events</h2>
          <div className="grid gap-3">
            {officialJams.map((jam) => <JamListCard key={jam.id} {...cardProps(jam, { isOfficial: true })} />)}
          </div>
        </section>
      )}

      {userId && pendingInviteJams.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Invitations</h2>
          <div className="grid gap-3">
            {pendingInviteJams.map((jam) => <JamListCard key={jam.id} {...cardProps(jam)} />)}
          </div>
        </section>
      )}

      {userId && hostingJams.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Jams you're hosting</h2>
          <div className="grid gap-3">
            {hostingJams.map((jam) => <JamListCard key={jam.id} {...cardProps(jam, { isHosting: true })} />)}
          </div>
        </section>
      )}

      {userId && communityJams.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Community jams</h2>
          <div className="grid gap-3">
            {communityJams.map((jam) => <JamListCard key={jam.id} {...cardProps(jam)} />)}
          </div>
        </section>
      )}

      {userId && privateJams.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Private jams</h2>
          <div className="grid gap-3">
            {privateJams.map((jam) => <JamListCard key={jam.id} {...cardProps(jam)} />)}
          </div>
        </section>
      )}

      {isEmpty && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
          <p className="text-sm text-zinc-500">
            {userId ? "No jams yet. Be the first to post one!" : "No upcoming events."}
          </p>
        </div>
      )}
    </div>
  );
}
