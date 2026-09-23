-- Records a card machine's bank credit and allocates it across the
-- restaurant(s)/date range it covers (spec §26: multiple-day deposits,
-- deposits covering multiple restaurants, partial settlements). Settling
-- never creates a sale — it only clears a receivable, so nothing here
-- touches sales_entries.
create or replace function public.create_card_settlement(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement_id uuid;
  v_amount numeric(14,2);
  v_allocated numeric(14,2);
begin
  if not app.has_permission('settlements.manage') then
    raise exception 'Not authorized to manage settlements';
  end if;

  v_amount := (payload ->> 'amount')::numeric;

  select coalesce(sum((item ->> 'amount')::numeric), 0) into v_allocated
  from jsonb_array_elements(coalesce(payload -> 'allocations', '[]'::jsonb)) as item;

  if v_allocated > v_amount then
    raise exception 'Allocated amount (%) exceeds settlement amount (%)', v_allocated, v_amount;
  end if;

  insert into card_settlements (card_machine_id, bank_account_id, credit_date, bank_reference, amount, status, notes, created_by)
  values (
    (payload ->> 'card_machine_id')::uuid, (payload ->> 'bank_account_id')::uuid,
    (payload ->> 'credit_date')::date, nullif(payload ->> 'bank_reference', ''), v_amount,
    case when v_allocated = 0 then 'unmatched' when v_allocated < v_amount then 'partially_matched' else 'matched' end,
    nullif(payload ->> 'notes', ''), auth.uid()
  )
  returning id into v_settlement_id;

  insert into card_settlement_allocations (card_settlement_id, restaurant_id, amount, covers_from, covers_to)
  select v_settlement_id, (item ->> 'restaurant_id')::uuid, (item ->> 'amount')::numeric,
         (item ->> 'covers_from')::date, (item ->> 'covers_to')::date
  from jsonb_array_elements(coalesce(payload -> 'allocations', '[]'::jsonb)) as item;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (auth.uid(), 'create', 'settlements', 'card_settlement', v_settlement_id, jsonb_build_object('amount', v_amount));

  return v_settlement_id;
end;
$$;

grant execute on function public.create_card_settlement(jsonb) to authenticated;
