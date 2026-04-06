-- Migration 056: add image_url to jams, create jam-images storage bucket

alter table public.jams add column if not exists image_url text;

-- Storage bucket for jam cover images (public read)
insert into storage.buckets (id, name, public)
values ('jam-images', 'jam-images', true)
on conflict (id) do nothing;

-- Anyone can read jam images
create policy "jam_images_public_select"
  on storage.objects for select
  using (bucket_id = 'jam-images');

-- Authenticated users can upload jam images
create policy "jam_images_auth_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'jam-images');

-- Authenticated users can delete their own uploads
create policy "jam_images_auth_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'jam-images');
