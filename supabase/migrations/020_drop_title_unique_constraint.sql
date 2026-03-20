-- Migration 020: drop unique constraint on songs.title
-- Titles are not unique (e.g. "Dreams" by Fleetwood Mac and The Cranberries).
-- The slug (title + composers) is the correct unique identifier.
alter table public.songs drop constraint if exists songs_title_unique;
