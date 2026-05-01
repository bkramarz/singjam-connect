import { unstable_cache } from "next/cache";
import { supabasePublic } from "@/lib/supabase/public";
import JamEventCard, { type JamEventCardData } from "@/components/JamEventCard";

const getUpcomingJams = unstable_cache(
  async () => {
    const { data } = await supabasePublic()
      .from("jams")
      .select("id, name, starts_at, ends_at, neighborhood, tickets_url, image_url")
      .eq("visibility", "official")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(3);
    return (data ?? []) as JamEventCardData[];
  },
  ["upcoming-jams"],
  { revalidate: 300 }
);

export default async function UpcomingJams() {
  const jams = await getUpcomingJams();

  if (jams.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-zinc-700">Upcoming events</h2>
      <div className="grid gap-3">
        {jams.map((jam) => (
          <JamEventCard key={jam.id} jam={jam} />
        ))}
      </div>
    </section>
  );
}
