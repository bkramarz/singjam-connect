create table if not exists productions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists song_productions (
  song_id uuid not null references songs(id) on delete cascade,
  production_id uuid not null references productions(id) on delete cascade,
  primary key (song_id, production_id)
);

alter table productions enable row level security;
alter table song_productions enable row level security;

create policy "Public read productions" on productions for select using (true);
create policy "Public read song_productions" on song_productions for select using (true);
create policy "Service role write productions" on productions for all using (auth.role() = 'service_role');
create policy "Service role write song_productions" on song_productions for all using (auth.role() = 'service_role');
create policy "Admin write productions" on productions for all using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "Admin write song_productions" on song_productions for all using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
