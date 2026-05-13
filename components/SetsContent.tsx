"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SetCard from "@/components/SetCard";

type SetItem = {
  id: string;
  name: string;
  description: string | null;
  owner_user_id: string;
};

type SetsData = {
  owned: SetItem[];
  collaborating: SetItem[];
};

export default function SetsContent() {
  const [data, setData] = useState<SetsData | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    fetch("/api/sets")
      .then((r) => {
        if (r.status === 401) { setIsSignedIn(false); setData({ owned: [], collaborating: [] }); return null; }
        setIsSignedIn(true);
        return r.json();
      })
      .then((json) => { if (json) setData(json); });
  }, []);

  if (!data) return null;

  const isEmpty = data.owned.length === 0 && data.collaborating.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Sets</h1>
        <p className="text-sm text-zinc-500">Curate ordered song lists for your performances.</p>
      </div>

      {isSignedIn && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Your sets</h2>
          <div className="grid grid-cols-1 gap-3">
            {data.owned.map((set) => (
              <SetCard key={set.id} set={set} isOwner />
            ))}
            <Link
              href="/set/new"
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-200 px-4 py-4 text-sm font-medium text-zinc-400 hover:border-amber-300 hover:text-amber-500 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New set
            </Link>
          </div>
        </section>
      )}

      {data.collaborating.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Collaborating on</h2>
          <div className="grid grid-cols-1 gap-3">
            {data.collaborating.map((set) => (
              <SetCard key={set.id} set={set} isOwner={false} />
            ))}
          </div>
        </section>
      )}

      {!isSignedIn && isEmpty && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
          <p className="text-sm text-zinc-500">Sign in to create and manage sets.</p>
          <Link href="/auth" className="mt-3 inline-block text-sm font-medium text-amber-600 hover:text-amber-500">
            Sign in →
          </Link>
        </div>
      )}
    </div>
  );
}
