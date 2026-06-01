-- Full replica identity is required so that Supabase Realtime broadcasts
-- all column values in UPDATE and DELETE events, not just the primary key.
-- Without this, UPDATE payloads on set_collaborators omit the old status/role
-- (needed to detect approvals), and DELETE payloads omit user_id (needed to
-- remove the right person from client state).
alter table public.set_collaborators replica identity full;
alter table public.user_songs replica identity full;
