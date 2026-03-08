"use client";

import SongSearch from "@/components/SongSearch";

export default function SongsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Song Library</h1>
      <p className="text-sm text-zinc-600">
        Search by title, first line, recording artist, or composer. Autocomplete is typo-tolerant.
      </p>
      <SongSearch />
    </div>
  );
}