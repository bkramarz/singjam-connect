-- Syncs Google avatar_url from auth metadata to profiles when not already set
CREATE OR REPLACE FUNCTION public.sync_google_avatar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles
  SET avatar_url = NEW.raw_user_meta_data->>'avatar_url'
  WHERE id = NEW.id
    AND avatar_url IS NULL
    AND NEW.raw_user_meta_data->>'avatar_url' IS NOT NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

CREATE TRIGGER on_auth_user_updated
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.sync_google_avatar();

-- Backfill existing Google users who don't have an avatar set
UPDATE public.profiles p
SET avatar_url = u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
WHERE p.id = u.id
  AND p.avatar_url IS NULL
  AND u.raw_user_meta_data->>'avatar_url' IS NOT NULL;
