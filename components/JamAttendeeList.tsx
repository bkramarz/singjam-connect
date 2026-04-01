import { supabaseServer } from "@/lib/supabase/server";

const SINGING_LABEL: Record<string, string> = {
  lead: "Lead vocals",
  backup: "Backup vocals",
};

export default async function JamAttendeeList({ jamId }: { jamId: string }) {
  const supabase = await supabaseServer();

  const { data: rsvps } = await supabase
    .from("jam_rsvps")
    .select("user_id, waitlist_position, status")
    .eq("jam_id", jamId)
    .in("status", ["attending", "waitlist"])
    .order("created_at", { ascending: true });

  if (!rsvps || rsvps.length === 0) return null;

  const userIds = (rsvps as any[]).map((r: any) => r.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, last_name, username, singing_voice, instrument_levels")
    .in("id", userIds);

  const profileMap = new Map<string, any>();
  for (const p of (profiles ?? []) as any[]) {
    profileMap.set(p.id, p);
  }

  const attending = (rsvps as any[]).filter((r: any) => r.status === "attending");
  const waitlist = (rsvps as any[]).filter((r: any) => r.status === "waitlist");

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

  function AttendeeRow({ rsvp, badge }: { rsvp: any; badge: React.ReactNode }) {
    const p = profileMap.get(rsvp.user_id);
    const fullName = [p?.display_name, p?.last_name].filter(Boolean).join(" ") || p?.username || "Unknown";
    const tags = renderTags(p);

    return (
      <li className="py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-zinc-900">
            {fullName}
            {p?.username && (
              <span className="ml-1.5 text-xs font-normal text-zinc-400">@{p.username}</span>
            )}
          </p>
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
        Who's going <span className="text-sm font-normal text-zinc-400">({attending.length})</span>
      </h2>
      <ul className="divide-y divide-zinc-100">
        {attending.map((r: any) => (
          <AttendeeRow
            key={r.user_id}
            rsvp={r}
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
            rsvp={r}
            badge={
              <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                #{r.waitlist_position} waitlist
              </span>
            }
          />
        ))}
      </ul>
    </div>
  );
}
