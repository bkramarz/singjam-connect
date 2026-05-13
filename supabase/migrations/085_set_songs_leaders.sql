alter table public.set_songs
  add column if not exists leader_user_ids uuid[] not null default '{}';
