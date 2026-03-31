import { supabaseServer } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import JamCard from "@/components/JamCard";

export default async function JamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data: jam } = await supabase
    .from("jams")
    .select(`
      id, name, visibility, starts_at, ends_at, neighborhood, notes, tickets_url, image_url,
      profiles(display_name, username),
      jam_genres(genres(name)),
      jam_themes(themes(name))
    `)
    .eq("id", id)
    .maybeSingle();

  if (!jam) notFound();

  const host = (jam.profiles as any);
  const hostLabel = host?.display_name ?? host?.username ?? null;
  const genres = ((jam.jam_genres ?? []) as any[]).map((g: any) => g.genres?.name).filter(Boolean) as string[];
  const themes = ((jam.jam_themes ?? []) as any[]).map((t: any) => t.themes?.name).filter(Boolean) as string[];

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
