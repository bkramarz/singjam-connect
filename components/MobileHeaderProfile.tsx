"use client";

import Link from "next/link";
import { useProfile } from "@/hooks/useProfile";
import NotificationBell from "./NotificationBell";

export default function MobileHeaderProfile() {
  const { signedIn, profile } = useProfile();

  if (signedIn) {
    return (
      <div className="flex items-center gap-1 sm:hidden">
        {profile?.is_admin && (
          <Link
            href="/admin"
            className="rounded-lg bg-amber-500/20 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition-colors"
          >
            Admin
          </Link>
        )}
        <NotificationBell />
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
