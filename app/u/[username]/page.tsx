import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import ProfileDisplay from "@/components/ProfileDisplay";
import { fetchProfileSongs } from "@/lib/fetchProfileSongs";
import { getFeatureFlag } from "@/lib/featureFlags";

export default async function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await supabaseServer();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, last_name, username, avatar_url, neighborhood, singing_voice, instrument_levels, favorite_genres")
    .eq("username", username)
    .maybeSingle();

  if (!profile) notFound();

  const [{ sharedSongs, additionalSongs }, invitesEnabled] = await Promise.all([
    fetchProfileSongs(supabase, profile.id),
    getFeatureFlag("jam_invites"),
  ]);

  return <ProfileDisplay profile={profile as any} invitesEnabled={invitesEnabled} sharedSongs={sharedSongs} additionalSongs={additionalSongs} />;
}
