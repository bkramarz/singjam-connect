"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SetCard from "@/components/SetCard";
import { supabaseBrowser } from "@/lib/supabase/client";

type SetItem = {
  id: string;
  name: string;
  description: string | null;
  owner_user_id: string;
  link_sharing?: "private" | "link" | "public";
};

type PublicSetItem = {
  id: string;
  name: string;
  description: string | null;
  ownerName: string | null;
  ownerUsername: string | null;
};

type SetsData = {
  owned: SetItem[];
  collaborating: SetItem[];
  public: PublicSetItem[];
};

export default function SetsContent() {
  const supabase = supabaseBrowser();
  const [data, setData] = useState<SetsData | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [hasRepertoire, setHasRepertoire] = useState(true);

  useEffect(() => {
    fetch("/api/sets")
      .then((r) => {
        if (r.status === 401) { setIsSignedIn(false); setData({ owned: [], collaborating: [], public: [] }); return null; }
        setIsSignedIn(true);
        return r.json();
      })
      .then((json) => {
        if (!json) return;
        setData(json);
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (!user) return;
          supabase.from("user_songs").select("song_id", { count: "exact", head: true }).eq("user_id", user.id).then(({ count }) => {
            setHasRepertoire((count ?? 0) > 0);
          });
        });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-xl font-semibold">Sets</h1>
          <p className="text-sm text-zinc-500">Build song lists for your jams and gigs.</p>
        </div>
        <section className="space-y-3">
          <div className="h-3 w-24 animate-pulse rounded bg-zinc-200" />
          <div className="grid grid-cols-1 gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-2">
                <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-200" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-100" />
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  const publicSets = data.public ?? [];

  const isEmpty = data.owned.length === 0 && data.collaborating.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Sets</h1>
        <p className="text-sm text-zinc-500">Build song lists for your jams and gigs.</p>
      </div>

      {isSignedIn && !hasRepertoire && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <p className="text-base font-semibold text-zinc-900">Your repertoire is empty</p>
          <p className="mt-1 text-sm text-zinc-500">Add songs you know to build sets for your jams and performances.</p>
          <Link
            href="/search"
            className="mt-4 inline-block rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-400 transition-colors"
          >
            Browse songs →
          </Link>
        </div>
      )}

      {isSignedIn && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Your sets</h2>
            <Link href="/set/new" className="flex items-center justify-center rounded-lg p-1 text-zinc-400 hover:text-amber-500 hover:bg-amber-50 transition-colors" aria-label="New set">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {data.owned.map((set) => (
              <SetCard
                key={set.id}
                set={set}
                isOwner
                linkSharing={set.link_sharing}
                onDelete={(id) => setData((d) => d && { ...d, owned: d.owned.filter((s) => s.id !== id) })}
              />
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
              <SetCard key={set.id} set={set} isOwner={false} linkSharing={set.link_sharing} />
            ))}
          </div>
        </section>
      )}

      {isSignedIn && publicSets.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Public sets</h2>
          <div className="grid grid-cols-1 gap-3">
            {publicSets.map((set) => (
              <SetCard
                key={set.id}
                set={{ ...set, owner_user_id: "" }}
                ownerName={set.ownerName}
                ownerUsername={set.ownerUsername}
                canCopy
              />
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
