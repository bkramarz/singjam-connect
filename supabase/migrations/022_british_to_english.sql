-- Migration 022: replace "British" with "English" in cultures
-- Ensure "English" exists
insert into public.cultures (name) values ('English') on conflict (name) do nothing;

-- Re-point any song_cultures rows from British → English
update public.song_cultures
set culture_id = (select id from public.cultures where name = 'English')
where culture_id = (select id from public.cultures where name = 'British');

-- Remove British
delete from public.cultures where name = 'British';
