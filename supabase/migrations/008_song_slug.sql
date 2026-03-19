-- Migration 008: add slug column to songs for human-readable URLs

alter table public.songs
  add column if not exists slug text unique;
