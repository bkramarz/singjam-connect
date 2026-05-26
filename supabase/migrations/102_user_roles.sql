-- Migration 102: replace is_admin boolean with user_role enum
-- Adds 'song_editor' as first non-admin role; future roles just add enum values.

-- ── 1. Enum ──────────────────────────────────────────────────────────────────
create type public.user_role as enum ('member', 'song_editor', 'admin');

-- ── 2. Add role column ───────────────────────────────────────────────────────
alter table public.profiles
  add column role public.user_role not null default 'member';

-- ── 3. Backfill existing admins ─────────────────────────────────────────────
update public.profiles set role = 'admin' where is_admin = true;

-- ── 4. Update RLS policies ───────────────────────────────────────────────────
-- All policies that referenced is_admin = true are dropped and recreated
-- using role = 'admin'.  Tables dropped in migration 071 (song_resources,
-- song_traditions, traditions) are skipped.

-- songs: keep admin-only full access, add song_editor update access
drop policy if exists "admin write songs" on public.songs;
create policy "admin write songs" on public.songs
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "song editor update songs" on public.songs
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'song_editor')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'song_editor')
  );

-- lookup tables (genres, themes, cultures, people, artists)
drop policy if exists "admin write genres" on public.genres;
create policy "admin write genres" on public.genres
  for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "admin write themes" on public.themes;
create policy "admin write themes" on public.themes
  for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "admin write cultures" on public.cultures;
create policy "admin write cultures" on public.cultures
  for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "admin write people" on public.people;
create policy "admin write people" on public.people
  for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "admin write artists" on public.artists;
create policy "admin write artists" on public.artists
  for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- song join tables
drop policy if exists "admin write song_genres" on public.song_genres;
create policy "admin write song_genres" on public.song_genres
  for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "admin write song_themes" on public.song_themes;
create policy "admin write song_themes" on public.song_themes
  for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "admin write song_cultures" on public.song_cultures;
create policy "admin write song_cultures" on public.song_cultures
  for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "admin write song_composers" on public.song_composers;
create policy "admin write song_composers" on public.song_composers
  for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "admin write song_lyricists" on public.song_lyricists;
create policy "admin write song_lyricists" on public.song_lyricists
  for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "admin write song_recording_artists" on public.song_recording_artists;
create policy "admin write song_recording_artists" on public.song_recording_artists
  for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "admin write song_alternate_titles" on public.song_alternate_titles;
create policy "admin write song_alternate_titles" on public.song_alternate_titles
  for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- languages / song_languages (may or may not still exist)
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'languages') then
    drop policy if exists "admin write languages" on public.languages;
    execute $p$
      create policy "admin write languages" on public.languages
        for all
        using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
        with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
    $p$;
  end if;
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'song_languages') then
    drop policy if exists "admin write song_languages" on public.song_languages;
    execute $p$
      create policy "admin write song_languages" on public.song_languages
        for all
        using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
        with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
    $p$;
  end if;
end $$;

-- user_songs
drop policy if exists "admin read all user_songs" on public.user_songs;
create policy "admin read all user_songs" on public.user_songs
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- productions
drop policy if exists "Admin write productions" on public.productions;
create policy "Admin write productions" on public.productions
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "Admin write song_productions" on public.song_productions;
create policy "Admin write song_productions" on public.song_productions
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- feature_flags
drop policy if exists "admin write feature_flags" on public.feature_flags;
create policy "admin write feature_flags" on public.feature_flags
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ── 5. Drop is_admin column ───────────────────────────────────────────────────
alter table public.profiles drop column is_admin;
