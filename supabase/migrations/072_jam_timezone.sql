-- Migration 072: store the host's timezone on the jam so server-side date
-- formatting in emails and invite messages uses the correct local time
-- rather than UTC.

alter table public.jams add column if not exists timezone text;
