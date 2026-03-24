-- Drop NOT NULL constraint on username so new Google signups aren't blocked
-- by profile creation triggers that don't set a username yet.
-- Username is still required at the UI level in AccountPanel.
ALTER TABLE public.profiles ALTER COLUMN username DROP NOT NULL;
