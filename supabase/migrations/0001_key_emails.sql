-- Kuest Auth email opt-in storage
create table if not exists public.key_emails (
  api_key uuid not null,
  email text not null check (position('@' in email) > 1),
  created_at timestamptz not null default now(),
  primary key (api_key)
);

alter table public.key_emails enable row level security;

create policy "insert_key_email"
on public.key_emails
for insert
to anon
with check (true);
