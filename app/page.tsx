import Link from "next/link";
import Image from "next/image";
import HomeButtons from "@/components/HomeButtons";
import { supabaseServer } from "@/lib/supabase/server";
import { FormattedDate, FormattedTime } from "@/components/FormattedTime";

export default async function HomePage() {
  const supabase = await supabaseServer();
  const { data: upcomingJams } = await supabase
    .from("jams")
    .select("id, name, starts_at, ends_at, neighborhood, tickets_url, image_url")
    .eq("visibility", "official")
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

      {upcomingJams && upcomingJams.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700">Upcoming events</h2>
          <div className="grid gap-3">
            {(upcomingJams as any[]).map((jam) => (
              <JamEventCard key={jam.id} jam={jam} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function JamEventCard({ jam }: { jam: any }) {
  return (
    <div className="flex overflow-hidden rounded-2xl border border-amber-200 bg-white">
      {/* Cover image or date block */}
      {jam.image_url ? (
        <div className="relative shrink-0 w-24 sm:w-32 overflow-hidden">
          <Image src={jam.image_url} alt={jam.name ?? "Event"} fill className="object-cover" sizes="128px" unoptimized />
        </div>
      ) : jam.starts_at ? (
        <div className="shrink-0 w-20 flex flex-col items-center justify-center bg-amber-50 border-r border-amber-200 px-2 py-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-500">
            <FormattedDate iso={jam.starts_at} options={{ weekday: "short" }} />
          </span>
          <span className="text-3xl font-bold text-zinc-900 leading-none">
            <FormattedDate iso={jam.starts_at} options={{ day: "numeric" }} />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-500">
            <FormattedDate iso={jam.starts_at} options={{ month: "short" }} />
          </span>
        </div>
      ) : null}

      <div className="flex-1 min-w-0 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-500 mb-0.5">Official SingJam event</p>
        <p className="font-semibold text-zinc-900 truncate">{jam.name ?? "SingJam event"}</p>
        {jam.starts_at && (
          <p className="text-xs text-zinc-500 mt-0.5">
            <FormattedDate iso={jam.starts_at} options={{ weekday: "short", month: "short", day: "numeric" }} />
            {" · "}
            <FormattedTime iso={jam.starts_at} />
            {jam.ends_at && <> – <FormattedTime iso={jam.ends_at} /></>}
          </p>
        )}
        {jam.neighborhood && <p className="text-xs text-zinc-400 mt-0.5">{jam.neighborhood}</p>}
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
      </div>
    </div>
  );
}
