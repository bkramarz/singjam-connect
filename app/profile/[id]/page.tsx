import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import ProfileDisplay from "@/components/ProfileDisplay";
import { fetchProfileSongs } from "@/lib/fetchProfileSongs";

export default async function ProfileByIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, last_name, username, avatar_url, neighborhood, singing_voice, instrument_levels, favorite_genres")
    .eq("id", id)
    .maybeSingle();

  if (!profile) notFound();

  const { sharedSongs, additionalSongs } = await fetchProfileSongs(supabase, id);

  return <ProfileDisplay profile={profile as any} sharedSongs={sharedSongs} additionalSongs={additionalSongs} />;
}
