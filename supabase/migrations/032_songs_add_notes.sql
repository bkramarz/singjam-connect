-- Migration 032: add notes field to songs
alter table public.songs add column if not exists notes text;
