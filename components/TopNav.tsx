"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import LogoutButton from "./LogoutButton";

type UserProfile = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export default function TopNav() {
  const supabase = supabaseBrowser();
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  async function loadProfile(userId: string, bust = false) {
    const { data } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
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
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
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

  const displayLabel = profile?.username
    ? `@${profile.username}`
    : profile?.display_name ?? "Account";

  const initial = (profile?.display_name ?? profile?.username ?? "?")[0].toUpperCase();

  if (pathname === "/auth/reset-password") return null;

  return (
    <nav className="flex items-center gap-1 text-sm">
      <Link href="/songs" className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
        Songs
      </Link>
      <Link href="/repertoire" className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
        Repertoire
      </Link>
      <Link href="/matches" className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
        Find Jammers
      </Link>
      <Link href="/jam/new" className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
        Post a Jam
      </Link>

      <div className="mx-2 h-4 w-px bg-slate-700" />

      {signedIn ? (
        <>
          <Link
            href="/profile"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full bg-slate-600">
              {profile?.avatar_url ? (
                <Image src={profile.avatar_url} alt="Avatar" fill className="object-cover" unoptimized />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xs font-medium text-slate-200">
                  {initial}
                </span>
              )}
            </span>
            <span className="max-w-[100px] truncate">{displayLabel}</span>
          </Link>
          <LogoutButton />
        </>
      ) : (
        <Link
          href="/auth"
          className="rounded-lg bg-amber-500 px-3 py-1.5 font-medium text-white hover:bg-amber-400 transition-colors"
        >
          Sign in
        </Link>
      )}
    </nav>
  );
}
