-- Document numbering helper. Not exposed via RPC (stays in `app`, called
-- only from the public-schema functions below).
create sequence if not exists app.document_number_seq;

create or replace function app.next_document_number(prefix text)
returns text
language sql
as $$
  select prefix || '-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('app.document_number_seq')::text, 5, '0');
$$;

-- Every function callable from the frontend lives directly in `public` —
-- Supabase's API only exposes that schema by default (see 0024's fix for
-- get_my_context/get_my_permissions, which hit this the hard way).

-- Atomically create/replace a draft purchase and its line items from one
-- JSON payload, instead of the client doing a multi-step insert sequence
-- (docs/architecture.md §5). Only draft/returned purchases are editable.
create or replace function public.save_purchase_draft(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase_id uuid;
  v_restaurant_id uuid;
  v_status purchase_status;
  v_item jsonb;
  v_subtotal numeric(14,2) := 0;
  v_discount numeric(14,2) := 0;
  v_tax numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
begin
  v_restaurant_id := (payload ->> 'restaurant_id')::uuid;

  if not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;
  if not app.has_permission('purchases.create') then
    raise exception 'Not authorized to create purchases';
  end if;
  if jsonb_array_length(coalesce(payload -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'A purchase needs at least one line item';
  end if;

  v_purchase_id := nullif(payload ->> 'id', '')::uuid;

  if v_purchase_id is not null then
    select status into v_status from purchases where id = v_purchase_id;
    if v_status is null then
      raise exception 'Purchase not found';
    end if;
    if v_status not in ('draft', 'returned') then
      raise exception 'Only draft or returned purchases can be edited';
    end if;
  end if;

  select
    coalesce(sum((item ->> 'quantity')::numeric * (item ->> 'unit_price')::numeric), 0),
    coalesce(sum(coalesce((item ->> 'discount_amount')::numeric, 0)), 0),
    coalesce(sum(coalesce((item ->> 'tax_amount')::numeric, 0)), 0)
  into v_subtotal, v_discount, v_tax
  from jsonb_array_elements(payload -> 'items') as item;

  v_total := v_subtotal - v_discount + v_tax;

  if v_purchase_id is null then
    insert into purchases (
      purchase_number, restaurant_id, supplier_id, invoice_number, invoice_date,
      status, subtotal_amount, discount_amount, tax_amount, total_amount, notes, created_by
    ) values (
      app.next_document_number('PUR'), v_restaurant_id, (payload ->> 'supplier_id')::uuid,
      payload ->> 'invoice_number', (payload ->> 'invoice_date')::date,
      'draft', v_subtotal, v_discount, v_tax, v_total, nullif(payload ->> 'notes', ''), auth.uid()
    ) returning id into v_purchase_id;
  else
    update purchases set
      supplier_id = (payload ->> 'supplier_id')::uuid,
      invoice_number = payload ->> 'invoice_number',
      invoice_date = (payload ->> 'invoice_date')::date,
      status = 'draft',
      subtotal_amount = v_subtotal,
      discount_amount = v_discount,
      tax_amount = v_tax,
      total_amount = v_total,
      notes = nullif(payload ->> 'notes', '')
    where id = v_purchase_id;

    delete from purchase_items where purchase_id = v_purchase_id;
  end if;

  insert into purchase_items (
    purchase_id, product_id, unit_id, pack_size, quantity, unit_price,
    discount_amount, tax_amount, line_total
  )
  select
    v_purchase_id,
    (item ->> 'product_id')::uuid,
    (item ->> 'unit_id')::uuid,
    nullif(item ->> 'pack_size', '')::numeric,
    (item ->> 'quantity')::numeric,
    (item ->> 'unit_price')::numeric,
    coalesce((item ->> 'discount_amount')::numeric, 0),
    coalesce((item ->> 'tax_amount')::numeric, 0),
    ((item ->> 'quantity')::numeric * (item ->> 'unit_price')::numeric)
      - coalesce((item ->> 'discount_amount')::numeric, 0)
      + coalesce((item ->> 'tax_amount')::numeric, 0)
  from jsonb_array_elements(payload -> 'items') as item;

  return v_purchase_id;
end;
$$;

-- Approval-workflow transitions (submit/approve/reject/return/cancel).
-- Each writes an `approvals` row and an `audit_logs` row so the full
-- back-and-forth is auditable, not just the final status.
create or replace function public.transition_purchase(
  p_purchase_id uuid, p_action text, p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_status purchase_status;
  v_new_status purchase_status;
  v_approval_action approval_action;
begin
  select restaurant_id, status into v_restaurant_id, v_status
  from purchases where id = p_purchase_id for update;

  if v_restaurant_id is null then
    raise exception 'Purchase not found';
  end if;
  if not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;

  if p_action = 'submit' then
    if v_status not in ('draft', 'returned') then
      raise exception 'Only draft or returned purchases can be submitted';
    end if;
    if not app.has_permission('purchases.create') then raise exception 'Not authorized'; end if;
    v_new_status := 'pending_approval';
    v_approval_action := 'submitted';
  elsif p_action = 'approve' then
    if v_status != 'pending_approval' then raise exception 'Only pending purchases can be approved'; end if;
    if not app.has_permission('purchases.approve') then raise exception 'Not authorized'; end if;
    v_new_status := 'approved';
    v_approval_action := 'approved';
  elsif p_action = 'reject' then
    if v_status != 'pending_approval' then raise exception 'Only pending purchases can be rejected'; end if;
    if not app.has_permission('purchases.approve') then raise exception 'Not authorized'; end if;
    v_new_status := 'rejected';
    v_approval_action := 'rejected';
  elsif p_action = 'return' then
    if v_status != 'pending_approval' then raise exception 'Only pending purchases can be returned'; end if;
    if not app.has_permission('purchases.approve') then raise exception 'Not authorized'; end if;
    v_new_status := 'returned';
    v_approval_action := 'returned';
  elsif p_action = 'cancel' then
    if v_status not in ('draft', 'pending_approval', 'returned') then
      raise exception 'A purchase in this state cannot be cancelled';
    end if;
    if not (app.has_permission('purchases.create') or app.has_permission('purchases.approve')) then
      raise exception 'Not authorized';
    end if;
    v_new_status := 'cancelled';
    v_approval_action := null;
  else
    raise exception 'Unknown action %', p_action;
  end if;

  update purchases set
    status = v_new_status,
    approved_by = case when p_action = 'approve' then auth.uid() else approved_by end,
    approved_at = case when p_action = 'approve' then now() else approved_at end
  where id = p_purchase_id;

  if v_approval_action is not null then
    insert into approvals (entity_type, entity_id, action, comment, actor_id)
    values ('purchase', p_purchase_id, v_approval_action, p_comment, auth.uid());
  end if;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, old_value, new_value)
  values (
    auth.uid(), p_action, 'purchases', 'purchase', p_purchase_id,
    jsonb_build_object('status', v_status), jsonb_build_object('status', v_new_status)
  );
end;
$$;

-- Financial posting: the only path that touches stock and the ledger.
-- Atomic — either everything below commits or nothing does.
create or replace function public.post_purchase(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase purchases%rowtype;
  v_item record;
  v_period_status accounting_period_status;
  v_entry_id uuid;
  v_inventory_account uuid;
  v_ap_account uuid;
begin
  select * into v_purchase from purchases where id = p_purchase_id for update;
  if v_purchase.id is null then raise exception 'Purchase not found'; end if;
  if not app.has_restaurant_access(v_purchase.restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;
  if not app.has_permission('purchases.post') then
    raise exception 'Not authorized to post purchases';
  end if;
  if v_purchase.status != 'approved' then
    raise exception 'Only approved purchases can be posted';
  end if;

  select status into v_period_status from accounting_periods
  where (restaurant_id = v_purchase.restaurant_id or restaurant_id is null)
    and period_month = date_trunc('month', v_purchase.invoice_date)::date
  order by restaurant_id nulls last
  limit 1;

  if v_period_status = 'locked' then
    raise exception 'The accounting period for % is locked', to_char(v_purchase.invoice_date, 'Mon YYYY');
  end if;

  for v_item in select * from purchase_items where purchase_id = p_purchase_id
  loop
    insert into stock_movements (
      restaurant_id, product_id, movement_type, quantity, unit_cost, total_cost,
      source_type, source_id, movement_date, created_by
    ) values (
      v_purchase.restaurant_id, v_item.product_id, 'purchase_receipt', v_item.quantity,
      v_item.unit_price, v_item.line_total, 'purchase', p_purchase_id, v_purchase.invoice_date, auth.uid()
    );

    insert into stock_balances (restaurant_id, product_id, quantity_on_hand, average_cost, updated_at)
    values (v_purchase.restaurant_id, v_item.product_id, v_item.quantity, v_item.unit_price, now())
    on conflict (restaurant_id, product_id) do update set
      average_cost = case
        when (stock_balances.quantity_on_hand + excluded.quantity_on_hand) = 0 then excluded.average_cost
        else ((stock_balances.quantity_on_hand * stock_balances.average_cost)
              + (excluded.quantity_on_hand * excluded.average_cost))
             / (stock_balances.quantity_on_hand + excluded.quantity_on_hand)
      end,
      quantity_on_hand = stock_balances.quantity_on_hand + excluded.quantity_on_hand,
      updated_at = now();
  end loop;

  select id into v_inventory_account from accounting_accounts where code = '1200';
  select id into v_ap_account from accounting_accounts where code = '2000';

  insert into journal_entries (entry_number, restaurant_id, entry_date, source_type, source_id, description, created_by)
  values (
    app.next_document_number('JE'), v_purchase.restaurant_id, v_purchase.invoice_date, 'purchase', p_purchase_id,
    'Purchase ' || v_purchase.purchase_number, auth.uid()
  )
  returning id into v_entry_id;

  insert into journal_lines (journal_entry_id, accounting_account_id, debit_amount, credit_amount, memo)
  values (v_entry_id, v_inventory_account, v_purchase.total_amount, 0, 'Inventory received');

  insert into journal_lines (journal_entry_id, accounting_account_id, debit_amount, credit_amount, memo)
  values (v_entry_id, v_ap_account, 0, v_purchase.total_amount, 'Payable to supplier');

  update purchases set status = 'posted', posted_at = now() where id = p_purchase_id;

  insert into approvals (entity_type, entity_id, action, actor_id)
  values ('purchase', p_purchase_id, 'posted', auth.uid());

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (
    auth.uid(), 'post', 'purchases', 'purchase', p_purchase_id,
    jsonb_build_object('total_amount', v_purchase.total_amount)
  );
end;
$$;

grant execute on function public.save_purchase_draft(jsonb) to authenticated;
grant execute on function public.transition_purchase(uuid, text, text) to authenticated;
grant execute on function public.post_purchase(uuid) to authenticated;
