-- Run in Supabase SQL Editor or via Supabase CLI.
-- Auth: disable public email signups in the dashboard so only existing auth.users receive magic links.
-- After adding a row to allowed_users, run: npm run add-user -- you@domain.com (creates auth user if missing).
-- Supabase Dashboard → Authentication → URL configuration: add redirect
--   http://127.0.0.1:4000/auth/callback
--   (and https://your-production-host/auth/callback). Set Site URL to the same origin as the app.

create extension if not exists "pgcrypto";

create table if not exists public.allowed_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  added_at timestamptz not null default now()
);

create table if not exists public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  attempted_at timestamptz not null default now(),
  outcome text not null
);

create index if not exists login_attempts_attempted_at_idx
  on public.login_attempts (attempted_at desc);

alter table public.allowed_users enable row level security;
alter table public.login_attempts enable row level security;

-- No policies: anon/authenticated cannot read/write; service_role bypasses RLS for server-side checks.
