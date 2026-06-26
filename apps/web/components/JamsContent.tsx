"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { FormattedDate, FormattedTime } from "@/components/FormattedTime";
import { supabaseBrowser } from "@/lib/supabase/client";

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

function JamListCard({ jam, tags, hostLabel, hostUsername, isOfficial, rsvp, isInvited, isHosting, onDeleted }: {
  jam: any;
  tags: string[];
  hostLabel?: string | null;
  hostUsername?: string | null;
  isOfficial: boolean;
  rsvp?: { status: RsvpStatus; waitlist_position?: number | null } | null;
  isInvited?: boolean;
  isHosting?: boolean;
  onDeleted?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isHosting) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [isHosting]);

  async function deleteJam() {
    setDeleting(true);
    const res = await fetch(`/api/jam/${jam.id}`, { method: "DELETE" });
    if (res.ok) {
      onDeleted?.();
    } else {
      setDeleting(false);
      setConfirming(false);
    }
  }

  const cardBody = (
    <div className={`flex overflow-hidden rounded-2xl border bg-white transition-colors ${isOfficial ? "border-amber-200 hover:border-amber-300" : "border-zinc-200 hover:border-zinc-300"}`}>
      {jam.image_url ? (
        <div className="relative shrink-0 w-24 sm:w-32 overflow-hidden bg-black">
          <Image src={jam.image_url} alt={jam.name ?? "Event"} fill className="object-contain" sizes="128px" unoptimized />
        </div>
      ) : jam.starts_at ? (
        <div className={`shrink-0 w-20 flex flex-col items-center justify-center border-r px-2 py-4 ${isOfficial ? "bg-amber-50 border-amber-200" : "bg-zinc-50 border-zinc-100"}`}>
          <span className={`text-xs font-semibold uppercase tracking-wide ${isOfficial ? "text-amber-500" : "text-zinc-400"}`}>
            <FormattedDate iso={jam.starts_at} timezone={jam.timezone} options={{ weekday: "short" }} />
          </span>
          <span className="text-3xl font-bold text-zinc-900 leading-none">
            <FormattedDate iso={jam.starts_at} timezone={jam.timezone} options={{ day: "numeric" }} />
          </span>
          <span className={`text-xs font-semibold uppercase tracking-wide ${isOfficial ? "text-amber-500" : "text-zinc-400"}`}>
            <FormattedDate iso={jam.starts_at} timezone={jam.timezone} options={{ month: "short" }} />
          </span>
        </div>
      ) : null}

      <div className="flex-1 min-w-0 p-4">
        {isOfficial && (
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-500 mb-0.5">Official SingJam event</p>
        )}
        {!isOfficial && (jam.visibility === "community" || jam.visibility === "private" || isHosting) && (
          <div className="flex items-center gap-2 mb-0.5">
            {jam.visibility === "community" && (
              <span className="text-xs font-semibold uppercase tracking-wide text-sky-600">Public</span>
            )}
            {jam.visibility === "private" && (
              <span className="text-xs font-semibold uppercase tracking-wide text-violet-600">Private</span>
            )}
            {isHosting && (
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Hosting</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <p className="flex-1 min-w-0 font-semibold text-zinc-900 truncate">{jam.name ?? (isOfficial ? "SingJam event" : "Community jam")}</p>
          {isInvited && !rsvp && (
            <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">Invited</span>
          )}
          {rsvp && <RsvpBadge status={rsvp.status} waitlistPosition={rsvp.waitlist_position} />}
        </div>
        {jam.starts_at && (
          <p className="text-xs text-zinc-500 mt-0.5">
            <FormattedDate iso={jam.starts_at} timezone={jam.timezone} options={{ weekday: "short", month: "short", day: "numeric" }} />
            {" · "}
            <FormattedTime iso={jam.starts_at} timezone={jam.timezone} />
            {jam.ends_at && <> – <FormattedTime iso={jam.ends_at} timezone={jam.timezone} /></>}
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
        {isOfficial ? (
          <p className="mt-2 text-xs text-zinc-400">
            Hosted by <span className="font-medium text-zinc-500">SingJam</span>
          </p>
        ) : (!isHosting && hostLabel && (
          <p className="mt-2 text-xs text-zinc-400">
            Hosted by <span className="font-medium text-zinc-500">{hostLabel}</span>
            {hostUsername && <span className="ml-1">@{hostUsername}</span>}
          </p>
        ))}
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

  const wrapped = isOfficial
    ? <div>{cardBody}</div>
    : <Link href={`/jam/${jam.id}`} className="block">{cardBody}</Link>;

  if (!isHosting) return wrapped;

  return (
    <div className="relative">
      {wrapped}
      <div className="absolute top-2 right-2" ref={menuRef}>
        <button
          onClick={() => { setMenuOpen((o) => !o); setConfirming(false); }}
          className="rounded-lg p-1 bg-white/90 text-zinc-400 hover:text-zinc-600 hover:bg-white transition-colors shadow-sm"
          aria-label="More options"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <circle cx="4" cy="10" r="1.5" />
            <circle cx="10" cy="10" r="1.5" />
            <circle cx="16" cy="10" r="1.5" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-zinc-200 bg-white shadow-lg z-10 overflow-hidden py-1">
            <Link
              href={`/jam/${jam.id}/edit`}
              className="flex items-center px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Edit details
            </Link>
            <Link
              href={`/jam/new?copy=${jam.id}`}
              className="flex items-center px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Copy event
            </Link>
            <button
              onClick={() => { setConfirming(true); setMenuOpen(false); }}
              className="w-full text-left flex items-center px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              Cancel jam
            </button>
          </div>
        )}
        {confirming && (
          <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-red-300 bg-red-50 px-4 py-3 shadow-lg z-10 space-y-2">
            <p className="text-sm font-medium text-red-800">Cancel this jam? This can't be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
              >
                Keep it
              </button>
              <button
                onClick={deleteJam}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Cancelling…" : "Yes, cancel"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function JamsContent() {
  const [data, setData] = useState<JamsData | null>(null);
  const supabase = supabaseBrowser();

  async function fetchData() {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user.id ?? null;

    const [flagRes, adminRes, jamsRes, rsvpsRes, invitesRes] = await Promise.all([
      supabase.from("feature_flags").select("enabled").eq("key", "jam_invites").maybeSingle(),
      userId
        ? supabase.from("profiles").select("role").eq("id", userId).single()
        : Promise.resolve({ data: null }),
      supabase
        .from("jams")
        .select("id, name, starts_at, ends_at, timezone, neighborhood, tickets_url, image_url, visibility, host_user_id")
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
        ? supabase.from("profiles").select("id, display_name, last_name, username").in("id", hostIds)
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
      profileById.set(p.id, { label: [p.display_name, p.last_name].filter(Boolean).join(" ") || p.username || null, username: p.username ?? null });
    }

    setData({
      userId,
      invitesEnabled: flagRes.data?.enabled ?? true,
      isAdmin: (adminRes.data as any)?.role === "admin",
      allJams,
      rsvpByJam,
      inviteByJam,
      genresByJam,
      themesByJam,
      profileById,
    });
  }

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-xl font-semibold">Jams</h1>
          <p className="text-sm text-zinc-500">Browse open jams or post your own.</p>
        </div>
        <section className="space-y-3">
          <div className="h-3 w-40 animate-pulse rounded bg-zinc-200" />
          <div className="grid grid-cols-1 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                <div className="shrink-0 w-20 animate-pulse bg-zinc-100 border-r border-zinc-100 py-10" />
                <div className="flex-1 p-4 space-y-2">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-100" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-100" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  const { userId, invitesEnabled, isAdmin, allJams, rsvpByJam, inviteByJam, genresByJam, themesByJam, profileById } = data;

  function cardProps(jam: any, opts: { isOfficial?: boolean; isHosting?: boolean } = {}) {
    return {
      jam,
      tags: [...(genresByJam.get(jam.id) ?? []), ...(themesByJam.get(jam.id) ?? [])],
      hostLabel: profileById.get(jam.host_user_id)?.label ?? null,
      hostUsername: profileById.get(jam.host_user_id)?.username ?? null,
      isOfficial: opts.isOfficial ?? false,
      isHosting: opts.isHosting ?? (!!userId && jam.host_user_id === userId),
      rsvp: (rsvpByJam.get(jam.id) as any) ?? null,
      isInvited: (inviteByJam.get(jam.id) as any)?.status === "pending",
    };
  }

  const now = new Date().toISOString();
  const upcomingOfficialJams = allJams.filter(
    (j) => j.visibility === "official" && (j.ends_at ?? j.starts_at) >= now
  );
  const pendingInviteJams = userId
    ? allJams.filter((j) =>
        j.host_user_id !== userId &&
        (inviteByJam.get(j.id) as any)?.status === "pending" &&
        (j.ends_at ?? j.starts_at) >= now
      )
    : [];
  const hostingJams = userId
    ? allJams.filter((j) =>
        j.visibility !== "official" &&
        j.host_user_id === userId &&
        (j.ends_at ?? j.starts_at) >= now
      )
    : [];
  const communityJams = userId
    ? allJams.filter((j) =>
        j.visibility === "community" &&
        j.host_user_id !== userId &&
        (inviteByJam.get(j.id) as any)?.status !== "pending" &&
        (j.ends_at ?? j.starts_at) >= now
      )
    : [];
  const privateJams = userId
    ? allJams.filter((j) => {
        if (j.visibility !== "private" || j.host_user_id === userId) return false;
        const s = (inviteByJam.get(j.id) as any)?.status;
        return (s === "accepted" || s === "declined") && (j.ends_at ?? j.starts_at) >= now;
      })
    : [];
  const pastJams = [...allJams]
    .reverse()
    .filter((j) => {
      if ((j.ends_at ?? j.starts_at) >= now) return false;
      if (j.visibility === "official") return true;
      if (!userId) return false;
      if (j.host_user_id === userId) return true;
      if (rsvpByJam.has(j.id)) return true;
      const s = (inviteByJam.get(j.id) as any)?.status;
      return s === "accepted" || s === "declined";
    });

  const isEmpty =
    upcomingOfficialJams.length === 0 &&
    pastJams.length === 0 &&
    pendingInviteJams.length === 0 &&
    hostingJams.length === 0 &&
    communityJams.length === 0 &&
    privateJams.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Jams</h1>
        <p className="text-sm text-zinc-500">Browse open jams or post your own.</p>
      </div>

      {userId && (invitesEnabled || isAdmin) && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Jams you're hosting</h2>
            <Link href="/jam/new" className="flex items-center justify-center rounded-lg p-1 text-zinc-400 hover:text-amber-500 hover:bg-amber-50 transition-colors" aria-label="Post a jam">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {hostingJams.map((jam) => <JamListCard key={jam.id} {...cardProps(jam, { isHosting: true })} onDeleted={fetchData} />)}
            <Link
              href="/jam/new"
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-200 px-4 py-4 text-sm font-medium text-zinc-400 hover:border-amber-300 hover:text-amber-500 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Post a jam
            </Link>
          </div>
        </section>
      )}

      {upcomingOfficialJams.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Upcoming SingJam events</h2>
          <div className="grid grid-cols-1 gap-3">
            {upcomingOfficialJams.map((jam) => <JamListCard key={jam.id} {...cardProps(jam, { isOfficial: true })} />)}
          </div>
        </section>
      )}

      {userId && pendingInviteJams.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Invitations</h2>
          <div className="grid grid-cols-1 gap-3">
            {pendingInviteJams.map((jam) => <JamListCard key={jam.id} {...cardProps(jam)} />)}
          </div>
        </section>
      )}

      {userId && communityJams.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Community jams</h2>
          <div className="grid grid-cols-1 gap-3">
            {communityJams.map((jam) => <JamListCard key={jam.id} {...cardProps(jam)} />)}
          </div>
        </section>
      )}

      {userId && privateJams.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Private jams</h2>
          <div className="grid grid-cols-1 gap-3">
            {privateJams.map((jam) => <JamListCard key={jam.id} {...cardProps(jam)} />)}
          </div>
        </section>
      )}

      {pastJams.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Past events</h2>
          <div className="grid grid-cols-1 gap-3">
            {pastJams.map((jam) => (
              <JamListCard
                key={jam.id}
                {...cardProps(jam, {
                  isOfficial: jam.visibility === "official",
                  isHosting: jam.host_user_id === userId,
                })}
                onDeleted={fetchData}
              />
            ))}
          </div>
        </section>
      )}

      {!userId && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
          <p className="text-base font-semibold text-zinc-900">Join the session</p>
          <p className="mt-2 text-sm text-zinc-500">
            Sign in to RSVP to community jams, post your own, and get invited to private sessions by other musicians.
          </p>
          <Link href="/auth" className="mt-4 inline-block text-sm font-medium text-amber-600 hover:text-amber-500">
            Sign in →
          </Link>
        </div>
      )}

      {userId && isEmpty && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
          <p className="text-sm text-zinc-500">No jams yet. Be the first to post one!</p>
        </div>
      )}
    </div>
  );
}
