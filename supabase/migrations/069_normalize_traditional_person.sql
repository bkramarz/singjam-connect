-- Normalize "[traditional]" (MusicBrainz format) to "Traditional" (our sentinel value).
-- Fixes existing data and installs a trigger to prevent future drift.

-- Step 1: merge any existing [traditional] rows into Traditional.
-- Re-point FKs first, then delete the stale row.
do $$
declare
  trad_id    uuid;
  bad_id     uuid;
begin
  select id into trad_id from public.people where name = 'Traditional';
  select id into bad_id  from public.people where lower(name) = '[traditional]';

  if bad_id is null then
    return; -- nothing to fix
  end if;

  if trad_id is null then
    -- No canonical row yet; just rename in place.
    update public.people set name = 'Traditional' where id = bad_id;
    return;
  end if;

  -- Re-point song_composers rows that aren't already on Traditional.
  update public.song_composers
  set person_id = trad_id
  where person_id = bad_id
    and not exists (
      select 1 from public.song_composers
      where song_id = song_composers.song_id and person_id = trad_id
    );
  delete from public.song_composers where person_id = bad_id;

  -- Re-point song_lyricists rows that aren't already on Traditional.
  update public.song_lyricists
  set person_id = trad_id
  where person_id = bad_id
    and not exists (
      select 1 from public.song_lyricists
      where song_id = song_lyricists.song_id and person_id = trad_id
    );
  delete from public.song_lyricists where person_id = bad_id;

  delete from public.people where id = bad_id;
end;
$$;

-- Step 2: trigger that normalizes the name before any insert or update.
create or replace function public.normalize_person_name()
returns trigger language plpgsql as $$
begin
  if lower(NEW.name) = '[traditional]' then
    NEW.name := 'Traditional';
  end if;
  return NEW;
end;
$$;

drop trigger if exists normalize_person_name_trigger on public.people;
create trigger normalize_person_name_trigger
before insert or update on public.people
for each row execute function public.normalize_person_name();
