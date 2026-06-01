-- RPC that searches profiles by username, display_name, last_name, and auth.users email.
-- SECURITY DEFINER so the function can join against auth.users without exposing
-- the email column in the public profiles table.

CREATE OR REPLACE FUNCTION public.search_users(
  search_query text,
  exclude_user_id uuid
)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  last_name text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q text := trim(search_query);
  parts text[];
BEGIN
  IF length(q) < 2 THEN
    RETURN;
  END IF;

  -- Strip leading @ for username queries
  IF left(q, 1) = '@' THEN
    q := substring(q FROM 2);
  END IF;

  parts := string_to_array(q, ' ');

  RETURN QUERY
  SELECT DISTINCT ON (p.id)
    p.id, p.username, p.display_name, p.last_name, p.avatar_url
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE p.id != exclude_user_id
    AND (
      p.username      ILIKE '%' || q || '%'
      OR p.display_name ILIKE '%' || q || '%'
      OR p.last_name    ILIKE '%' || q || '%'
      OR u.email        ILIKE '%' || q || '%'
      OR (
        array_length(parts, 1) >= 2
        AND p.display_name ILIKE '%' || parts[1] || '%'
        AND p.last_name    ILIKE '%' || array_to_string(parts[2:array_length(parts,1)], ' ') || '%'
      )
    )
  LIMIT 10;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_users(text, uuid) TO authenticated;
