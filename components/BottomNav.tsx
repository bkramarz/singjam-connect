"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type UserProfile = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

const TABS = [
  {
    href: "/search",
    label: "Search",
    icon: (active: boolean) => (
      <svg className={`h-6 w-6 ${active ? "text-amber-500" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0016.803 15.803z" />
      </svg>
    ),
  },
  {
    href: "/repertoire",
    label: "Repertoire",
    icon: (active: boolean) => (
      <svg className={`h-6 w-6 ${active ? "text-amber-500" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
      </svg>
    ),
  },
  {
    href: "/friends",
    label: "Friends",
    icon: (active: boolean) => (
      <svg className={`h-6 w-6 ${active ? "text-amber-500" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  {
    href: "/jams",
    label: "Jams",
    icon: (active: boolean) => (
      <svg className={`h-6 w-6 ${active ? "text-amber-500" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const supabase = supabaseBrowser();
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

  if (pathname === "/auth/reset-password") return null;

  const initial = (profile?.display_name ?? profile?.username ?? "?")[0].toUpperCase();
  const profileActive = pathname === "/profile" || pathname === "/account" || pathname.startsWith("/u/");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 sm:hidden border-t border-slate-200 bg-white">
      <div className="flex items-stretch">
        {TABS.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2.5"
            >
              {icon(active)}
              <span className={`text-[10px] font-medium ${active ? "text-amber-500" : "text-slate-400"}`}>
                {label}
              </span>
            </Link>
          );
        })}

        {signedIn ? (
          <Link
            href="/profile"
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2.5"
          >
            <span className={`relative h-6 w-6 shrink-0 overflow-hidden rounded-full ${profileActive ? "ring-2 ring-amber-500" : "bg-slate-300"}`}>
              {profile?.avatar_url ? (
                <Image src={profile.avatar_url} alt="Avatar" fill className="object-cover" unoptimized />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-slate-600 text-xs font-medium text-slate-200">
                  {initial}
                </span>
              )}
            </span>
            <span className={`text-[10px] font-medium ${profileActive ? "text-amber-500" : "text-slate-400"}`}>
              Profile
            </span>
          </Link>
        ) : (
          <Link
            href="/auth"
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2.5"
          >
            <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            <span className="text-[10px] font-medium text-slate-400">Sign in</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
