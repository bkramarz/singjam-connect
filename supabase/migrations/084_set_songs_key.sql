-- Add per-set key override to set_songs.
-- Collaborators can set a key for a song in their set list, independent of the global tonality.
alter table public.set_songs add column if not exists key_note text;
