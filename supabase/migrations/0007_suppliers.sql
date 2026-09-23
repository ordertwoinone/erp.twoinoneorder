create table suppliers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  trn text,
  payment_terms_days integer not null default 30,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_iban text,
  bank_swift text,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on suppliers
  for each row execute function app.set_updated_at();
create index suppliers_name_trgm_idx on suppliers using gin (name gin_trgm_ops);

create table supplier_contacts (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  name text not null,
  role text,
  phone text,
  email text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index supplier_contacts_supplier_idx on supplier_contacts(supplier_id);

create table supplier_quotations (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  quotation_number text,
  quotation_date date not null,
  valid_from date not null,
  valid_to date,
  status text not null default 'active' check (status in ('active', 'expired', 'superseded')),
  attachment_id uuid,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on supplier_quotations
  for each row execute function app.set_updated_at();
create index supplier_quotations_supplier_idx on supplier_quotations(supplier_id);

create table supplier_quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references supplier_quotations(id) on delete cascade,
  product_id uuid not null references products(id),
  unit_id uuid not null references units(id),
  pack_size numeric(12,3),
  price numeric(14,2) not null,
  created_at timestamptz not null default now()
);
create index supplier_quotation_items_quotation_idx on supplier_quotation_items(quotation_id);
create index supplier_quotation_items_product_idx on supplier_quotation_items(product_id);

-- Append-only: a price change closes the current row (valid_to) and inserts
-- a new one. See docs/database-design.md §2.3 / §4.
create table supplier_price_locks (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  product_id uuid not null references products(id),
  unit_id uuid not null references units(id),
  pack_size numeric(12,3),
  agreed_price numeric(14,2) not null,
  valid_from date not null,
  valid_to date,
  source_quotation_id uuid references supplier_quotations(id),
  is_current boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index supplier_price_locks_lookup_idx
  on supplier_price_locks(supplier_id, product_id, unit_id, is_current);
create index supplier_price_locks_current_idx
  on supplier_price_locks(supplier_id, product_id) where is_current;

-- Empty = applies to all restaurants. Explicit rows scope the lock.
create table supplier_price_lock_restaurants (
  price_lock_id uuid not null references supplier_price_locks(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  primary key (price_lock_id, restaurant_id)
);

alter table suppliers enable row level security;
alter table supplier_contacts enable row level security;
alter table supplier_quotations enable row level security;
alter table supplier_quotation_items enable row level security;
alter table supplier_price_locks enable row level security;
alter table supplier_price_lock_restaurants enable row level security;

-- Suppliers are a group-level entity: any authenticated user can see the
-- supplier record, but bank details are masked at the query layer for users
-- without suppliers.view_bank_details (application-level column selection);
-- the RLS boundary here governs row visibility and writes.
create policy suppliers_select on suppliers for select using (auth.uid() is not null);
create policy suppliers_write on suppliers for all
  using (app.has_permission('suppliers.manage')) with check (app.has_permission('suppliers.manage'));

create policy supplier_contacts_select on supplier_contacts for select using (auth.uid() is not null);
create policy supplier_contacts_write on supplier_contacts for all
  using (app.has_permission('suppliers.manage')) with check (app.has_permission('suppliers.manage'));

create policy supplier_quotations_select on supplier_quotations for select using (auth.uid() is not null);
create policy supplier_quotations_write on supplier_quotations for all
  using (app.has_permission('suppliers.manage')) with check (app.has_permission('suppliers.manage'));

create policy supplier_quotation_items_select on supplier_quotation_items for select using (auth.uid() is not null);
create policy supplier_quotation_items_write on supplier_quotation_items for all
  using (app.has_permission('suppliers.manage')) with check (app.has_permission('suppliers.manage'));

create policy supplier_price_locks_select on supplier_price_locks for select using (auth.uid() is not null);
create policy supplier_price_locks_write on supplier_price_locks for all
  using (app.has_permission('supplier_prices.manage')) with check (app.has_permission('supplier_prices.manage'));

create policy supplier_price_lock_restaurants_select on supplier_price_lock_restaurants for select using (auth.uid() is not null);
create policy supplier_price_lock_restaurants_write on supplier_price_lock_restaurants for all
  using (app.has_permission('supplier_prices.manage')) with check (app.has_permission('supplier_prices.manage'));
