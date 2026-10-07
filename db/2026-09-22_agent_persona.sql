-- =============================================================================
-- CUPAI — اسم وجنس الوكيل (agent persona)
--
-- The merchant can now choose the name the agent introduces itself with and
-- whether it speaks about itself as a man or a woman. Both columns are
-- optional; when empty the agent keeps its default identity.
-- Additive and safe to re-run.
-- =============================================================================

alter table public.merchants
  add column if not exists agent_name   text,
  add column if not exists agent_gender text;  -- male | female
