"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useProfile } from "@/hooks/useProfile";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function NavMenu() {
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = supabaseBrowser();

  useEffect(() => {
    let cancelled = false;

    async function fetchCount() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      if (!cancelled) setUnread(count ?? 0);
    }

    fetchCount();

    const handleVisibility = () => { if (document.visibilityState === "visible") fetchCount(); };
    const handleRead = () => fetchCount();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("notifications-read", handleRead);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("notifications-read", handleRead);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  async function logout() {
    await supabase.auth.signOut();
    setOpen(false);
    router.refresh();
    router.push("/");
  }

  const initial = (profile?.display_name ?? profile?.username ?? "?")[0].toUpperCase();
  const displayName = profile?.display_name ?? profile?.username ?? "Account";
  const username = profile?.username ? `@${profile.username}` : null;

  return (
    <div ref={ref} className="relative">
      <div className="relative inline-flex">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Account menu"
          className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-600 hover:ring-2 hover:ring-amber-500 transition-all"
        >
          {profile?.avatar_url ? (
            <Image src={profile.avatar_url} alt="Avatar" fill className="object-cover" unoptimized />
          ) : (
            <span className="text-xs font-medium text-slate-200">{initial}</span>
          )}
        </button>
        {unread > 0 && (
          <span className="pointer-events-none absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 ring-2 ring-slate-800 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </div>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-zinc-200 bg-white py-1.5 shadow-lg z-50">
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 hover:bg-zinc-50 transition-colors"
          >
            <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-slate-600">
              {profile?.avatar_url ? (
                <Image src={profile.avatar_url} alt="Avatar" fill className="object-cover" unoptimized />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xs font-medium text-slate-200">
                  {initial}
                </span>
              )}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-zinc-800">{displayName}</div>
              {username && <div className="truncate text-xs text-zinc-400">{username}</div>}
            </div>
          </Link>

          <div className="my-1 border-t border-zinc-100" />

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <span className="relative">
              <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </span>
            Notifications
            {unread > 0 && (
              <span className="ml-auto text-xs font-semibold text-amber-600">{unread}</span>
            )}
          </Link>

          <div className="my-1 border-t border-zinc-100" />

          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-50 transition-colors"
          >
            <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
