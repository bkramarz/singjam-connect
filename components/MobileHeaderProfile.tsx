"use client";

import Link from "next/link";
import { useProfile } from "@/hooks/useProfile";
import NotificationBell from "./NotificationBell";

export default function MobileHeaderProfile() {
  const { signedIn } = useProfile();

  if (signedIn) {
    return (
      <div className="flex items-center sm:hidden">
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
