import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import JamEventCard, { type JamEventCardData } from "@/components/JamEventCard";

const getUpcomingJams = unstable_cache(
  async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from("jams")
      .select("id, name, starts_at, ends_at, timezone, neighborhood, tickets_url, image_url")
      .eq("visibility", "official")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(3);
    return data ?? [];
  },
  ["upcoming-jams"],
  { revalidate: 60, tags: ["upcoming-jams"] }
);

export function UpcomingJamsSkeleton() {
  return (
    <section className="space-y-3">
      <div className="h-3.5 w-32 animate-pulse rounded bg-zinc-200" />
      <div className="grid gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="flex overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <div className="shrink-0 w-20 animate-pulse bg-zinc-100 border-r border-zinc-100 py-10" />
            <div className="flex-1 p-4 space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-200" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-100" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function UpcomingJams() {
  const jams = await getUpcomingJams();
  if (jams.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-zinc-700">Upcoming events</h2>
      <div className="grid gap-3">
        {jams.map((jam) => (
          <JamEventCard key={jam.id} jam={jam as JamEventCardData} />
        ))}
      </div>
    </section>
  );
}
