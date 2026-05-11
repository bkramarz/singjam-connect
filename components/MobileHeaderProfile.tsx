"use client";

import Link from "next/link";
import { useProfile } from "@/hooks/useProfile";
import NotificationBell from "./NotificationBell";

export default function MobileHeaderProfile() {
  const { signedIn, profile } = useProfile();

  if (signedIn) {
    return (
      <div className="flex items-center gap-1 sm:hidden">
        <Link
          href="/search"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          aria-label="Search songs"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0016.803 15.803z" />
          </svg>
        </Link>
        <NotificationBell />
        {profile?.is_admin && (
          <Link
            href="/admin"
            className="rounded-lg bg-amber-500/20 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition-colors"
          >
            Admin
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 sm:hidden">
      <Link
        href="/search"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        aria-label="Search songs"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0016.803 15.803z" />
        </svg>
      </Link>
      <Link
        href="/auth"
        className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-400 transition-colors"
      >
        Sign in
      </Link>
    </div>
  );
}
