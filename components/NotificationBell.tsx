"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
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

    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchCount();
    };
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

  return (
    <Link
      href="/notifications"
      className="relative rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
      aria-label="Notifications"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
