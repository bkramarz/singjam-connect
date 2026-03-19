-- Migration 007: allow admins to read all user_songs rows (for repertoire count)

create policy "admin read all user_songs" on public.user_songs
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
