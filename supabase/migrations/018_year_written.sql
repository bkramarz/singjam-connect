-- Migration 018: add year_written to songs for composition date distinct from first recording

alter table public.songs add column if not exists year_written integer;
