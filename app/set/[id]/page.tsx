import { notFound } from "next/navigation";
import { Suspense } from "react";
import { supabaseServer } from "@/lib/supabase/server";
import SetDetail from "@/components/SetDetail";
import SetRequestAccess from "@/components/SetRequestAccess";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("sets").select("name").eq("id", id).single();
  return { title: (data as any)?.name ?? "Set" };
}

export default async function SetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data: { user } } = await supabase.auth.getUser();

  const [setRes, songsRes, collabRes, requestsRes, profileRes] = await Promise.all([
    supabase
      .from("sets")
      .select("id, name, description, owner_user_id, jam_id, link_sharing, youtube_playlist_id, youtube_playlist_fingerprint, spotify_playlist_id, spotify_playlist_fingerprint, profiles(display_name, last_name, username, avatar_url)")
      .eq("id", id)
      .single(),
    supabase
      .from("set_songs")
      .select("id, song_id, position, key_note, leader_user_ids, songs(title, display_artist, slug, chord_chart_url, youtube_url, tonality, song_recording_artists(position, youtube_url, spotify_url))")
      .eq("set_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("set_collaborators")
      .select("id, user_id, status, role, profiles!user_id(display_name, last_name, username, avatar_url)")
      .eq("set_id", id)
      .eq("status", "accepted"),
    supabase
      .from("set_collaborators")
      .select("id, user_id, status, role, profiles!user_id(display_name, last_name, username, avatar_url)")
      .eq("set_id", id)
      .eq("status", "requested"),
    user
      ? supabase.from("profiles").select("is_admin").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
  ]);

  if (!setRes.data) notFound();

  const set = setRes.data as any;
  const songs = (songsRes.data ?? []) as any[];
  const accessRequests = (requestsRes.data ?? []) as any[];
  const collaborators = (collabRes.data ?? []).sort((a: any, b: any) => {
    const nameA = (a.profiles?.display_name ?? a.profiles?.username ?? "").toLowerCase();
    const nameB = (b.profiles?.display_name ?? b.profiles?.username ?? "").toLowerCase();
    return nameA.localeCompare(nameB);
  }) as any[];

  const songIds = songs.map((s: any) => s.song_id);
  const participantIds = [set.owner_user_id, ...collaborators.map((c: any) => c.user_id)].filter(Boolean) as string[];
  const leaderEligible = songIds.length > 0 && participantIds.length > 0
    ? ((await supabase.from("user_songs").select("user_id, song_id").in("user_id", participantIds).in("song_id", songIds).eq("confidence", "lead")).data ?? []) as { user_id: string; song_id: string }[]
    : [];

  const jamSharedSongs = (set.jam_id && user)
    ? ((await supabase.rpc("jam_shared_songs", { jam_id_param: set.jam_id })).data ?? []) as any[]
    : [];

  const isOwner = user?.id === set.owner_user_id;
  const isCollaborator = collaborators.some((c: any) => c.user_id === user?.id);
  const isEditorCollaborator = collaborators.some((c: any) => c.user_id === user?.id && c.role === "editor");
  const isAdmin = (profileRes as any)?.data?.is_admin ?? false;
  const isPublicViewer = !isOwner && !isCollaborator && !isAdmin && set.link_sharing === "view";

  if (!isOwner && !isCollaborator && !isAdmin && set.link_sharing === "disabled") {
    return <SetRequestAccess setId={set.id} setName={set.name} isLoggedIn={!!user} />;
  }

  return (
    <Suspense>
      <SetDetail
        set={set}
        initialSongs={songs}
        collaborators={collaborators}
        accessRequests={accessRequests}
        currentUserId={user?.id ?? null}
        canEdit={isOwner || isEditorCollaborator}
        isOwner={isOwner}
        isAdmin={isAdmin}
        isPublicViewer={isPublicViewer}
        jamSharedSongs={jamSharedSongs}
        leaderEligible={leaderEligible}
      />
    </Suspense>
  );
}
