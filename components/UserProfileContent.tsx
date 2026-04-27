"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fetchProfileSongs, type ProfileSong } from "@/lib/fetchProfileSongs";
import ProfileDisplay from "@/components/ProfileDisplay";

type Profile = {
  id: string;
  display_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
  neighborhood: string | null;
  singing_voice: string | null;
  instrument_levels: any;
  favorite_genres: any;
};

type State =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "ready"; profile: Profile; invitesEnabled: boolean; sharedSongs: ProfileSong[]; additionalSongs: ProfileSong[] };

export default function UserProfileContent() {
  const params = useParams();
  const username = params.username as string;
  const [state, setState] = useState<State>({ status: "loading" });
  const supabase = supabaseBrowser();

  useEffect(() => {
    (async () => {
      const [profileRes, flagRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, last_name, username, avatar_url, neighborhood, singing_voice, instrument_levels, favorite_genres")
          .eq("username", username)
          .maybeSingle(),
        supabase.from("feature_flags").select("enabled").eq("key", "jam_invites").maybeSingle(),
      ]);

      if (!profileRes.data) { setState({ status: "not_found" }); return; }

      const profile = profileRes.data as Profile;
      const invitesEnabled = flagRes.data?.enabled ?? true;
      const { sharedSongs, additionalSongs } = await fetchProfileSongs(supabase, profile.id);

      setState({ status: "ready", profile, invitesEnabled, sharedSongs, additionalSongs });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  if (state.status === "loading") return null;
  if (state.status === "not_found") return <p className="text-sm text-zinc-500">User not found.</p>;

  return (
    <ProfileDisplay
      profile={state.profile}
      invitesEnabled={state.invitesEnabled}
      sharedSongs={state.sharedSongs}
      additionalSongs={state.additionalSongs}
    />
  );
}
