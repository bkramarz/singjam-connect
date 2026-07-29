-- Migration 151: drop song_popularity_counts(), now that nothing calls it.
--
-- 049 introduced it because user_songs RLS hides other users' rows, so counting
-- owners per song across all users needed definer rights. Two later changes
-- removed every caller:
--   * 138's my_repertoire() returns popularity per row, so the repertoire
--     screens no longer aggregate the whole table.
--   * The native Song Library now browses through browse_songs (PR #264), which
--     also returns popularity. That was the last caller anywhere in the repo.
--
-- 139's scoped song_popularity_for(uuid[]) is NOT touched — web's SetDetail
-- still uses it, and it only aggregates the song ids handed to it.
--
-- Checked against the live database before writing this: no other routine body,
-- view, materialized view, RLS policy or trigger references the function, and
-- song_popularity_counts() has no other overload. Dropped without cascade so
-- Postgres would refuse rather than take anything else with it.

drop function if exists public.song_popularity_counts();
