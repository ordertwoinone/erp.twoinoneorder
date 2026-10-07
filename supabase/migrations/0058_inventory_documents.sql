-- Inventory documents (desktop "Inventory" ribbon): Locations, Purchase
-- Return, Wastage, Stock Adjustment, Stock Request and Stock Transfer with
-- draft -> post. Every document is saved and posted through one pair of
-- RPCs (save_stock_document / post_stock_document) so the screens share one
-- shape. Stock always moves through stock_movements + stock_balances.
-- Re-runnable: every change is "if not exists" / "or replace" / drop-first.

-- === Reference changes ========================================================
alter type transfer_status add value if not exists 'draft';

alter table restaurants
  add column if not exists linked_supplier_id uuid references suppliers(id) on delete set null,
  add column if not exists linked_customer_name text;

alter table stock_movements drop constraint if exists stock_movements_movement_type_check;
alter table stock_movements add constraint stock_movements_movement_type_check check (movement_type in (
  'purchase_receipt', 'sale_consumption', 'transfer_out', 'transfer_in',
  'adjustment_in', 'adjustment_out', 'opening', 'closing', 'purchase_return', 'wastage'
));
alter table stock_movements drop constraint if exists stock_movements_source_type_check;
alter table stock_movements add constraint stock_movements_source_type_check check (source_type in (
  'purchase', 'goods_receipt', 'branch_transfer', 'manual_adjustment',
  'opening_stock', 'closing_stock', 'purchase_return', 'wastage', 'stock_adjustment'
));

alter table journal_entries drop constraint if exists journal_entries_source_type_check;
alter table journal_entries add constraint journal_entries_source_type_check check (source_type in (
  'purchase', 'supplier_payment', 'sales_entry', 'salary_payment',
  'operating_expense', 'card_settlement', 'delivery_settlement',
  'branch_transfer', 'adjustment', 'manual', 'purchase_return', 'wastage'
));

insert into accounting_accounts (code, name, account_type) values
  ('5050', 'Stock Wastage', 'expense'),
  ('5060', 'Inventory Adjustments', 'expense')
on conflict (code) do nothing;

-- === Purchase returns (tables existed since 0008, unused) =====================
alter table purchase_returns alter column purchase_id drop not null;
alter table purchase_returns
  add column if not exists supplier_id uuid references suppliers(id),
  add column if not exists invoice_number text,
  add column if not exists received_date date,
  add column if not exists payment_mode text,
  add column if not exists tax_disabled boolean not null default false,
  add column if not exists subtotal_amount numeric(14,2) not null default 0,
  add column if not exists discount_percent numeric(6,2) not null default 0,
  add column if not exists discount_amount numeric(14,2) not null default 0,
  add column if not exists tax_amount numeric(14,2) not null default 0,
  add column if not exists total_amount numeric(14,2) not null default 0,
  add column if not exists posted_by uuid references profiles(id),
  add column if not exists posted_at timestamptz;
update purchase_returns r set supplier_id = p.supplier_id
from purchases p where p.id = r.purchase_id and r.supplier_id is null;
create index if not exists purchase_returns_restaurant_idx on purchase_returns(restaurant_id, status);

alter table purchase_return_items
  add column if not exists foc_quantity numeric(14,3) not null default 0,
  add column if not exists tax_percent numeric(6,2) not null default 5,
  add column if not exists discount_amount numeric(14,2) not null default 0,
  add column if not exists tax_amount numeric(14,2) not null default 0,
  add column if not exists current_cost numeric(14,4) not null default 0,
  add column if not exists sort_order integer not null default 0;

-- === Wastage ==================================================================
create table if not exists stock_wastages (
  id uuid primary key default gen_random_uuid(),
  wastage_number text not null unique,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  wastage_date date not null default current_date,
  item_kind text not null default 'material' check (item_kind in ('material', 'food_product')),
  notes text,
  status text not null default 'draft' check (status in ('draft', 'posted', 'cancelled')),
  total_quantity numeric(14,3) not null default 0,
  total_amount numeric(14,2) not null default 0,
  created_by uuid references profiles(id),
  posted_by uuid references profiles(id),
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stock_wastages_restaurant_idx on stock_wastages(restaurant_id, status);

create table if not exists stock_wastage_items (
  id uuid primary key default gen_random_uuid(),
  wastage_id uuid not null references stock_wastages(id) on delete cascade,
  product_id uuid not null references products(id),
  unit_id uuid not null references units(id),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost numeric(14,4) not null default 0,
  amount numeric(14,2) not null default 0,
  remarks text,
  sort_order integer not null default 0
);
create index if not exists stock_wastage_items_doc_idx on stock_wastage_items(wastage_id);

-- === Stock adjustments ========================================================
create table if not exists stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  adjustment_number text not null unique,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  adjustment_date date not null default current_date,
  notes text,
  status text not null default 'draft' check (status in ('draft', 'posted', 'cancelled')),
  total_value numeric(14,2) not null default 0,
  created_by uuid references profiles(id),
  posted_by uuid references profiles(id),
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stock_adjustments_restaurant_idx on stock_adjustments(restaurant_id, status);

create table if not exists stock_adjustment_items (
  id uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references stock_adjustments(id) on delete cascade,
  product_id uuid not null references products(id),
  unit_id uuid not null references units(id),
  unit_cost numeric(14,4) not null default 0,
  current_stock numeric(14,3) not null default 0,
  adjustment_quantity numeric(14,3) not null default 0,
  new_stock numeric(14,3) not null default 0,
  adjustment_value numeric(14,2) not null default 0,
  notes text,
  sort_order integer not null default 0
);
create index if not exists stock_adjustment_items_doc_idx on stock_adjustment_items(adjustment_id);

-- === Stock (transfer) requests ===============================================
-- from_restaurant_id supplies the goods, to_restaurant_id asks for them — the
-- same direction as the transfer that fulfils the request.
create table if not exists stock_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  from_restaurant_id uuid not null references restaurants(id) on delete cascade,
  to_restaurant_id uuid not null references restaurants(id) on delete cascade,
  request_date date not null default current_date,
  notes text,
  status text not null default 'open' check (status in ('open', 'posted', 'fulfilled', 'rejected', 'cancelled')),
  total_cost numeric(14,2) not null default 0,
  branch_transfer_id uuid references branch_transfers(id) on delete set null,
  created_by uuid references profiles(id),
  posted_by uuid references profiles(id),
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_requests_distinct_chk check (from_restaurant_id != to_restaurant_id)
);
create index if not exists stock_requests_from_idx on stock_requests(from_restaurant_id, status);
create index if not exists stock_requests_to_idx on stock_requests(to_restaurant_id, status);

create table if not exists stock_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references stock_requests(id) on delete cascade,
  product_id uuid not null references products(id),
  unit_id uuid not null references units(id),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost numeric(14,4) not null default 0,
  remarks text,
  sort_order integer not null default 0
);
create index if not exists stock_request_items_doc_idx on stock_request_items(request_id);

-- === Transfers: drafts, remarks, link to request =============================
alter table branch_transfers
  add column if not exists stock_request_id uuid references stock_requests(id) on delete set null,
  add column if not exists total_cost numeric(14,2) not null default 0,
  add column if not exists created_by uuid references profiles(id);
alter table branch_transfer_items
  add column if not exists remarks text,
  add column if not exists sort_order integer not null default 0;

-- === RLS: read by restaurant; all writes go through the RPCs below ===========
alter table stock_wastages enable row level security;
alter table stock_wastage_items enable row level security;
alter table stock_adjustments enable row level security;
alter table stock_adjustment_items enable row level security;
alter table stock_requests enable row level security;
alter table stock_request_items enable row level security;

drop policy if exists stock_wastages_select on stock_wastages;
create policy stock_wastages_select on stock_wastages for select using (app.has_restaurant_access(restaurant_id));
drop policy if exists stock_wastage_items_select on stock_wastage_items;
create policy stock_wastage_items_select on stock_wastage_items for select
  using (exists (select 1 from stock_wastages d where d.id = wastage_id and app.has_restaurant_access(d.restaurant_id)));
drop policy if exists stock_adjustments_select on stock_adjustments;
create policy stock_adjustments_select on stock_adjustments for select using (app.has_restaurant_access(restaurant_id));
drop policy if exists stock_adjustment_items_select on stock_adjustment_items;
create policy stock_adjustment_items_select on stock_adjustment_items for select
  using (exists (select 1 from stock_adjustments d where d.id = adjustment_id and app.has_restaurant_access(d.restaurant_id)));
drop policy if exists stock_requests_select on stock_requests;
create policy stock_requests_select on stock_requests for select
  using (app.has_restaurant_access(from_restaurant_id) or app.has_restaurant_access(to_restaurant_id));
drop policy if exists stock_request_items_select on stock_request_items;
create policy stock_request_items_select on stock_request_items for select
  using (exists (select 1 from stock_requests d where d.id = request_id
                 and (app.has_restaurant_access(d.from_restaurant_id) or app.has_restaurant_access(d.to_restaurant_id))));

-- === Internal helpers =========================================================
create or replace function app.assert_period_open(p_restaurant_id uuid, p_date date)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_status accounting_period_status;
begin
  select status into v_status from accounting_periods
  where (restaurant_id = p_restaurant_id or restaurant_id is null)
    and period_month = date_trunc('month', p_date)::date
  order by restaurant_id nulls last
  limit 1;
  if v_status = 'locked' then
    raise exception 'The accounting period for % is locked', to_char(p_date, 'Mon YYYY');
  end if;
end;
$$;

-- Takes stock out at the current average cost (average cost is unchanged by
-- an outflow). Returns the unit cost used. Refuses to go below zero when
-- p_block_negative is true.
create or replace function app.stock_out(
  p_restaurant_id uuid, p_product_id uuid, p_quantity numeric, p_movement_type text,
  p_source_type text, p_source_id uuid, p_date date, p_block_negative boolean default true,
  p_unit_cost numeric default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available numeric;
  v_avg numeric;
  v_cost numeric;
begin
  select quantity_on_hand, average_cost into v_available, v_avg
  from stock_balances where restaurant_id = p_restaurant_id and product_id = p_product_id
  for update;

  if p_block_negative and coalesce(v_available, 0) < p_quantity then
    raise exception 'Not enough stock of "%" (have %, need %). Post a Stock Adjustment first if the count is wrong.',
      (select name from products where id = p_product_id), round(coalesce(v_available, 0), 3), round(p_quantity, 3);
  end if;

  v_cost := coalesce(p_unit_cost, v_avg, 0);

  insert into stock_movements (
    restaurant_id, product_id, movement_type, quantity, unit_cost, total_cost,
    source_type, source_id, movement_date, created_by
  ) values (
    p_restaurant_id, p_product_id, p_movement_type, -p_quantity, round(v_cost, 2),
    -round(p_quantity * v_cost, 2), p_source_type, p_source_id, p_date, auth.uid()
  );

  insert into stock_balances (restaurant_id, product_id, quantity_on_hand, average_cost, updated_at)
  values (p_restaurant_id, p_product_id, -p_quantity, round(v_cost, 2), now())
  on conflict (restaurant_id, product_id) do update set
    quantity_on_hand = stock_balances.quantity_on_hand - p_quantity,
    updated_at = now();

  return v_cost;
end;
$$;

-- Puts stock in and re-weights the average cost.
create or replace function app.stock_in(
  p_restaurant_id uuid, p_product_id uuid, p_quantity numeric, p_unit_cost numeric,
  p_movement_type text, p_source_type text, p_source_id uuid, p_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into stock_movements (
    restaurant_id, product_id, movement_type, quantity, unit_cost, total_cost,
    source_type, source_id, movement_date, created_by
  ) values (
    p_restaurant_id, p_product_id, p_movement_type, p_quantity, round(p_unit_cost, 2),
    round(p_quantity * p_unit_cost, 2), p_source_type, p_source_id, p_date, auth.uid()
  );

  insert into stock_balances (restaurant_id, product_id, quantity_on_hand, average_cost, updated_at)
  values (p_restaurant_id, p_product_id, p_quantity, round(p_unit_cost, 2), now())
  on conflict (restaurant_id, product_id) do update set
    average_cost = case
      when stock_balances.quantity_on_hand <= 0 or (stock_balances.quantity_on_hand + p_quantity) <= 0 then round(p_unit_cost, 2)
      else round(((stock_balances.quantity_on_hand * stock_balances.average_cost) + (p_quantity * p_unit_cost))
                  / (stock_balances.quantity_on_hand + p_quantity), 2)
    end,
    quantity_on_hand = stock_balances.quantity_on_hand + p_quantity,
    updated_at = now();
end;
$$;

-- Two-line journal (debit one account code, credit another). Skips zero.
create or replace function app.post_simple_journal(
  p_restaurant_id uuid, p_date date, p_source_type text, p_source_id uuid, p_description text,
  p_debit_code text, p_credit_code text, p_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
  v_amount numeric := round(abs(coalesce(p_amount, 0)), 2);
begin
  if v_amount = 0 then return; end if;
  insert into journal_entries (entry_number, restaurant_id, entry_date, source_type, source_id, description, created_by)
  values (app.next_document_number('JE'), p_restaurant_id, p_date, p_source_type, p_source_id, p_description, auth.uid())
  returning id into v_entry_id;
  insert into journal_lines (journal_entry_id, accounting_account_id, debit_amount, credit_amount, memo)
  values (v_entry_id, (select id from accounting_accounts where code = p_debit_code), v_amount, 0, p_description);
  insert into journal_lines (journal_entry_id, accounting_account_id, debit_amount, credit_amount, memo)
  values (v_entry_id, (select id from accounting_accounts where code = p_credit_code), 0, v_amount, p_description);
end;
$$;

create or replace function app.current_avg_cost(p_restaurant_id uuid, p_product_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select nullif(average_cost, 0) from stock_balances where restaurant_id = p_restaurant_id and product_id = p_product_id),
    (select pi.unit_price from purchase_items pi join purchases p on p.id = pi.purchase_id
      where pi.product_id = p_product_id and p.restaurant_id = p_restaurant_id and p.status != 'cancelled'
      order by p.invoice_date desc, p.created_at desc limit 1),
    0
  );
$$;

-- === Item search for inventory screens =======================================
drop function if exists public.search_stock_items(uuid, text, int, uuid);
create function public.search_stock_items(
  p_restaurant_id uuid, p_search text, p_limit int default 20, p_supplier_id uuid default null
)
returns table (
  product_id uuid,
  name text,
  sku text,
  barcode text,
  base_unit_id uuid,
  base_unit_code text,
  pack_size numeric,
  image_path text,
  current_stock numeric,
  average_cost numeric,
  last_cost numeric
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

  return query
  select
    p.id, p.name, p.sku, p.barcode, p.base_unit_id, u.code, p.pack_size, p.image_path,
    coalesce(sb.quantity_on_hand, 0)::numeric, coalesce(sb.average_cost, 0)::numeric,
    coalesce(lp.unit_price, app.current_avg_cost(p_restaurant_id, p.id))::numeric
  from products p
  join units u on u.id = p.base_unit_id
  left join stock_balances sb on sb.restaurant_id = p_restaurant_id and sb.product_id = p.id
  left join lateral (
    select pi.unit_price from purchase_items pi join purchases po on po.id = pi.purchase_id
    where pi.product_id = p.id and po.restaurant_id = p_restaurant_id and po.status != 'cancelled'
      and (p_supplier_id is null or po.supplier_id = p_supplier_id)
    order by po.invoice_date desc, po.created_at desc limit 1
  ) lp on true
  where p.is_active
    and (
      p_search is null or p_search = ''
      or p.name ilike '%' || p_search || '%'
      or p.sku ilike '%' || p_search || '%'
      or p.barcode ilike '%' || p_search || '%'
    )
  order by (p.sku = p_search or p.barcode = p_search) desc, p.name
  limit p_limit;
end;
$$;
grant execute on function public.search_stock_items(uuid, text, int, uuid) to authenticated;

-- === Locations ================================================================
drop function if exists public.list_locations();
create function public.list_locations()
returns table (
  id uuid, code text, name text, is_head_office boolean, is_active boolean,
  linked_supplier_id uuid, linked_supplier_name text, linked_customer_name text,
  item_count bigint, stock_value numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.code, r.name, r.is_head_office, r.is_active, r.linked_supplier_id, s.name, r.linked_customer_name,
    (select count(*) from stock_balances b where b.restaurant_id = r.id and b.quantity_on_hand <> 0),
    coalesce((select sum(b.quantity_on_hand * b.average_cost) from stock_balances b where b.restaurant_id = r.id), 0)
  from restaurants r
  left join suppliers s on s.id = r.linked_supplier_id
  where app.has_restaurant_access(r.id)
  order by r.is_head_office desc, r.name;
$$;
grant execute on function public.list_locations() to authenticated;

-- New locations are new restaurants (needs restaurants.manage); linking a
-- vendor/customer to an existing one needs inventory.manage.
create or replace function public.save_location(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := nullif(payload ->> 'id', '')::uuid;
  v_name text := nullif(trim(payload ->> 'name'), '');
  v_code text;
begin
  if v_name is null then raise exception 'Location name is required'; end if;

  if v_id is null then
    if not app.has_permission('restaurants.manage') then
      raise exception 'Only users who manage restaurants can add a location';
    end if;
    v_code := upper(coalesce(nullif(trim(payload ->> 'code'), ''), left(regexp_replace(v_name, '[^A-Za-z0-9]', '', 'g'), 6)));
    if v_code = '' then v_code := 'LOC'; end if;
    while exists (select 1 from restaurants where code = v_code) loop
      v_code := left(v_code, 6) || floor(random() * 90 + 10)::int;
    end loop;
    insert into restaurants (code, name, linked_supplier_id, linked_customer_name)
    values (v_code, v_name, nullif(payload ->> 'linked_supplier_id', '')::uuid, nullif(trim(payload ->> 'linked_customer_name'), ''))
    returning id into v_id;
  else
    if not app.has_restaurant_access(v_id) then raise exception 'Not authorized for this location'; end if;
    if not (app.has_permission('inventory.manage') or app.has_permission('restaurants.manage')) then
      raise exception 'Not authorized to manage locations';
    end if;
    update restaurants set
      name = case when app.has_permission('restaurants.manage') then v_name else name end,
      linked_supplier_id = nullif(payload ->> 'linked_supplier_id', '')::uuid,
      linked_customer_name = nullif(trim(payload ->> 'linked_customer_name'), '')
    where id = v_id;
  end if;
  return v_id;
end;
$$;
grant execute on function public.save_location(jsonb) to authenticated;

-- === Saving documents =========================================================
create or replace function app.save_purchase_return(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := nullif(payload ->> 'id', '')::uuid;
  v_restaurant uuid := (payload ->> 'restaurant_id')::uuid;
  v_status text;
  v_item jsonb;
  v_i int := 0;
  v_qty numeric; v_cost numeric; v_disc numeric; v_tax_pct numeric; v_net numeric;
  v_sub numeric := 0; v_tax numeric := 0; v_bill_disc numeric; v_pct numeric;
  v_tax_disabled boolean := coalesce((payload ->> 'tax_disabled')::boolean, false);
begin
  if not app.has_permission('purchases.create') then raise exception 'Not authorized to create purchase returns'; end if;
  if v_restaurant is null then raise exception 'Select a location'; end if;
  if not app.has_restaurant_access(v_restaurant) then raise exception 'Not authorized for this location'; end if;
  if nullif(payload ->> 'supplier_id', '') is null then raise exception 'Select a vendor'; end if;

  if v_id is not null then
    select status into v_status from purchase_returns where id = v_id for update;
    if v_status is null then raise exception 'Purchase return not found'; end if;
    if v_status != 'draft' then raise exception 'Only draft returns can be edited'; end if;
    update purchase_returns set
      restaurant_id = v_restaurant,
      supplier_id = (payload ->> 'supplier_id')::uuid,
      purchase_id = nullif(payload ->> 'purchase_id', '')::uuid,
      invoice_number = nullif(trim(payload ->> 'invoice_number'), ''),
      return_date = coalesce(nullif(payload ->> 'doc_date', '')::date, current_date),
      received_date = nullif(payload ->> 'received_date', '')::date,
      payment_mode = nullif(payload ->> 'payment_mode', ''),
      tax_disabled = v_tax_disabled,
      reason = nullif(payload ->> 'notes', '')
    where id = v_id;
    delete from purchase_return_items where purchase_return_id = v_id;
  else
    insert into purchase_returns (return_number, restaurant_id, supplier_id, purchase_id, invoice_number, return_date,
      received_date, payment_mode, tax_disabled, reason, created_by)
    values (app.next_document_number('PRT'), v_restaurant, (payload ->> 'supplier_id')::uuid,
      nullif(payload ->> 'purchase_id', '')::uuid, nullif(trim(payload ->> 'invoice_number'), ''),
      coalesce(nullif(payload ->> 'doc_date', '')::date, current_date), nullif(payload ->> 'received_date', '')::date,
      nullif(payload ->> 'payment_mode', ''), v_tax_disabled, nullif(payload ->> 'notes', ''), auth.uid())
    returning id into v_id;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'items', '[]'::jsonb)) loop
    v_i := v_i + 1;
    v_qty := coalesce((v_item ->> 'quantity')::numeric, 0);
    if v_qty <= 0 then raise exception 'Line %: quantity must be more than 0', v_i; end if;
    v_cost := coalesce((v_item ->> 'unit_cost')::numeric, 0);
    v_disc := coalesce((v_item ->> 'discount_amount')::numeric, 0);
    v_tax_pct := case when v_tax_disabled then 0 else coalesce((v_item ->> 'tax_percent')::numeric, 5) end;
    v_net := round(v_qty * v_cost - v_disc, 2);
    insert into purchase_return_items (purchase_return_id, product_id, unit_id, quantity, foc_quantity, unit_price,
      discount_amount, tax_percent, tax_amount, line_total, current_cost, sort_order)
    values (v_id, (v_item ->> 'product_id')::uuid, (v_item ->> 'unit_id')::uuid, v_qty,
      coalesce((v_item ->> 'foc_quantity')::numeric, 0), v_cost, v_disc, v_tax_pct, round(v_net * v_tax_pct / 100, 2),
      v_net, app.current_avg_cost(v_restaurant, (v_item ->> 'product_id')::uuid), v_i);
    v_sub := v_sub + v_net;
    v_tax := v_tax + round(v_net * v_tax_pct / 100, 2);
  end loop;
  if v_i = 0 then raise exception 'Add at least one item'; end if;

  v_pct := coalesce((payload ->> 'discount_percent')::numeric, 0);
  v_bill_disc := case when v_pct > 0 then round(v_sub * v_pct / 100, 2) else coalesce((payload ->> 'discount_amount')::numeric, 0) end;
  if v_sub > 0 and v_bill_disc > 0 then v_tax := round(v_tax * (1 - v_bill_disc / v_sub), 2); end if;

  update purchase_returns set subtotal_amount = v_sub, discount_percent = v_pct, discount_amount = v_bill_disc,
    tax_amount = v_tax, total_amount = v_sub - v_bill_disc + v_tax
  where id = v_id;
  return v_id;
end;
$$;

create or replace function app.save_wastage(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := nullif(payload ->> 'id', '')::uuid;
  v_restaurant uuid := (payload ->> 'restaurant_id')::uuid;
  v_status text;
  v_item jsonb;
  v_i int := 0;
  v_qty numeric; v_cost numeric;
begin
  if v_restaurant is null then raise exception 'Select a location'; end if;
  if not app.has_restaurant_access(v_restaurant) then raise exception 'Not authorized for this location'; end if;

  if v_id is not null then
    select status into v_status from stock_wastages where id = v_id for update;
    if v_status is null then raise exception 'Wastage not found'; end if;
    if v_status != 'draft' then raise exception 'Only draft wastage can be edited'; end if;
    update stock_wastages set restaurant_id = v_restaurant,
      wastage_date = coalesce(nullif(payload ->> 'doc_date', '')::date, current_date),
      item_kind = coalesce(nullif(payload ->> 'item_kind', ''), 'material'),
      notes = nullif(payload ->> 'notes', ''), updated_at = now()
    where id = v_id;
    delete from stock_wastage_items where wastage_id = v_id;
  else
    insert into stock_wastages (wastage_number, restaurant_id, wastage_date, item_kind, notes, created_by)
    values (app.next_document_number('WST'), v_restaurant, coalesce(nullif(payload ->> 'doc_date', '')::date, current_date),
      coalesce(nullif(payload ->> 'item_kind', ''), 'material'), nullif(payload ->> 'notes', ''), auth.uid())
    returning id into v_id;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'items', '[]'::jsonb)) loop
    v_i := v_i + 1;
    v_qty := coalesce((v_item ->> 'quantity')::numeric, 0);
    if v_qty <= 0 then raise exception 'Line %: quantity must be more than 0', v_i; end if;
    v_cost := coalesce((v_item ->> 'unit_cost')::numeric, app.current_avg_cost(v_restaurant, (v_item ->> 'product_id')::uuid));
    insert into stock_wastage_items (wastage_id, product_id, unit_id, quantity, unit_cost, amount, remarks, sort_order)
    values (v_id, (v_item ->> 'product_id')::uuid, (v_item ->> 'unit_id')::uuid, v_qty, v_cost, round(v_qty * v_cost, 2),
      nullif(v_item ->> 'remarks', ''), v_i);
  end loop;
  if v_i = 0 then raise exception 'Add at least one item'; end if;

  update stock_wastages set
    total_quantity = (select coalesce(sum(quantity), 0) from stock_wastage_items where wastage_id = v_id),
    total_amount = (select coalesce(sum(amount), 0) from stock_wastage_items where wastage_id = v_id)
  where id = v_id;
  return v_id;
end;
$$;

create or replace function app.save_stock_adjustment(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := nullif(payload ->> 'id', '')::uuid;
  v_restaurant uuid := (payload ->> 'restaurant_id')::uuid;
  v_status text;
  v_item jsonb;
  v_i int := 0;
  v_current numeric; v_adj numeric; v_new numeric; v_cost numeric;
begin
  if v_restaurant is null then raise exception 'Select a location'; end if;
  if not app.has_restaurant_access(v_restaurant) then raise exception 'Not authorized for this location'; end if;

  if v_id is not null then
    select status into v_status from stock_adjustments where id = v_id for update;
    if v_status is null then raise exception 'Stock adjustment not found'; end if;
    if v_status != 'draft' then raise exception 'Only draft adjustments can be edited'; end if;
    update stock_adjustments set restaurant_id = v_restaurant,
      adjustment_date = coalesce(nullif(payload ->> 'doc_date', '')::date, current_date),
      notes = nullif(payload ->> 'notes', ''), updated_at = now()
    where id = v_id;
    delete from stock_adjustment_items where adjustment_id = v_id;
  else
    insert into stock_adjustments (adjustment_number, restaurant_id, adjustment_date, notes, created_by)
    values (app.next_document_number('ADJ'), v_restaurant, coalesce(nullif(payload ->> 'doc_date', '')::date, current_date),
      nullif(payload ->> 'notes', ''), auth.uid())
    returning id into v_id;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'items', '[]'::jsonb)) loop
    v_i := v_i + 1;
    select coalesce(quantity_on_hand, 0) into v_current from stock_balances
    where restaurant_id = v_restaurant and product_id = (v_item ->> 'product_id')::uuid;
    v_current := coalesce(v_current, 0);
    -- A counted "new stock" wins; otherwise the +/- adjustment is used.
    if nullif(v_item ->> 'new_stock', '') is not null then
      v_new := (v_item ->> 'new_stock')::numeric;
      v_adj := v_new - v_current;
    else
      v_adj := coalesce((v_item ->> 'adjustment_quantity')::numeric, 0);
      v_new := v_current + v_adj;
    end if;
    v_cost := coalesce(nullif(v_item ->> 'unit_cost', '')::numeric, app.current_avg_cost(v_restaurant, (v_item ->> 'product_id')::uuid));
    insert into stock_adjustment_items (adjustment_id, product_id, unit_id, unit_cost, current_stock, adjustment_quantity,
      new_stock, adjustment_value, notes, sort_order)
    values (v_id, (v_item ->> 'product_id')::uuid, (v_item ->> 'unit_id')::uuid, v_cost, v_current, v_adj, v_new,
      round(v_adj * v_cost, 2), nullif(v_item ->> 'remarks', ''), v_i);
  end loop;
  if v_i = 0 then raise exception 'Add at least one item'; end if;

  update stock_adjustments set total_value = (select coalesce(sum(adjustment_value), 0) from stock_adjustment_items where adjustment_id = v_id)
  where id = v_id;
  return v_id;
end;
$$;

create or replace function app.save_stock_request(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := nullif(payload ->> 'id', '')::uuid;
  v_from uuid := nullif(payload ->> 'from_restaurant_id', '')::uuid;
  v_to uuid := nullif(payload ->> 'to_restaurant_id', '')::uuid;
  v_status text;
  v_item jsonb;
  v_i int := 0;
  v_qty numeric; v_cost numeric;
begin
  if v_from is null or v_to is null then raise exception 'Select both From and To locations'; end if;
  if v_from = v_to then raise exception 'From and To locations must be different'; end if;
  if not (app.has_restaurant_access(v_from) or app.has_restaurant_access(v_to)) then
    raise exception 'Not authorized for these locations';
  end if;

  if v_id is not null then
    select status into v_status from stock_requests where id = v_id for update;
    if v_status is null then raise exception 'Stock request not found'; end if;
    if v_status != 'open' then raise exception 'Only open requests can be edited'; end if;
    update stock_requests set from_restaurant_id = v_from, to_restaurant_id = v_to,
      request_date = coalesce(nullif(payload ->> 'doc_date', '')::date, current_date),
      notes = nullif(payload ->> 'notes', ''), updated_at = now()
    where id = v_id;
    delete from stock_request_items where request_id = v_id;
  else
    insert into stock_requests (request_number, from_restaurant_id, to_restaurant_id, request_date, notes, created_by)
    values (app.next_document_number('SRQ'), v_from, v_to, coalesce(nullif(payload ->> 'doc_date', '')::date, current_date),
      nullif(payload ->> 'notes', ''), auth.uid())
    returning id into v_id;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'items', '[]'::jsonb)) loop
    v_i := v_i + 1;
    v_qty := coalesce((v_item ->> 'quantity')::numeric, 0);
    if v_qty <= 0 then raise exception 'Line %: quantity must be more than 0', v_i; end if;
    v_cost := app.current_avg_cost(v_from, (v_item ->> 'product_id')::uuid);
    insert into stock_request_items (request_id, product_id, unit_id, quantity, unit_cost, remarks, sort_order)
    values (v_id, (v_item ->> 'product_id')::uuid, (v_item ->> 'unit_id')::uuid, v_qty, v_cost, nullif(v_item ->> 'remarks', ''), v_i);
  end loop;
  if v_i = 0 then raise exception 'Add at least one item'; end if;

  update stock_requests set total_cost = (select coalesce(sum(round(quantity * unit_cost, 2)), 0) from stock_request_items where request_id = v_id)
  where id = v_id;
  return v_id;
end;
$$;

create or replace function app.save_stock_transfer(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := nullif(payload ->> 'id', '')::uuid;
  v_from uuid := nullif(payload ->> 'from_restaurant_id', '')::uuid;
  v_to uuid := nullif(payload ->> 'to_restaurant_id', '')::uuid;
  v_status text;
  v_item jsonb;
  v_i int := 0;
  v_qty numeric; v_cost numeric;
begin
  if v_from is null or v_to is null then raise exception 'Select both From and To locations'; end if;
  if v_from = v_to then raise exception 'From and To locations must be different'; end if;
  if not app.has_restaurant_access(v_from) then raise exception 'Not authorized for the source location'; end if;

  if v_id is not null then
    select status::text into v_status from branch_transfers where id = v_id for update;
    if v_status is null then raise exception 'Transfer not found'; end if;
    if v_status != 'draft' then raise exception 'Only draft transfers can be edited'; end if;
    update branch_transfers set from_restaurant_id = v_from, to_restaurant_id = v_to,
      dispatch_date = coalesce(nullif(payload ->> 'doc_date', '')::date, current_date),
      notes = nullif(payload ->> 'notes', '')
    where id = v_id;
    delete from branch_transfer_items where branch_transfer_id = v_id;
  else
    insert into branch_transfers (transfer_number, from_restaurant_id, to_restaurant_id, status, dispatch_date, notes,
      stock_request_id, created_by)
    values (app.next_document_number('TRF'), v_from, v_to, 'draft'::text::transfer_status,
      coalesce(nullif(payload ->> 'doc_date', '')::date, current_date), nullif(payload ->> 'notes', ''),
      nullif(payload ->> 'stock_request_id', '')::uuid, auth.uid())
    returning id into v_id;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'items', '[]'::jsonb)) loop
    v_i := v_i + 1;
    v_qty := coalesce((v_item ->> 'quantity')::numeric, 0);
    if v_qty <= 0 then raise exception 'Line %: quantity must be more than 0', v_i; end if;
    v_cost := app.current_avg_cost(v_from, (v_item ->> 'product_id')::uuid);
    insert into branch_transfer_items (branch_transfer_id, product_id, unit_id, quantity, unit_cost, remarks, sort_order)
    values (v_id, (v_item ->> 'product_id')::uuid, (v_item ->> 'unit_id')::uuid, v_qty, round(v_cost, 2), nullif(v_item ->> 'remarks', ''), v_i);
  end loop;
  if v_i = 0 then raise exception 'Add at least one item'; end if;

  update branch_transfers set total_cost = (select coalesce(sum(round(quantity * unit_cost, 2)), 0) from branch_transfer_items where branch_transfer_id = v_id)
  where id = v_id;
  return v_id;
end;
$$;

-- p_kind: purchase_return | wastage | adjustment | request | transfer
create or replace function public.save_stock_document(p_kind text, payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind != 'purchase_return' and not app.has_permission('inventory.manage') then
    raise exception 'Not authorized to manage inventory';
  end if;
  return case p_kind
    when 'purchase_return' then app.save_purchase_return(payload)
    when 'wastage' then app.save_wastage(payload)
    when 'adjustment' then app.save_stock_adjustment(payload)
    when 'request' then app.save_stock_request(payload)
    when 'transfer' then app.save_stock_transfer(payload)
  end;
end;
$$;
grant execute on function public.save_stock_document(text, jsonb) to authenticated;

-- === Posting ==================================================================
create or replace function public.post_stock_document(p_kind text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_date date;
  v_number text;
  v_status text;
  v_item record;
  v_cost numeric;
  v_total numeric := 0;
  v_in numeric := 0;
  v_out numeric := 0;
  v_live numeric;
  v_pr purchase_returns%rowtype;
begin
  if p_kind = 'purchase_return' then
    select * into v_pr from purchase_returns where id = p_id for update;
    if v_pr.id is null then raise exception 'Purchase return not found'; end if;
    if not app.has_restaurant_access(v_pr.restaurant_id) then raise exception 'Not authorized for this location'; end if;
    if not app.has_permission('purchases.post') then raise exception 'Not authorized to post purchase returns'; end if;
    if v_pr.status != 'draft' then raise exception 'This return is already %', v_pr.status; end if;
    perform app.assert_period_open(v_pr.restaurant_id, v_pr.return_date);

    for v_item in select * from purchase_return_items where purchase_return_id = p_id order by sort_order loop
      perform app.stock_out(v_pr.restaurant_id, v_item.product_id, v_item.quantity + v_item.foc_quantity,
        'purchase_return', 'purchase_return', p_id, v_pr.return_date, true, v_item.unit_price);
    end loop;

    perform app.post_simple_journal(v_pr.restaurant_id, v_pr.return_date, 'purchase_return', p_id,
      'Purchase return ' || v_pr.return_number, '2000', '1200', v_pr.total_amount);

    if v_pr.total_amount > 0 then
      insert into supplier_credit_notes (credit_note_number, supplier_id, restaurant_id, purchase_return_id, amount, issue_date, notes, created_by)
      values (coalesce(v_pr.invoice_number, v_pr.return_number), v_pr.supplier_id, v_pr.restaurant_id, p_id,
        v_pr.total_amount, v_pr.return_date, 'Purchase return ' || v_pr.return_number, auth.uid());
    end if;

    update purchase_returns set status = 'posted', posted_by = auth.uid(), posted_at = now() where id = p_id;
    v_restaurant := v_pr.restaurant_id;

  elsif p_kind = 'wastage' then
    if not app.has_permission('inventory.manage') then raise exception 'Not authorized to manage inventory'; end if;
    select restaurant_id, wastage_date, wastage_number, status into v_restaurant, v_date, v_number, v_status
    from stock_wastages where id = p_id for update;
    if v_restaurant is null then raise exception 'Wastage not found'; end if;
    if not app.has_restaurant_access(v_restaurant) then raise exception 'Not authorized for this location'; end if;
    if v_status != 'draft' then raise exception 'This wastage is already %', v_status; end if;
    perform app.assert_period_open(v_restaurant, v_date);

    for v_item in select * from stock_wastage_items where wastage_id = p_id order by sort_order loop
      v_cost := app.stock_out(v_restaurant, v_item.product_id, v_item.quantity, 'wastage', 'wastage', p_id, v_date, true);
      if v_cost = 0 then v_cost := v_item.unit_cost; end if;
      update stock_wastage_items set unit_cost = v_cost, amount = round(quantity * v_cost, 2) where id = v_item.id;
      v_total := v_total + round(v_item.quantity * v_cost, 2);
    end loop;

    update stock_wastages set status = 'posted', posted_by = auth.uid(), posted_at = now(), total_amount = v_total, updated_at = now()
    where id = p_id;
    perform app.post_simple_journal(v_restaurant, v_date, 'wastage', p_id, 'Wastage ' || v_number, '5050', '1200', v_total);

  elsif p_kind = 'adjustment' then
    if not app.has_permission('inventory.manage') then raise exception 'Not authorized to manage inventory'; end if;
    select restaurant_id, adjustment_date, adjustment_number, status into v_restaurant, v_date, v_number, v_status
    from stock_adjustments where id = p_id for update;
    if v_restaurant is null then raise exception 'Stock adjustment not found'; end if;
    if not app.has_restaurant_access(v_restaurant) then raise exception 'Not authorized for this location'; end if;
    if v_status != 'draft' then raise exception 'This adjustment is already %', v_status; end if;
    perform app.assert_period_open(v_restaurant, v_date);

    for v_item in select * from stock_adjustment_items where adjustment_id = p_id order by sort_order loop
      -- The counted new stock is what the shelf holds now, so re-base the
      -- difference on the live balance at posting time.
      select coalesce(quantity_on_hand, 0) into v_live from stock_balances
      where restaurant_id = v_restaurant and product_id = v_item.product_id;
      v_live := coalesce(v_live, 0);
      update stock_adjustment_items set current_stock = v_live, adjustment_quantity = new_stock - v_live,
        adjustment_value = round((new_stock - v_live) * unit_cost, 2)
      where id = v_item.id;

      if v_item.new_stock - v_live > 0 then
        perform app.stock_in(v_restaurant, v_item.product_id, v_item.new_stock - v_live, v_item.unit_cost,
          'adjustment_in', 'stock_adjustment', p_id, v_date);
        v_in := v_in + round((v_item.new_stock - v_live) * v_item.unit_cost, 2);
      elsif v_item.new_stock - v_live < 0 then
        v_cost := app.stock_out(v_restaurant, v_item.product_id, v_live - v_item.new_stock, 'adjustment_out',
          'stock_adjustment', p_id, v_date, false);
        v_out := v_out + round((v_live - v_item.new_stock) * v_cost, 2);
      end if;
    end loop;

    update stock_adjustments set status = 'posted', posted_by = auth.uid(), posted_at = now(), updated_at = now(),
      total_value = (select coalesce(sum(adjustment_value), 0) from stock_adjustment_items where adjustment_id = p_id)
    where id = p_id;
    if v_in > v_out then
      perform app.post_simple_journal(v_restaurant, v_date, 'adjustment', p_id, 'Stock adjustment ' || v_number, '1200', '5060', v_in - v_out);
    elsif v_out > v_in then
      perform app.post_simple_journal(v_restaurant, v_date, 'adjustment', p_id, 'Stock adjustment ' || v_number, '5060', '1200', v_out - v_in);
    end if;

  elsif p_kind = 'request' then
    if not app.has_permission('inventory.manage') then raise exception 'Not authorized to manage inventory'; end if;
    select to_restaurant_id, status into v_restaurant, v_status from stock_requests where id = p_id for update;
    if v_restaurant is null then raise exception 'Stock request not found'; end if;
    if not (app.has_restaurant_access(v_restaurant)
            or app.has_restaurant_access((select from_restaurant_id from stock_requests where id = p_id))) then
      raise exception 'Not authorized for these locations';
    end if;
    if v_status != 'open' then raise exception 'This request is already %', v_status; end if;
    update stock_requests set status = 'posted', posted_by = auth.uid(), posted_at = now(), updated_at = now() where id = p_id;

  elsif p_kind = 'transfer' then
    if not app.has_permission('inventory.manage') then raise exception 'Not authorized to manage inventory'; end if;
    select from_restaurant_id, dispatch_date, transfer_number, status::text into v_restaurant, v_date, v_number, v_status
    from branch_transfers where id = p_id for update;
    if v_restaurant is null then raise exception 'Transfer not found'; end if;
    if not app.has_restaurant_access(v_restaurant) then raise exception 'Not authorized for the source location'; end if;
    if v_status != 'draft' then raise exception 'This transfer is already %', v_status; end if;

    for v_item in select * from branch_transfer_items where branch_transfer_id = p_id order by sort_order loop
      v_cost := app.stock_out(v_restaurant, v_item.product_id, v_item.quantity, 'transfer_out', 'branch_transfer', p_id, v_date, true);
      update branch_transfer_items set unit_cost = round(v_cost, 2) where id = v_item.id;
    end loop;

    update branch_transfers set status = 'dispatched', dispatched_by = auth.uid(),
      total_cost = (select coalesce(sum(round(quantity * unit_cost, 2)), 0) from branch_transfer_items where branch_transfer_id = p_id)
    where id = p_id;
    update stock_requests set status = 'fulfilled', updated_at = now()
    where id = (select stock_request_id from branch_transfers where id = p_id) and status in ('open', 'posted');
  else
    raise exception 'Unknown document type %', p_kind;
  end if;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (auth.uid(), 'post', 'inventory', p_kind, p_id, '{}'::jsonb);
end;
$$;
grant execute on function public.post_stock_document(text, uuid) to authenticated;

-- Drafts (and open requests) can be deleted; posted documents cannot.
create or replace function public.delete_stock_document(p_kind text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_status text;
begin
  if p_kind = 'purchase_return' then
    select restaurant_id, status into v_restaurant, v_status from purchase_returns where id = p_id;
    if not app.has_permission('purchases.create') then raise exception 'Not authorized'; end if;
  elsif p_kind = 'wastage' then
    select restaurant_id, status into v_restaurant, v_status from stock_wastages where id = p_id;
  elsif p_kind = 'adjustment' then
    select restaurant_id, status into v_restaurant, v_status from stock_adjustments where id = p_id;
  elsif p_kind = 'request' then
    select to_restaurant_id, case when status = 'open' then 'draft' else status end into v_restaurant, v_status from stock_requests where id = p_id;
  elsif p_kind = 'transfer' then
    select from_restaurant_id, status::text into v_restaurant, v_status from branch_transfers where id = p_id;
  end if;
  if v_restaurant is null then raise exception 'Document not found'; end if;
  if p_kind != 'purchase_return' and not app.has_permission('inventory.manage') then raise exception 'Not authorized'; end if;
  if not app.has_restaurant_access(v_restaurant) then raise exception 'Not authorized for this location'; end if;
  if v_status != 'draft' then raise exception 'Only unposted documents can be deleted'; end if;

  case p_kind
    when 'purchase_return' then delete from purchase_returns where id = p_id;
    when 'wastage' then delete from stock_wastages where id = p_id;
    when 'adjustment' then delete from stock_adjustments where id = p_id;
    when 'request' then delete from stock_requests where id = p_id;
    when 'transfer' then delete from branch_transfers where id = p_id;
  end case;
end;
$$;
grant execute on function public.delete_stock_document(text, uuid) to authenticated;

-- Supplying location turns a posted request into a draft transfer.
create or replace function public.create_transfer_from_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req stock_requests%rowtype;
  v_id uuid;
begin
  select * into v_req from stock_requests where id = p_request_id for update;
  if v_req.id is null then raise exception 'Stock request not found'; end if;
  if v_req.status not in ('open', 'posted') then raise exception 'This request is already %', v_req.status; end if;
  if v_req.branch_transfer_id is not null then return v_req.branch_transfer_id; end if;
  if not app.has_permission('inventory.manage') then raise exception 'Not authorized to manage inventory'; end if;

  v_id := app.save_stock_transfer(jsonb_build_object(
    'from_restaurant_id', v_req.from_restaurant_id,
    'to_restaurant_id', v_req.to_restaurant_id,
    'doc_date', current_date,
    'notes', coalesce(v_req.notes, 'From request ' || v_req.request_number),
    'stock_request_id', v_req.id,
    'items', (select jsonb_agg(jsonb_build_object('product_id', product_id, 'unit_id', unit_id, 'quantity', quantity, 'remarks', remarks) order by sort_order)
              from stock_request_items where request_id = p_request_id)
  ));
  update stock_requests set branch_transfer_id = v_id, updated_at = now() where id = p_request_id;
  return v_id;
end;
$$;
grant execute on function public.create_transfer_from_request(uuid) to authenticated;

create or replace function public.reject_stock_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from uuid;
  v_status text;
begin
  select from_restaurant_id, status into v_from, v_status from stock_requests where id = p_request_id for update;
  if v_from is null then raise exception 'Stock request not found'; end if;
  if not (app.has_permission('inventory.manage') and app.has_restaurant_access(v_from)) then
    raise exception 'Only the supplying location can reject a request';
  end if;
  if v_status not in ('open', 'posted') then raise exception 'This request is already %', v_status; end if;
  update stock_requests set status = 'rejected', updated_at = now() where id = p_request_id;
end;
$$;
grant execute on function public.reject_stock_request(uuid) to authenticated;

-- === Reading ==================================================================
drop function if exists public.list_stock_documents(text, uuid, text, boolean, int, int);
create function public.list_stock_documents(
  p_kind text, p_restaurant_id uuid default null, p_search text default null,
  p_unposted_only boolean default false, p_limit int default 50, p_offset int default 0
)
returns table (
  id uuid, doc_number text, doc_date date, location_name text, counterparty text, narration text,
  status text, total_amount numeric, item_count bigint, total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with docs as (
    select r.id, r.return_number as doc_number, r.return_date as doc_date, rs.name as location_name, s.name as counterparty,
      coalesce(r.invoice_number, r.reason) as narration, r.status, r.total_amount,
      (select count(*) from purchase_return_items i where i.purchase_return_id = r.id) as item_count,
      r.restaurant_id as loc_a, r.restaurant_id as loc_b, r.created_at
    from purchase_returns r join restaurants rs on rs.id = r.restaurant_id left join suppliers s on s.id = r.supplier_id
    where p_kind = 'purchase_return'
    union all
    select w.id, w.wastage_number, w.wastage_date, rs.name, case w.item_kind when 'food_product' then 'Food product' else 'Material' end,
      w.notes, w.status, w.total_amount, (select count(*) from stock_wastage_items i where i.wastage_id = w.id),
      w.restaurant_id, w.restaurant_id, w.created_at
    from stock_wastages w join restaurants rs on rs.id = w.restaurant_id
    where p_kind = 'wastage'
    union all
    select a.id, a.adjustment_number, a.adjustment_date, rs.name, null, a.notes, a.status, a.total_value,
      (select count(*) from stock_adjustment_items i where i.adjustment_id = a.id), a.restaurant_id, a.restaurant_id, a.created_at
    from stock_adjustments a join restaurants rs on rs.id = a.restaurant_id
    where p_kind = 'adjustment'
    union all
    select q.id, q.request_number, q.request_date, fr.name, tr.name, q.notes, q.status, q.total_cost,
      (select count(*) from stock_request_items i where i.request_id = q.id), q.from_restaurant_id, q.to_restaurant_id, q.created_at
    from stock_requests q join restaurants fr on fr.id = q.from_restaurant_id join restaurants tr on tr.id = q.to_restaurant_id
    where p_kind = 'request'
    union all
    select t.id, t.transfer_number, t.dispatch_date, fr.name, tr.name, t.notes, t.status::text, t.total_cost,
      (select count(*) from branch_transfer_items i where i.branch_transfer_id = t.id), t.from_restaurant_id, t.to_restaurant_id, t.created_at
    from branch_transfers t join restaurants fr on fr.id = t.from_restaurant_id join restaurants tr on tr.id = t.to_restaurant_id
    where p_kind = 'transfer'
  )
  select d.id, d.doc_number, d.doc_date, d.location_name, d.counterparty, d.narration, d.status, d.total_amount, d.item_count,
    count(*) over ()
  from docs d
  where (app.has_restaurant_access(d.loc_a) or app.has_restaurant_access(d.loc_b))
    and (p_restaurant_id is null or d.loc_a = p_restaurant_id or d.loc_b = p_restaurant_id)
    and (not p_unposted_only or d.status in ('draft', 'open'))
    and (p_search is null or p_search = ''
         or d.doc_number ilike '%' || p_search || '%'
         or d.location_name ilike '%' || p_search || '%'
         or coalesce(d.counterparty, '') ilike '%' || p_search || '%'
         or coalesce(d.narration, '') ilike '%' || p_search || '%')
  order by d.doc_date desc, d.created_at desc
  limit p_limit offset p_offset;
$$;
grant execute on function public.list_stock_documents(text, uuid, text, boolean, int, int) to authenticated;

-- One document as { header: {...}, items: [...] } in the shape the form uses.
create or replace function public.get_stock_document(p_kind text, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_header jsonb;
  v_items jsonb;
  v_loc_a uuid;
  v_loc_b uuid;
begin
  if p_kind = 'purchase_return' then
    select to_jsonb(r) || jsonb_build_object('doc_number', r.return_number, 'doc_date', r.return_date, 'notes', r.reason,
        'location_name', rs.name, 'supplier_name', s.name, 'supplier_trn', s.trn),
      r.restaurant_id, r.restaurant_id
    into v_header, v_loc_a, v_loc_b
    from purchase_returns r join restaurants rs on rs.id = r.restaurant_id left join suppliers s on s.id = r.supplier_id
    where r.id = p_id;
    select coalesce(jsonb_agg(jsonb_build_object(
      'product_id', i.product_id, 'unit_id', i.unit_id, 'quantity', i.quantity, 'foc_quantity', i.foc_quantity,
      'unit_cost', i.unit_price, 'tax_percent', i.tax_percent, 'discount_amount', i.discount_amount,
      'tax_amount', i.tax_amount, 'amount', i.line_total, 'current_cost', i.current_cost
    ) || jsonb_build_object('product_name', p.name, 'sku', p.sku, 'barcode', p.barcode, 'unit_code', u.code, 'pack_size', p.pack_size,
      'current_stock', coalesce(sb.quantity_on_hand, 0)) order by i.sort_order), '[]'::jsonb)
    into v_items
    from purchase_return_items i join products p on p.id = i.product_id join units u on u.id = i.unit_id
    left join stock_balances sb on sb.restaurant_id = v_loc_a and sb.product_id = i.product_id
    where i.purchase_return_id = p_id;

  elsif p_kind = 'wastage' then
    select to_jsonb(w) || jsonb_build_object('doc_number', w.wastage_number, 'doc_date', w.wastage_date, 'location_name', rs.name),
      w.restaurant_id, w.restaurant_id
    into v_header, v_loc_a, v_loc_b
    from stock_wastages w join restaurants rs on rs.id = w.restaurant_id where w.id = p_id;
    select coalesce(jsonb_agg(jsonb_build_object(
      'product_id', i.product_id, 'unit_id', i.unit_id, 'quantity', i.quantity, 'unit_cost', i.unit_cost,
      'amount', i.amount, 'remarks', i.remarks, 'product_name', p.name, 'sku', p.sku, 'barcode', p.barcode,
      'unit_code', u.code, 'pack_size', p.pack_size, 'current_stock', coalesce(sb.quantity_on_hand, 0)
    ) order by i.sort_order), '[]'::jsonb)
    into v_items
    from stock_wastage_items i join products p on p.id = i.product_id join units u on u.id = i.unit_id
    left join stock_balances sb on sb.restaurant_id = v_loc_a and sb.product_id = i.product_id
    where i.wastage_id = p_id;

  elsif p_kind = 'adjustment' then
    select to_jsonb(a) || jsonb_build_object('doc_number', a.adjustment_number, 'doc_date', a.adjustment_date, 'location_name', rs.name),
      a.restaurant_id, a.restaurant_id
    into v_header, v_loc_a, v_loc_b
    from stock_adjustments a join restaurants rs on rs.id = a.restaurant_id where a.id = p_id;
    select coalesce(jsonb_agg(jsonb_build_object(
      'product_id', i.product_id, 'unit_id', i.unit_id, 'unit_cost', i.unit_cost,
      'current_stock', case when a.status = 'draft' then coalesce(sb.quantity_on_hand, 0) else i.current_stock end,
      'adjustment_quantity', i.adjustment_quantity, 'new_stock', i.new_stock, 'amount', i.adjustment_value,
      'remarks', i.notes, 'product_name', p.name, 'sku', p.sku, 'barcode', p.barcode, 'unit_code', u.code, 'pack_size', p.pack_size
    ) order by i.sort_order), '[]'::jsonb)
    into v_items
    from stock_adjustment_items i join stock_adjustments a on a.id = i.adjustment_id
    join products p on p.id = i.product_id join units u on u.id = i.unit_id
    left join stock_balances sb on sb.restaurant_id = v_loc_a and sb.product_id = i.product_id
    where i.adjustment_id = p_id;

  elsif p_kind = 'request' then
    select to_jsonb(q) || jsonb_build_object('doc_number', q.request_number, 'doc_date', q.request_date,
        'from_name', fr.name, 'to_name', tr.name,
        'transfer_number', (select transfer_number from branch_transfers where id = q.branch_transfer_id)),
      q.from_restaurant_id, q.to_restaurant_id
    into v_header, v_loc_a, v_loc_b
    from stock_requests q join restaurants fr on fr.id = q.from_restaurant_id join restaurants tr on tr.id = q.to_restaurant_id
    where q.id = p_id;
    select coalesce(jsonb_agg(jsonb_build_object(
      'product_id', i.product_id, 'unit_id', i.unit_id, 'quantity', i.quantity, 'unit_cost', i.unit_cost,
      'amount', round(i.quantity * i.unit_cost, 2), 'remarks', i.remarks, 'product_name', p.name, 'sku', p.sku,
      'barcode', p.barcode, 'unit_code', u.code, 'pack_size', p.pack_size, 'current_stock', coalesce(sb.quantity_on_hand, 0)
    ) order by i.sort_order), '[]'::jsonb)
    into v_items
    from stock_request_items i join products p on p.id = i.product_id join units u on u.id = i.unit_id
    left join stock_balances sb on sb.restaurant_id = v_loc_b and sb.product_id = i.product_id
    where i.request_id = p_id;

  elsif p_kind = 'transfer' then
    select to_jsonb(t) || jsonb_build_object('doc_number', t.transfer_number, 'doc_date', t.dispatch_date,
        'from_name', fr.name, 'to_name', tr.name,
        'request_number', (select request_number from stock_requests where id = t.stock_request_id)),
      t.from_restaurant_id, t.to_restaurant_id
    into v_header, v_loc_a, v_loc_b
    from branch_transfers t join restaurants fr on fr.id = t.from_restaurant_id join restaurants tr on tr.id = t.to_restaurant_id
    where t.id = p_id;
    select coalesce(jsonb_agg(jsonb_build_object(
      'product_id', i.product_id, 'unit_id', i.unit_id, 'quantity', i.quantity, 'unit_cost', i.unit_cost,
      'amount', round(i.quantity * i.unit_cost, 2), 'remarks', i.remarks, 'product_name', p.name, 'sku', p.sku,
      'barcode', p.barcode, 'unit_code', u.code, 'pack_size', p.pack_size, 'current_stock', coalesce(sb.quantity_on_hand, 0)
    ) order by i.sort_order), '[]'::jsonb)
    into v_items
    from branch_transfer_items i join products p on p.id = i.product_id join units u on u.id = i.unit_id
    left join stock_balances sb on sb.restaurant_id = v_loc_a and sb.product_id = i.product_id
    where i.branch_transfer_id = p_id;
  end if;

  if v_header is null then raise exception 'Document not found'; end if;
  if not (app.has_restaurant_access(v_loc_a) or app.has_restaurant_access(v_loc_b)) then
    raise exception 'Not authorized for this document';
  end if;
  return jsonb_build_object('header', v_header, 'items', v_items);
end;
$$;
grant execute on function public.get_stock_document(text, uuid) to authenticated;
