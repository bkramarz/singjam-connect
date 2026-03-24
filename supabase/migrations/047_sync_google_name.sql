-- Extend the Google sync trigger to also copy first/last name from auth metadata.
-- Google provides full_name (e.g. "Alice Apple"), not separate given_name/family_name.
CREATE OR REPLACE FUNCTION public.sync_google_avatar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  full_name text;
  space_pos int;
  first_name text;
  last_name_val text;
BEGIN
  full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    ''
  );
  space_pos := position(' ' IN full_name);
  IF space_pos > 0 THEN
    first_name   := left(full_name, space_pos - 1);
    last_name_val := substring(full_name from space_pos + 1);
  ELSE
    first_name   := full_name;
    last_name_val := NULL;
  END IF;

  UPDATE public.profiles
  SET
    avatar_url   = COALESCE(avatar_url,   NEW.raw_user_meta_data->>'avatar_url'),
    display_name = COALESCE(display_name, NULLIF(first_name, '')),
    last_name    = COALESCE(last_name,    NULLIF(last_name_val, ''))
  WHERE id = NEW.id
    AND (
      (avatar_url   IS NULL AND NEW.raw_user_meta_data->>'avatar_url' IS NOT NULL) OR
      (display_name IS NULL AND NULLIF(first_name, '')   IS NOT NULL) OR
      (last_name    IS NULL AND NULLIF(last_name_val, '') IS NOT NULL)
    );
  RETURN NEW;
END;
$$;

-- Backfill existing Google users missing name fields
UPDATE public.profiles p
SET
  display_name = COALESCE(p.display_name, NULLIF(split_part(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''), ' ', 1), '')),
  last_name    = COALESCE(p.last_name,    NULLIF(trim(substring(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '') from position(' ' IN COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')) + 1)), ''))
FROM auth.users u
WHERE p.id = u.id
  AND u.raw_user_meta_data->>'avatar_url' IS NOT NULL
  AND (p.display_name IS NULL OR p.last_name IS NULL);
