alter table public.sets
  add column link_sharing text not null default 'disabled'
  check (link_sharing in ('disabled', 'view'));
