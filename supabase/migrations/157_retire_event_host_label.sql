-- Migration 157: retire the unused 'event_host' role label
--
-- 155 added 'event_host' to the user_role enum; 156 replaced it with the
-- profiles.can_host_official capability, because role is a single exclusive
-- enum column and granting it to a song_editor would have stripped their
-- song-editing rights. The label has been inert ever since, and an inert label
-- in a permissions enum is a trap: setting role = 'event_host' would look like
-- it granted something and silently grant nothing.
--
-- Renamed rather than dropped. Postgres has no ALTER TYPE ... DROP VALUE, so
-- removing it means recreating user_role — and ~20 RLS policies from migration
-- 102 reference profiles.role (songs, feature_flags, user_songs, productions
-- and a dozen song join tables), every one of which would have to be dropped
-- and recreated. That is a large, security-critical change for a purely
-- cosmetic gain; policy churn is how a tidiness fix becomes a real hole.
--
-- The rename gets the part that matters at no risk: 'event_host' is no longer a
-- valid label, so using it now raises an error instead of silently doing
-- nothing. Nothing references it — 156 replaced the trigger body, and no
-- application code mentions it.
--
-- If user_role is ever recreated for another reason, drop this label then,
-- while those policies are already being verified.

alter type public.user_role rename value 'event_host' to 'unused_event_host';

comment on type public.user_role is
  'Exclusive role tier. unused_event_host is retired — grant official-event hosting with profiles.can_host_official, which composes with any role.';
