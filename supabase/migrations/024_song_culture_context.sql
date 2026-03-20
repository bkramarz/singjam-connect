-- Migration 024: add context to song_cultures to distinguish music vs lyrics tradition
alter table public.song_cultures
  add column if not exists context text check (context in ('music', 'lyrics', null));
