-- Migration 068: allow users to submit songs for review

alter table public.songs
  add column if not exists needs_review boolean not null default false,
  add column if not exists submitted_by uuid references public.profiles(id) on delete set null;
