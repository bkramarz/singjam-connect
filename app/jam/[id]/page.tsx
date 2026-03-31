import { supabaseServer } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import JamCard from "@/components/JamCard";

export default async function JamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const [jamRes, genresRes, themesRes] = await Promise.all([
    supabase
      .from("jams")
      .select("id, name, visibility, starts_at, ends_at, neighborhood, notes, tickets_url, image_url, profiles(display_name, username)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("jam_genres")
      .select("genres(name)")
      .eq("jam_id", id),
    supabase
      .from("jam_themes")
      .select("themes(name)")
      .eq("jam_id", id),
  ]);

  const jam = jamRes.data;
  if (!jam) notFound();

  const host = (jam.profiles as any);
  const hostLabel = host?.display_name ?? host?.username ?? null;
  const genres = ((genresRes.data ?? []) as any[]).map((g: any) => g.genres?.name).filter(Boolean) as string[];
  const themes = ((themesRes.data ?? []) as any[]).map((t: any) => t.themes?.name).filter(Boolean) as string[];

  return (
    <JamCard
      jam={{
        name: jam.name,
        visibility: jam.visibility as any,
        starts_at: jam.starts_at,
        ends_at: jam.ends_at,
        neighborhood: jam.neighborhood,
        notes: jam.notes,
        tickets_url: jam.tickets_url,
        image_url: jam.image_url,
        genres,
        themes,
        host: hostLabel,
      }}
    />
  );
}
