-- Make the trigger exception-safe so it never blocks user creation
CREATE OR REPLACE FUNCTION public.sync_google_avatar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles
  SET avatar_url = NEW.raw_user_meta_data->>'avatar_url'
  WHERE id = NEW.id
    AND avatar_url IS NULL
    AND NEW.raw_user_meta_data->>'avatar_url' IS NOT NULL;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
