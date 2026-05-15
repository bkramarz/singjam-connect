-- Migration 092: unique constraint on normalised (title, display_artist)
-- Prevents duplicate songs regardless of casing or surrounding whitespace.
-- Two songs with the same title ARE allowed if they have different display_artists
-- (e.g. "Dreams" by Fleetwood Mac vs The Cranberries).
-- NULL display_artist is coalesced to '' so two title-only songs also conflict.

create unique index songs_title_artist_unique
  on public.songs (lower(trim(title)), lower(trim(coalesce(display_artist, ''))));
