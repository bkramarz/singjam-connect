import type { Metadata } from "next";
import SongSearch from "@/components/SongSearch";

export const metadata: Metadata = { title: "Song Search" };

export default function SongsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Song Library</h1>
      <p className="text-sm text-zinc-600">
        Search by title, recording artist, first line or composer.
      </p>
      <SongSearch />
    </div>
  );
}
