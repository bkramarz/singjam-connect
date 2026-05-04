"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export type UserProfile = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
};

export function useProfile() {
  const supabase = supabaseBrowser();
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  async function loadProfile(userId: string, bust = false) {
    const { data } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url, is_admin")
      .eq("id", userId)
      .single();
    if (data && bust && data.avatar_url) {
      data.avatar_url = data.avatar_url + `?t=${Date.now()}`;
    }
    setProfile(data ?? null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setSignedIn(true);
        loadProfile(data.session.user.id);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
      if (session?.user) loadProfile(session.user.id);
      else setProfile(null);
    });

    function handleProfileUpdated() {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) loadProfile(data.user.id, true);
      });
    }
    window.addEventListener("profile-updated", handleProfileUpdated);

    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("profile-updated", handleProfileUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { signedIn, profile };
}
