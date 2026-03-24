-- Extend the Google sync trigger to also copy first/last name from auth metadata
CREATE OR REPLACE FUNCTION public.sync_google_avatar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles
  SET
    avatar_url   = COALESCE(avatar_url,   NEW.raw_user_meta_data->>'avatar_url'),
    display_name = COALESCE(display_name, NEW.raw_user_meta_data->>'given_name'),
    last_name    = COALESCE(last_name,    NEW.raw_user_meta_data->>'family_name')
  WHERE id = NEW.id
    AND (
      (avatar_url   IS NULL AND NEW.raw_user_meta_data->>'avatar_url'   IS NOT NULL) OR
      (display_name IS NULL AND NEW.raw_user_meta_data->>'given_name'   IS NOT NULL) OR
      (last_name    IS NULL AND NEW.raw_user_meta_data->>'family_name'  IS NOT NULL)
    );
  RETURN NEW;
END;
$$;

-- Backfill existing Google users who are missing name fields
UPDATE public.profiles p
SET
  display_name = COALESCE(p.display_name, u.raw_user_meta_data->>'given_name'),
  last_name    = COALESCE(p.last_name,    u.raw_user_meta_data->>'family_name')
FROM auth.users u
WHERE p.id = u.id
  AND (
    (p.display_name IS NULL AND u.raw_user_meta_data->>'given_name'  IS NOT NULL) OR
    (p.last_name    IS NULL AND u.raw_user_meta_data->>'family_name' IS NOT NULL)
  );
