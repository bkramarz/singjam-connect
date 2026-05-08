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
      <div className="flex justify-end -mt-16 sm:-mt-14">
        {isSignedIn && (
          <Link
            href="/set/new"
            className="self-start rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400 transition-colors sm:self-auto"
          >
            New set
          </Link>
        )}
      </div>

      {data.owned.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Your sets</h2>
          <div className="grid grid-cols-1 gap-3">
            {data.owned.map((set) => (
              <SetCard key={set.id} set={set} isOwner />
            ))}
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

      {isEmpty && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
          <p className="text-sm text-zinc-500">
            {isSignedIn
              ? "No sets yet. Create one to get started."
              : "Sign in to create and manage sets."}
          </p>
          {!isSignedIn && (
            <Link href="/auth" className="mt-3 inline-block text-sm font-medium text-amber-600 hover:text-amber-500">
              Sign in →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
