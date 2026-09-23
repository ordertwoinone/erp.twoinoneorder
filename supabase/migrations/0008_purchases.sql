-- === Purchase requests (branch asks head office for stock) ================
create table purchase_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  restaurant_id uuid not null references restaurants(id),
  status purchase_request_status not null default 'requested',
  notes text,
  requested_by uuid references profiles(id),
  reviewed_by uuid references profiles(id),
  requested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on purchase_requests
  for each row execute function app.set_updated_at();
create index purchase_requests_restaurant_idx on purchase_requests(restaurant_id, status);

create table purchase_request_items (
  id uuid primary key default gen_random_uuid(),
  purchase_request_id uuid not null references purchase_requests(id) on delete cascade,
  product_id uuid not null references products(id),
  unit_id uuid not null references units(id),
  quantity numeric(14,3) not null check (quantity > 0),
  notes text
);
create index purchase_request_items_request_idx on purchase_request_items(purchase_request_id);

-- === Purchase orders (head office commits to a supplier) ====================
create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  restaurant_id uuid not null references restaurants(id),
  supplier_id uuid not null references suppliers(id),
  purchase_request_id uuid references purchase_requests(id),
  status purchase_order_status not null default 'draft',
  order_date date not null default current_date,
  expected_date date,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on purchase_orders
  for each row execute function app.set_updated_at();
create index purchase_orders_restaurant_idx on purchase_orders(restaurant_id, status);
create index purchase_orders_supplier_idx on purchase_orders(supplier_id);

create table purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid not null references products(id),
  unit_id uuid not null references units(id),
  pack_size numeric(12,3),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  quantity_received numeric(14,3) not null default 0
);
create index purchase_order_items_order_idx on purchase_order_items(purchase_order_id);

-- === Purchases (the actual supplier invoice/bill) ============================
create table purchases (
  id uuid primary key default gen_random_uuid(),
  purchase_number text not null unique,
  restaurant_id uuid not null references restaurants(id),
  supplier_id uuid not null references suppliers(id),
  purchase_order_id uuid references purchase_orders(id),
  invoice_number text not null,
  invoice_date date not null,
  status purchase_status not null default 'draft',
  payment_status payment_status not null default 'unpaid',
  source text not null default 'manual' check (source in ('manual', 'ai_scan')),
  ai_scan_job_id uuid,
  subtotal_amount numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  notes text,
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on purchases
  for each row execute function app.set_updated_at();
create index purchases_restaurant_idx on purchases(restaurant_id, status);
create index purchases_supplier_idx on purchases(supplier_id);
create index purchases_invoice_idx on purchases(supplier_id, invoice_number, invoice_date);
create index purchases_status_idx on purchases(status);
create index purchases_payment_status_idx on purchases(payment_status);
-- Duplicate-invoice detection (spec §17/§18).
create unique index purchases_duplicate_guard_idx
  on purchases(supplier_id, invoice_number, restaurant_id)
  where status != 'cancelled';

create table purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  product_id uuid not null references products(id),
  unit_id uuid not null references units(id),
  pack_size numeric(12,3),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  discount_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null,
  agreed_price_at_entry numeric(14,2),
  created_at timestamptz not null default now()
);
create index purchase_items_purchase_idx on purchase_items(purchase_id);
create index purchase_items_product_idx on purchase_items(product_id);

-- === Goods receipts (what physically arrived, can be partial) ===============
create table goods_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  restaurant_id uuid not null references restaurants(id),
  purchase_order_id uuid references purchase_orders(id),
  purchase_id uuid references purchases(id),
  status goods_receipt_status not null default 'draft',
  received_date date not null default current_date,
  received_by uuid references profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on goods_receipts
  for each row execute function app.set_updated_at();
create index goods_receipts_restaurant_idx on goods_receipts(restaurant_id);

create table goods_receipt_items (
  id uuid primary key default gen_random_uuid(),
  goods_receipt_id uuid not null references goods_receipts(id) on delete cascade,
  product_id uuid not null references products(id),
  unit_id uuid not null references units(id),
  quantity_received numeric(14,3) not null check (quantity_received >= 0),
  quantity_shortage numeric(14,3) not null default 0,
  notes text
);
create index goods_receipt_items_receipt_idx on goods_receipt_items(goods_receipt_id);

-- === Purchase returns & supplier credit notes ================================
create table purchase_returns (
  id uuid primary key default gen_random_uuid(),
  return_number text not null unique,
  restaurant_id uuid not null references restaurants(id),
  purchase_id uuid not null references purchases(id),
  status text not null default 'draft' check (status in ('draft', 'posted', 'cancelled')),
  return_date date not null default current_date,
  reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on purchase_returns
  for each row execute function app.set_updated_at();
create index purchase_returns_purchase_idx on purchase_returns(purchase_id);

create table purchase_return_items (
  id uuid primary key default gen_random_uuid(),
  purchase_return_id uuid not null references purchase_returns(id) on delete cascade,
  purchase_item_id uuid references purchase_items(id),
  product_id uuid not null references products(id),
  unit_id uuid not null references units(id),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null,
  line_total numeric(14,2) not null
);
create index purchase_return_items_return_idx on purchase_return_items(purchase_return_id);

create table supplier_credit_notes (
  id uuid primary key default gen_random_uuid(),
  credit_note_number text not null,
  supplier_id uuid not null references suppliers(id),
  restaurant_id uuid not null references restaurants(id),
  purchase_return_id uuid references purchase_returns(id),
  amount numeric(14,2) not null check (amount > 0),
  issue_date date not null default current_date,
  status text not null default 'open' check (status in ('open', 'applied', 'cancelled')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on supplier_credit_notes
  for each row execute function app.set_updated_at();
create index supplier_credit_notes_supplier_idx on supplier_credit_notes(supplier_id);

-- === RLS ======================================================================
alter table purchase_requests enable row level security;
alter table purchase_request_items enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;
alter table purchases enable row level security;
alter table purchase_items enable row level security;
alter table goods_receipts enable row level security;
alter table goods_receipt_items enable row level security;
alter table purchase_returns enable row level security;
alter table purchase_return_items enable row level security;
alter table supplier_credit_notes enable row level security;

create policy purchase_requests_select on purchase_requests for select
  using (app.has_restaurant_access(restaurant_id));
create policy purchase_requests_write on purchase_requests for all
  using (app.has_restaurant_access(restaurant_id) and app.has_permission('purchases.create'))
  with check (app.has_restaurant_access(restaurant_id) and app.has_permission('purchases.create'));

create policy purchase_request_items_select on purchase_request_items for select
  using (exists (select 1 from purchase_requests pr where pr.id = purchase_request_id and app.has_restaurant_access(pr.restaurant_id)));
create policy purchase_request_items_write on purchase_request_items for all
  using (exists (select 1 from purchase_requests pr where pr.id = purchase_request_id and app.has_restaurant_access(pr.restaurant_id) and app.has_permission('purchases.create')))
  with check (exists (select 1 from purchase_requests pr where pr.id = purchase_request_id and app.has_restaurant_access(pr.restaurant_id) and app.has_permission('purchases.create')));

create policy purchase_orders_select on purchase_orders for select
  using (app.has_restaurant_access(restaurant_id));
create policy purchase_orders_write on purchase_orders for all
  using (app.has_restaurant_access(restaurant_id) and app.has_permission('purchase_orders.manage'))
  with check (app.has_restaurant_access(restaurant_id) and app.has_permission('purchase_orders.manage'));

create policy purchase_order_items_select on purchase_order_items for select
  using (exists (select 1 from purchase_orders po where po.id = purchase_order_id and app.has_restaurant_access(po.restaurant_id)));
create policy purchase_order_items_write on purchase_order_items for all
  using (exists (select 1 from purchase_orders po where po.id = purchase_order_id and app.has_restaurant_access(po.restaurant_id) and app.has_permission('purchase_orders.manage')))
  with check (exists (select 1 from purchase_orders po where po.id = purchase_order_id and app.has_restaurant_access(po.restaurant_id) and app.has_permission('purchase_orders.manage')));

create policy purchases_select on purchases for select
  using (app.has_restaurant_access(restaurant_id));
create policy purchases_insert on purchases for insert
  with check (app.has_restaurant_access(restaurant_id) and app.has_permission('purchases.create'));
create policy purchases_update on purchases for update
  using (app.has_restaurant_access(restaurant_id) and (
    (status in ('draft', 'returned') and app.has_permission('purchases.create'))
    or app.has_permission('purchases.approve')
    or app.has_permission('purchases.post')
  ))
  with check (app.has_restaurant_access(restaurant_id));

create policy purchase_items_select on purchase_items for select
  using (exists (select 1 from purchases p where p.id = purchase_id and app.has_restaurant_access(p.restaurant_id)));
create policy purchase_items_write on purchase_items for all
  using (exists (select 1 from purchases p where p.id = purchase_id and app.has_restaurant_access(p.restaurant_id) and app.has_permission('purchases.create')))
  with check (exists (select 1 from purchases p where p.id = purchase_id and app.has_restaurant_access(p.restaurant_id) and app.has_permission('purchases.create')));

create policy goods_receipts_select on goods_receipts for select
  using (app.has_restaurant_access(restaurant_id));
create policy goods_receipts_write on goods_receipts for all
  using (app.has_restaurant_access(restaurant_id) and app.has_permission('purchases.create'))
  with check (app.has_restaurant_access(restaurant_id) and app.has_permission('purchases.create'));

create policy goods_receipt_items_select on goods_receipt_items for select
  using (exists (select 1 from goods_receipts gr where gr.id = goods_receipt_id and app.has_restaurant_access(gr.restaurant_id)));
create policy goods_receipt_items_write on goods_receipt_items for all
  using (exists (select 1 from goods_receipts gr where gr.id = goods_receipt_id and app.has_restaurant_access(gr.restaurant_id) and app.has_permission('purchases.create')))
  with check (exists (select 1 from goods_receipts gr where gr.id = goods_receipt_id and app.has_restaurant_access(gr.restaurant_id) and app.has_permission('purchases.create')));

create policy purchase_returns_select on purchase_returns for select
  using (app.has_restaurant_access(restaurant_id));
create policy purchase_returns_write on purchase_returns for all
  using (app.has_restaurant_access(restaurant_id) and app.has_permission('purchases.create'))
  with check (app.has_restaurant_access(restaurant_id) and app.has_permission('purchases.create'));

create policy purchase_return_items_select on purchase_return_items for select
  using (exists (select 1 from purchase_returns pr where pr.id = purchase_return_id and app.has_restaurant_access(pr.restaurant_id)));
create policy purchase_return_items_write on purchase_return_items for all
  using (exists (select 1 from purchase_returns pr where pr.id = purchase_return_id and app.has_restaurant_access(pr.restaurant_id) and app.has_permission('purchases.create')))
  with check (exists (select 1 from purchase_returns pr where pr.id = purchase_return_id and app.has_restaurant_access(pr.restaurant_id) and app.has_permission('purchases.create')));

create policy supplier_credit_notes_select on supplier_credit_notes for select
  using (app.has_restaurant_access(restaurant_id));
create policy supplier_credit_notes_write on supplier_credit_notes for all
  using (app.has_restaurant_access(restaurant_id) and app.has_permission('purchases.create'))
  with check (app.has_restaurant_access(restaurant_id) and app.has_permission('purchases.create'));
