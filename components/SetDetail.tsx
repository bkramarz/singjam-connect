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
import { useSongSearch } from "@/hooks/useSongSearch";
import SetInvitePanel from "@/components/SetInvitePanel";
import { formatComposers } from "@/lib/formatComposers";
import ConfidencePicker from "@/components/ConfidencePicker";

const MUSICAL_KEYS = ["A", "Bb", "B", "C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab"];

type Song = {
  id: string;
  song_id: string;
  position: number;
  key_note: string | null;
  leader_user_ids: string[];
  songs: {
    title: string;
    display_artist: string | null;
    slug: string | null;
    chord_chart_url: string | null;
    youtube_url: string | null;
    tonality: string | null;
    year: number | null;
    meter: string | null;
    song_composers: { people: { name: string } | null }[];
    song_lyricists: { people: { name: string } | null }[];
    song_cultures: { cultures: { name: string } | null; context: string | null }[];
    song_genres: { genres: { name: string } | null }[];
    song_themes: { themes: { name: string } | null }[];
    song_recording_artists: { position: number; youtube_url: string | null; spotify_url: string | null }[];
  };
};

type Participant = {
  user_id: string;
  display_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type Collaborator = {
  id: string;
  user_id: string | null;
  status: string;
  role: "editor" | "viewer";
  profiles: { display_name: string | null; last_name: string | null; username: string | null; avatar_url: string | null } | null;
};

type PlaylistLink = { url: string; added?: number; total?: number };

type SetData = {
  id: string;
  name: string;
  description: string | null;
  owner_user_id: string;
  jam_id: string | null;
  link_sharing: "private" | "link" | "public";
  youtube_playlist_id: string | null;
  youtube_playlist_fingerprint: string | null;
  spotify_playlist_id: string | null;
  spotify_playlist_fingerprint: string | null;
  profiles: { display_name: string | null; last_name: string | null; username: string | null; avatar_url: string | null } | null;
};

type JamSong = {
  song_id: string;
  title: string;
  display_artist: string | null;
};

const CSV_COLUMN_OPTIONS = [
  { key: "artist",   label: "Artist" },
  { key: "year",     label: "Year" },
  { key: "tonality", label: "Tonality" },
  { key: "meter",    label: "Meter" },
  { key: "key",      label: "Key (set)" },
  { key: "leader",   label: "Leader" },
  { key: "songwriters", label: "Songwriters" },
  { key: "genres",      label: "Genres" },
  { key: "themes",      label: "Themes" },
  { key: "singjam",     label: "SingJam link" },
  { key: "youtube",     label: "YouTube link" },
  { key: "spotify",  label: "Spotify link" },
  { key: "chords",   label: "Chord chart link" },
] as const;

type CsvColumnKey = typeof CSV_COLUMN_OPTIONS[number]["key"];

function getYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0] || null;
    if (u.hostname.includes("youtube.com")) {
      return u.searchParams.get("v")
        ?? u.pathname.match(/\/(?:embed|v|shorts)\/([^/?]+)/)?.[1]
        ?? null;
    }
    return null;
  } catch { return null; }
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

function getPrimarySpotifyUrl(song: Song["songs"]): string | null {
  return [...(song.song_recording_artists ?? [])]
    .sort((a, b) => a.position - b.position)
    .find((a) => a.spotify_url)?.spotify_url ?? null;
}

function getSpotifyTrackId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const match = new URL(url).pathname.match(/\/track\/([a-zA-Z0-9]+)/);
    return match?.[1] ?? null;
  } catch { return null; }
}

type AddingField = "youtube" | "spotify" | "chord" | null;

function SongRowContent({
  song,
  canEdit,
  isAdmin,
  isHost,
  isPublicViewer,
  participants,
  hasEligible,
  participantKnowledge,
  currentUserId,
  currentUserSingingVoice,
  inRepertoire,
  onMediaAdded,
  onKeyChanged,
  onLeadersChanged,
  onAddToRepertoire,
  onVoiceUpdated,
  signInUrl,
}: {
  song: Song;
  index: number;
  canEdit: boolean;
  isAdmin: boolean;
  isHost: boolean;
  isPublicViewer: boolean;
  participants: Participant[];
  hasEligible: boolean;
  participantKnowledge: Map<string, string>;
  currentUserId: string | null;
  currentUserSingingVoice: string | null;
  inRepertoire: boolean;
  onMediaAdded: (songId: string, field: "youtube_url" | "spotify_url" | "chord_chart_url", url: string) => void;
  onKeyChanged: (id: string, key: string | null) => void;
  onLeadersChanged: (id: string, leaderUserIds: string[]) => void;
  onAddToRepertoire: (songId: string, confidence: string) => Promise<void>;
  onVoiceUpdated: (voice: string) => void;
  signInUrl?: string;
}) {
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [spotifyOpen, setSpotifyOpen] = useState(false);
  const [addingField, setAddingField] = useState<AddingField>(null);
  const [pickingRepertoire, setPickingRepertoire] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [youtubeSearchResults, setYoutubeSearchResults] = useState<Array<{ videoId: string; title: string; channel: string; url: string }>>([]);
  const [youtubeSearching, setYoutubeSearching] = useState(false);

  const videoId = getPrimaryYoutubeId(song.songs);
  const spotify_url = getPrimarySpotifyUrl(song.songs);
  const spotifyTrackId = getSpotifyTrackId(spotify_url);
  const { chord_chart_url } = song.songs;

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

  async function handleYoutubeSearch() {
    setYoutubeSearching(true);
    setYoutubeSearchResults([]);
    try {
      const artist = song.songs.display_artist ?? "";
      const res = await fetch(
        `/api/youtube?title=${encodeURIComponent(song.songs.title)}&artist=${encodeURIComponent(artist)}`
      );
      const data = await res.json();
      setYoutubeSearchResults(data.items ?? []);
    } finally {
      setYoutubeSearching(false);
    }
  }

  function toggleAdding(field: NonNullable<AddingField>) {
    if (addingField === field) {
      setAddingField(null);
      setUrlInput("");
      setYoutubeSearchResults([]);
    } else {
      setAddingField(field);
      setUrlInput("");
      setYoutubeSearchResults([]);
      if (field === "youtube") handleYoutubeSearch();
    }
  }

  async function saveMedia(field: NonNullable<AddingField>, url: string) {
    setSaving(true);
    const res = await fetch(`/api/songs/${song.song_id}/media`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [fieldMap[field]]: url }),
    });
    if (res.ok) {
      onMediaAdded(song.song_id, fieldMap[field], url);
      setAddingField(null);
      setUrlInput("");
      setYoutubeSearchResults([]);
    }
    setSaving(false);
  }

  async function handleSave() {
    if (!addingField || !urlInput.trim()) return;
    await saveMedia(addingField, urlInput.trim());
  }

  function handleToggleLeader(userId: string) {
    const current = song.leader_user_ids ?? [];
    const updated = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId];
    onLeadersChanged(song.id, updated);
  }

  const leaderIds = song.leader_user_ids ?? [];
  // Public viewers only see designated leaders; everyone else sees all knowledge levels
  const visibleParticipants = isPublicViewer
    ? participants.filter((p) => leaderIds.includes(p.user_id))
    : participants;

  const leadParticipants = visibleParticipants.filter(
    (p) => leaderIds.includes(p.user_id) || participantKnowledge.get(p.user_id) === "lead"
  );
  const supportParticipants = visibleParticipants.filter(
    (p) => !leaderIds.includes(p.user_id) && participantKnowledge.get(p.user_id) === "support"
  );

  return (
    <div className="flex-1 min-w-0 space-y-2">
      <div className="flex items-start gap-2 min-w-0">
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
          <div className="flex items-center gap-2 mt-1">
            {canEdit ? (
              <select
                value={song.key_note ?? ""}
                onChange={(e) => {
                  const val = e.target.value || null;
                  if (val !== song.key_note) onKeyChanged(song.id, val);
                }}
                className={`text-xs rounded border border-zinc-300 px-1.5 py-0.5 focus:border-amber-400 focus:outline-none ${song.key_note ? "w-14" : "w-20"}`}
              >
                <option value="">key</option>
                {MUSICAL_KEYS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            ) : (
              !isPublicViewer && song.key_note && (
                <span className="text-xs font-medium bg-amber-100 text-amber-800 rounded px-1.5 py-0.5">
                  {song.key_note}
                </span>
              )
            )}
            {!isPublicViewer && song.songs.tonality && (
              <span className="text-xs font-semibold text-zinc-900">{song.songs.tonality}</span>
            )}
          </div>
          {!inRepertoire && (currentUserId || signInUrl) && (
            !currentUserId ? (
              <a
                href={signInUrl}
                className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-400 transition-colors"
              >
                + Add to my repertoire
              </a>
            ) : pickingRepertoire ? (
              <div className="mt-1.5">
                <ConfidencePicker
                  variant="compact"
                  singingVoice={currentUserSingingVoice}
                  onSave={async (level) => { await onAddToRepertoire(song.song_id, level); setPickingRepertoire(false); }}
                  onCancel={() => setPickingRepertoire(false)}
                  onVoiceUpdated={onVoiceUpdated}
                />
              </div>
            ) : (
              <button
                onClick={() => setPickingRepertoire(true)}
                className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-400 transition-colors"
              >
                + Add to my repertoire
              </button>
            )
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
          ) : isAdmin ? (
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
            <button
              onClick={() => setSpotifyOpen((o) => !o)}
              className={`rounded-lg p-1.5 transition-colors text-green-500 ${spotifyOpen ? "bg-green-50" : "hover:bg-green-50"}`}
              title={spotifyOpen ? "Close player" : "Play on Spotify"}
            >
              <SpotifyIcon />
            </button>
          ) : isAdmin ? (
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
          ) : isAdmin ? (
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

      {(leadParticipants.length > 0 || supportParticipants.length > 0 || (isHost && participants.length > 0)) && (
        <div className="space-y-1">
          {(leadParticipants.length > 0 || (isHost && participants.length > 0)) && (
            <div className="flex items-start gap-1.5">
              <span className="shrink-0 text-[10px] text-amber-500 font-medium pt-0.5">Lead</span>
              <div className="flex flex-wrap gap-1 flex-1">
                {isHost && leaderIds.length === 0 && !hasEligible && (
                  <span className="rounded-full border border-dashed border-amber-300 px-2 py-0.5 text-xs font-medium text-amber-500">
                    No leader
                  </span>
                )}
                {leadParticipants.map((p) => {
                  const isLeader = leaderIds.includes(p.user_id);
                  const isClickable = isHost && participantKnowledge.get(p.user_id) === "lead";
                  const firstName = p.display_name ?? p.username ?? "?";
                  const label = p.last_name ? `${firstName} ${p.last_name[0].toUpperCase()}.` : firstName;
                  const pillStyle = isLeader ? "bg-amber-400 text-white" : "bg-amber-100 text-amber-700";
                  return (
                    <button
                      key={p.user_id}
                      type="button"
                      onClick={() => isClickable && handleToggleLeader(p.user_id)}
                      disabled={!isClickable}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium transition-all ${pillStyle} ${isClickable ? "cursor-pointer hover:opacity-75" : "cursor-default"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {supportParticipants.length > 0 && (
            <div className="flex items-start gap-1.5">
              <span className="shrink-0 text-[10px] text-sky-500 font-medium pt-0.5">Support</span>
              <div className="flex flex-wrap gap-1 flex-1">
                {supportParticipants.map((p) => {
                  const firstName = p.display_name ?? p.username ?? "?";
                  const label = p.last_name ? `${firstName} ${p.last_name[0].toUpperCase()}.` : firstName;
                  return (
                    <span
                      key={p.user_id}
                      className="rounded-full px-2 py-0.5 text-xs font-medium bg-sky-100 text-sky-700"
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

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

      {spotifyOpen && spotifyTrackId && (
        <iframe
          src={`https://open.spotify.com/embed/track/${spotifyTrackId}?utm_source=generator`}
          width="100%"
          height="152"
          className="rounded-xl border-0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      )}

      {addingField && (
        <div className="space-y-2">
          {addingField === "youtube" && (
            <div>
              {youtubeSearching && (
                <p className="text-xs text-zinc-400 py-1">Searching YouTube…</p>
              )}
              {!youtubeSearching && youtubeSearchResults.length > 0 && (
                <div className="rounded-lg border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
                  {youtubeSearchResults.map((r) => (
                    <div key={r.videoId} className="flex items-center justify-between gap-3 px-3 py-2 bg-white">
                      <div className="min-w-0">
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-amber-600 hover:underline truncate block">{r.title}</a>
                        <div className="text-xs text-zinc-400 truncate">{r.channel}</div>
                      </div>
                      <button
                        onClick={() => saveMedia("youtube", r.url)}
                        disabled={saving}
                        className="shrink-0 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:border-amber-400 hover:text-amber-600 disabled:opacity-50 transition-colors"
                      >
                        Select
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {!youtubeSearching && youtubeSearchResults.length === 0 && (
                <p className="text-xs text-zinc-400 py-1">No results — paste URL below.</p>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder={placeholders[addingField]}
              className="flex-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setAddingField(null); setUrlInput(""); setYoutubeSearchResults([]); } }}
              autoFocus={addingField !== "youtube"}
            />
            <button
              onClick={handleSave}
              disabled={saving || !urlInput.trim()}
              className="rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-400 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setAddingField(null); setUrlInput(""); setYoutubeSearchResults([]); }}
              className="text-xs text-zinc-400 hover:text-zinc-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableSongItem({
  song,
  index,
  canEdit,
  isAdmin,
  isHost,
  isPublicViewer,
  participants,
  hasEligible,
  participantKnowledge,
  currentUserId,
  currentUserSingingVoice,
  inRepertoire,
  onRemove,
  onMediaAdded,
  onKeyChanged,
  onLeadersChanged,
  onAddToRepertoire,
  onVoiceUpdated,
  signInUrl,
}: {
  song: Song;
  index: number;
  canEdit: boolean;
  isAdmin: boolean;
  isHost: boolean;
  isPublicViewer: boolean;
  participants: Participant[];
  hasEligible: boolean;
  participantKnowledge: Map<string, string>;
  currentUserId: string | null;
  currentUserSingingVoice: string | null;
  inRepertoire: boolean;
  onRemove: (songId: string) => void;
  onMediaAdded: (songId: string, field: "youtube_url" | "spotify_url" | "chord_chart_url", url: string) => void;
  onKeyChanged: (id: string, key: string | null) => void;
  onLeadersChanged: (id: string, leaderUserIds: string[]) => void;
  onAddToRepertoire: (songId: string, confidence: string) => Promise<void>;
  onVoiceUpdated: (voice: string) => void;
  signInUrl?: string;
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
        isAdmin={isAdmin}
        isHost={isHost}
        isPublicViewer={isPublicViewer}
        participants={participants}
        hasEligible={hasEligible}
        participantKnowledge={participantKnowledge}
        currentUserId={currentUserId}
        currentUserSingingVoice={currentUserSingingVoice}
        inRepertoire={inRepertoire}
        onMediaAdded={onMediaAdded}
        onKeyChanged={onKeyChanged}
        onLeadersChanged={onLeadersChanged}
        onAddToRepertoire={onAddToRepertoire}
        onVoiceUpdated={onVoiceUpdated}
        signInUrl={signInUrl}
      />

      <button
        onClick={() => onRemove(song.song_id)}
        className="shrink-0 mt-0.5 text-zinc-300 hover:text-red-400 transition-colors"
        aria-label="Remove song"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      </button>
    </div>
  );
}

export default function SetDetail({
  set,
  initialSongs,
  collaborators: initialCollaborators,
  accessRequests: initialAccessRequests = [],
  currentUserId,
  currentUserSingingVoice = null,
  canEdit,
  isOwner,
  isAdmin,
  isPublicViewer = false,
  jamSharedSongs = [],
  songKnowledge: initialSongKnowledge = [],
  canAccessJam = false,
}: {
  set: SetData;
  initialSongs: Song[];
  collaborators: Collaborator[];
  accessRequests?: Collaborator[];
  currentUserId: string | null;
  currentUserSingingVoice?: string | null;
  canEdit: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isPublicViewer?: boolean;
  jamSharedSongs?: JamSong[];
  songKnowledge?: { user_id: string; song_id: string; confidence: string }[];
  canAccessJam?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = supabaseBrowser();

  const [songs, setSongs] = useState(initialSongs);
  const [songKnowledge, setSongKnowledge] = useState(initialSongKnowledge);
  const [userSingingVoice, setUserSingingVoice] = useState(currentUserSingingVoice ?? null);
  const [collaborators, setCollaborators] = useState(initialCollaborators);
  const [accessRequests, setAccessRequests] = useState(initialAccessRequests);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(set.name);
  const [descValue, setDescValue] = useState(set.description ?? "");
  const [showAddSong, setShowAddSong] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingSong, setPendingSong] = useState<any | null>(null);
  const { results: searchResults, loading: searching } = useSongSearch(searchQuery, { limit: 20 });
  const [userRepertoire, setUserRepertoire] = useState(new Map<string, string>());
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [showAllCollaborators, setShowAllCollaborators] = useState(false);
  const [linkSharing, setLinkSharing] = useState<"private" | "link" | "public">(set.link_sharing ?? "private");
  const [savingName, setSavingName] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copying, setCopying] = useState(false);
  const [setMenuOpen, setSetMenuOpen] = useState(false);
  const setMenuRef = useRef<HTMLDivElement>(null);
  const participantIdsRef = useRef<Set<string>>(
    new Set([set.owner_user_id, ...initialCollaborators.map((c) => c.user_id).filter((id): id is string => Boolean(id))])
  );
  const songIdsRef = useRef<Set<string>>(new Set(initialSongs.map((s) => s.song_id)));
  const [creatingPlaylist, setCreatingPlaylist] = useState<"youtube" | "spotify" | null>(null);
  const [lastSyncedYoutubeFingerprint, setLastSyncedYoutubeFingerprint] = useState<string | null>(set.youtube_playlist_fingerprint ?? null);
  const [lastSyncedSpotifyFingerprint, setLastSyncedSpotifyFingerprint] = useState<string | null>(set.spotify_playlist_fingerprint ?? null);
  const [playlistLinks, setPlaylistLinks] = useState<{ youtube?: PlaylistLink; spotify?: PlaylistLink }>({
    youtube: set.youtube_playlist_id ? { url: `https://www.youtube.com/playlist?list=${set.youtube_playlist_id}` } : undefined,
    spotify: set.spotify_playlist_id ? { url: `https://open.spotify.com/playlist/${set.spotify_playlist_id}` } : undefined,
  });
  const [playlistError, setPlaylistError] = useState<"youtube" | "spotify" | null>(null);
  const [showMissingSong, setShowMissingSong] = useState(false);
  const [missingSongTitle, setMissingSongTitle] = useState("");
  const [missingSongArtist, setMissingSongArtist] = useState("");
  const [missingSongBusy, setMissingSongBusy] = useState(false);
  const [missingSongError, setMissingSongError] = useState<string | null>(null);
  const [showCsvOptions, setShowCsvOptions] = useState(false);
  const [csvColumns, setCsvColumns] = useState<Record<CsvColumnKey, boolean>>({
    artist: true,
    year: false,
    tonality: false,
    meter: false,
    key: true,
    leader: true,
    songwriters: false,
    genres: false,
    themes: false,
    singjam: false,
    youtube: false,
    spotify: false,
    chords: false,
  });

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

  useEffect(() => {
    if (!isOwner) return;
    function onClickOutside(e: MouseEvent) {
      if (setMenuRef.current && !setMenuRef.current.contains(e.target as Node)) {
        setSetMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [isOwner]);

  useEffect(() => {
    participantIdsRef.current = new Set([
      set.owner_user_id,
      ...collaborators.map((c) => c.user_id).filter((id): id is string => Boolean(id)),
    ]);
  }, [collaborators, set.owner_user_id]);

  useEffect(() => {
    songIdsRef.current = new Set(songs.map((s) => s.song_id));
  }, [songs]);

  useEffect(() => {
    const channel = supabase
      .channel(`set-detail-${set.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "set_collaborators", filter: `set_id=eq.${set.id}` },
        async (payload) => {
          const row = payload.new as any;
          if (row.status !== "accepted") return;
          const currentSongIds = Array.from(songIdsRef.current);
          const [profileRes, knowledgeRes] = await Promise.all([
            supabase.from("profiles").select("display_name, last_name, username, avatar_url").eq("id", row.user_id).single(),
            currentSongIds.length > 0
              ? supabase.from("user_songs").select("user_id, song_id, confidence").eq("user_id", row.user_id).in("song_id", currentSongIds).in("confidence", ["lead", "support", "learn"])
              : Promise.resolve({ data: [] as any[] }),
          ]);
          const newCollab: Collaborator = {
            id: row.id,
            user_id: row.user_id,
            status: "accepted",
            role: row.role,
            profiles: (profileRes.data as any) ?? null,
          };
          setCollaborators((prev) => {
            if (prev.some((c) => c.id === row.id)) return prev;
            return [...prev, newCollab].sort((a, b) => {
              const nameA = (a.profiles?.display_name ?? a.profiles?.username ?? "").toLowerCase();
              const nameB = (b.profiles?.display_name ?? b.profiles?.username ?? "").toLowerCase();
              return nameA.localeCompare(nameB);
            });
          });
          if (knowledgeRes.data?.length) {
            setSongKnowledge((prev) => [
              ...prev.filter((k) => k.user_id !== row.user_id),
              ...(knowledgeRes.data as { user_id: string; song_id: string; confidence: string }[]),
            ]);
          }
          participantIdsRef.current.add(row.user_id);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "set_collaborators", filter: `set_id=eq.${set.id}` },
        async (payload) => {
          const row = payload.new as any;
          const old = payload.old as any;
          if (row.status === "accepted" && old.status !== "accepted") {
            // Request approved — fetch profile and knowledge, add as collaborator
            const currentSongIds = Array.from(songIdsRef.current);
            const [profileRes, knowledgeRes] = await Promise.all([
              supabase.from("profiles").select("display_name, last_name, username, avatar_url").eq("id", row.user_id).single(),
              currentSongIds.length > 0
                ? supabase.from("user_songs").select("user_id, song_id, confidence").eq("user_id", row.user_id).in("song_id", currentSongIds).in("confidence", ["lead", "support", "learn"])
                : Promise.resolve({ data: [] as any[] }),
            ]);
            const newCollab: Collaborator = {
              id: row.id,
              user_id: row.user_id,
              status: "accepted",
              role: row.role,
              profiles: (profileRes.data as any) ?? null,
            };
            setCollaborators((prev) => {
              if (prev.some((c) => c.id === row.id)) return prev;
              return [...prev, newCollab].sort((a, b) => {
                const nameA = (a.profiles?.display_name ?? a.profiles?.username ?? "").toLowerCase();
                const nameB = (b.profiles?.display_name ?? b.profiles?.username ?? "").toLowerCase();
                return nameA.localeCompare(nameB);
              });
            });
            if (knowledgeRes.data?.length) {
              setSongKnowledge((prev) => [
                ...prev.filter((k) => k.user_id !== row.user_id),
                ...(knowledgeRes.data as { user_id: string; song_id: string; confidence: string }[]),
              ]);
            }
            participantIdsRef.current.add(row.user_id);
          } else if (row.status === "accepted") {
            // Role changed for existing collaborator
            setCollaborators((prev) => prev.map((c) => c.id === row.id ? { ...c, role: row.role } : c));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "set_collaborators", filter: `set_id=eq.${set.id}` },
        (payload) => {
          const row = payload.old as any;
          setCollaborators((prev) => prev.filter((c) => c.id !== row.id));
          if (row.user_id) {
            participantIdsRef.current.delete(row.user_id);
            setSongKnowledge((prev) => prev.filter((k) => k.user_id !== row.user_id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_songs" },
        (payload) => {
          const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as any;
          if (!participantIdsRef.current.has(row.user_id) || !songIdsRef.current.has(row.song_id)) return;
          if (payload.eventType === "DELETE") {
            setSongKnowledge((prev) =>
              prev.filter((k) => !(k.user_id === row.user_id && k.song_id === row.song_id))
            );
          } else {
            if (!["lead", "support", "learn"].includes(row.confidence)) return;
            setSongKnowledge((prev) => [
              ...prev.filter((k) => !(k.user_id === row.user_id && k.song_id === row.song_id)),
              { user_id: row.user_id, song_id: row.song_id, confidence: row.confidence },
            ]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.id]);

  async function handleSelectSong(song: any) {
    const existing = userRepertoire.get(song.song_id);
    if (existing) {
      await submitAddSong(song.song_id, null, song);
    } else {
      setPendingSong(song);
    }
  }

  async function submitAddSong(songId: string, confidence: string | null, songHint?: { title: string; display_artist: string | null; slug?: string | null; year?: number | null }) {
    const body: any = { songId };
    if (confidence) body.confidence = confidence;

    const optimisticId = `optimistic-${songId}`;

    if (songHint) {
      const optimistic: Song = {
        id: optimisticId,
        song_id: songId,
        position: songs.length,
        key_note: null,
        leader_user_ids: [],
        songs: {
          title: songHint.title,
          display_artist: songHint.display_artist,
          slug: songHint.slug ?? null,
          chord_chart_url: null,
          youtube_url: null,
          tonality: null,
          year: songHint.year ?? null,
          meter: null,
          song_composers: [],
          song_lyricists: [],
          song_cultures: [],
          song_genres: [],
          song_themes: [],
          song_recording_artists: [],
        },
      };
      setSongs((prev) => [...prev, optimistic]);
    }

    setPendingSong(null);
    setSearchQuery("");
    setShowAddSong(false);

    const res = await fetch(`/api/sets/${set.id}/songs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const { song, knowledge } = await res.json();
      setSongs((prev) => {
        const without = prev.filter((s) => s.id !== optimisticId);
        return [...without, song];
      });
      if (knowledge?.length) {
        setSongKnowledge((prev) => [...prev, ...knowledge]);
      }
      if (confidence) {
        setUserRepertoire((prev) => new Map(prev).set(songId, confidence));
      }
    } else if (songHint) {
      setSongs((prev) => prev.filter((s) => s.id !== optimisticId));
    }
  }

  async function submitMissingSong() {
    if (!missingSongTitle.trim()) return;
    setMissingSongBusy(true);
    setMissingSongError(null);
    const res = await fetch("/api/songs/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: missingSongTitle.trim(), artist: missingSongArtist.trim() }),
    });
    const json = await res.json();
    setMissingSongBusy(false);
    if ((res.status === 409 || res.ok) && json.id) {
      setShowMissingSong(false);
      await handleSelectSong({ song_id: json.id, title: missingSongTitle.trim(), display_artist: missingSongArtist.trim() || null });
      return;
    }
    setMissingSongError(json.error ?? "Something went wrong. Please try again.");
  }

  async function handleAddToRepertoire(songId: string, confidence: string) {
    await supabase
      .from("user_songs")
      .upsert({ user_id: currentUserId!, song_id: songId, confidence }, { onConflict: "user_id,song_id" });
    setUserRepertoire((prev) => new Map(prev).set(songId, confidence));
    setSongKnowledge((prev) => [
      ...prev.filter((k) => !(k.user_id === currentUserId! && k.song_id === songId)),
      { user_id: currentUserId!, song_id: songId, confidence },
    ]);
  }


  async function handleRemoveSong(songId: string) {
    const removed = songs.find((s) => s.song_id === songId);
    setSongs((prev) => prev.filter((s) => s.song_id !== songId));
    const res = await fetch(`/api/sets/${set.id}/songs/${songId}`, { method: "DELETE" });
    if (!res.ok && removed) {
      setSongs((prev) => {
        const idx = prev.findIndex((s) => s.position >= removed.position);
        const next = [...prev];
        next.splice(idx === -1 ? next.length : idx, 0, removed);
        return next;
      });
    }
  }

  function handleMediaAdded(songId: string, field: "youtube_url" | "spotify_url" | "chord_chart_url", url: string) {
    setSongs((prev) =>
      prev.map((s) =>
        s.song_id === songId ? { ...s, songs: { ...s.songs, [field]: url } } : s
      )
    );
  }

  async function handleKeyChanged(id: string, key: string | null) {
    setSongs((prev) => prev.map((s) => s.id === id ? { ...s, key_note: key } : s));
    const entry = songs.find((s) => s.id === id);
    if (!entry) return;
    fetch(`/api/sets/${set.id}/songs/${entry.song_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key_note: key }),
    });
  }

  function handleLeadersChanged(id: string, leaderUserIds: string[]) {
    setSongs((prev) => prev.map((s) => s.id === id ? { ...s, leader_user_ids: leaderUserIds } : s));
    const entry = songs.find((s) => s.id === id);
    if (!entry) return;
    if (currentUserId && leaderUserIds.includes(currentUserId) && !userRepertoire.has(entry.song_id)) {
      setUserRepertoire((prev) => new Map(prev).set(entry.song_id, "lead"));
    }
    fetch(`/api/sets/${set.id}/songs/${entry.song_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leader_user_ids: leaderUserIds }),
    });
  }

  const participants: Participant[] = [
    ...(set.profiles ? [{ user_id: set.owner_user_id, display_name: set.profiles.display_name, last_name: null, username: set.profiles.username, avatar_url: null }] : []),
    ...collaborators.filter((c) => c.user_id).map((c) => ({
      user_id: c.user_id!,
      display_name: c.profiles?.display_name ?? null,
      last_name: c.profiles?.last_name ?? null,
      username: c.profiles?.username ?? null,
      avatar_url: c.profiles?.avatar_url ?? null,
    })),
  ];

  // Build a per-song lookup: songId → Map<userId, confidence>
  const songKnowledgeMap = new Map<string, Map<string, string>>();
  for (const k of songKnowledge) {
    if (!songKnowledgeMap.has(k.song_id)) songKnowledgeMap.set(k.song_id, new Map());
    songKnowledgeMap.get(k.song_id)!.set(k.user_id, k.confidence);
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

  async function handleChangeCollaboratorRole(collaboratorId: string, role: "editor" | "viewer") {
    const prev = collaborators;
    setCollaborators((cs) => cs.map((c) => c.id === collaboratorId ? { ...c, role } : c));
    const res = await fetch(`/api/sets/${set.id}/collaborators`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collaboratorId, role }),
    });
    if (!res.ok) setCollaborators(prev);
  }

  async function handleRemoveCollaborator(collaboratorId: string) {
    const removed = collaborators.find((c) => c.id === collaboratorId);
    setCollaborators((prev) => prev.filter((c) => c.id !== collaboratorId));
    const res = await fetch(`/api/sets/${set.id}/invite/link`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId: collaboratorId }),
    });
    if (!res.ok && removed) setCollaborators((prev) => [...prev, removed].sort((a, b) => {
      const nameA = (a.profiles?.display_name ?? a.profiles?.username ?? "").toLowerCase();
      const nameB = (b.profiles?.display_name ?? b.profiles?.username ?? "").toLowerCase();
      return nameA.localeCompare(nameB);
    }));
  }

  async function handleApproveRequest(requestId: string, role: "editor" | "viewer") {
    const request = accessRequests.find((r) => r.id === requestId);
    if (!request) return;
    setAccessRequests((prev) => prev.filter((r) => r.id !== requestId));
    setCollaborators((prev) => [...prev, { ...request, status: "accepted", role }].sort((a, b) => {
      const nameA = (a.profiles?.display_name ?? a.profiles?.username ?? "").toLowerCase();
      const nameB = (b.profiles?.display_name ?? b.profiles?.username ?? "").toLowerCase();
      return nameA.localeCompare(nameB);
    }));
    const res = await fetch(`/api/sets/${set.id}/collaborators`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collaboratorId: requestId, role }),
    });
    if (!res.ok) {
      setAccessRequests((prev) => [...prev, request]);
      setCollaborators((prev) => prev.filter((c) => c.id !== requestId));
    }
  }

  async function handleDenyRequest(requestId: string) {
    setAccessRequests((prev) => prev.filter((r) => r.id !== requestId));
    await fetch(`/api/sets/${set.id}/invite/link`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId: requestId }),
    });
  }

  async function handleSetLinkSharing(value: "private" | "link" | "public") {
    const prev = linkSharing;
    setLinkSharing(value);
    const res = await fetch(`/api/sets/${set.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link_sharing: value }),
    });
    if (!res.ok) setLinkSharing(prev);
  }

  function handleCSVDownload() {
    const headers: string[] = ["#", "Title"];
    if (csvColumns.artist)   headers.push("Artist");
    if (csvColumns.year)     headers.push("Year");
    if (csvColumns.tonality) headers.push("Tonality");
    if (csvColumns.meter)    headers.push("Meter");
    if (csvColumns.key)      headers.push("Key");
    if (csvColumns.leader)   headers.push("Leader");
    if (csvColumns.songwriters) { headers.push("Composers"); headers.push("Lyricists"); }
    if (csvColumns.genres)      headers.push("Genres");
    if (csvColumns.themes)      headers.push("Themes");
    if (csvColumns.singjam)     headers.push("SingJam link");
    if (csvColumns.youtube)  headers.push("YouTube");
    if (csvColumns.spotify)  headers.push("Spotify");
    if (csvColumns.chords)   headers.push("Chord Chart");

    const rows = songs.map((s, i) => {
      const cols: (string | number)[] = [i + 1, `"${s.songs.title.replace(/"/g, '""')}"`];
      if (csvColumns.artist)   cols.push(`"${(s.songs.display_artist ?? "").replace(/"/g, '""')}"`);
      if (csvColumns.year)     cols.push(s.songs.year ?? "");
      if (csvColumns.tonality) cols.push(s.songs.tonality ?? "");
      if (csvColumns.meter)    cols.push(s.songs.meter ?? "");
      if (csvColumns.key)      cols.push(s.key_note ?? "");
      if (csvColumns.leader) {
        const leaderNames = (s.leader_user_ids ?? [])
          .map((uid) => {
            const p = participants.find((pt) => pt.user_id === uid);
            return p?.display_name ?? p?.username ?? "";
          })
          .filter(Boolean)
          .join("; ");
        cols.push(`"${leaderNames.replace(/"/g, '""')}"`);
      }
      if (csvColumns.songwriters) {
        const composerNames = (s.songs.song_composers ?? []).map((c) => c.people?.name).filter(Boolean) as string[];
        const lyricistNames = (s.songs.song_lyricists ?? []).map((l) => l.people?.name).filter(Boolean) as string[];
        const musicCultures = (s.songs.song_cultures ?? []).filter((c) => c.context === "music").map((c) => c.cultures?.name).filter(Boolean) as string[];
        const lyricCultures = (s.songs.song_cultures ?? []).filter((c) => c.context === "lyrics").map((c) => c.cultures?.name).filter(Boolean) as string[];
        const composerStr = formatComposers(composerNames, musicCultures);
        const lyricistStr = formatComposers(lyricistNames, lyricCultures);
        cols.push(`"${composerStr.replace(/"/g, '""')}"`);
        cols.push(`"${lyricistStr.replace(/"/g, '""')}"`);
      }
      if (csvColumns.genres) {
        const names = (s.songs.song_genres ?? []).map((g) => g.genres?.name).filter(Boolean).join("; ");
        cols.push(`"${names.replace(/"/g, '""')}"`);
      }
      if (csvColumns.themes) {
        const names = (s.songs.song_themes ?? []).map((t) => t.themes?.name).filter(Boolean).join("; ");
        cols.push(`"${names.replace(/"/g, '""')}"`);
      }
      if (csvColumns.singjam) cols.push(s.songs.slug ? `https://singjam.org/songs/${s.songs.slug}` : "");
      if (csvColumns.youtube) {
        const videoId = getPrimaryYoutubeId(s.songs);
        cols.push(videoId ? `https://www.youtube.com/watch?v=${videoId}` : "");
      }
      if (csvColumns.spotify) cols.push(getPrimarySpotifyUrl(s.songs) ?? "");
      if (csvColumns.chords)  cols.push(s.songs.chord_chart_url ?? "");
      return cols.join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${set.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowCsvOptions(false);
  }

  async function handleCreatePlaylist(platform: "youtube" | "spotify") {
    setCreatingPlaylist(platform);
    setPlaylistError(null);
    const res = await fetch(`/api/sets/${set.id}/playlists/${platform}`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setPlaylistLinks(prev => ({ ...prev, [platform]: { url: data.url, added: data.added, total: data.total } }));
      if (platform === "youtube") setLastSyncedYoutubeFingerprint(data.fingerprint ?? null);
      else setLastSyncedSpotifyFingerprint(data.fingerprint ?? null);
    } else {
      setPlaylistError(platform);
    }
    setCreatingPlaylist(null);
  }

  async function handleDeleteSet() {
    setDeleting(true);
    await fetch(`/api/sets/${set.id}`, { method: "DELETE" });
    router.push("/sets");
  }

  async function handleCopySet() {
    setCopying(true);
    setSetMenuOpen(false);
    const res = await fetch(`/api/sets/${set.id}/copy`, { method: "POST" });
    if (res.ok) {
      const { id } = await res.json();
      router.push(`/set/${id}`);
    } else {
      setCopying(false);
    }
  }

  const youtubeFingerprint = songs.map(s => getPrimaryYoutubeId(s.songs)).filter(Boolean).join(",");
  const spotifyFingerprint = songs.map(s => getSpotifyTrackId(getPrimarySpotifyUrl(s.songs))).filter(Boolean).join(",");
  const youtubeOutdated = !!playlistLinks.youtube && lastSyncedYoutubeFingerprint !== youtubeFingerprint;
  const spotifyOutdated = !!playlistLinks.spotify && lastSyncedSpotifyFingerprint !== spotifyFingerprint;

  const ownerFullName = [set.profiles?.display_name, set.profiles?.last_name].filter(Boolean).join(" ") || set.profiles?.username || "Unknown";

  return (
    <div className="space-y-6">
      {(playlistLinks.youtube?.added !== undefined || playlistLinks.spotify?.added !== undefined || playlistError) && (
        <div className={`rounded-xl border px-4 py-3 space-y-1.5 ${playlistError ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
          {playlistLinks.youtube?.added !== undefined && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-green-700">
                {playlistLinks.youtube.added < (playlistLinks.youtube.total ?? 0)
                  ? `YouTube playlist synced — ${playlistLinks.youtube.added} of ${playlistLinks.youtube.total} songs added (${(playlistLinks.youtube.total ?? 0) - playlistLinks.youtube.added} have no YouTube link).`
                  : `YouTube playlist synced — all ${playlistLinks.youtube.total} songs added.`}
              </p>
              <a href={playlistLinks.youtube.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm font-medium text-green-700 underline">Open →</a>
            </div>
          )}
          {playlistLinks.spotify?.added !== undefined && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-green-700">
                {playlistLinks.spotify.added < (playlistLinks.spotify.total ?? 0)
                  ? `Spotify playlist synced — ${playlistLinks.spotify.added} of ${playlistLinks.spotify.total} songs added (${(playlistLinks.spotify.total ?? 0) - playlistLinks.spotify.added} have no Spotify link).`
                  : `Spotify playlist synced — all ${playlistLinks.spotify.total} songs added.`}
              </p>
              <a href={playlistLinks.spotify.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm font-medium text-green-700 underline">Open →</a>
            </div>
          )}
          {playlistError && (
            <p className="text-sm text-red-700">
              Couldn&apos;t sync {playlistError === "youtube" ? "YouTube" : "Spotify"} playlist. Please try again.
            </p>
          )}
        </div>
      )}

      {set.jam_id && canAccessJam && (
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
              <p className="text-xs text-zinc-400 mt-1">
                by{" "}
                {set.profiles?.username ? (
                  <Link href={`/u/${set.profiles.username}`} className="font-medium text-zinc-500 hover:underline">
                    {ownerFullName}
                    {(set.profiles.display_name || set.profiles.last_name) && (
                      <span className="ml-1 font-normal text-zinc-400">@{set.profiles.username}</span>
                    )}
                  </Link>
                ) : (
                  <span className="font-medium text-zinc-500">{ownerFullName}</span>
                )}
              </p>
            </>
          )}
        </div>

        {isPublicViewer && (
          currentUserId ? (
            <button
              onClick={handleCopySet}
              disabled={copying}
              className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
            >
              {copying ? "Copying…" : "Copy to my sets"}
            </button>
          ) : (
            <a
              href={`/auth?next=/set/${set.id}`}
              className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Sign in to copy
            </a>
          )
        )}

        {isOwner && !editingName && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setEditingName(true)}
              className="text-zinc-400 hover:text-zinc-600 transition-colors"
              aria-label="Edit set name"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
            </button>
            <div className="relative" ref={setMenuRef}>
              <button
                onClick={() => setSetMenuOpen((o) => !o)}
                disabled={copying}
                className="text-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-50"
                aria-label="More options"
              >
                {copying ? (
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M12 2a10 10 0 0 1 0 20" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                    <circle cx="4" cy="10" r="1.5" />
                    <circle cx="10" cy="10" r="1.5" />
                    <circle cx="16" cy="10" r="1.5" />
                  </svg>
                )}
              </button>
              {setMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-zinc-200 bg-white shadow-lg z-10 overflow-hidden py-1">
                  <button
                    onClick={handleCopySet}
                    className="w-full text-left flex items-center px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    Copy set
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Visibility selector — owner only */}
      {isOwner && (
        <div className="rounded-xl border border-zinc-100 bg-white px-3 py-2.5 space-y-2">
          <p className="text-xs font-medium text-zinc-500">Visibility</p>
          <div className="flex gap-0.5 rounded-lg bg-zinc-100 p-0.5">
            {([
              { value: "private", label: "Private" },
              { value: "link",    label: "Open join" },
              { value: "public",  label: "Public" },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleSetLinkSharing(value)}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  linkSharing === value
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-400">
            {linkSharing === "private" && "Only invited collaborators can access this set."}
            {linkSharing === "link"    && "Logged-in users who visit are automatically joined as viewers."}
            {linkSharing === "public"  && "Anyone with the link can view without signing in."}
          </p>
        </div>
      )}

      {/* Collaborators — owner first, then accepted collaborators */}
      {!isPublicViewer && <ul className="space-y-2">
        {/* Owner card */}
        <li className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-white px-3 py-2">
          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-xs font-medium text-zinc-600">
            {set.profiles?.avatar_url
              ? <Image src={set.profiles.avatar_url} alt="" fill className="object-cover" unoptimized />
              : (set.profiles?.display_name ?? set.profiles?.username ?? "?")[0].toUpperCase()
            }
          </span>
          {set.profiles?.username ? (
            <Link href={`/u/${set.profiles.username}`} className="flex-1 min-w-0 text-sm text-zinc-700 truncate hover:underline">
              {[set.profiles.display_name, set.profiles.last_name].filter(Boolean).join(" ") || set.profiles.username}
            </Link>
          ) : (
            <span className="flex-1 min-w-0 text-sm text-zinc-700 truncate">
              {ownerFullName}
            </span>
          )}
          <span className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700">Owner</span>
        </li>

        {/* Access request cards */}
        {isOwner && accessRequests.map((r) => (
          <li key={r.id} className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-100 text-xs font-medium text-amber-700">
              {r.profiles?.avatar_url
                ? <Image src={r.profiles.avatar_url} alt="" fill className="object-cover" unoptimized />
                : (r.profiles?.display_name ?? r.profiles?.username ?? "?")[0].toUpperCase()
              }
            </span>
            {r.profiles?.username ? (
              <Link href={`/u/${r.profiles.username}`} className="flex-1 min-w-0 text-sm text-zinc-700 truncate hover:underline">
                {[r.profiles?.display_name, r.profiles?.last_name].filter(Boolean).join(" ") || r.profiles.username}
              </Link>
            ) : (
              <span className="flex-1 min-w-0 text-sm text-zinc-700 truncate">
                {[r.profiles?.display_name, r.profiles?.last_name].filter(Boolean).join(" ") || "Unknown"}
              </span>
            )}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-amber-600 mr-1">Requested</span>
              <div className="flex rounded-lg border border-zinc-200 overflow-hidden bg-white">
                {(["editor", "viewer"] as const).map((role) => (
                  <button
                    key={role}
                    onClick={() => handleApproveRequest(r.id, role)}
                    className="px-2.5 py-1 text-xs font-medium capitalize text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 transition-colors"
                  >
                    {role}
                  </button>
                ))}
              </div>
              <button
                onClick={() => handleDenyRequest(r.id)}
                className="text-xs text-zinc-400 hover:text-red-400 transition-colors"
              >
                Deny
              </button>
            </div>
          </li>
        ))}

        {/* Collaborator cards */}
        {(showAllCollaborators ? collaborators : collaborators.slice(0, 3)).map((c) => (
          <li key={c.id} className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-white px-3 py-2">
            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-xs font-medium text-zinc-600">
              {c.profiles?.avatar_url
                ? <Image src={c.profiles.avatar_url} alt="" fill className="object-cover" unoptimized />
                : (c.profiles?.display_name ?? c.profiles?.username ?? "?")[0].toUpperCase()
              }
            </span>
            {c.profiles?.username ? (
              <Link href={`/u/${c.profiles.username}`} className="flex-1 min-w-0 text-sm text-zinc-700 truncate hover:underline">
                {[c.profiles?.display_name, c.profiles?.last_name].filter(Boolean).join(" ") || c.profiles.username}
              </Link>
            ) : (
              <span className="flex-1 min-w-0 text-sm text-zinc-700 truncate">
                {[c.profiles?.display_name, c.profiles?.last_name].filter(Boolean).join(" ") || "Unknown"}
              </span>
            )}
            {isOwner ? (
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex rounded-lg border border-zinc-200 overflow-hidden">
                  {(["editor", "viewer"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => handleChangeCollaboratorRole(c.id, r)}
                      className={`px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                        c.role === r
                          ? "bg-zinc-100 text-zinc-700"
                          : "text-zinc-400 hover:text-zinc-600"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => handleRemoveCollaborator(c.id)}
                  className="text-xs text-zinc-400 hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : canEdit ? (
              <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
                c.role === "editor" ? "bg-zinc-100 text-zinc-600" : "bg-zinc-50 text-zinc-400"
              }`}>
                {c.role}
              </span>
            ) : null}
          </li>
        ))}

        {collaborators.length > 3 && (
          <li>
            <button
              onClick={() => setShowAllCollaborators((v) => !v)}
              className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              {showAllCollaborators ? "Show less" : `+${collaborators.length - 3} more`}
            </button>
          </li>
        )}
      </ul>}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <>
            <button
              onClick={() => setShowInvitePanel((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
              Share
            </button>
            {showInvitePanel && (
              <div className="basis-full">
                <SetInvitePanel
                  setId={set.id}
                  isOwner={isOwner}
                  alreadyCollaboratorIds={collaborators.filter((c) => c.user_id).map((c) => c.user_id!)}
                  onCollaboratorAdded={(c) => setCollaborators((prev) => [...prev, c])}
                />
              </div>
            )}
          </>
        )}

        {isAdmin ? (
          !playlistLinks.youtube ? (
            <button
              onClick={() => handleCreatePlaylist("youtube")}
              disabled={!!creatingPlaylist}
              className="flex items-center gap-1.5 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              <YoutubeIcon />
              {creatingPlaylist === "youtube" ? "Creating…" : "YouTube playlist"}
            </button>
          ) : youtubeOutdated ? (
            <div className="flex items-center rounded-xl border border-red-200 overflow-hidden">
              <button
                onClick={() => handleCreatePlaylist("youtube")}
                disabled={!!creatingPlaylist}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <YoutubeIcon />
                <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                {creatingPlaylist === "youtube" ? "Updating…" : "Update playlist"}
              </button>
              <a href={playlistLinks.youtube.url} target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors border-l border-red-200">
                Open →
              </a>
            </div>
          ) : (
            <div className="flex items-center rounded-xl border border-red-200 overflow-hidden">
              <a href={playlistLinks.youtube.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                <YoutubeIcon />
                Open playlist
              </a>
              <button
                onClick={() => handleCreatePlaylist("youtube")}
                disabled={!!creatingPlaylist}
                className="px-3 py-2 text-sm text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 transition-colors border-l border-red-200"
                title="Re-sync playlist"
              >
                {creatingPlaylist === "youtube" ? "…" : "↺"}
              </button>
            </div>
          )
        ) : playlistLinks.youtube ? (
          <a href={playlistLinks.youtube.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
            <YoutubeIcon />
            YouTube playlist →
          </a>
        ) : null}

        {isOwner ? (
          !playlistLinks.spotify ? (
            <button
              onClick={() => handleCreatePlaylist("spotify")}
              disabled={!!creatingPlaylist}
              className="flex items-center gap-1.5 rounded-xl border border-green-200 px-4 py-2 text-sm font-medium text-green-600 hover:bg-green-50 disabled:opacity-50 transition-colors"
            >
              <SpotifyIcon />
              {creatingPlaylist === "spotify" ? "Creating…" : "Spotify playlist"}
            </button>
          ) : spotifyOutdated ? (
            <div className="flex items-center rounded-xl border border-green-200 overflow-hidden">
              <button
                onClick={() => handleCreatePlaylist("spotify")}
                disabled={!!creatingPlaylist}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-green-600 hover:bg-green-50 disabled:opacity-50 transition-colors"
              >
                <SpotifyIcon />
                <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                {creatingPlaylist === "spotify" ? "Updating…" : "Update playlist"}
              </button>
              <a href={playlistLinks.spotify.url} target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-sm font-medium text-green-500 hover:bg-green-50 transition-colors border-l border-green-200">
                Open →
              </a>
            </div>
          ) : (
            <div className="flex items-center rounded-xl border border-green-200 overflow-hidden">
              <a href={playlistLinks.spotify.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-green-600 hover:bg-green-50 transition-colors">
                <SpotifyIcon />
                Open playlist
              </a>
              <button
                onClick={() => handleCreatePlaylist("spotify")}
                disabled={!!creatingPlaylist}
                className="px-3 py-2 text-sm text-green-400 hover:bg-green-50 hover:text-green-600 disabled:opacity-50 transition-colors border-l border-green-200"
                title="Re-sync playlist"
              >
                {creatingPlaylist === "spotify" ? "…" : "↺"}
              </button>
            </div>
          )
        ) : playlistLinks.spotify ? (
          <a href={playlistLinks.spotify.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-xl border border-green-200 px-4 py-2 text-sm font-medium text-green-600 hover:bg-green-50 transition-colors">
            <SpotifyIcon />
            Spotify playlist →
          </a>
        ) : null}

        <button
          onClick={() => setShowCsvOptions((v) => !v)}
          className={`flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${showCsvOptions ? "border-zinc-400 bg-zinc-50 text-zinc-900" : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"}`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export CSV
        </button>
        {showCsvOptions && (
          <div className="basis-full rounded-xl border border-zinc-200 bg-white px-4 py-3 space-y-3">
            <p className="text-xs font-medium text-zinc-500">Columns to include</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {CSV_COLUMN_OPTIONS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-1.5 text-sm text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={csvColumns[key]}
                    onChange={(e) => setCsvColumns((prev) => ({ ...prev, [key]: e.target.checked }))}
                    className="rounded border-zinc-300 accent-amber-500"
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCSVDownload}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-400 transition-colors"
              >
                Download
              </button>
              <button
                onClick={() => setShowCsvOptions(false)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        <a
          href={`/set/${set.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          Create PDF
        </a>
      </div>

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
                {songs.map((song, i) => {
                  const knowledgeForSong = songKnowledgeMap.get(song.song_id) ?? new Map<string, string>();
                  const knowledgeUserIds = new Set(knowledgeForSong.keys());
                  const hasEligible = [...knowledgeForSong.values()].some((c) => c === "lead");
                  const rowParticipants = participants.filter((p) =>
                    knowledgeUserIds.has(p.user_id) || (song.leader_user_ids ?? []).includes(p.user_id)
                  );
                  return (
                    <SortableSongItem
                      key={song.id}
                      song={song}
                      index={i}
                      canEdit={canEdit}
                      isAdmin={isAdmin}
                      isHost={isOwner}
                      isPublicViewer={isPublicViewer}
                      participants={rowParticipants}
                      hasEligible={hasEligible}
                      participantKnowledge={knowledgeForSong}
                      currentUserId={currentUserId}
                      currentUserSingingVoice={userSingingVoice}
                      inRepertoire={userRepertoire.has(song.song_id)}
                      onRemove={handleRemoveSong}
                      onMediaAdded={handleMediaAdded}
                      onKeyChanged={handleKeyChanged}
                      onLeadersChanged={handleLeadersChanged}
                      onAddToRepertoire={handleAddToRepertoire}
                      onVoiceUpdated={setUserSingingVoice}
                      signInUrl={currentUserId ? undefined : `/auth?next=/set/${set.id}`}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
          ) : (
            songs.map((song, i) => {
              const knowledgeForSong = songKnowledgeMap.get(song.song_id) ?? new Map<string, string>();
              const knowledgeUserIds = new Set(knowledgeForSong.keys());
              const hasEligible = [...knowledgeForSong.values()].some((c) => c === "lead");
              const rowParticipants = isPublicViewer
                ? participants.filter((p) => (song.leader_user_ids ?? []).includes(p.user_id))
                : participants.filter((p) =>
                    knowledgeUserIds.has(p.user_id) || (song.leader_user_ids ?? []).includes(p.user_id)
                  );
              return (
                <div key={song.id} className="flex items-start gap-2 sm:gap-3 rounded-xl border border-zinc-200 bg-white px-2 sm:px-4 py-2.5 sm:py-3">
                  <span className="shrink-0 mt-0.5 w-4 sm:w-6 text-center text-[10px] sm:text-xs font-semibold text-zinc-300">{i + 1}</span>
                  <SongRowContent
                    song={song}
                    index={i}
                    canEdit={false}
                    isAdmin={false}
                    isHost={false}
                    isPublicViewer={isPublicViewer}
                    participants={rowParticipants}
                    hasEligible={hasEligible}
                    participantKnowledge={knowledgeForSong}
                    currentUserId={currentUserId}
                    currentUserSingingVoice={userSingingVoice}
                    inRepertoire={userRepertoire.has(song.song_id)}
                    onMediaAdded={() => {}}
                    onKeyChanged={() => {}}
                    onLeadersChanged={() => {}}
                    onAddToRepertoire={handleAddToRepertoire}
                    onVoiceUpdated={setUserSingingVoice}
                    signInUrl={currentUserId ? undefined : `/auth?next=/set/${set.id}`}
                  />
                </div>
              );
            })
          )
        )}

        {canEdit && (
          showAddSong ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-700">Add a song</p>
                <button
                  onClick={() => { setShowAddSong(false); setSearchQuery(""); setPendingSong(null); setShowMissingSong(false); setMissingSongError(null); }}
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
                  <ConfidencePicker
                    variant="compact"
                    singingVoice={userSingingVoice}
                    onSave={(level) => submitAddSong(pendingSong.song_id, level, pendingSong)}
                    onCancel={() => setPendingSong(null)}
                    onVoiceUpdated={setUserSingingVoice}
                  />
                </div>
              ) : (
                <>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setShowMissingSong(false); setMissingSongError(null); }}
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
                    showMissingSong ? (
                      <div className="space-y-2 rounded-xl border border-zinc-200 p-3">
                        <p className="text-sm font-medium text-zinc-700">Add a missing song</p>
                        <input
                          value={missingSongTitle}
                          onChange={(e) => setMissingSongTitle(e.target.value)}
                          placeholder="Song title"
                          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                        />
                        <input
                          value={missingSongArtist}
                          onChange={(e) => setMissingSongArtist(e.target.value)}
                          placeholder="Recording artist (optional)"
                          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                        />
                        {missingSongError && <p className="text-xs text-red-500">{missingSongError}</p>}
                        {missingSongBusy && <p className="text-xs text-zinc-400">Looking up song info — this may take a moment…</p>}
                        <div className="flex gap-2">
                          <button
                            onClick={submitMissingSong}
                            disabled={missingSongBusy || !missingSongTitle.trim()}
                            className="rounded-xl bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-50 transition-colors"
                          >
                            {missingSongBusy ? "Adding…" : "Add song"}
                          </button>
                          <button
                            onClick={() => setShowMissingSong(false)}
                            disabled={missingSongBusy}
                            className="rounded-xl border border-zinc-200 px-4 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs text-zinc-400">No songs found.</p>
                        <button
                          onClick={() => { setShowMissingSong(true); setMissingSongTitle(searchQuery.trim()); setMissingSongArtist(""); }}
                          className="text-xs text-amber-600 hover:text-amber-700 transition-colors"
                        >
                          Add a missing song →
                        </button>
                      </div>
                    )
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
