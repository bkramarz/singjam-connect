"use client";

import Link from "next/link";
import Image from "next/image";
import { useProfile } from "@/hooks/useProfile";
import NotificationBell from "./NotificationBell";

export default function MobileHeaderProfile() {
  const { signedIn, profile } = useProfile();

  const initial = (profile?.display_name ?? profile?.username ?? "?")[0].toUpperCase();

  if (signedIn) {
    return (
      <div className="flex items-center gap-1 sm:hidden">
        <NotificationBell />
        <Link href="/profile">
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
      </div>
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
