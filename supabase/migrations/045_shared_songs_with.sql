create or replace function public.shared_songs_with(other_user_id uuid)
returns table (title text)
language sql
security definer
as $$
  select s.title
  from public.user_songs us1
  join public.user_songs us2 on us1.song_id = us2.song_id
  join public.songs s on s.id = us1.song_id
  where us1.user_id = auth.uid()
    and us2.user_id = other_user_id
    and us1.confidence in ('lead', 'support', 'follow')
    and us2.confidence in ('lead', 'support', 'follow')
  order by s.title;
$$;
