import { getServerSupabase } from "@/lib/supabase/cached";
import { fetchProfileSongs } from "@/lib/fetchProfileSongs";
import ProfileDisplay, { type ProfileData } from "@/components/ProfileDisplay";

export default async function ProfileByIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();

  const [profileRes, flagRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, last_name, username, avatar_url, neighborhood, singing_voice, instrument_levels, favorite_genres")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("feature_flags").select("enabled").eq("key", "jam_invites").maybeSingle(),
  ]);

  if (!profileRes.data) return <p className="text-sm text-zinc-500">User not found.</p>;

  const profile = profileRes.data as ProfileData;
  const invitesEnabled = flagRes.data?.enabled ?? true;
  const { sharedSongs, additionalSongs, wantsToLearnSongs } = await fetchProfileSongs(supabase, profile.id);

  return (
    <ProfileDisplay
      profile={profile}
      invitesEnabled={invitesEnabled}
      sharedSongs={sharedSongs}
      additionalSongs={additionalSongs}
      wantsToLearnSongs={wantsToLearnSongs}
    />
  );
}
