"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export type UserProfile = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
};

type ProfileContextValue = {
  signedIn: boolean;
  profile: UserProfile | null;
  unread: number;
};

const ProfileContext = createContext<ProfileContextValue>({
  signedIn: false,
  profile: null,
  unread: 0,
});

export function useProfile() {
  return useContext(ProfileContext);
}

export default function ProfileProvider({ children }: { children: React.ReactNode }) {
  const supabase = useRef(supabaseBrowser()).current;
  const userIdRef = useRef<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile(userId: string, bust = false) {
      const { data } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url, role")
        .eq("id", userId)
        .single();
      if (cancelled) return;
      if (data && bust && data.avatar_url) {
        data.avatar_url = data.avatar_url + `?t=${Date.now()}`;
      }
      setProfile(data ?? null);
    }

    async function loadUnread(userId: string) {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("read", false);
      if (!cancelled) setUnread(count ?? 0);
    }

    function handleUser(userId: string | null) {
      setSignedIn(!!userId);
      if (!userId) {
        userIdRef.current = null;
        setProfile(null);
        setUnread(0);
        return;
      }
      // Auth events fire repeatedly (token refresh, tab focus) — only
      // refetch when the signed-in user actually changes.
      if (userId === userIdRef.current) return;
      userIdRef.current = userId;
      loadProfile(userId);
      loadUnread(userId);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) handleUser(data.session?.user.id ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      handleUser(session?.user.id ?? null);
    });

    function handleProfileUpdated() {
      if (userIdRef.current) loadProfile(userIdRef.current, true);
    }

    function refreshUnread() {
      if (userIdRef.current) loadUnread(userIdRef.current);
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") refreshUnread();
    }

    window.addEventListener("profile-updated", handleProfileUpdated);
    window.addEventListener("notifications-read", refreshUnread);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.removeEventListener("profile-updated", handleProfileUpdated);
      window.removeEventListener("notifications-read", refreshUnread);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ProfileContext.Provider value={{ signedIn, profile, unread }}>
      {children}
    </ProfileContext.Provider>
  );
}
