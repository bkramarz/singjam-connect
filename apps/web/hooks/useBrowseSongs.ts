import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { browseRpcParams, type BrowseFilters } from "@/lib/browseSongsParams";

export type { BrowseFilters } from "@/lib/browseSongsParams";

export type BrowseSong = {
  song_id: string;
  title: string;
  slug: string | null;
  display_artist: string | null;
  composers: string[];
  cultures: string[];
  productions: string[];
  genres: string[];
  languages: string[];
  themes: string[];
  vibe: string | null;
  tonality: string | null;
  meter: string | null;
  year: number | null;
  popularity: number;
  youtube_id: string | null;
  spotify_track_id: string | null;
  total_count: number;
};

export function useBrowseSongs(
  filters: BrowseFilters,
  { pageSize = 20, initialCount = pageSize }: { pageSize?: number; initialCount?: number } = {}
) {
  const supabase = useRef(supabaseBrowser()).current;
  const [songs, setSongs] = useState<BrowseSong[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const isFirstLoad = useRef(true);

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  useEffect(() => {
    const seq = ++requestSeq.current;
    const f = JSON.parse(filtersKey) as BrowseFilters;
    const limit = isFirstLoad.current ? Math.max(initialCount, pageSize) : pageSize;
    isFirstLoad.current = false;
    setLoading(true);
    setLoadingMore(false);
    supabase.rpc("browse_songs", browseRpcParams(f, 0, limit)).then(({ data, error: rpcError }) => {
      if (seq !== requestSeq.current) return;
      setLoading(false);
      if (rpcError) {
        setError("Could not load songs. Please try again.");
        setSongs([]);
        setTotal(null);
        return;
      }
      const rows = (data ?? []) as BrowseSong[];
      setError(null);
      setSongs(rows);
      setTotal(rows[0]?.total_count ?? 0);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  const hasMore = total !== null && songs.length < total;

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    const seq = requestSeq.current;
    const f = JSON.parse(filtersKey) as BrowseFilters;
    setLoadingMore(true);
    supabase.rpc("browse_songs", browseRpcParams(f, songs.length, pageSize)).then(({ data, error: rpcError }) => {
      if (seq !== requestSeq.current) return;
      setLoadingMore(false);
      if (rpcError) {
        setError("Could not load more songs. Please try again.");
        return;
      }
      const rows = (data ?? []) as BrowseSong[];
      setSongs((prev) => [...prev, ...rows]);
      if (rows[0]) setTotal(rows[0].total_count);
      else setTotal(songs.length);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, songs.length, pageSize, loading, loadingMore, hasMore]);

  return { songs, total, loading, loadingMore, error, hasMore, loadMore };
}
