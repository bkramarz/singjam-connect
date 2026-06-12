import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import PDFBuilderLoader from "./PDFBuilderLoader";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("sets").select("name").eq("id", id).single();
  return { title: `${(data as any)?.name ?? "Set"} | PDF Builder` };
}

export default async function SetPDFPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ order?: string }> }) {
  const { id } = await params;
  const { order } = await searchParams;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const [setRes, songsRes, authCollabRes, allCollabsRes] = await Promise.all([
    supabase.from("sets").select("id, name, owner_user_id, link_sharing, profiles(display_name, username)").eq("id", id).single(),
    supabase
      .from("set_songs")
      .select("song_id, position, key_note, leader_user_ids, songs(title, display_artist, tonality, song_recording_artists(position, youtube_url), song_composers(people(name)))")
      .eq("set_id", id)
      .order("position", { ascending: true }),
    user
      ? supabase.from("set_collaborators").select("user_id").eq("set_id", id).eq("status", "accepted").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("set_collaborators")
      .select("user_id, profiles!user_id(display_name, username)")
      .eq("set_id", id)
      .eq("status", "accepted"),
  ]);

  const set = setRes.data as any;
  if (!set) redirect(`/set/${id}`);

  const isOwner = user?.id === set.owner_user_id;
  const isCollaborator = !!authCollabRes.data;
  if (!isOwner && !isCollaborator && set.link_sharing !== "view") redirect(`/set/${id}`);

  const participantMap = new Map<string, string>();
  if (set.profiles) {
    const ownerName = set.profiles.display_name ?? set.profiles.username;
    if (ownerName) participantMap.set(set.owner_user_id, ownerName);
  }
  for (const collab of (allCollabsRes.data ?? [])) {
    const name = (collab.profiles as any)?.display_name ?? (collab.profiles as any)?.username;
    if (name && collab.user_id) participantMap.set(collab.user_id as string, name);
  }

  let rawSongs = (songsRes.data ?? []).map((s: any) => {
    const songwriters = (s.songs?.song_composers ?? [])
      .map((sc: any) => sc.people?.name)
      .filter(Boolean) as string[];

    return {
      song_id: s.song_id as string,
      title: (s.songs?.title ?? "") as string,
      artist: (s.songs?.display_artist ?? null) as string | null,
      key: (s.key_note ?? null) as string | null,
      tonality: (s.songs?.tonality ?? null) as string | null,
      songwriters,
      leaders: ((s.leader_user_ids ?? []) as string[])
        .map((uid) => participantMap.get(uid))
        .filter(Boolean) as string[],
    };
  });

  if (order) {
    const orderIds = order.split(",");
    rawSongs.sort((a, b) => {
      const ai = orderIds.indexOf(a.song_id);
      const bi = orderIds.indexOf(b.song_id);
      return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
    });
  }

  const songs = rawSongs.map(({ song_id: _id, ...rest }, idx) => ({ position: idx + 1, ...rest }));

  return <PDFBuilderLoader setName={set.name} songs={songs} />;
}
