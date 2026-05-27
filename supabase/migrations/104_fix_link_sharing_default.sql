-- Migration 103 updated the constraint values but left the column default
-- pointing at the old 'disabled' value, causing constraint violations on any
-- new set insert that doesn't explicitly supply link_sharing.
alter table public.sets
  alter column link_sharing set default 'private';
