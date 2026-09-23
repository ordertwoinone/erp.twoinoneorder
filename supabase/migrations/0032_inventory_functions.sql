-- Dispatch: writes transfer_out movements + decrements the source
-- restaurant's stock immediately. The source's cost is carried forward
-- unchanged onto the transfer item, so the receiving side posts stock at
-- the same cost — a transfer must never create or destroy value
-- (docs/business-workflows.md §6).
create or replace function public.create_branch_transfer(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer_id uuid;
  v_from_restaurant uuid;
  v_to_restaurant uuid;
  v_item record;
begin
  v_from_restaurant := (payload ->> 'from_restaurant_id')::uuid;
  v_to_restaurant := (payload ->> 'to_restaurant_id')::uuid;

  if v_from_restaurant = v_to_restaurant then
    raise exception 'Source and destination restaurants must differ';
  end if;
  if not (app.has_restaurant_access(v_from_restaurant) or app.has_restaurant_access(v_to_restaurant)) then
    raise exception 'Not authorized for either restaurant';
  end if;
  if not app.has_permission('inventory.manage') then
    raise exception 'Not authorized to manage inventory';
  end if;
  if jsonb_array_length(coalesce(payload -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'Add at least one item';
  end if;

  insert into branch_transfers (transfer_number, from_restaurant_id, to_restaurant_id, status, dispatch_date, dispatched_by, notes)
  values (
    app.next_document_number('TRF'), v_from_restaurant, v_to_restaurant, 'dispatched', current_date, auth.uid(),
    nullif(payload ->> 'notes', '')
  )
  returning id into v_transfer_id;

  for v_item in
    select
      (item ->> 'product_id')::uuid as product_id,
      (item ->> 'unit_id')::uuid as unit_id,
      (item ->> 'quantity')::numeric as quantity,
      coalesce((select average_cost from stock_balances where restaurant_id = v_from_restaurant and product_id = (item ->> 'product_id')::uuid), 0) as unit_cost
    from jsonb_array_elements(payload -> 'items') as item
  loop
    insert into branch_transfer_items (branch_transfer_id, product_id, unit_id, quantity, unit_cost)
    values (v_transfer_id, v_item.product_id, v_item.unit_id, v_item.quantity, v_item.unit_cost);

    insert into stock_movements (
      restaurant_id, product_id, movement_type, quantity, unit_cost, total_cost,
      source_type, source_id, movement_date, created_by
    ) values (
      v_from_restaurant, v_item.product_id, 'transfer_out', -v_item.quantity, v_item.unit_cost,
      -v_item.quantity * v_item.unit_cost, 'branch_transfer', v_transfer_id, current_date, auth.uid()
    );

    insert into stock_balances (restaurant_id, product_id, quantity_on_hand, average_cost, updated_at)
    values (v_from_restaurant, v_item.product_id, -v_item.quantity, v_item.unit_cost, now())
    on conflict (restaurant_id, product_id) do update set
      quantity_on_hand = stock_balances.quantity_on_hand - v_item.quantity,
      updated_at = now();
  end loop;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (auth.uid(), 'dispatch', 'inventory', 'branch_transfer', v_transfer_id,
          jsonb_build_object('from', v_from_restaurant, 'to', v_to_restaurant));

  return v_transfer_id;
end;
$$;

create or replace function public.receive_branch_transfer(p_transfer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer branch_transfers%rowtype;
  v_item record;
begin
  select * into v_transfer from branch_transfers where id = p_transfer_id for update;
  if v_transfer.id is null then raise exception 'Transfer not found'; end if;
  if not app.has_restaurant_access(v_transfer.to_restaurant_id) then
    raise exception 'Not authorized for the destination restaurant';
  end if;
  if not app.has_permission('inventory.manage') then
    raise exception 'Not authorized to manage inventory';
  end if;
  if v_transfer.status != 'dispatched' then
    raise exception 'Only dispatched transfers can be received';
  end if;

  for v_item in select * from branch_transfer_items where branch_transfer_id = p_transfer_id
  loop
    insert into stock_movements (
      restaurant_id, product_id, movement_type, quantity, unit_cost, total_cost,
      source_type, source_id, movement_date, created_by
    ) values (
      v_transfer.to_restaurant_id, v_item.product_id, 'transfer_in', v_item.quantity, v_item.unit_cost,
      v_item.quantity * v_item.unit_cost, 'branch_transfer', p_transfer_id, current_date, auth.uid()
    );

    insert into stock_balances (restaurant_id, product_id, quantity_on_hand, average_cost, updated_at)
    values (v_transfer.to_restaurant_id, v_item.product_id, v_item.quantity, v_item.unit_cost, now())
    on conflict (restaurant_id, product_id) do update set
      average_cost = case
        when (stock_balances.quantity_on_hand + v_item.quantity) = 0 then excluded.average_cost
        else ((stock_balances.quantity_on_hand * stock_balances.average_cost) + (v_item.quantity * v_item.unit_cost))
             / (stock_balances.quantity_on_hand + v_item.quantity)
      end,
      quantity_on_hand = stock_balances.quantity_on_hand + v_item.quantity,
      updated_at = now();
  end loop;

  update branch_transfers set status = 'received', received_date = current_date, received_by = auth.uid()
  where id = p_transfer_id;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (auth.uid(), 'receive', 'inventory', 'branch_transfer', p_transfer_id, '{}'::jsonb);
end;
$$;

grant execute on function public.create_branch_transfer(jsonb) to authenticated;
grant execute on function public.receive_branch_transfer(uuid) to authenticated;
