-- Migration 057: update jam read policy to use new visibility values

drop policy if exists "read jams" on public.jams;

create policy "read jams" on public.jams
  for select using (
    visibility = 'official'
    or (auth.uid() is not null and visibility = 'community')
    or auth.uid() = host_user_id
  );
