"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function UpcomingJamsCta() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(document.cookie.split(";").some((c) => c.trim().match(/^sb-.+-auth-token/)));
  }, []);

  if (signedIn) return null;

  return (
    <Link href="/auth?mode=signup" className="mt-2 inline-block text-xs font-medium text-amber-600 hover:text-amber-500">
      Create an account to stay in the loop →
    </Link>
  );
}
