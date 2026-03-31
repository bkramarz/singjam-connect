-- Migration 059: add image focal point to jams
alter table public.jams add column if not exists image_focal_point text default '50% 50%';
