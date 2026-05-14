import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import PDFBuilderLoader from "./PDFBuilderLoader";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("sets").select("name").eq("id", id).single();
  return { title: `${(data as any)?.name ?? "Set"} — PDF Builder` };
}

export default async function SetPDFPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const [setRes, songsRes, collabRes] = await Promise.all([
    supabase.from("sets").select("id, name, owner_user_id, link_sharing").eq("id", id).single(),
    supabase
      .from("set_songs")
      .select("position, key_note, songs(title, display_artist, tonality, song_recording_artists(position, youtube_url), song_composers(people(name)))")
      .eq("set_id", id)
      .order("position", { ascending: true }),
    user
      ? supabase.from("set_collaborators").select("user_id").eq("set_id", id).eq("status", "accepted").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const set = setRes.data as any;
  if (!set) redirect(`/set/${id}`);

  const isOwner = user?.id === set.owner_user_id;
  const isCollaborator = !!collabRes.data;
  if (!isOwner && !isCollaborator && set.link_sharing !== "view") redirect(`/set/${id}`);

  const songs = (songsRes.data ?? []).map((s: any, idx: number) => {
    const songwriters = (s.songs?.song_composers ?? [])
      .map((sc: any) => sc.people?.name)
      .filter(Boolean) as string[];

    return {
      position: idx + 1,
      title: (s.songs?.title ?? "") as string,
      artist: (s.songs?.display_artist ?? null) as string | null,
      key: (s.key_note ?? null) as string | null,
      tonality: (s.songs?.tonality ?? null) as string | null,
      songwriters,
    };
  });

  return <PDFBuilderLoader setName={set.name} songs={songs} />;
}
