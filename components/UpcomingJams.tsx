"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import JamEventCard, { type JamEventCardData } from "@/components/JamEventCard";

export default function UpcomingJams() {
  const [jams, setJams] = useState<JamEventCardData[] | null>(null);

  useEffect(() => {
    supabaseBrowser()
      .from("jams")
      .select("id, name, starts_at, ends_at, neighborhood, tickets_url, image_url")
      .eq("visibility", "official")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(3)
      .then(({ data }) => setJams(data ?? []));
  }, []);

  if (!jams || jams.length === 0) return null;

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
