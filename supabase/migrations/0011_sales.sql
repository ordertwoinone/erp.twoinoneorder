create table sales_channels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true
);

create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true
);

create table sales_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  business_date date not null,
  shift text not null default 'full_day' check (shift in ('morning', 'evening', 'full_day')),
  gross_sales numeric(14,2) not null default 0,
  discounts numeric(14,2) not null default 0,
  refunds numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  net_sales numeric(14,2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'reviewed', 'posted')),
  submitted_by uuid references profiles(id),
  reviewed_by uuid references profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, business_date, shift)
);
create trigger set_updated_at before update on sales_entries
  for each row execute function app.set_updated_at();
create index sales_entries_restaurant_date_idx on sales_entries(restaurant_id, business_date);
create index sales_entries_status_idx on sales_entries(status);

-- Payment-method breakdown as child rows (cash/card/Talabat/other) rather
-- than fixed columns, so a new channel/method is a data change.
create table sales_payment_breakdowns (
  id uuid primary key default gen_random_uuid(),
  sales_entry_id uuid not null references sales_entries(id) on delete cascade,
  sales_channel_id uuid references sales_channels(id),
  payment_method_id uuid not null references payment_methods(id),
  amount numeric(14,2) not null check (amount >= 0)
);
create index sales_payment_breakdowns_entry_idx on sales_payment_breakdowns(sales_entry_id);

alter table sales_channels enable row level security;
alter table payment_methods enable row level security;
alter table sales_entries enable row level security;
alter table sales_payment_breakdowns enable row level security;

create policy sales_channels_select on sales_channels for select using (auth.uid() is not null);
create policy sales_channels_write on sales_channels for all
  using (app.has_permission('catalog.manage')) with check (app.has_permission('catalog.manage'));

create policy payment_methods_select on payment_methods for select using (auth.uid() is not null);
create policy payment_methods_write on payment_methods for all
  using (app.has_permission('catalog.manage')) with check (app.has_permission('catalog.manage'));

create policy sales_entries_select on sales_entries for select
  using (app.has_restaurant_access(restaurant_id));
create policy sales_entries_insert on sales_entries for insert
  with check (app.has_restaurant_access(restaurant_id) and app.has_permission('sales.create'));
create policy sales_entries_update on sales_entries for update
  using (app.has_restaurant_access(restaurant_id) and (
    (status in ('draft', 'submitted') and app.has_permission('sales.create'))
    or app.has_permission('sales.review')
  ))
  with check (app.has_restaurant_access(restaurant_id));

create policy sales_payment_breakdowns_select on sales_payment_breakdowns for select
  using (exists (select 1 from sales_entries se where se.id = sales_entry_id and app.has_restaurant_access(se.restaurant_id)));
create policy sales_payment_breakdowns_write on sales_payment_breakdowns for all
  using (exists (select 1 from sales_entries se where se.id = sales_entry_id and app.has_restaurant_access(se.restaurant_id) and app.has_permission('sales.create')))
  with check (exists (select 1 from sales_entries se where se.id = sales_entry_id and app.has_restaurant_access(se.restaurant_id) and app.has_permission('sales.create')));
