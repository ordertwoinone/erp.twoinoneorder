-- Append-only movement ledger. Every purchase receipt, sale consumption,
-- transfer leg, and adjustment is one row here — stock_balances is a
-- maintained projection, never the source of truth. See
-- docs/database-design.md §2.12.
create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  product_id uuid not null references products(id),
  movement_type text not null check (movement_type in (
    'purchase_receipt', 'sale_consumption', 'transfer_out', 'transfer_in',
    'adjustment_in', 'adjustment_out', 'opening', 'closing'
  )),
  quantity numeric(14,3) not null,
  unit_cost numeric(14,2) not null default 0,
  total_cost numeric(14,2) not null default 0,
  source_type text not null check (source_type in (
    'purchase', 'goods_receipt', 'branch_transfer', 'manual_adjustment',
    'opening_stock', 'closing_stock'
  )),
  source_id uuid,
  movement_date date not null default current_date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index stock_movements_restaurant_product_idx on stock_movements(restaurant_id, product_id, movement_date);
create index stock_movements_source_idx on stock_movements(source_type, source_id);

create table stock_balances (
  restaurant_id uuid not null references restaurants(id),
  product_id uuid not null references products(id),
  quantity_on_hand numeric(14,3) not null default 0,
  average_cost numeric(14,2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, product_id)
);

create table branch_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_number text not null unique,
  from_restaurant_id uuid not null references restaurants(id),
  to_restaurant_id uuid not null references restaurants(id),
  status transfer_status not null default 'dispatched',
  dispatch_date date not null default current_date,
  received_date date,
  dispatched_by uuid references profiles(id),
  received_by uuid references profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branch_transfers_distinct_chk check (from_restaurant_id != to_restaurant_id)
);
create trigger set_updated_at before update on branch_transfers
  for each row execute function app.set_updated_at();
create index branch_transfers_from_idx on branch_transfers(from_restaurant_id);
create index branch_transfers_to_idx on branch_transfers(to_restaurant_id);

create table branch_transfer_items (
  id uuid primary key default gen_random_uuid(),
  branch_transfer_id uuid not null references branch_transfers(id) on delete cascade,
  product_id uuid not null references products(id),
  unit_id uuid not null references units(id),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost numeric(14,2) not null check (unit_cost >= 0)
);
create index branch_transfer_items_transfer_idx on branch_transfer_items(branch_transfer_id);

create table opening_stock (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  product_id uuid not null references products(id),
  period_month date not null,
  quantity numeric(14,3) not null default 0,
  unit_cost numeric(14,2) not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (restaurant_id, product_id, period_month)
);
create index opening_stock_restaurant_period_idx on opening_stock(restaurant_id, period_month);

create table closing_stock (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  product_id uuid not null references products(id),
  period_month date not null,
  quantity numeric(14,3) not null default 0,
  unit_cost numeric(14,2) not null default 0,
  counted_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (restaurant_id, product_id, period_month)
);
create index closing_stock_restaurant_period_idx on closing_stock(restaurant_id, period_month);

alter table stock_movements enable row level security;
alter table stock_balances enable row level security;
alter table branch_transfers enable row level security;
alter table branch_transfer_items enable row level security;
alter table opening_stock enable row level security;
alter table closing_stock enable row level security;

create policy stock_movements_select on stock_movements for select
  using (app.has_restaurant_access(restaurant_id));
create policy stock_movements_write on stock_movements for all
  using (app.has_restaurant_access(restaurant_id) and app.has_permission('inventory.manage'))
  with check (app.has_restaurant_access(restaurant_id) and app.has_permission('inventory.manage'));

create policy stock_balances_select on stock_balances for select
  using (app.has_restaurant_access(restaurant_id));
create policy stock_balances_write on stock_balances for all
  using (app.has_restaurant_access(restaurant_id) and app.has_permission('inventory.manage'))
  with check (app.has_restaurant_access(restaurant_id) and app.has_permission('inventory.manage'));

create policy branch_transfers_select on branch_transfers for select
  using (app.has_restaurant_access(from_restaurant_id) or app.has_restaurant_access(to_restaurant_id));
create policy branch_transfers_write on branch_transfers for all
  using ((app.has_restaurant_access(from_restaurant_id) or app.has_restaurant_access(to_restaurant_id)) and app.has_permission('inventory.manage'))
  with check ((app.has_restaurant_access(from_restaurant_id) or app.has_restaurant_access(to_restaurant_id)) and app.has_permission('inventory.manage'));

create policy branch_transfer_items_select on branch_transfer_items for select
  using (exists (select 1 from branch_transfers t where t.id = branch_transfer_id and (app.has_restaurant_access(t.from_restaurant_id) or app.has_restaurant_access(t.to_restaurant_id))));
create policy branch_transfer_items_write on branch_transfer_items for all
  using (exists (select 1 from branch_transfers t where t.id = branch_transfer_id and (app.has_restaurant_access(t.from_restaurant_id) or app.has_restaurant_access(t.to_restaurant_id)) and app.has_permission('inventory.manage')))
  with check (exists (select 1 from branch_transfers t where t.id = branch_transfer_id and (app.has_restaurant_access(t.from_restaurant_id) or app.has_restaurant_access(t.to_restaurant_id)) and app.has_permission('inventory.manage')));

create policy opening_stock_select on opening_stock for select
  using (app.has_restaurant_access(restaurant_id));
create policy opening_stock_write on opening_stock for all
  using (app.has_restaurant_access(restaurant_id) and app.has_permission('inventory.manage'))
  with check (app.has_restaurant_access(restaurant_id) and app.has_permission('inventory.manage'));

create policy closing_stock_select on closing_stock for select
  using (app.has_restaurant_access(restaurant_id));
create policy closing_stock_write on closing_stock for all
  using (app.has_restaurant_access(restaurant_id) and app.has_permission('inventory.manage'))
  with check (app.has_restaurant_access(restaurant_id) and app.has_permission('inventory.manage'));
