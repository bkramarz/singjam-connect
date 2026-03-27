-- Allow any authenticated user to read other users' song confidence levels
-- so that shared repertoire on public profiles can show lead/support/learn status.
create policy "authenticated read all user_songs"
  on public.user_songs for select
  to authenticated
  using (true);
