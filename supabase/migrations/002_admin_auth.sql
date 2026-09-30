-- Admin panel auth: separate email+password login for managing allowed_users.
-- Bootstrap the first admin with: npm run add-admin -- admin@domain.com "a strong password"

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
-- No policies: anon/authenticated cannot read/write; service_role bypasses RLS for server-side checks.
