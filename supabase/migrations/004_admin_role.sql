-- Migration 004: add is_admin flag to profiles and admin write policies

-- ─────────────────────────────────────────
-- Admin flag on profiles
-- ─────────────────────────────────────────
alter table public.profiles
  add column if not exists is_admin boolean not null default false;


-- ─────────────────────────────────────────
-- Admin write policies: songs
-- ─────────────────────────────────────────
create policy "admin write songs" on public.songs
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );


-- ─────────────────────────────────────────
-- Admin write policies: lookup tables
-- ─────────────────────────────────────────
create policy "admin write genres"      on public.genres
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admin write themes"      on public.themes
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admin write cultures"    on public.cultures
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admin write languages"   on public.languages
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admin write traditions"  on public.traditions
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admin write people"      on public.people
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admin write artists"     on public.artists
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));


-- ─────────────────────────────────────────
-- Admin write policies: join tables
-- ─────────────────────────────────────────
create policy "admin write song_genres"     on public.song_genres
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admin write song_themes"     on public.song_themes
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admin write song_cultures"   on public.song_cultures
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admin write song_languages"  on public.song_languages
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admin write song_traditions" on public.song_traditions
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admin write song_composers"  on public.song_composers
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admin write song_lyricists"  on public.song_lyricists
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admin write song_recording_artists" on public.song_recording_artists
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admin write song_alternate_titles" on public.song_alternate_titles
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admin write song_resources" on public.song_resources
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
