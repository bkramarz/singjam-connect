import Link from "next/link";
import HomeButtons from "@/components/HomeButtons";
import { supabaseServer } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await supabaseServer();
  const { data: publicJams } = await supabase
    .from("jams")
    .select("id, name, jam_type, starts_at, neighborhood, tickets_url")
    .eq("visibility", "public")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(3);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 px-6 py-10 sm:px-12 sm:py-14">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/20 via-transparent to-transparent" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Bay Area music community
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Build your repertoire.<br />
            <span className="text-amber-400">Sing and jam with friends.</span>
          </h1>
          <div className="mt-8 flex flex-wrap gap-3">
            <HomeButtons />
          </div>
        </div>
      </div>

      {publicJams && publicJams.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700">Upcoming events</h2>
          <div className="grid gap-3">
            {(publicJams as any[]).map((jam) => {
              const startsAt = jam.starts_at
                ? new Date(jam.starts_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                : null;
              return (
                <div
                  key={jam.id}
                  className="rounded-2xl border border-amber-200 bg-amber-50 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold text-zinc-900">{jam.name ?? jam.jam_type}</div>
                    {startsAt && <span className="shrink-0 text-xs text-zinc-400">{startsAt}</span>}
                  </div>
                  {jam.neighborhood && (
                    <p className="mt-1 text-sm text-zinc-500">{jam.neighborhood}</p>
                  )}
                  {jam.tickets_url ? (
                    <a
                      href={jam.tickets_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-400 transition-colors"
                    >
                      Get tickets ↗
                    </a>
                  ) : (
                    <Link
                      href={`/jam/${jam.id}`}
                      className="mt-3 inline-block text-xs font-medium text-amber-600 hover:text-amber-500"
                    >
                      Learn more →
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
