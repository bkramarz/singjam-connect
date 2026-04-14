import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

const SINGING_LABEL: Record<string, string> = {
  lead: "Lead vocals",
  backup: "Backup vocals",
};

export default async function JamAttendeeList({ jamId, hostId }: { jamId: string; hostId: string }) {
  const supabase = await supabaseServer();

  const [rsvpsRes, hostRes] = await Promise.all([
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
  ]);

  const rsvps = rsvpsRes.data ?? [];
  const hostProfile = hostRes.data;

  // Fetch attendee profiles (excluding host if they RSVPd separately)
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

  // Total going = host + attending RSVPs
  const totalGoing = 1 + attending.length;

  function renderTags(profile: any) {
    const tags: string[] = [];
    const voices: string[] = (profile?.singing_voice ?? "")
      .split(",")
      .filter((v: string) => v && v !== "none");
    for (const v of voices) {
      if (SINGING_LABEL[v]) tags.push(SINGING_LABEL[v]);
    }
    const instruments: Record<string, string> = profile?.instrument_levels ?? {};
    for (const [name, level] of Object.entries(instruments)) {
      tags.push(`${name} · ${level}`);
    }
    return tags;
  }

  function AttendeeRow({ userId, badge }: { userId: string; badge: React.ReactNode }) {
    const p = profileMap.get(userId);
    const fullName = [p?.display_name, p?.last_name].filter(Boolean).join(" ") || p?.username || "Unknown";
    const tags = renderTags(p);

    return (
      <li className="py-3">
        <div className="flex items-center justify-between gap-3">
          {p?.username ? (
            <Link href={`/u/${p.username}`} className="text-sm font-medium text-zinc-900 hover:underline">
              {fullName}
              <span className="ml-1.5 text-xs font-normal text-zinc-400">@{p.username}</span>
            </Link>
          ) : (
            <p className="text-sm font-medium text-zinc-900">{fullName}</p>
          )}
          {badge}
        </div>
        {tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs text-zinc-600">
                {t}
              </span>
            ))}
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-1">
      <h2 className="text-base font-semibold mb-2">
        Who's going <span className="text-sm font-normal text-zinc-400">({totalGoing})</span>
      </h2>
      <ul className="divide-y divide-zinc-100">
        {/* Host always first */}
        <AttendeeRow
          userId={hostId}
          badge={
            <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              Host
            </span>
          }
        />
        {attending.map((r: any) => (
          <AttendeeRow
            key={r.user_id}
            userId={r.user_id}
            badge={
              <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                Going
              </span>
            }
          />
        ))}
        {waitlist.map((r: any) => (
          <AttendeeRow
            key={r.user_id}
            userId={r.user_id}
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
