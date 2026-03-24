import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import ProfileDisplay from "@/components/ProfileDisplay";

export default async function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await supabaseServer();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, last_name, username, avatar_url, neighborhood, singing_voice, instrument_levels, favorite_genres")
    .eq("username", username)
    .maybeSingle();

  if (!profile) notFound();

  const { data: shared } = await supabase.rpc("shared_songs_with", {
    other_user_id: profile.id,
  });

  const sharedSongs = (shared ?? []) as { song_id: string; title: string; display_artist: string | null }[];

  return <ProfileDisplay profile={profile as any} sharedSongs={sharedSongs} />;
}
