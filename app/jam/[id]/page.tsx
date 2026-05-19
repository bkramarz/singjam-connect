import type { Metadata } from "next";
import { Suspense } from "react";
import { supabaseServer } from "@/lib/supabase/server";
import JamContent from "@/components/JamContent";
import JamLoading from "./loading";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("jams")
    .select("name, starts_at, neighborhood, visibility, profiles(display_name, last_name, username)")
    .eq("id", id)
    .single();
  if (!data) return { title: "Jam" };
  const jam = data as any;
  const name = jam.name ?? "Jam";
  const host = jam.profiles?.display_name ?? jam.profiles?.username ?? null;
  const date = jam.starts_at
    ? new Date(jam.starts_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;
  const parts = [date, jam.neighborhood, host ? `Hosted by ${host}` : null].filter(Boolean);
  const description = parts.length
    ? `${parts.join(" · ")}. RSVP and jam together on SingJam.`
    : "An upcoming jam on SingJam. RSVP and join the music.";
  return {
    title: name,
    description,
    openGraph: { title: name, description },
  };
}

export default function JamPage() {
  return (
    <Suspense fallback={<JamLoading />}>
      <JamContent />
    </Suspense>
  );
}
