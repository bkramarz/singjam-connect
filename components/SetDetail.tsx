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
  songs: {
    title: string;
    display_artist: string | null;
    slug: string | null;
    chord_chart_url: string | null;
    youtube_url: string | null;
    spotify_url: string | null;
    song_recording_artists: { position: number; youtube_url: string | null }[];
  };
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

function getYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).searchParams.get("v"); } catch { return null; }
}

function YoutubeIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function SpotifyIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

function UltimateGuitarIcon() {
  return (
    <svg className="h-5 w-5 rounded-sm" viewBox="0 0 1200 1200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M892 88H308C186.498 88 88 186.498 88 308V892C88 1013.5 186.498 1112 308 1112H892C1013.5 1112 1112 1013.5 1112 892V308C1112 186.498 1013.5 88 892 88Z" fill="#111111"/>
      <path d="M291.02 280.202L356.294 463.987C375.375 409.765 425.595 348.494 507.938 348.494C594.301 348.494 647.532 411.755 657.573 481.057H794.152L858.425 232L706.782 310.342C670.621 280.221 623.411 263.132 572.209 263.132C502.907 263.132 451.715 291.252 417.554 329.413L291.02 280.202Z" fill="#FFD609"/>
      <path d="M562.169 646.76L913.66 481.057V780.327L840.349 752.208C799.167 877.732 704.783 967.12 560.159 967.12C399.474 967.12 287 841.576 287 687.931C287 642.73 296.046 605.588 312.107 569.428H314.115C305.075 598.549 301.06 624.658 301.06 655.799C301.06 777.322 393.455 868.702 512.959 868.702C619.422 868.702 687.693 794.375 719.834 707.012L562.169 646.76Z" fill="#FFD609"/>
    </svg>
  );
}

function getPrimaryYoutubeId(song: Song["songs"]): string | null {
  const fromArtists = [...(song.song_recording_artists ?? [])]
    .sort((a, b) => a.position - b.position)
    .find((a) => a.youtube_url)?.youtube_url;
  return getYoutubeId(fromArtists) ?? getYoutubeId(song.youtube_url);
}

type AddingField = "youtube" | "spotify" | "chord" | null;

function SongRowContent({
  song,
  index,
  canEdit,
  onMediaAdded,
}: {
  song: Song;
  index: number;
  canEdit: boolean;
  onMediaAdded: (songId: string, field: "youtube_url" | "spotify_url" | "chord_chart_url", url: string) => void;
}) {
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [addingField, setAddingField] = useState<AddingField>(null);
  const [urlInput, setUrlInput] = useState("");
  const [saving, setSaving] = useState(false);

  const videoId = getPrimaryYoutubeId(song.songs);
  const { chord_chart_url, spotify_url } = song.songs;

  const fieldMap: Record<NonNullable<AddingField>, "youtube_url" | "spotify_url" | "chord_chart_url"> = {
    youtube: "youtube_url",
    spotify: "spotify_url",
    chord: "chord_chart_url",
  };

  const placeholders: Record<NonNullable<AddingField>, string> = {
    youtube: "Paste YouTube URL…",
    spotify: "Paste Spotify track URL…",
    chord: "Paste chord chart URL…",
  };

  function toggleAdding(field: NonNullable<AddingField>) {
    if (addingField === field) {
      setAddingField(null);
      setUrlInput("");
    } else {
      setAddingField(field);
      setUrlInput("");
    }
  }

  async function handleSave() {
    if (!addingField || !urlInput.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/songs/${song.song_id}/media`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [fieldMap[addingField]]: urlInput.trim() }),
    });
    if (res.ok) {
      onMediaAdded(song.song_id, fieldMap[addingField], urlInput.trim());
      setAddingField(null);
      setUrlInput("");
    }
    setSaving(false);
  }

  return (
    <div className="flex-1 min-w-0 space-y-2">
      <div className="flex items-center gap-2 min-w-0">
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

        <div className="shrink-0 flex items-center gap-0.5">
          {/* YouTube */}
          {videoId ? (
            <button
              onClick={() => setYoutubeOpen((o) => !o)}
              className={`rounded-lg p-1.5 transition-colors text-red-500 ${youtubeOpen ? "bg-red-50" : "hover:bg-red-50"}`}
              title={youtubeOpen ? "Close video" : "Watch on YouTube"}
            >
              <YoutubeIcon />
            </button>
          ) : canEdit ? (
            <button
              onClick={() => toggleAdding("youtube")}
              className={`rounded-lg p-1.5 transition-colors ${addingField === "youtube" ? "bg-red-50 text-red-500" : "text-red-400 border border-dashed border-red-300 hover:bg-red-50 hover:text-red-500 hover:border-red-400"}`}
              title="Add YouTube link"
            >
              <YoutubeIcon />
            </button>
          ) : null}

          {/* Spotify */}
          {spotify_url ? (
            <a
              href={spotify_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-1.5 text-green-500 hover:bg-green-50 transition-colors"
              title="Open on Spotify"
            >
              <SpotifyIcon />
            </a>
          ) : canEdit ? (
            <button
              onClick={() => toggleAdding("spotify")}
              className={`rounded-lg p-1.5 transition-colors ${addingField === "spotify" ? "bg-green-50 text-green-500" : "text-green-500 border border-dashed border-green-300 hover:bg-green-50 hover:border-green-400"}`}
              title="Add Spotify link"
            >
              <SpotifyIcon />
            </button>
          ) : null}

          {/* Ultimate Guitar chord chart */}
          {chord_chart_url ? (
            <a
              href={chord_chart_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-1.5 transition-opacity hover:opacity-80"
              title="Chord chart"
            >
              <UltimateGuitarIcon />
            </a>
          ) : canEdit ? (
            <button
              onClick={() => toggleAdding("chord")}
              className={`rounded-lg p-1.5 transition-all ${addingField === "chord" ? "opacity-100" : "opacity-50 border border-dashed border-zinc-400 hover:opacity-80 hover:border-zinc-500"}`}
              title="Add chord chart"
            >
              <UltimateGuitarIcon />
            </button>
          ) : null}
        </div>
      </div>

      {youtubeOpen && videoId && (
        <div className="rounded-xl overflow-hidden border border-zinc-200">
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${videoId}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {addingField && (
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={placeholders[addingField]}
            className="flex-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setAddingField(null); setUrlInput(""); } }}
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={saving || !urlInput.trim()}
            className="rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-400 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => { setAddingField(null); setUrlInput(""); }}
            className="text-xs text-zinc-400 hover:text-zinc-600"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function SortableSongItem({
  song,
  index,
  canEdit,
  onRemove,
  onMediaAdded,
}: {
  song: Song;
  index: number;
  canEdit: boolean;
  onRemove: (songId: string) => void;
  onMediaAdded: (songId: string, field: "youtube_url" | "spotify_url" | "chord_chart_url", url: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: song.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-start gap-2 sm:gap-3 rounded-xl border border-zinc-200 bg-white px-2 sm:px-4 py-2.5 sm:py-3"
    >
      <div className="shrink-0 flex flex-col items-center gap-0.5 pt-0.5 w-4 sm:w-6">
        <span className="text-[10px] sm:text-xs leading-none font-semibold text-zinc-300">{index + 1}</span>
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-zinc-300 hover:text-zinc-500 active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      </div>

      <SongRowContent
        song={song}
        index={index}
        canEdit={canEdit}
        onMediaAdded={onMediaAdded}
      />

      <button
        onClick={() => onRemove(song.song_id)}
        className="shrink-0 mt-0.5 text-zinc-300 hover:text-red-400 transition-colors"
        aria-label="Remove song"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
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

  function handleMediaAdded(songId: string, field: "youtube_url" | "spotify_url" | "chord_chart_url", url: string) {
    setSongs((prev) =>
      prev.map((s) =>
        s.song_id === songId ? { ...s, songs: { ...s.songs, [field]: url } } : s
      )
    );
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

      {/* Song list */}
      <div className="space-y-2">
        {songs.length === 0 && !canEdit && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
            <p className="text-sm text-zinc-500">This set has no songs yet.</p>
          </div>
        )}

        {songs.length > 0 && (
          canEdit ? (
            <DndContext id={set.id} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={songs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {songs.map((song, i) => (
                  <SortableSongItem
                    key={song.id}
                    song={song}
                    index={i}
                    canEdit={canEdit}
                    onRemove={handleRemoveSong}
                    onMediaAdded={handleMediaAdded}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            songs.map((song, i) => (
              <div key={song.id} className="flex items-start gap-2 sm:gap-3 rounded-xl border border-zinc-200 bg-white px-2 sm:px-4 py-2.5 sm:py-3">
                <span className="shrink-0 mt-0.5 w-4 sm:w-6 text-center text-[10px] sm:text-xs font-semibold text-zinc-300">{i + 1}</span>
                <SongRowContent
                  song={song}
                  index={i}
                  canEdit={false}
                  onMediaAdded={() => {}}
                />
              </div>
            ))
          )
        )}

        {canEdit && (
          showAddSong ? (
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
          ) : (
            <button
              onClick={() => setShowAddSong(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 py-2.5 text-sm text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add song
            </button>
          )
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
