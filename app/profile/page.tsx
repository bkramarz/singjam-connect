import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import ProfileDisplay from "@/components/ProfileDisplay";

export default async function ProfilePage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, last_name, username, avatar_url, neighborhood, singing_voice, instrument_levels, favorite_genres")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/account");

  return <ProfileDisplay profile={profile as any} isOwner />;
}
