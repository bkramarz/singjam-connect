import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import ProfileDisplay from "@/components/ProfileDisplay";
import { fetchProfileSongs } from "@/lib/fetchProfileSongs";

export default async function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await supabaseServer();

  const [profileRes, flagRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, last_name, username, avatar_url, neighborhood, singing_voice, instrument_levels, favorite_genres")
      .eq("username", username)
      .maybeSingle(),
    supabase.from("feature_flags").select("enabled").eq("key", "jam_invites").maybeSingle(),
  ]);

  if (!profileRes.data) notFound();

  const profile = profileRes.data;
  const invitesEnabled = flagRes.data?.enabled ?? true;
  const { sharedSongs, additionalSongs } = await fetchProfileSongs(supabase, profile.id);

  return <ProfileDisplay profile={profile as any} invitesEnabled={invitesEnabled} sharedSongs={sharedSongs} additionalSongs={additionalSongs} />;
}
