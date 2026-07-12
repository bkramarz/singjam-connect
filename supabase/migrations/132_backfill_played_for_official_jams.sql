update public.set_songs ss
set played = true
from public.sets s
join public.jams j on j.id = s.jam_id
where ss.set_id = s.id
  and j.visibility = 'official'
  and j.starts_at <= now();
