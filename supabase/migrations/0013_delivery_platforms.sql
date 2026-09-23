-- Extensible: Talabat is a row here, not a hardcoded concept, so another
-- platform can be added later without a schema change.
create table delivery_platforms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  integration_status integration_status not null default 'pending_configuration',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table delivery_sales (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  delivery_platform_id uuid not null references delivery_platforms(id),
  business_date date not null,
  gross_sales numeric(14,2) not null default 0,
  commission_amount numeric(14,2) not null default 0,
  other_deductions numeric(14,2) not null default 0,
  refund_amount numeric(14,2) not null default 0,
  expected_payout numeric(14,2) not null default 0,
  source text not null default 'manual' check (source in ('manual', 'ai_scan', 'import')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, delivery_platform_id, business_date)
);
create trigger set_updated_at before update on delivery_sales
  for each row execute function app.set_updated_at();
create index delivery_sales_restaurant_idx on delivery_sales(restaurant_id, business_date);

create table delivery_settlements (
  id uuid primary key default gen_random_uuid(),
  delivery_platform_id uuid not null references delivery_platforms(id),
  restaurant_id uuid not null references restaurants(id),
  bank_account_id uuid references bank_accounts(id),
  credit_date date not null,
  bank_reference text,
  amount numeric(14,2) not null check (amount > 0),
  covers_from date not null,
  covers_to date not null,
  status delivery_settlement_status not null default 'unmatched',
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on delivery_settlements
  for each row execute function app.set_updated_at();
create index delivery_settlements_restaurant_idx on delivery_settlements(restaurant_id, credit_date);

alter table delivery_platforms enable row level security;
alter table delivery_sales enable row level security;
alter table delivery_settlements enable row level security;

create policy delivery_platforms_select on delivery_platforms for select using (auth.uid() is not null);
create policy delivery_platforms_write on delivery_platforms for all
  using (app.has_permission('settlements.manage')) with check (app.has_permission('settlements.manage'));

create policy delivery_sales_select on delivery_sales for select
  using (app.has_restaurant_access(restaurant_id));
create policy delivery_sales_write on delivery_sales for all
  using (app.has_restaurant_access(restaurant_id) and app.has_permission('sales.create'))
  with check (app.has_restaurant_access(restaurant_id) and app.has_permission('sales.create'));

create policy delivery_settlements_select on delivery_settlements for select
  using (app.has_restaurant_access(restaurant_id) and app.has_permission('settlements.view'));
create policy delivery_settlements_write on delivery_settlements for all
  using (app.has_restaurant_access(restaurant_id) and app.has_permission('settlements.manage'))
  with check (app.has_restaurant_access(restaurant_id) and app.has_permission('settlements.manage'));
