-- =============================================================================
-- CUPAI — Merchant edits products/quantities of an existing order.
-- Stock follows the edit atomically, using the order's own deduction ledger
-- (orders.stock_deducted):
--   * every quantity previously deducted for this order is returned to stock,
--   * the new basket is checked and deducted,
--   so increases deduct the difference, decreases return it, and a changed
--   product/colour/size returns the old line and deducts the new one.
-- If the order never deducted stock (empty ledger), stock is left untouched.
-- Any shortage rolls the whole edit back. Safe to re-run.
-- =============================================================================

create or replace function public.edit_order_items(
  p_order_id    uuid,
  p_merchant_id uuid,
  p_items       jsonb,
  p_subtotal    numeric,
  p_total       numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order     record;
  v_user_id   uuid;
  v_entry     jsonb;
  v_was_deducted boolean;
  v_shortages jsonb;
  v_deducted  jsonb := '[]'::jsonb;
begin
  select * into v_order
  from public.orders
  where id = p_order_id and merchant_id = p_merchant_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_order.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'cancelled');
  end if;

  select user_id into v_user_id from public.merchants where id = p_merchant_id;

  v_was_deducted := jsonb_array_length(coalesce(v_order.stock_deducted, '[]'::jsonb)) > 0;

  if v_was_deducted then
    -- 1) give back everything this order took
    for v_entry in select * from jsonb_array_elements(v_order.stock_deducted)
    loop
      update public.product_variants
        set stock = greatest(coalesce(stock, 0), 0) + coalesce((v_entry->>'quantity')::numeric, 0)::integer
        where id = (v_entry->>'variant_id')::uuid;
    end loop;

    -- 2) the new basket must fit the stock now available
    v_shortages := public.cupai_item_shortages(p_items, v_user_id);
    if jsonb_array_length(coalesce(v_shortages, '[]'::jsonb)) > 0 then
      raise exception using message = 'CUPAI_SHORTAGE:' || v_shortages::text;
    end if;

    -- 3) take the new basket
    v_deducted := public.cupai_deduct_items(p_items, v_user_id);
  end if;

  update public.orders
    set items          = p_items,
        subtotal_price = p_subtotal,
        total_price    = p_total,
        stock_deducted = case when v_was_deducted then v_deducted else stock_deducted end
    where id = p_order_id;

  return jsonb_build_object('ok', true, 'stock_updated', v_was_deducted);
exception
  when others then
    if sqlerrm like 'CUPAI_SHORTAGE:%' then
      return jsonb_build_object(
        'ok', false, 'error', 'insufficient_stock',
        'shortages', substring(sqlerrm from 16)::jsonb
      );
    end if;
    raise;
end;
$$;

grant execute on function public.edit_order_items(uuid, uuid, jsonb, numeric, numeric) to service_role;
