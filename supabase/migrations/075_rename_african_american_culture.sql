do $$
declare
  african_american_id uuid;
  american_id uuid;
begin
  select id into african_american_id from public.cultures where name = 'African American';
  select id into american_id from public.cultures where name = 'American';

  if african_american_id is null then
    return; -- already cleaned up
  end if;

  if american_id is null then
    -- no American row yet — just rename
    update public.cultures set name = 'American' where id = african_american_id;
  else
    -- merge: re-point song_cultures rows, then delete the old entry
    update public.song_cultures
    set culture_id = american_id
    where culture_id = african_american_id
      and not exists (
        select 1 from public.song_cultures sc2
        where sc2.song_id = song_cultures.song_id
          and sc2.culture_id = american_id
          and sc2.context is not distinct from song_cultures.context
      );

    delete from public.song_cultures where culture_id = african_american_id;
    delete from public.cultures where id = african_american_id;
  end if;
end $$;
