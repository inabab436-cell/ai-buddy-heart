-- =============================================================================
-- CUPAI — Early-access waitlist (first 100 subscribers).
--
-- No email confirmation: a row is created the moment the visitor submits.
-- Reads/writes happen only through server functions using the service role,
-- so RLS is enabled with NO policies (anon/authenticated get nothing).
-- Safe to re-run.
-- =============================================================================

create table if not exists public.waitlist_signups (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists waitlist_signups_email_key
  on public.waitlist_signups (lower(email));

create index if not exists waitlist_signups_created_idx
  on public.waitlist_signups (created_at);

grant all on public.waitlist_signups to service_role;

alter table public.waitlist_signups enable row level security;
