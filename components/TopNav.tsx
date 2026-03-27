"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useProfile } from "@/hooks/useProfile";
import LogoutButton from "./LogoutButton";

export default function TopNav() {
  const pathname = usePathname();
  const { signedIn, profile } = useProfile();

  const displayLabel = profile?.username
    ? `@${profile.username}`
    : profile?.display_name ?? "Account";

  const initial = (profile?.display_name ?? profile?.username ?? "?")[0].toUpperCase();

  if (pathname === "/auth/reset-password") return null;

  return (
    <nav className="flex items-center gap-1 text-sm">
      <Link href="/search" className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
        Song Search
      </Link>
      <Link href="/repertoire" className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
        Repertoire
      </Link>
      <Link href="/friends" className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
        Friends
      </Link>
      <Link href="/jams" className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
        Jams
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
