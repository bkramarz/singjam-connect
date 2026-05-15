-- Merge "Appalachian" → "American"
do $$
declare
  old_id uuid;
  new_id uuid;
begin
  select id into old_id from public.cultures where name = 'Appalachian';
  select id into new_id from public.cultures where name = 'American';

  if old_id is not null and new_id is not null then
    update public.song_cultures set culture_id = new_id
    where culture_id = old_id
      and not exists (
        select 1 from public.song_cultures sc2
        where sc2.song_id = song_cultures.song_id
          and sc2.culture_id = new_id
      );
    delete from public.song_cultures where culture_id = old_id;
    delete from public.cultures where id = old_id;
  end if;
end $$;

-- Merge "British" → "English"
do $$
declare
  old_id uuid;
  new_id uuid;
begin
  select id into old_id from public.cultures where name = 'British';
  select id into new_id from public.cultures where name = 'English';

  if old_id is not null and new_id is not null then
    update public.song_cultures set culture_id = new_id
    where culture_id = old_id
      and not exists (
        select 1 from public.song_cultures sc2
        where sc2.song_id = song_cultures.song_id
          and sc2.culture_id = new_id
      );
    delete from public.song_cultures where culture_id = old_id;
    delete from public.cultures where id = old_id;
  end if;
end $$;
