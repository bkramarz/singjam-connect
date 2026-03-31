import Link from "next/link";
import { getSessionServer, supabaseServer } from "@/lib/supabase/server";

export default async function JamsPage() {
  const session = await getSessionServer();
  const supabase = await supabaseServer();
  const { data: jams } = await supabase
    .from("jams")
    .select("id, name, jam_type, starts_at, neighborhood, notes, tickets_url, visibility, created_at, host_user_id, profiles(display_name, username)")
    .order("starts_at", { ascending: true, nullsFirst: false })
    .limit(50);

  const publicJams = (jams ?? []).filter((j: any) => j.visibility === "public");
  const privateJams = (jams ?? []).filter((j: any) => j.visibility !== "public");

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Jams</h1>
          <p className="text-sm text-zinc-500">Browse open jams or post your own.</p>
        </div>
        {session && (
          <Link
            href="/jam/new"
            className="self-start rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400 transition-colors sm:self-auto"
          >
            Post a jam
          </Link>
        )}
      </div>

      {publicJams.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Upcoming SingJam events</h2>
          <div className="grid gap-3">
            {(publicJams as any[]).map((jam) => {
              const startsAt = jam.starts_at
                ? new Date(jam.starts_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                : null;
              return (
                <div
                  key={jam.id}
                  className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold text-zinc-900">{jam.name ?? jam.jam_type}</div>
                    {startsAt && <span className="shrink-0 text-xs text-zinc-400">{startsAt}</span>}
                  </div>
                  {jam.notes && (
                    <p className="mt-1 text-sm text-zinc-600 line-clamp-2">{jam.notes}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                    {jam.neighborhood && <span>{jam.neighborhood}</span>}
                  </div>
                  {jam.tickets_url && (
                    <a
                      href={jam.tickets_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-400 transition-colors"
                    >
                      Get tickets ↗
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {session && (
        <section className="space-y-3">
          {privateJams.length > 0 && (
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Community jams</h2>
          )}
          {privateJams.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-zinc-500">No community jams posted yet.</p>
              <Link
                href="/jam/new"
                className="mt-4 inline-block rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400 transition-colors"
              >
                Be the first to post one
              </Link>
            </div>
          ) : (
            <div className="grid gap-3">
              {(privateJams as any[]).map((jam) => {
                const host = jam.profiles;
                const hostLabel = host?.display_name ?? host?.username ?? "Someone";
                const startsAt = jam.starts_at
                  ? new Date(jam.starts_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                  : null;

                return (
                  <Link
                    key={jam.id}
                    href={`/jam/${jam.id}`}
                    className="block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-zinc-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-semibold text-zinc-900 capitalize">{jam.jam_type} jam</div>
                      {startsAt && (
                        <span className="shrink-0 text-xs text-zinc-400">{startsAt}</span>
                      )}
                    </div>
                    {jam.notes && (
                      <p className="mt-1 text-sm text-zinc-500 line-clamp-2">{jam.notes}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-400">
                      <span>Hosted by {hostLabel}</span>
                      {jam.neighborhood && <span>· {jam.neighborhood}</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {!session && publicJams.length === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-zinc-500">No jams posted yet.</p>
        </div>
      )}
    </div>
  );
}
