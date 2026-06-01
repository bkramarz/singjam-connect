-- Migration 110: RPC to suggest songs for a user's repertoire.
-- Scores candidates by community popularity + attribute overlap with the user's
-- existing genres and cultures. Falls back to pure popularity for empty repertoires.
-- SECURITY DEFINER needed to read user_songs across all users.

CREATE OR REPLACE FUNCTION public.suggest_songs_for_user(
  p_user_id uuid,
  p_limit   int DEFAULT 20
)
RETURNS TABLE (
  song_id        uuid,
  title          text,
  display_artist text,
  first_line     text,
  slug           text,
  composers      text[],
  cultures       text[],
  productions    text[],
  genres         text[],
  languages      text[],
  year           int,
  popularity     bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH user_genres AS (
    SELECT DISTINCT sg.genre_id
    FROM user_songs us
    JOIN song_genres sg ON sg.song_id = us.song_id
    WHERE us.user_id = p_user_id
  ),
  user_cultures AS (
    SELECT DISTINCT sc.culture_id
    FROM user_songs us
    JOIN song_cultures sc ON sc.song_id = us.song_id
    WHERE us.user_id = p_user_id
  ),
  popularity AS (
    SELECT song_id, COUNT(*) AS user_count
    FROM user_songs
    GROUP BY song_id
  ),
  affinity AS (
    SELECT
      s.id AS song_id,
      COUNT(DISTINCT ug.genre_id) + COUNT(DISTINCT uc.culture_id) AS score
    FROM songs s
    LEFT JOIN song_genres sgen    ON sgen.song_id    = s.id
    LEFT JOIN user_genres ug      ON ug.genre_id     = sgen.genre_id
    LEFT JOIN song_cultures scu   ON scu.song_id     = s.id
    LEFT JOIN user_cultures uc    ON uc.culture_id   = scu.culture_id
    WHERE s.id NOT IN (
      SELECT song_id FROM user_songs WHERE user_id = p_user_id
    )
    GROUP BY s.id
  ),
  scored AS (
    SELECT
      a.song_id,
      COALESCE(p.user_count, 0) AS pop,
      a.score * 3 + COALESCE(p.user_count, 0) AS total
    FROM affinity a
    LEFT JOIN popularity p ON p.song_id = a.song_id
    WHERE COALESCE(p.user_count, 0) > 0
  )
  SELECT
    s.id,
    s.title,
    s.display_artist,
    s.first_line,
    s.slug,
    COALESCE(array_agg(DISTINCT pe.name)  FILTER (WHERE pe.name  IS NOT NULL), '{}'::text[]) AS composers,
    COALESCE(array_agg(DISTINCT c.name)   FILTER (WHERE c.name   IS NOT NULL), '{}'::text[]) AS cultures,
    COALESCE(array_agg(DISTINCT pr.name)  FILTER (WHERE pr.name  IS NOT NULL), '{}'::text[]) AS productions,
    COALESCE(array_agg(DISTINCT g.name)   FILTER (WHERE g.name   IS NOT NULL), '{}'::text[]) AS genres,
    COALESCE(array_agg(DISTINCT l.name)   FILTER (WHERE l.name   IS NOT NULL), '{}'::text[]) AS languages,
    LEAST(s.year_written, MIN(sra.year)) AS year,
    scr.pop AS popularity
  FROM scored scr
  JOIN songs s ON s.id = scr.song_id
  LEFT JOIN song_composers scomp ON scomp.song_id = s.id
  LEFT JOIN song_lyricists slyrc ON slyrc.song_id = s.id
  LEFT JOIN people pe   ON pe.id = scomp.person_id OR pe.id = slyrc.person_id
  LEFT JOIN song_cultures scu2  ON scu2.song_id   = s.id
  LEFT JOIN cultures c          ON c.id           = scu2.culture_id
  LEFT JOIN song_productions sp ON sp.song_id     = s.id
  LEFT JOIN productions pr      ON pr.id          = sp.production_id
  LEFT JOIN song_genres sg      ON sg.song_id     = s.id
  LEFT JOIN genres g            ON g.id           = sg.genre_id
  LEFT JOIN song_languages slng ON slng.song_id   = s.id
  LEFT JOIN languages l         ON l.id           = slng.language_id
  LEFT JOIN song_recording_artists sra ON sra.song_id = s.id
  GROUP BY s.id, scr.pop, scr.total
  ORDER BY scr.total DESC, s.title
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.suggest_songs_for_user(uuid, int) TO authenticated;
