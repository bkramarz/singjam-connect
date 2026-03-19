-- Migration 006: add year to song_recording_artists
alter table public.song_recording_artists
  add column if not exists year integer;
