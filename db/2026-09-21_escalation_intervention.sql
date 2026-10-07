-- =============================================================================
-- CUPAI — استدعاء التدخل / استدعاء مسؤول (human intervention calls)
--
-- The agent already had a silent `request_handoff` tool that flipped the
-- conversation to `needs_human` and wrote a `human_needed` notification. Two
-- problems came out of that:
--
--   1. A parked-for-payment conversation and an escalated conversation were
--      indistinguishable (both = `human_needed` + agent off), so the payment
--      queue swallowed real intervention calls.
--   2. Nothing recorded WHY the agent called for a human, so the merchant had
--      to read the whole chat to find out.
--
-- This migration adds the classification columns. Everything is additive and
-- safe to re-run; the app code tolerates their absence.
-- =============================================================================

alter table public.conversations
  add column if not exists escalation_status   text,        -- open | resolved
  add column if not exists escalation_category text,        -- see src/lib/escalation.ts
  add column if not exists escalation_severity text,        -- normal | urgent
  add column if not exists escalation_reason   text,
  add column if not exists escalated_at        timestamptz,
  add column if not exists escalation_resolved_at timestamptz;

create index if not exists conversations_escalation_open_idx
  on public.conversations (merchant_id, escalated_at desc)
  where escalation_status = 'open';

-- The notification row carries the same classification so the dashboard list
-- can show it without a second read.
alter table public.notifications
  add column if not exists escalation_category text,
  add column if not exists escalation_severity text;
