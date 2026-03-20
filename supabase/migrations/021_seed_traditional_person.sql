-- Migration 021: seed "Traditional" into the people table
insert into public.people (name) values ('Traditional') on conflict (name) do nothing;
