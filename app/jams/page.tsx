import Link from "next/link";
import Image from "next/image";
import { FormattedDate, FormattedTime } from "@/components/FormattedTime";
import { getSessionServer, supabaseServer } from "@/lib/supabase/server";
import { getFeatureFlag } from "@/lib/featureFlags";
import Tooltip from "@/components/Tooltip";


function JamListCard({ jam, tags, hostLabel, isOfficial }: {
  jam: any;
  tags: string[];
  hostLabel?: string | null;
  isOfficial: boolean;
}) {
  const inner = (
    <div className={`flex overflow-hidden rounded-2xl border bg-white transition-colors ${isOfficial ? "border-amber-200 hover:border-amber-300" : "border-zinc-200 hover:border-zinc-300"}`}>
      {/* Date block or image */}
      {jam.image_url ? (
        <div className="relative shrink-0 w-24 sm:w-32 overflow-hidden">
          <Image src={jam.image_url} alt={jam.name ?? "Event"} fill className="object-cover" sizes="128px" unoptimized />
        </div>
      ) : jam.starts_at ? (
        <div className={`shrink-0 w-20 flex flex-col items-center justify-center border-r px-2 py-4 ${isOfficial ? "bg-amber-50 border-amber-200" : "bg-zinc-50 border-zinc-100"}`}>
          <span className={`text-xs font-semibold uppercase tracking-wide ${isOfficial ? "text-amber-500" : "text-zinc-400"}`}>
            <FormattedDate iso={jam.starts_at} options={{ month: "short" }} />
          </span>
          <span className="text-3xl font-bold text-zinc-900 leading-none">
            <FormattedDate iso={jam.starts_at} options={{ day: "numeric" }} />
          </span>
        </div>
      ) : null}

      <div className="flex-1 min-w-0 p-4">
        {isOfficial && (
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-500 mb-0.5">Official SingJam event</p>
        )}
        <p className="font-semibold text-zinc-900 truncate">{jam.name ?? (isOfficial ? "SingJam event" : "Community jam")}</p>
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
        {!isOfficial && hostLabel && (
          <p className="mt-2 text-xs text-zinc-400">Hosted by {hostLabel}</p>
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

  if (isOfficial) {
    return <div>{inner}</div>;
  }

  return (
    <Link href={`/jam/${jam.id}`} className="block">
      {inner}
    </Link>
  );
}

export default async function JamsPage() {
  const session = await getSessionServer();
  const supabase = await supabaseServer();

  const invitesEnabled = await getFeatureFlag("jam_invites");

  let isAdmin = false;
  if (session) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", session.user.id)
      .single();
    isAdmin = profile?.is_admin ?? false;
  }

  // Fetch jams without nested joins to avoid RLS nulling the row
  const { data: jams } = await supabase
    .from("jams")
    .select("id, name, starts_at, ends_at, neighborhood, notes, tickets_url, image_url, visibility, host_user_id")
    .order("starts_at", { ascending: true, nullsFirst: false })
    .limit(50);

  const officialJams = (jams ?? []).filter((j: any) => j.visibility === "official");
  const communityJams = (jams ?? []).filter((j: any) => j.visibility === "community");

  // Fetch tags and host profiles for all jams in parallel
  const jamIds = (jams ?? []).map((j: any) => j.id);
  const hostIds = [...new Set((jams ?? []).map((j: any) => j.host_user_id).filter(Boolean))];

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

  // Build lookup maps
  const genresByJam = new Map<string, string[]>();
  const themesByJam = new Map<string, string[]>();
  const profileById = new Map<string, string>();

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
    profileById.set(p.id, p.display_name ?? p.username ?? null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Jams</h1>
          <p className="text-sm text-zinc-500">Browse open jams or post your own.</p>
        </div>
        {session && (invitesEnabled || isAdmin) && (
          <Link
            href="/jam/new"
            className="self-start rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400 transition-colors sm:self-auto"
          >
            Post a jam
          </Link>
        )}
        {session && !invitesEnabled && !isAdmin && (
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
            {(officialJams as any[]).map((jam) => (
              <JamListCard
                key={jam.id}
                jam={jam}
                tags={[...(genresByJam.get(jam.id) ?? []), ...(themesByJam.get(jam.id) ?? [])]}
                isOfficial
              />
            ))}
          </div>
        </section>
      )}

      {session && communityJams.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Community jams</h2>
          <div className="grid gap-3">
            {(communityJams as any[]).map((jam) => (
              <JamListCard
                key={jam.id}
                jam={jam}
                tags={[...(genresByJam.get(jam.id) ?? []), ...(themesByJam.get(jam.id) ?? [])]}
                hostLabel={profileById.get(jam.host_user_id) ?? null}
                isOfficial={false}
              />
            ))}
          </div>
        </section>
      )}

      {!session && officialJams.length === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
          <p className="text-sm text-zinc-500">No upcoming events.</p>
        </div>
      )}
    </div>
  );
}
