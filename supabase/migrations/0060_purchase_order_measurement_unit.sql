-- Purchase order lines: the measurement (pack size) gets its own unit, so a
-- line can say "1 BAG of 50 KG" or "1 CTN of 24 PCS". Re-runnable.

alter table purchase_order_items
  add column if not exists pack_unit_id uuid references units(id);

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

  insert into purchase_order_items (purchase_order_id, product_id, unit_id, pack_size, pack_unit_id, quantity, unit_price)
  select
    v_order_id, (item ->> 'product_id')::uuid, (item ->> 'unit_id')::uuid,
    nullif(item ->> 'pack_size', '')::numeric, nullif(item ->> 'pack_unit_id', '')::uuid,
    (item ->> 'quantity')::numeric, (item ->> 'unit_price')::numeric
  from jsonb_array_elements(payload -> 'items') as item;

  return v_order_id;
end;
$$;
