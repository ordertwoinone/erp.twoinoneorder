-- New Purchase, round 3 — the fields the old desktop "New Purchase Material"
-- screen had:
--  * received date, pay mode, PO reference, "disable tax", invoice currency
--    with exchange rate, bill discount as a percentage
--  * per line: FOC (free) quantity, per-unit discount, price in the invoice
--    currency, and landing cost
--  * other related expenses (freight, customs, clearing…) that are not on the
--    supplier's bill but are spread into the landing cost of the items
--  * previous purchase prices for the items being entered
-- Safe to re-run.

-- === Columns =====================================================================
alter table purchases
  add column if not exists received_date date,
  add column if not exists payment_mode text check (payment_mode in ('cash', 'credit', 'card', 'bank_transfer', 'cheque')),
  add column if not exists po_reference text,
  add column if not exists tax_disabled boolean not null default false,
  add column if not exists currency_code text not null default 'AED' check (currency_code in ('AED', 'USD', 'EUR', 'INR', 'EGP')),
  add column if not exists exchange_rate numeric(14,6) not null default 1 check (exchange_rate > 0),
  add column if not exists bill_discount_percent numeric(5,2) check (bill_discount_percent between 0 and 100),
  add column if not exists other_expenses_amount numeric(14,2) not null default 0 check (other_expenses_amount >= 0);

alter table purchase_items
  add column if not exists foc_quantity numeric(14,3) not null default 0 check (foc_quantity >= 0),
  add column if not exists unit_discount numeric(14,2) not null default 0 check (unit_discount >= 0),
  add column if not exists foreign_unit_price numeric(14,4) check (foreign_unit_price >= 0),
  add column if not exists landing_cost numeric(14,4);

-- Costs paid to other parties for this delivery. Not part of the supplier's
-- payable; only used to work out the real (landing) cost of the stock.
create table if not exists purchase_expenses (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  description text not null,
  payee text,
  amount numeric(14,2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);
create index if not exists purchase_expenses_purchase_idx on purchase_expenses(purchase_id);

alter table purchase_expenses enable row level security;
drop policy if exists purchase_expenses_select on purchase_expenses;
create policy purchase_expenses_select on purchase_expenses for select
  using (exists (select 1 from purchases p where p.id = purchase_id and app.has_restaurant_access(p.restaurant_id)));
drop policy if exists purchase_expenses_write on purchase_expenses;
create policy purchase_expenses_write on purchase_expenses for all
  using (exists (select 1 from purchases p where p.id = purchase_id and app.has_restaurant_access(p.restaurant_id) and app.has_permission('purchases.create')))
  with check (exists (select 1 from purchases p where p.id = purchase_id and app.has_restaurant_access(p.restaurant_id) and app.has_permission('purchases.create')));

-- === save_purchase_draft (replaces 0045) =========================================
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
    foc_quantity, unit_discount, foreign_unit_price, landing_cost
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
    )
  from jsonb_array_elements(v_items) as item
  cross join lateral (
    select round((item ->> 'quantity')::numeric * (item ->> 'unit_price')::numeric, 2)
           - coalesce((item ->> 'discount_amount')::numeric, 0) as amount
  ) net;

  insert into purchase_expenses (purchase_id, description, payee, amount)
  select v_purchase_id, coalesce(nullif(trim(e ->> 'description'), ''), 'Expense'), nullif(e ->> 'payee', ''),
         coalesce(nullif(e ->> 'amount', '')::numeric, 0)
  from jsonb_array_elements(coalesce(payload -> 'expenses', '[]'::jsonb)) as e;

  return v_purchase_id;
end;
$$;

grant execute on function public.save_purchase_draft(jsonb) to authenticated;

-- === post_purchase (replaces 0025) ===============================================
-- Same as before, except FOC quantity is received into stock too and the
-- stock is valued at landing cost (falls back to the unit price for lines
-- saved before landing cost existed).
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
    v_qty := v_item.quantity + coalesce(v_item.foc_quantity, 0);
    v_cost := coalesce(v_item.landing_cost, v_item.unit_price);

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

grant execute on function public.post_purchase(uuid) to authenticated;

-- === Previous prices for the items on a purchase =================================
-- For each product: the last price from this supplier, and the last price
-- from any supplier (to spot a cheaper source). Cancelled and the purchase
-- being edited are ignored.
create or replace function public.get_previous_purchase_prices(
  p_restaurant_id uuid, p_supplier_id uuid, p_product_ids uuid[], p_exclude_purchase_id uuid default null
)
returns table (
  product_id uuid,
  supplier_price numeric,
  supplier_unit_code text,
  supplier_date date,
  supplier_quantity numeric,
  any_price numeric,
  any_unit_code text,
  any_date date,
  any_supplier_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not app.has_restaurant_access(p_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;
  if not app.has_permission('purchases.create') then
    raise exception 'Not authorized';
  end if;

  return query
  select
    pid,
    s.unit_price, s.code, s.invoice_date, s.quantity,
    a.unit_price, a.code, a.invoice_date, a.supplier_name
  from unnest(p_product_ids) as pid
  left join lateral (
    select pi.unit_price, u.code, po.invoice_date, pi.quantity
    from purchase_items pi
    join purchases po on po.id = pi.purchase_id
    join units u on u.id = pi.unit_id
    where pi.product_id = pid and po.restaurant_id = p_restaurant_id and po.supplier_id = p_supplier_id
      and po.status != 'cancelled' and po.id is distinct from p_exclude_purchase_id
    order by po.invoice_date desc, po.created_at desc
    limit 1
  ) s on true
  left join lateral (
    select pi.unit_price, u.code, po.invoice_date, sup.name as supplier_name
    from purchase_items pi
    join purchases po on po.id = pi.purchase_id
    join suppliers sup on sup.id = po.supplier_id
    join units u on u.id = pi.unit_id
    where pi.product_id = pid and po.restaurant_id = p_restaurant_id
      and po.status != 'cancelled' and po.id is distinct from p_exclude_purchase_id
    order by po.invoice_date desc, po.created_at desc
    limit 1
  ) a on true;
end;
$$;

grant execute on function public.get_previous_purchase_prices(uuid, uuid, uuid[], uuid) to authenticated;
