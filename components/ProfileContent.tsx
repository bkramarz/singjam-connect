"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import ProfileDisplay from "@/components/ProfileDisplay";

export default function ProfileContent() {
  const [profile, setProfile] = useState<any | null | "loading">("loading");
  const router = useRouter();
  const supabase = supabaseBrowser();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth"); return; }

      const { data } = await supabase
        .from("profiles")
        .select("display_name, last_name, username, avatar_url, neighborhood, singing_voice, instrument_levels, favorite_genres")
        .eq("id", session.user.id)
        .single();

      if (!data) { router.push("/account"); return; }
      setProfile(data);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (profile === "loading" || profile === null) return null;
  return <ProfileDisplay profile={profile} isOwner />;
}
