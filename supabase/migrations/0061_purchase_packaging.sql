-- New Purchase packaging: a line is bought in a purchase unit (carton) that
-- holds N pieces of a given weight; the price can be per carton, per piece or
-- per kg; and stock is added in the item's stock unit (kg, pcs, ...).
--   1 carton = 6 pieces x 2 kg = 12 kg  ->  5 cartons = 60 kg into stock
-- stock_factor = stock units per purchase unit (computed by the screen from
-- the packaging); stock_quantity = (qty + FOC) x stock_factor.
-- Re-runnable.

alter table products
  add column if not exists piece_weight numeric(14,4),
  add column if not exists piece_weight_unit_id uuid references units(id);

alter table purchase_items
  add column if not exists piece_weight numeric(14,4),
  add column if not exists piece_weight_unit_id uuid references units(id),
  add column if not exists price_basis text not null default 'unit',
  add column if not exists basis_rate numeric(14,4),
  add column if not exists stock_factor numeric(14,6) not null default 1,
  add column if not exists stock_quantity numeric(14,3);

alter table purchase_items drop constraint if exists purchase_items_price_basis_check;
alter table purchase_items add constraint purchase_items_price_basis_check check (price_basis in ('unit', 'piece', 'weight'));

-- === save_purchase_draft (replaces 0054) =========================================
create or replace function public.save_purchase_draft(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase_id uuid;
  v_restaurant_id uuid;
  v_supplier_id uuid;
  v_status purchase_status;
  v_subtotal numeric(14,2) := 0;
  v_discount numeric(14,2) := 0;
  v_tax numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_net_total numeric(14,2) := 0;
  v_other numeric(14,2) := 0;
  v_terms integer := nullif(payload ->> 'payment_terms_days', '')::integer;
  v_tax_disabled boolean := coalesce((payload ->> 'tax_disabled')::boolean, false);
  v_items jsonb;
begin
  v_restaurant_id := (payload ->> 'restaurant_id')::uuid;
  v_supplier_id := (payload ->> 'supplier_id')::uuid;

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

  if v_terms is null then
    select payment_terms_days into v_terms from suppliers where id = v_supplier_id;
  end if;

  -- "Disable tax" zero-rates every line regardless of what the client sent.
  select jsonb_agg(case when v_tax_disabled then item || '{"vat_rate": 0}'::jsonb else item end)
  into v_items
  from jsonb_array_elements(payload -> 'items') as item;

  select
    coalesce(sum(round((item ->> 'quantity')::numeric * (item ->> 'unit_price')::numeric, 2)), 0),
    coalesce(sum(coalesce((item ->> 'discount_amount')::numeric, 0)), 0),
    coalesce(sum(app.line_vat(item)), 0)
  into v_subtotal, v_discount, v_tax
  from jsonb_array_elements(v_items) as item;

  v_total := v_subtotal - v_discount + v_tax;
  v_net_total := v_subtotal - v_discount;

  select coalesce(sum(nullif(e ->> 'amount', '')::numeric), 0) into v_other
  from jsonb_array_elements(coalesce(payload -> 'expenses', '[]'::jsonb)) as e;

  if v_purchase_id is null then
    insert into purchases (
      purchase_number, restaurant_id, supplier_id, invoice_number, invoice_date, payment_terms_days,
      status, source, subtotal_amount, discount_amount, tax_amount, total_amount, notes, created_by,
      received_date, payment_mode, po_reference, tax_disabled, currency_code, exchange_rate,
      bill_discount_percent, other_expenses_amount
    ) values (
      app.next_document_number('PUR'), v_restaurant_id, v_supplier_id,
      payload ->> 'invoice_number', (payload ->> 'invoice_date')::date, v_terms,
      'draft', coalesce(nullif(payload ->> 'source', ''), 'manual'),
      v_subtotal, v_discount, v_tax, v_total, nullif(payload ->> 'notes', ''), auth.uid(),
      nullif(payload ->> 'received_date', '')::date, nullif(payload ->> 'payment_mode', ''),
      nullif(payload ->> 'po_reference', ''), v_tax_disabled,
      coalesce(nullif(payload ->> 'currency_code', ''), 'AED'),
      coalesce(nullif(payload ->> 'exchange_rate', '')::numeric, 1),
      nullif(payload ->> 'bill_discount_percent', '')::numeric, v_other
    ) returning id into v_purchase_id;
  else
    update purchases set
      supplier_id = v_supplier_id,
      invoice_number = payload ->> 'invoice_number',
      invoice_date = (payload ->> 'invoice_date')::date,
      payment_terms_days = v_terms,
      status = 'draft',
      subtotal_amount = v_subtotal,
      discount_amount = v_discount,
      tax_amount = v_tax,
      total_amount = v_total,
      notes = nullif(payload ->> 'notes', ''),
      received_date = nullif(payload ->> 'received_date', '')::date,
      payment_mode = nullif(payload ->> 'payment_mode', ''),
      po_reference = nullif(payload ->> 'po_reference', ''),
      tax_disabled = v_tax_disabled,
      currency_code = coalesce(nullif(payload ->> 'currency_code', ''), 'AED'),
      exchange_rate = coalesce(nullif(payload ->> 'exchange_rate', '')::numeric, 1),
      bill_discount_percent = nullif(payload ->> 'bill_discount_percent', '')::numeric,
      other_expenses_amount = v_other
    where id = v_purchase_id;

    delete from purchase_items where purchase_id = v_purchase_id;
    delete from purchase_expenses where purchase_id = v_purchase_id;
  end if;

  insert into purchase_items (
    purchase_id, product_id, unit_id, pack_size, quantity, unit_price,
    discount_amount, tax_amount, line_total, agreed_price_at_entry,
    foc_quantity, unit_discount, foreign_unit_price, landing_cost, description,
    piece_weight, piece_weight_unit_id, price_basis, basis_rate, stock_factor, stock_quantity
  )
  select
    v_purchase_id,
    (item ->> 'product_id')::uuid,
    (item ->> 'unit_id')::uuid,
    nullif(item ->> 'pack_size', '')::numeric,
    (item ->> 'quantity')::numeric,
    (item ->> 'unit_price')::numeric,
    coalesce((item ->> 'discount_amount')::numeric, 0),
    app.line_vat(item),
    round((item ->> 'quantity')::numeric * (item ->> 'unit_price')::numeric, 2)
      - coalesce((item ->> 'discount_amount')::numeric, 0)
      + app.line_vat(item),
    app.current_agreed_price(v_supplier_id, (item ->> 'product_id')::uuid, (item ->> 'unit_id')::uuid, v_restaurant_id),
    coalesce(nullif(item ->> 'foc_quantity', '')::numeric, 0),
    coalesce(nullif(item ->> 'unit_discount', '')::numeric, 0),
    nullif(item ->> 'foreign_unit_price', '')::numeric,
    -- Landing cost per unit received (paid + free): the line's cost after
    -- discount, excluding recoverable VAT, plus its value-weighted share of
    -- the other related expenses.
    round(
      (net.amount + case when v_net_total > 0 then v_other * net.amount / v_net_total else 0 end)
      / nullif((item ->> 'quantity')::numeric + coalesce(nullif(item ->> 'foc_quantity', '')::numeric, 0), 0),
      4
    ),
    nullif(trim(item ->> 'description'), ''),
    nullif(item ->> 'piece_weight', '')::numeric,
    nullif(item ->> 'piece_weight_unit_id', '')::uuid,
    coalesce(nullif(item ->> 'price_basis', ''), 'unit'),
    nullif(item ->> 'basis_rate', '')::numeric,
    coalesce(nullif(item ->> 'stock_factor', '')::numeric, 1),
    round(((item ->> 'quantity')::numeric + coalesce(nullif(item ->> 'foc_quantity', '')::numeric, 0))
          * coalesce(nullif(item ->> 'stock_factor', '')::numeric, 1), 3)
  from jsonb_array_elements(v_items) as item
  cross join lateral (
    select round((item ->> 'quantity')::numeric * (item ->> 'unit_price')::numeric, 2)
           - coalesce((item ->> 'discount_amount')::numeric, 0) as amount
  ) net;

  -- Remember the packaging on the item card when it has none yet, so the next
  -- purchase of the same item starts with it filled in.
  update products p set
    pack_size = coalesce(p.pack_size, nullif(item ->> 'pack_size', '')::numeric),
    piece_weight = coalesce(p.piece_weight, nullif(item ->> 'piece_weight', '')::numeric),
    piece_weight_unit_id = coalesce(p.piece_weight_unit_id, nullif(item ->> 'piece_weight_unit_id', '')::uuid)
  from jsonb_array_elements(v_items) as item
  where p.id = (item ->> 'product_id')::uuid
    and (p.pack_size is null or p.piece_weight is null);

  insert into purchase_expenses (purchase_id, description, payee, amount)
  select v_purchase_id, coalesce(nullif(trim(e ->> 'description'), ''), 'Expense'), nullif(e ->> 'payee', ''),
         coalesce(nullif(e ->> 'amount', '')::numeric, 0)
  from jsonb_array_elements(coalesce(payload -> 'expenses', '[]'::jsonb)) as e;

  return v_purchase_id;
end;
$$;

grant execute on function public.save_purchase_draft(jsonb) to authenticated;

-- === post_purchase (replaces 0051) ==============================================
create or replace function public.post_purchase(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase purchases%rowtype;
  v_item record;
  v_qty numeric;
  v_cost numeric;
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
    -- Stock goes in by the item's stock unit (e.g. 5 cartons x 6 pcs x 2 kg
    -- = 60 kg). The value is unchanged: cost per stock unit = line cost / stock qty.
    v_qty := coalesce(nullif(v_item.stock_quantity, 0), v_item.quantity + coalesce(v_item.foc_quantity, 0));
    v_cost := coalesce(v_item.landing_cost, v_item.unit_price)
              * (v_item.quantity + coalesce(v_item.foc_quantity, 0)) / nullif(v_qty, 0);
    v_cost := coalesce(v_cost, 0);

    insert into stock_movements (
      restaurant_id, product_id, movement_type, quantity, unit_cost, total_cost,
      source_type, source_id, movement_date, created_by
    ) values (
      v_purchase.restaurant_id, v_item.product_id, 'purchase_receipt', v_qty,
      v_cost, round(v_cost * v_qty, 2), 'purchase', p_purchase_id,
      coalesce(v_purchase.received_date, v_purchase.invoice_date), auth.uid()
    );

    insert into stock_balances (restaurant_id, product_id, quantity_on_hand, average_cost, updated_at)
    values (v_purchase.restaurant_id, v_item.product_id, v_qty, v_cost, now())
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
