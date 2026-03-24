"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type UserProfile = {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export default function MobileHeaderProfile() {
  const supabase = supabaseBrowser();
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  async function loadProfile(userId: string, bust = false) {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, username, avatar_url")
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

  const initial = (profile?.display_name ?? profile?.username ?? "?")[0].toUpperCase();

  if (signedIn) {
    return (
      <Link href="/profile" className="sm:hidden">
        <span className="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-slate-600 ring-2 ring-slate-700">
          {profile?.avatar_url ? (
            <Image src={profile.avatar_url} alt="Profile" fill className="object-cover" unoptimized />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs font-medium text-slate-200">
              {initial}
            </span>
          )}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/auth"
      className="sm:hidden rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-400 transition-colors"
    >
      Sign in
    </Link>
  );
}
