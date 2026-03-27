-- Migration 051: remove 'follow' as a confidence level
-- Migrate any existing 'follow' entries to 'support' (closest equivalent)
update public.user_songs set confidence = 'support' where confidence = 'follow';

-- Update the check constraint to remove 'follow'
alter table public.user_songs drop constraint if exists user_songs_confidence_check;
alter table public.user_songs add constraint user_songs_confidence_check
  check (confidence in ('lead', 'support', 'learn'));
