-- =============================================================================
-- CUPAI — Browser/device push notifications (Firebase Cloud Messaging).
-- Replaces email as the merchant's alert channel. Safe to re-run.
-- =============================================================================

-- One row per registered browser/device of a merchant account.
create table if not exists public.push_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  user_agent  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens(user_id);

grant select, insert, update, delete on public.push_tokens to authenticated;
grant all on public.push_tokens to service_role;

alter table public.push_tokens enable row level security;

drop policy if exists own_push_tokens on public.push_tokens;
create policy own_push_tokens on public.push_tokens for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Per-event push preferences.
create table if not exists public.push_notification_settings (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  new_order           boolean not null default true,
  missing_information boolean not null default true,
  human_needed        boolean not null default true,
  updated_at          timestamptz not null default now()
);

grant select, insert, update, delete on public.push_notification_settings to authenticated;
grant all on public.push_notification_settings to service_role;

alter table public.push_notification_settings enable row level security;

drop policy if exists own_push_settings on public.push_notification_settings;
create policy own_push_settings on public.push_notification_settings for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
