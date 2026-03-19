-- Move all tradition values into cultures
insert into public.cultures (name) values
  ('African Traditional'),('Amish'),('Anglican'),('Baptist'),
  ('Buddhist'),('Catholic'),('Celtic Pagan'),('Christian'),
  ('Coptic'),('Eastern Orthodox'),('Ethiopian Orthodox'),
  ('Evangelical'),('Gospel'),('Gregorian'),('Hindu'),
  ('Indigenous'),('Islamic'),('Jewish'),('Liturgical'),
  ('Lutheran'),('Methodist'),('Mormon'),('Pentecostal'),
  ('Presbyterian'),('Protestant'),('Quaker'),('Rastafarian'),
  ('Secular'),('Seventh-day Adventist'),('Shaker'),('Sikh'),
  ('Spiritual'),('Sufi'),('Unitarian Universalist')
on conflict (name) do nothing;

-- Migrate any existing song_traditions join rows into song_cultures
insert into public.song_cultures (song_id, culture_id)
select st.song_id, c.id
from public.song_traditions st
join public.traditions t on t.id = st.tradition_id
join public.cultures c on c.name = t.name
on conflict do nothing;

-- Drop traditions join table and lookup table
drop table if exists public.song_traditions;
drop table if exists public.traditions;
