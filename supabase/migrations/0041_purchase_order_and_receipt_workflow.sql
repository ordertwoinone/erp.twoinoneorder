-- Purchase orders and goods receipts had tables (0008) and RLS (0008) but no
-- write path — approving a purchase request only flipped its status, with no
-- way to actually commit an order to a supplier or record what arrived. This
-- closes the Request -> Order -> Receive -> Invoice pipeline the dashboard
-- already visualizes.

-- === Purchase orders ===========================================================
-- Draft/edit. Placing the order (below) is a separate step so a buyer can
-- adjust supplier/quantities before committing, same shape as purchases'
-- draft-then-submit flow.
create or replace function public.save_purchase_order(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_restaurant_id uuid;
  v_status purchase_order_status;
begin
  v_restaurant_id := (payload ->> 'restaurant_id')::uuid;

  if not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;
  if not app.has_permission('purchase_orders.manage') then
    raise exception 'Not authorized to manage purchase orders';
  end if;
  if jsonb_array_length(coalesce(payload -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'A purchase order needs at least one line item';
  end if;

  v_order_id := nullif(payload ->> 'id', '')::uuid;

  if v_order_id is not null then
    select status into v_status from purchase_orders where id = v_order_id;
    if v_status is null then
      raise exception 'Purchase order not found';
    end if;
    if v_status != 'draft' then
      raise exception 'Only draft orders can be edited';
    end if;

    update purchase_orders set
      supplier_id = (payload ->> 'supplier_id')::uuid,
      purchase_request_id = nullif(payload ->> 'purchase_request_id', '')::uuid,
      order_date = coalesce(nullif(payload ->> 'order_date', '')::date, current_date),
      expected_date = nullif(payload ->> 'expected_date', '')::date,
      notes = nullif(payload ->> 'notes', '')
    where id = v_order_id;

    delete from purchase_order_items where purchase_order_id = v_order_id;
  else
    insert into purchase_orders (
      order_number, restaurant_id, supplier_id, purchase_request_id, status, order_date, expected_date, notes, created_by
    ) values (
      app.next_document_number('PO'), v_restaurant_id, (payload ->> 'supplier_id')::uuid,
      nullif(payload ->> 'purchase_request_id', '')::uuid, 'draft',
      coalesce(nullif(payload ->> 'order_date', '')::date, current_date), nullif(payload ->> 'expected_date', '')::date,
      nullif(payload ->> 'notes', ''), auth.uid()
    ) returning id into v_order_id;
  end if;

  insert into purchase_order_items (purchase_order_id, product_id, unit_id, pack_size, quantity, unit_price)
  select
    v_order_id, (item ->> 'product_id')::uuid, (item ->> 'unit_id')::uuid,
    nullif(item ->> 'pack_size', '')::numeric, (item ->> 'quantity')::numeric, (item ->> 'unit_price')::numeric
  from jsonb_array_elements(payload -> 'items') as item;

  return v_order_id;
end;
$$;

grant execute on function public.save_purchase_order(jsonb) to authenticated;

create or replace function public.place_purchase_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_status purchase_order_status;
  v_request_id uuid;
begin
  select restaurant_id, status, purchase_request_id into v_restaurant_id, v_status, v_request_id
  from purchase_orders where id = p_order_id for update;

  if v_restaurant_id is null then raise exception 'Purchase order not found'; end if;
  if not app.has_restaurant_access(v_restaurant_id) then raise exception 'Not authorized for this restaurant'; end if;
  if not app.has_permission('purchase_orders.manage') then raise exception 'Not authorized to place purchase orders'; end if;
  if v_status != 'draft' then raise exception 'Only draft orders can be placed'; end if;

  update purchase_orders set status = 'ordered' where id = p_order_id;
  if v_request_id is not null then
    update purchase_requests set status = 'ordered' where id = v_request_id and status = 'approved';
  end if;

  insert into approvals (entity_type, entity_id, action, actor_id)
  values ('purchase_order', p_order_id, 'submitted', auth.uid());
  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (auth.uid(), 'place_order', 'purchasing', 'purchase_order', p_order_id, jsonb_build_object('status', 'ordered'));
end;
$$;

grant execute on function public.place_purchase_order(uuid) to authenticated;

create or replace function public.cancel_purchase_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_status purchase_order_status;
begin
  select restaurant_id, status into v_restaurant_id, v_status from purchase_orders where id = p_order_id for update;

  if v_restaurant_id is null then raise exception 'Purchase order not found'; end if;
  if not app.has_restaurant_access(v_restaurant_id) then raise exception 'Not authorized for this restaurant'; end if;
  if not app.has_permission('purchase_orders.manage') then raise exception 'Not authorized to cancel purchase orders'; end if;
  if v_status in ('closed', 'cancelled') then raise exception 'This order can no longer be cancelled'; end if;

  update purchase_orders set status = 'cancelled' where id = p_order_id;
  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (auth.uid(), 'cancel', 'purchasing', 'purchase_order', p_order_id, jsonb_build_object('status', 'cancelled'));
end;
$$;

grant execute on function public.cancel_purchase_order(uuid) to authenticated;

-- === Goods receipts ============================================================
-- Records what physically arrived, optionally against a purchase order —
-- rolls quantity_received up on the order's lines and advances the order's
-- status to partially_received/received once enough has arrived.
create or replace function public.save_goods_receipt(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt_id uuid;
  v_restaurant_id uuid;
  v_purchase_order_id uuid;
  v_item jsonb;
  v_total_ordered numeric;
  v_total_received numeric;
begin
  v_restaurant_id := (payload ->> 'restaurant_id')::uuid;
  v_purchase_order_id := nullif(payload ->> 'purchase_order_id', '')::uuid;

  if not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;
  if not app.has_permission('purchases.create') then
    raise exception 'Not authorized to record goods receipts';
  end if;
  if jsonb_array_length(coalesce(payload -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'A goods receipt needs at least one line item';
  end if;

  insert into goods_receipts (receipt_number, restaurant_id, purchase_order_id, status, received_date, received_by, notes)
  values (
    app.next_document_number('GR'), v_restaurant_id, v_purchase_order_id, 'confirmed',
    coalesce(nullif(payload ->> 'received_date', '')::date, current_date), auth.uid(), nullif(payload ->> 'notes', '')
  ) returning id into v_receipt_id;

  insert into goods_receipt_items (goods_receipt_id, product_id, unit_id, quantity_received, quantity_shortage, notes)
  select
    v_receipt_id, (item ->> 'product_id')::uuid, (item ->> 'unit_id')::uuid,
    (item ->> 'quantity_received')::numeric, coalesce((item ->> 'quantity_shortage')::numeric, 0), nullif(item ->> 'notes', '')
  from jsonb_array_elements(payload -> 'items') as item;

  if v_purchase_order_id is not null then
    for v_item in select * from jsonb_array_elements(payload -> 'items') loop
      update purchase_order_items set quantity_received = quantity_received + (v_item ->> 'quantity_received')::numeric
      where purchase_order_id = v_purchase_order_id
        and product_id = (v_item ->> 'product_id')::uuid
        and unit_id = (v_item ->> 'unit_id')::uuid;
    end loop;

    select coalesce(sum(quantity), 0), coalesce(sum(quantity_received), 0)
      into v_total_ordered, v_total_received
    from purchase_order_items where purchase_order_id = v_purchase_order_id;

    update purchase_orders set status = case
      when v_total_received >= v_total_ordered then 'received'
      when v_total_received > 0 then 'partially_received'
      else status
    end
    where id = v_purchase_order_id and status not in ('cancelled', 'closed');
  end if;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (
    auth.uid(), 'record_receipt', 'purchasing', 'goods_receipt', v_receipt_id,
    jsonb_build_object('purchase_order_id', v_purchase_order_id)
  );

  return v_receipt_id;
end;
$$;

grant execute on function public.save_goods_receipt(jsonb) to authenticated;
