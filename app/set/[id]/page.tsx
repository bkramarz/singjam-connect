import { notFound } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import SetDetail from "@/components/SetDetail";
import SetRequestAccess from "@/components/SetRequestAccess";
import SetJoinPrompt from "@/components/SetJoinPrompt";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const [setRes, countRes] = await Promise.all([
    supabase.from("sets").select("name, description, profiles(display_name, last_name, username)").eq("id", id).single(),
    supabase.from("set_songs").select("id", { count: "exact", head: true }).eq("set_id", id),
  ]);
  if (!setRes.data) return { title: "Set" };
  const set = setRes.data as any;
  const name = set.name ?? "Set";
  const owner = set.profiles?.display_name ?? set.profiles?.username ?? null;
  const songCount = countRes.count ?? 0;
  const description = [
    set.description || null,
    owner ? `Curated by ${owner}.` : null,
    songCount > 0 ? `${songCount} song${songCount === 1 ? "" : "s"} in this set.` : null,
  ].filter(Boolean).join(" ") || "A collaborative song set on SingJam.";
  return {
    title: name,
    description,
    openGraph: { title: name, description },
  };
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
      .select("id, name, description, owner_user_id, jam_id, link_sharing, youtube_playlist_id, youtube_playlist_fingerprint, spotify_playlist_id, spotify_playlist_fingerprint, ultimate_guitar_playlist_url, profiles(display_name, last_name, username, avatar_url)")
      .eq("id", id)
      .single(),
    supabase
      .from("set_songs")
      .select("id, song_id, position, key_note, leader_user_ids, songs(title, display_artist, slug, chord_chart_url, youtube_url, tonality, year, meter, song_composers(people(name)), song_lyricists(people(name)), song_cultures(cultures(name), context), song_genres(genres(name)), song_themes(themes(name)), song_recording_artists(position, youtube_url, spotify_url))")
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
      ? supabase.from("profiles").select("role, singing_voice").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
  ]);

  if (!setRes.data) notFound();

  const set = setRes.data as any;
  const songs = (songsRes.data ?? []) as any[];
  const accessRequests = (requestsRes.data ?? []) as any[];

  const sortCollaborators = (list: any[]) =>
    [...list].sort((a, b) => {
      const nameA = (a.profiles?.display_name ?? a.profiles?.username ?? "").toLowerCase();
      const nameB = (b.profiles?.display_name ?? b.profiles?.username ?? "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

  let collaborators = sortCollaborators(collabRes.data ?? []);

  const isOwner = user?.id === set.owner_user_id;
  const isAdmin = (profileRes as any)?.data?.role === "admin";
  const currentUserSingingVoice: string | null = (profileRes as any)?.data?.singing_voice ?? null;

  // Auto-join for 'link' mode — logged-in users are added as viewers on first visit
  if (set.link_sharing === "link" && user && !isOwner && !isAdmin) {
    const alreadyJoined = collaborators.some((c: any) => c.user_id === user.id);
    if (!alreadyJoined) {
      const admin = supabaseAdmin();
      const { data: existing } = await admin
        .from("set_collaborators")
        .select("id")
        .eq("set_id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existing) {
        const { data: newCollab } = await admin
          .from("set_collaborators")
          .insert({ set_id: id, user_id: user.id, invited_by: user.id, status: "accepted", role: "viewer" })
          .select("id, user_id, status, role, profiles!user_id(display_name, last_name, username, avatar_url)")
          .single();

        if (newCollab) collaborators = sortCollaborators([...collaborators, newCollab as any]);
      }
    }
  }

  const isCollaborator = collaborators.some((c: any) => c.user_id === user?.id);
  const isEditorCollaborator = collaborators.some((c: any) => c.user_id === user?.id && c.role === "editor");

  // Gate by visibility mode
  if (!isOwner && !isCollaborator && !isAdmin) {
    if (set.link_sharing === "private") {
      return <SetRequestAccess setId={set.id} setName={set.name} isLoggedIn={!!user} />;
    }
    if (set.link_sharing === "link" && !user) {
      // Open-join sets require a SingJam account to auto-join
      return (
        <SetJoinPrompt
          setId={set.id}
          setName={set.name}
          ownerName={set.profiles?.display_name ?? set.profiles?.username ?? null}
          mode="join"
        />
      );
    }
    // 'public' sets are open to everyone — fall through
  }

  const isPublicViewer = !isOwner && !isCollaborator;

  const songIds = songs.map((s: any) => s.song_id);
  const participantIds = [set.owner_user_id, ...collaborators.map((c: any) => c.user_id)].filter(Boolean) as string[];

  // Fetch all knowledge levels for every participant × song combination
  const songKnowledge = songIds.length > 0 && participantIds.length > 0
    ? ((await supabase
        .from("user_songs")
        .select("user_id, song_id, confidence")
        .in("user_id", participantIds)
        .in("song_id", songIds)
        .in("confidence", ["lead", "support", "learn"])
      ).data ?? []) as { user_id: string; song_id: string; confidence: string }[]
    : [];

  const [jamSharedSongs, canAccessJam] = await Promise.all([
    set.jam_id && user
      ? supabase.rpc("jam_shared_songs", { jam_id_param: set.jam_id }).then(r => (r.data ?? []) as any[])
      : Promise.resolve([] as any[]),
    set.jam_id
      ? supabase.from("jams").select("id").eq("id", set.jam_id).maybeSingle().then(r => r.data !== null)
      : Promise.resolve(false),
  ]);

  return (
    <Suspense>
      <SetDetail
        set={set}
        initialSongs={songs}
        collaborators={collaborators}
        accessRequests={accessRequests}
        currentUserId={user?.id ?? null}
        currentUserSingingVoice={currentUserSingingVoice}
        canEdit={isOwner || isEditorCollaborator}
        isOwner={isOwner}
        isAdmin={isAdmin}
        isPublicViewer={isPublicViewer}
        jamSharedSongs={jamSharedSongs}
        songKnowledge={songKnowledge}
        canAccessJam={canAccessJam}
      />
    </Suspense>
  );
}
