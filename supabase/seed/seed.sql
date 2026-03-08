-- Minimal seed: a few songs + packs (replace with your real SingJam lists)

insert into public.songs (title, artist) values
('Wagon Wheel', 'Old Crow Medicine Show'),
('Stand By Me', 'Ben E. King'),
('Three Little Birds', 'Bob Marley'),
('Let It Be', 'The Beatles'),
('Hallelujah', 'Leonard Cohen')
on conflict do nothing;

insert into public.song_packs (name, description, sort_order) values
('SingJam Core 50 (starter)', 'A starter pack for instant overlap (replace with full Core 50).', 10),
('Island Vibes (starter)', 'Sunny acoustic singalongs.', 20)
on conflict do nothing;

-- Link songs to packs (naive: by title)
insert into public.song_pack_songs (pack_id, song_id)
select p.id, s.id
from public.song_packs p
join public.songs s on s.title in ('Wagon Wheel','Stand By Me','Let It Be')
where p.name = 'SingJam Core 50 (starter)'
on conflict do nothing;

insert into public.song_pack_songs (pack_id, song_id)
select p.id, s.id
from public.song_packs p
join public.songs s on s.title in ('Three Little Birds')
where p.name = 'Island Vibes (starter)'
on conflict do nothing;
