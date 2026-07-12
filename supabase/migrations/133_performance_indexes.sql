-- Performance indexes for hot query paths identified in the 2026-07 audit.
-- All additive; no schema or policy changes.

-- Reverse lookups by song (popularity counts, "who plays this", play stats):
-- composite PKs lead with user_id/set_id so song_id-only filters were unindexed.
create index if not exists user_songs_song_id_idx on public.user_songs (song_id);
create index if not exists set_songs_song_id_idx on public.set_songs (song_id);

-- Repertoire list orders by updated_at within a user.
create index if not exists user_songs_user_updated_idx on public.user_songs (user_id, updated_at desc);

-- Upcoming-jams queries filter and order by starts_at.
create index if not exists jams_starts_at_idx on public.jams (starts_at);

-- "My sets" lookups.
create index if not exists sets_owner_user_id_idx on public.sets (owner_user_id);

-- Invite lookups by invitee; PK (jam_id, invited_user_id) can't serve
-- invited_user_id-only filters.
create index if not exists jam_invites_invited_user_id_idx on public.jam_invites (invited_user_id);

-- RSVP lookups by user (jams list); unique (jam_id, user_id) can't serve
-- user_id-only filters.
create index if not exists jam_rsvps_user_id_idx on public.jam_rsvps (user_id);
