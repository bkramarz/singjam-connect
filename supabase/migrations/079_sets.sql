-- Sets: collaborative, ordered song lists

create table public.sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.sets enable row level security;

create policy "sets_select" on public.sets for select using (true);
create policy "sets_insert" on public.sets for insert with check (auth.uid() = owner_user_id);
create policy "sets_update" on public.sets for update using (auth.uid() = owner_user_id);
create policy "sets_delete" on public.sets for delete using (auth.uid() = owner_user_id);

-- Collaborators: invited via token link, accepted on claim
create table public.set_collaborators (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.sets(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  invited_by uuid references public.profiles(id) on delete set null,
  token uuid not null default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz default now(),
  unique(token)
);

alter table public.set_collaborators enable row level security;

-- Accepted collaborators are visible to all (set is publicly viewable); pending only to owner/invitee
create policy "set_collaborators_select" on public.set_collaborators for select
  using (
    status = 'accepted'
    or auth.uid() = user_id
    or exists (select 1 from public.sets s where s.id = set_id and s.owner_user_id = auth.uid())
  );

create policy "set_collaborators_insert" on public.set_collaborators for insert
  with check (auth.uid() = invited_by);

create policy "set_collaborators_delete" on public.set_collaborators for delete
  using (
    auth.uid() = user_id
    or exists (select 1 from public.sets s where s.id = set_id and s.owner_user_id = auth.uid())
  );

-- Songs in a set, ordered by position
create table public.set_songs (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.sets(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  position integer not null default 0,
  added_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  unique(set_id, song_id)
);

alter table public.set_songs enable row level security;

create policy "set_songs_select" on public.set_songs for select using (true);

create policy "set_songs_insert" on public.set_songs for insert
  with check (
    auth.uid() is not null
    and (
      exists (select 1 from public.sets s where s.id = set_id and s.owner_user_id = auth.uid())
      or exists (select 1 from public.set_collaborators sc where sc.set_id = set_id and sc.user_id = auth.uid() and sc.status = 'accepted')
    )
  );

create policy "set_songs_update" on public.set_songs for update
  using (
    exists (select 1 from public.sets s where s.id = set_id and s.owner_user_id = auth.uid())
    or exists (select 1 from public.set_collaborators sc where sc.set_id = set_id and sc.user_id = auth.uid() and sc.status = 'accepted')
  );

create policy "set_songs_delete" on public.set_songs for delete
  using (
    exists (select 1 from public.sets s where s.id = set_id and s.owner_user_id = auth.uid())
    or exists (select 1 from public.set_collaborators sc where sc.set_id = set_id and sc.user_id = auth.uid() and sc.status = 'accepted')
  );
