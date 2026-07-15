"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { SINGING_LABEL, voiceBadgeClass } from "@/lib/singingVoice";

type AttendeeData = {
  profileMap: Map<string, any>;
  attending: any[];
  waitlist: any[];
  totalGoing: number;
  cohostIds: Set<string>;
};

function parseTags(profile: any): { label: string; voice: "lead" | "backup" | null }[] {
  const tags: { label: string; voice: "lead" | "backup" | null }[] = [];
  const voices: string[] = (profile?.singing_voice ?? "")
    .split(",")
    .filter((v: string) => v && v !== "none");
  for (const v of voices) {
    if (SINGING_LABEL[v]) tags.push({ label: SINGING_LABEL[v], voice: v as "lead" | "backup" });
  }
  const instruments: Record<string, string> = profile?.instrument_levels ?? {};
  for (const [name, level] of Object.entries(instruments)) {
    tags.push({ label: `${name} · ${level}`, voice: null });
  }
  return tags;
}

function AttendeeRow({ profile, badge, action }: { profile: any; badge: ReactNode; action?: ReactNode }) {
  const fullName = [profile?.display_name, profile?.last_name].filter(Boolean).join(" ") || profile?.username || "Unknown";
  const tags = parseTags(profile);
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        {profile?.username ? (
          <Link href={`/u/${profile.username}`} className="text-sm font-medium text-zinc-900 hover:underline">
            {fullName}
            <span className="ml-1.5 text-xs font-normal text-zinc-400">@{profile.username}</span>
          </Link>
        ) : (
          <p className="text-sm font-medium text-zinc-900">{fullName}</p>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {badge}
          {action}
        </div>
      </div>
      {tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {tags.map(({ label, voice }) => (
            <span
              key={label}
              className={`rounded-full border px-2.5 py-0.5 text-xs ${voiceBadgeClass(voice)}`}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

export default function JamAttendeeList({ jamId, hostId, isHost }: { jamId: string; hostId: string; isHost: boolean }) {
  const [data, setData] = useState<AttendeeData | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const supabase = supabaseBrowser();

  useEffect(() => {
    (async () => {
      const [rsvpsRes, hostRes, cohostsRes] = await Promise.all([
        supabase
          .from("jam_rsvps")
          .select("user_id, waitlist_position, status")
          .eq("jam_id", jamId)
          .in("status", ["attending", "waitlist"])
          .order("created_at", { ascending: true }),
        supabase
          .from("profiles")
          .select("id, display_name, last_name, username, singing_voice, instrument_levels")
          .eq("id", hostId)
          .single(),
        supabase.from("jam_cohosts").select("user_id").eq("jam_id", jamId),
      ]);

      const rsvps = rsvpsRes.data ?? [];
      const hostProfile = hostRes.data;
      const cohostIds = new Set<string>(((cohostsRes.data ?? []) as any[]).map((c: any) => c.user_id));
      const attendeeIds = (rsvps as any[])
        .map((r: any) => r.user_id)
        .filter((uid: string) => uid !== hostId);

      const profileMap = new Map<string, any>();
      if (hostProfile) profileMap.set(hostId, hostProfile);

      if (attendeeIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, last_name, username, singing_voice, instrument_levels")
          .in("id", attendeeIds);
        for (const p of (profiles ?? []) as any[]) {
          profileMap.set(p.id, p);
        }
      }

      const attending = (rsvps as any[]).filter((r: any) => r.status === "attending" && r.user_id !== hostId);
      const waitlist = (rsvps as any[]).filter((r: any) => r.status === "waitlist");

      setData({ profileMap, attending, waitlist, totalGoing: 1 + attending.length, cohostIds });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jamId, hostId]);

  async function toggleCohost(userId: string, makeCohost: boolean) {
    setPending(userId);
    const res = await fetch(`/api/jam/${jamId}/cohosts`, {
      method: makeCohost ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      setData((prev) => {
        if (!prev) return prev;
        const cohostIds = new Set(prev.cohostIds);
        if (makeCohost) cohostIds.add(userId);
        else cohostIds.delete(userId);
        return { ...prev, cohostIds };
      });
    }
    setPending(null);
  }

  if (!data) return null;
  const { profileMap, attending, waitlist, totalGoing, cohostIds } = data;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-1">
      <h2 className="text-base font-semibold mb-2">
        Who's going <span className="text-sm font-normal text-zinc-400">({totalGoing})</span>
      </h2>
      <ul className="divide-y divide-zinc-100">
        <AttendeeRow
          profile={profileMap.get(hostId)}
          badge={
            <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              Host
            </span>
          }
        />
        {attending.map((r: any) => {
          const isCohost = cohostIds.has(r.user_id);
          return (
            <AttendeeRow
              key={r.user_id}
              profile={profileMap.get(r.user_id)}
              badge={
                isCohost ? (
                  <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                    Co-host
                  </span>
                ) : (
                  <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    Going
                  </span>
                )
              }
              action={
                isHost && (
                  <button
                    onClick={() => toggleCohost(r.user_id, !isCohost)}
                    disabled={pending === r.user_id}
                    className="rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
                  >
                    {isCohost ? "Remove co-host" : "Make co-host"}
                  </button>
                )
              }
            />
          );
        })}
        {waitlist.map((r: any) => (
          <AttendeeRow
            key={r.user_id}
            profile={profileMap.get(r.user_id)}
            badge={
              <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                #{r.waitlist_position} waitlist
              </span>
            }
          />
        ))}
      </ul>
    </div>
  );
}
