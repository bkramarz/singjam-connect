create table if not exists public.system_flags (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.system_flags to service_role;
