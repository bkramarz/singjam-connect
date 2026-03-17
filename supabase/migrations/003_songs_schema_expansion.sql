-- Migration 003: expand songs schema with full metadata, lookup tables, and search

-- ─────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────
create extension if not exists pg_trgm;


-- ─────────────────────────────────────────
-- Expand songs table (additive first)
-- ─────────────────────────────────────────
alter table public.songs
  add column if not exists display_artist  text,
  add column if not exists first_line      text,
  add column if not exists hook            text,
  add column if not exists lyrics          text,
  add column if not exists year            int,
  add column if not exists tonality        text,
  add column if not exists meter           text,
  add column if not exists energy          smallint check (energy between 1 and 5),
  add column if not exists difficulty      smallint check (difficulty between 1 and 5),
  add column if not exists popularity      smallint check (popularity between 1 and 5),
  add column if not exists updated_at      timestamptz default now();

-- Copy existing artist → display_artist, then drop artist
update public.songs set display_artist = artist where display_artist is null and artist is not null;
alter table public.songs drop column if exists artist;

-- Drop tags array (replaced by normalized join tables)
alter table public.songs drop column if exists tags;


-- ─────────────────────────────────────────
-- Lookup tables
-- ─────────────────────────────────────────
create table if not exists public.genres (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz default now()
);

create table if not exists public.themes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz default now()
);

create table if not exists public.cultures (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz default now()
);

create table if not exists public.languages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz default now()
);

create table if not exists public.traditions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz default now()
);

-- People: composers and lyricists
create table if not exists public.people (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz default now()
);

-- Artists: recording artists (bands, ensembles, solo acts)
create table if not exists public.artists (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz default now()
);


-- ─────────────────────────────────────────
-- Join tables
-- ─────────────────────────────────────────
create table if not exists public.song_genres (
  song_id  uuid not null references public.songs(id) on delete cascade,
  genre_id uuid not null references public.genres(id) on delete cascade,
  primary key (song_id, genre_id)
);

create table if not exists public.song_themes (
  song_id  uuid not null references public.songs(id) on delete cascade,
  theme_id uuid not null references public.themes(id) on delete cascade,
  primary key (song_id, theme_id)
);

create table if not exists public.song_cultures (
  song_id    uuid not null references public.songs(id) on delete cascade,
  culture_id uuid not null references public.cultures(id) on delete cascade,
  primary key (song_id, culture_id)
);

create table if not exists public.song_languages (
  song_id     uuid not null references public.songs(id) on delete cascade,
  language_id uuid not null references public.languages(id) on delete cascade,
  primary key (song_id, language_id)
);

create table if not exists public.song_traditions (
  song_id      uuid not null references public.songs(id) on delete cascade,
  tradition_id uuid not null references public.traditions(id) on delete cascade,
  primary key (song_id, tradition_id)
);

create table if not exists public.song_composers (
  song_id   uuid not null references public.songs(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  primary key (song_id, person_id)
);

create table if not exists public.song_lyricists (
  song_id   uuid not null references public.songs(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  primary key (song_id, person_id)
);

create table if not exists public.song_recording_artists (
  song_id   uuid not null references public.songs(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  primary key (song_id, artist_id)
);


-- ─────────────────────────────────────────
-- Alternate titles
-- ─────────────────────────────────────────
create table if not exists public.song_alternate_titles (
  id         uuid primary key default gen_random_uuid(),
  song_id    uuid not null references public.songs(id) on delete cascade,
  title      text not null,
  created_at timestamptz default now(),
  unique (song_id, title)
);


-- ─────────────────────────────────────────
-- Song resources (chords, audio, sheets)
-- ─────────────────────────────────────────
create table if not exists public.song_resources (
  id            uuid primary key default gen_random_uuid(),
  song_id       uuid not null references public.songs(id) on delete cascade,
  label         text,
  url           text not null,
  resource_type text check (resource_type in ('chords','lyrics','audio','video','sheet','other')),
  created_at    timestamptz default now()
);


-- ─────────────────────────────────────────
-- Indexes for search
-- ─────────────────────────────────────────

-- Trigram indexes for partial/fuzzy search
create index if not exists songs_title_trgm        on public.songs using gin (title gin_trgm_ops);
create index if not exists songs_first_line_trgm   on public.songs using gin (first_line gin_trgm_ops);
create index if not exists songs_display_artist_trgm on public.songs using gin (display_artist gin_trgm_ops);
create index if not exists alt_titles_title_trgm   on public.song_alternate_titles using gin (title gin_trgm_ops);

-- Full-text search vector index (for future lyric search)
create index if not exists songs_fts on public.songs using gin (
  to_tsvector('english',
    coalesce(title, '') || ' ' ||
    coalesce(first_line, '') || ' ' ||
    coalesce(display_artist, '') || ' ' ||
    coalesce(lyrics, '')
  )
);

-- FK lookup indexes
create index if not exists song_genres_song_id       on public.song_genres(song_id);
create index if not exists song_themes_song_id       on public.song_themes(song_id);
create index if not exists song_cultures_song_id     on public.song_cultures(song_id);
create index if not exists song_languages_song_id    on public.song_languages(song_id);
create index if not exists song_traditions_song_id   on public.song_traditions(song_id);
create index if not exists song_composers_song_id    on public.song_composers(song_id);
create index if not exists song_lyricists_song_id    on public.song_lyricists(song_id);
create index if not exists song_recording_artists_song_id on public.song_recording_artists(song_id);
create index if not exists alt_titles_song_id        on public.song_alternate_titles(song_id);
create index if not exists song_resources_song_id    on public.song_resources(song_id);


-- ─────────────────────────────────────────
-- RLS for all new tables
-- ─────────────────────────────────────────
alter table public.genres              enable row level security;
alter table public.themes              enable row level security;
alter table public.cultures            enable row level security;
alter table public.languages           enable row level security;
alter table public.traditions          enable row level security;
alter table public.people              enable row level security;
alter table public.artists             enable row level security;
alter table public.song_genres         enable row level security;
alter table public.song_themes         enable row level security;
alter table public.song_cultures       enable row level security;
alter table public.song_languages      enable row level security;
alter table public.song_traditions     enable row level security;
alter table public.song_composers      enable row level security;
alter table public.song_lyricists      enable row level security;
alter table public.song_recording_artists enable row level security;
alter table public.song_alternate_titles  enable row level security;
alter table public.song_resources      enable row level security;

-- Public read for all lookup and join tables
create policy "read genres"               on public.genres              for select using (true);
create policy "read themes"               on public.themes              for select using (true);
create policy "read cultures"             on public.cultures            for select using (true);
create policy "read languages"            on public.languages           for select using (true);
create policy "read traditions"           on public.traditions          for select using (true);
create policy "read people"               on public.people              for select using (true);
create policy "read artists"              on public.artists             for select using (true);
create policy "read song_genres"          on public.song_genres         for select using (true);
create policy "read song_themes"          on public.song_themes         for select using (true);
create policy "read song_cultures"        on public.song_cultures       for select using (true);
create policy "read song_languages"       on public.song_languages      for select using (true);
create policy "read song_traditions"      on public.song_traditions     for select using (true);
create policy "read song_composers"       on public.song_composers      for select using (true);
create policy "read song_lyricists"       on public.song_lyricists      for select using (true);
create policy "read song_recording_artists" on public.song_recording_artists for select using (true);
create policy "read song_alternate_titles"  on public.song_alternate_titles  for select using (true);
create policy "read song_resources"       on public.song_resources      for select using (true);


-- ─────────────────────────────────────────
-- Updated search_songs RPC
-- Searches: title, first_line, display_artist, alternate titles
-- Supports trigram (partial match) + full-text scoring
-- ─────────────────────────────────────────
create or replace function public.search_songs(q text, limit_n int default 50)
returns table (
  song_id        uuid,
  title          text,
  display_artist text,
  first_line     text,
  aka            text[],
  score          float4
)
language sql
security definer
as $$
  select
    s.id             as song_id,
    s.title,
    s.display_artist,
    s.first_line,
    coalesce(
      array_agg(distinct sat.title) filter (where sat.title is not null),
      '{}'::text[]
    )                as aka,
    ts_rank(
      to_tsvector('english',
        coalesce(s.title, '') || ' ' ||
        coalesce(s.first_line, '') || ' ' ||
        coalesce(s.display_artist, '')
      ),
      plainto_tsquery('english', q)
    )                as score
  from public.songs s
  left join public.song_alternate_titles sat on sat.song_id = s.id
  where
    s.title          ilike '%' || q || '%'
    or s.first_line  ilike '%' || q || '%'
    or s.display_artist ilike '%' || q || '%'
    or sat.title     ilike '%' || q || '%'
    or to_tsvector('english',
         coalesce(s.title, '') || ' ' ||
         coalesce(s.first_line, '') || ' ' ||
         coalesce(s.display_artist, '')
       ) @@ plainto_tsquery('english', q)
  group by s.id
  order by score desc, s.title
  limit limit_n;
$$;
