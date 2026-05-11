"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabaseBrowser } from "@/lib/supabase/client";

type Song = {
  id: string;
  song_id: string;
  position: number;
  songs: { title: string; display_artist: string | null; slug: string | null };
};

type Collaborator = {
  id: string;
  user_id: string | null;
  status: string;
  profiles: { display_name: string | null; last_name: string | null; username: string | null; avatar_url: string | null } | null;
};

type SetData = {
  id: string;
  name: string;
  description: string | null;
  owner_user_id: string;
  jam_id: string | null;
  profiles: { display_name: string | null; username: string | null } | null;
};

type JamSong = {
  song_id: string;
  title: string;
  display_artist: string | null;
};

const CONFIDENCE_LEVELS = [
  { key: "lead", label: "Lead", style: "bg-amber-100 text-amber-800 font-semibold" },
  { key: "support", label: "Support", style: "bg-zinc-100 text-zinc-700" },
  { key: "learn", label: "Learn", style: "bg-zinc-100 text-zinc-500" },
] as const;

function SortableSongItem({
  song,
  index,
  canEdit,
  onRemove,
}: {
  song: Song;
  index: number;
  canEdit: boolean;
  onRemove: (songId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: song.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-3"
    >
      {canEdit && (
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab touch-none text-zinc-300 hover:text-zinc-500 active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      )}

      <span className="shrink-0 w-6 text-center text-xs font-medium text-zinc-400">{index + 1}</span>

      <div className="flex-1 min-w-0">
        {song.songs.slug ? (
          <Link href={`/songs/${song.songs.slug}`} className="font-medium text-zinc-900 hover:text-amber-600 truncate block">
            {song.songs.title}
          </Link>
        ) : (
          <p className="font-medium text-zinc-900 truncate">{song.songs.title}</p>
        )}
        {song.songs.display_artist && (
          <p className="text-xs text-zinc-500 truncate">{song.songs.display_artist}</p>
        )}
      </div>

      {canEdit && (
        <button
          onClick={() => onRemove(song.song_id)}
          className="shrink-0 text-zinc-300 hover:text-red-400 transition-colors"
          aria-label="Remove song"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function SetDetail({
  set,
  initialSongs,
  collaborators: initialCollaborators,
  currentUserId,
  canEdit,
  isOwner,
  jamSharedSongs = [],
}: {
  set: SetData;
  initialSongs: Song[];
  collaborators: Collaborator[];
  currentUserId: string | null;
  canEdit: boolean;
  isOwner: boolean;
  jamSharedSongs?: JamSong[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = supabaseBrowser();

  const [songs, setSongs] = useState(initialSongs);
  const [collaborators, setCollaborators] = useState(initialCollaborators);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(set.name);
  const [descValue, setDescValue] = useState(set.description ?? "");
  const [showAddSong, setShowAddSong] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingSong, setPendingSong] = useState<any | null>(null);
  const [userRepertoire, setUserRepertoire] = useState(new Map<string, string>());
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Claim invite token if present in URL
  useEffect(() => {
    const token = searchParams.get("invite");
    if (!token || !currentUserId) return;
    fetch(`/api/sets/${set.id}/invite/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(() => router.replace(`/set/${set.id}`));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load user repertoire for confidence checks
  useEffect(() => {
    if (!currentUserId) return;
    supabase
      .from("user_songs")
      .select("song_id, confidence")
      .eq("user_id", currentUserId)
      .then(({ data }) => {
        setUserRepertoire(new Map((data ?? []).map((r: any) => [r.song_id, r.confidence])));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  function handleSearchChange(q: string) {
    setSearchQuery(q);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase.rpc("search_songs", { q: q.trim(), limit_n: 20 });
      setSearchResults((data ?? []) as any[]);
      setSearching(false);
    }, 250);
  }

  async function handleSelectSong(song: any) {
    const existing = userRepertoire.get(song.song_id);
    if (existing) {
      await submitAddSong(song.song_id, null);
    } else {
      setPendingSong(song);
    }
  }

  async function submitAddSong(songId: string, confidence: string | null) {
    const body: any = { songId };
    if (confidence) body.confidence = confidence;

    const res = await fetch(`/api/sets/${set.id}/songs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const { song } = await res.json();
      setSongs((prev) => [...prev, song]);
      if (confidence) {
        setUserRepertoire((prev) => new Map(prev).set(songId, confidence));
      }
    }

    setPendingSong(null);
    setSearchQuery("");
    setSearchResults([]);
    setShowAddSong(false);
  }

  async function handleRemoveSong(songId: string) {
    await fetch(`/api/sets/${set.id}/songs/${songId}`, { method: "DELETE" });
    setSongs((prev) => prev.filter((s) => s.song_id !== songId));
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = songs.findIndex((s) => s.id === active.id);
    const newIndex = songs.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(songs, oldIndex, newIndex).map((s, i) => ({ ...s, position: i }));

    setSongs(reordered);
    fetch(`/api/sets/${set.id}/songs/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: reordered.map((s) => ({ id: s.id, position: s.position })) }),
    });
  }

  async function handleSaveName() {
    if (!nameValue.trim()) return;
    setSavingName(true);
    await fetch(`/api/sets/${set.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameValue.trim(), description: descValue.trim() || null }),
    });
    setSavingName(false);
    setEditingName(false);
  }

  async function handleShare() {
    const res = await fetch(`/api/sets/${set.id}/invite/link`, { method: "POST" });
    const { inviteId, url, message } = await res.json();

    if (navigator.share) {
      try {
        await navigator.share({ text: message });
      } catch {
        await fetch(`/api/sets/${set.id}/invite/link`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteId }),
        });
      }
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
      setShareStatus("Link copied!");
      setTimeout(() => setShareStatus(null), 2500);
    }
  }

  async function handleRemoveCollaborator(collaboratorId: string) {
    await fetch(`/api/sets/${set.id}/invite/link`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId: collaboratorId }),
    });
    setCollaborators((prev) => prev.filter((c) => c.id !== collaboratorId));
  }

  async function handleDeleteSet() {
    setDeleting(true);
    await fetch(`/api/sets/${set.id}`, { method: "DELETE" });
    router.push("/sets");
  }

  const ownerLabel = set.profiles?.display_name ?? set.profiles?.username ?? "Unknown";

  return (
    <div className="space-y-6">
      {set.jam_id && (
        <a
          href={`/jam/${set.jam_id}`}
          className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to jam
        </a>
      )}

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="space-y-2">
              <input
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                className="w-full text-xl font-semibold rounded-lg border border-zinc-300 px-2 py-1 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                autoFocus
              />
              <textarea
                value={descValue}
                onChange={(e) => setDescValue(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full text-sm rounded-lg border border-zinc-300 px-2 py-1 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveName}
                  disabled={savingName || !nameValue.trim()}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-400 disabled:opacity-50 transition-colors"
                >
                  {savingName ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => { setEditingName(false); setNameValue(set.name); setDescValue(set.description ?? ""); }}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-zinc-900">{nameValue}</h1>
              {descValue && <p className="text-sm text-zinc-500 mt-0.5">{descValue}</p>}
              <p className="text-xs text-zinc-400 mt-1">by {ownerLabel}</p>
            </>
          )}
        </div>

        {isOwner && !editingName && (
          <button
            onClick={() => setEditingName(true)}
            className="shrink-0 text-zinc-400 hover:text-zinc-600 transition-colors"
            aria-label="Edit set name"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
          </button>
        )}
      </div>

      {/* Actions */}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowAddSong(true)}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add song
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
            Invite collaborator
          </button>

          {shareStatus && (
            <span className="self-center text-xs text-zinc-500">{shareStatus}</span>
          )}
        </div>
      )}

      {/* Add song panel */}
      {showAddSong && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-700">Add a song</p>
            <button
              onClick={() => { setShowAddSong(false); setSearchQuery(""); setSearchResults([]); setPendingSong(null); }}
              className="text-zinc-400 hover:text-zinc-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {pendingSong ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-700">
                How well do you know <span className="font-semibold">{pendingSong.title}</span>?
              </p>
              <div className="flex flex-wrap gap-2">
                {CONFIDENCE_LEVELS.map(({ key, label, style }) => (
                  <button
                    key={key}
                    onClick={() => submitAddSong(pendingSong.song_id, key)}
                    className={`rounded-full px-3 py-1 text-sm ${style} hover:opacity-80 transition-opacity`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setPendingSong(null)}
                className="text-xs text-zinc-400 hover:text-zinc-600"
              >
                ← Back to search
              </button>
            </div>
          ) : (
            <>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search songs…"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                autoFocus
              />
              {jamSharedSongs.length > 0 && !searchQuery && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-zinc-500">Shared by attendees</p>
                  <ul className="max-h-48 overflow-y-auto divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                    {jamSharedSongs.map((song) => {
                      const alreadyAdded = songs.some((s) => s.song_id === song.song_id);
                      return (
                        <li key={song.song_id}>
                          <button
                            disabled={alreadyAdded}
                            onClick={() => handleSelectSong(song)}
                            className="w-full text-left px-3 py-2.5 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <p className="text-sm font-medium text-zinc-900">{song.title}</p>
                            {song.display_artist && <p className="text-xs text-zinc-500">{song.display_artist}</p>}
                            {alreadyAdded && <p className="text-xs text-zinc-400">Already in set</p>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {searching && <p className="text-xs text-zinc-400">Searching…</p>}
              {searchResults.length > 0 && (
                <ul className="divide-y divide-zinc-100 max-h-64 overflow-y-auto rounded-xl border border-zinc-200">
                  {searchResults.map((song: any) => {
                    const alreadyAdded = songs.some((s) => s.song_id === song.song_id);
                    return (
                      <li key={song.song_id}>
                        <button
                          disabled={alreadyAdded}
                          onClick={() => handleSelectSong(song)}
                          className="w-full text-left px-3 py-2.5 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <p className="text-sm font-medium text-zinc-900">{song.title}</p>
                          {song.display_artist && (
                            <p className="text-xs text-zinc-500">{song.display_artist}</p>
                          )}
                          {alreadyAdded && <p className="text-xs text-zinc-400">Already in set</p>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {searchQuery.trim() && !searching && searchResults.length === 0 && (
                <p className="text-xs text-zinc-400">No songs found.</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Song list */}
      <div className="space-y-2">
        {songs.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
            <p className="text-sm text-zinc-500">
              {canEdit ? "No songs yet. Add one to get started." : "This set has no songs yet."}
            </p>
          </div>
        ) : canEdit ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={songs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {songs.map((song, i) => (
                <SortableSongItem
                  key={song.id}
                  song={song}
                  index={i}
                  canEdit={canEdit}
                  onRemove={handleRemoveSong}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          songs.map((song, i) => (
            <div key={song.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-3">
              <span className="shrink-0 w-6 text-center text-xs font-medium text-zinc-400">{i + 1}</span>
              <div className="flex-1 min-w-0">
                {song.songs.slug ? (
                  <Link href={`/songs/${song.songs.slug}`} className="font-medium text-zinc-900 hover:text-amber-600 truncate block">
                    {song.songs.title}
                  </Link>
                ) : (
                  <p className="font-medium text-zinc-900 truncate">{song.songs.title}</p>
                )}
                {song.songs.display_artist && (
                  <p className="text-xs text-zinc-500 truncate">{song.songs.display_artist}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Collaborators */}
      {(collaborators.length > 0 || isOwner) && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Collaborators</h2>
          {collaborators.length === 0 ? (
            <p className="text-sm text-zinc-400">None yet. Share an invite link to add collaborators.</p>
          ) : (
            <ul className="space-y-2">
              {collaborators.map((c) => (
                <li key={c.id} className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-white px-3 py-2">
                  <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-xs font-medium text-zinc-600">
                    {c.profiles?.avatar_url
                      ? <Image src={c.profiles.avatar_url} alt="" fill className="object-cover" unoptimized />
                      : (c.profiles?.display_name ?? c.profiles?.username ?? "?")[0].toUpperCase()
                    }
                  </span>
                  <span className="flex-1 min-w-0 text-sm text-zinc-700 truncate">
                    {[c.profiles?.display_name, c.profiles?.last_name].filter(Boolean).join(" ") || c.profiles?.username || "Unknown"}
                  </span>
                  {isOwner && (
                    <button
                      onClick={() => handleRemoveCollaborator(c.id)}
                      className="shrink-0 text-xs text-zinc-400 hover:text-red-400 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Danger zone */}
      {isOwner && (
        <section className="pt-4 border-t border-zinc-100 space-y-2">
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-sm text-zinc-600">Delete this set? This cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteSet}
                  disabled={deleting}
                  className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-400 disabled:opacity-50 transition-colors"
                >
                  {deleting ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-zinc-400 hover:text-red-400 transition-colors"
            >
              Delete set
            </button>
          )}
        </section>
      )}
    </div>
  );
}
