create table payment_vouchers (
  id uuid primary key default gen_random_uuid(),
  voucher_number text not null unique,
  restaurant_id uuid not null references restaurants(id),
  payee_type text not null check (payee_type in ('supplier', 'expense', 'employee', 'other')),
  supplier_id uuid references suppliers(id),
  expense_category_id uuid,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('bank', 'cash')),
  bank_account_id uuid references bank_accounts(id),
  cash_account_id uuid references cash_accounts(id),
  payment_reference text,
  voucher_date date not null default current_date,
  status voucher_status not null default 'draft',
  notes text,
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_vouchers_account_chk check (
    (payment_method = 'bank' and bank_account_id is not null and cash_account_id is null)
    or (payment_method = 'cash' and cash_account_id is not null and bank_account_id is null)
  )
);
create trigger set_updated_at before update on payment_vouchers
  for each row execute function app.set_updated_at();
create index payment_vouchers_restaurant_idx on payment_vouchers(restaurant_id, status);
create index payment_vouchers_supplier_idx on payment_vouchers(supplier_id);

create table payment_voucher_items (
  id uuid primary key default gen_random_uuid(),
  payment_voucher_id uuid not null references payment_vouchers(id) on delete cascade,
  description text not null,
  amount numeric(14,2) not null check (amount > 0)
);
create index payment_voucher_items_voucher_idx on payment_voucher_items(payment_voucher_id);

-- One supplier payment can settle multiple invoices (payment_allocations)
-- or be recorded as an advance with no allocation yet.
create table supplier_payments (
  id uuid primary key default gen_random_uuid(),
  payment_voucher_id uuid not null references payment_vouchers(id),
  supplier_id uuid not null references suppliers(id),
  restaurant_id uuid not null references restaurants(id),
  amount numeric(14,2) not null check (amount > 0),
  is_advance boolean not null default false,
  payment_date date not null default current_date,
  created_at timestamptz not null default now()
);
create index supplier_payments_supplier_idx on supplier_payments(supplier_id);
create index supplier_payments_voucher_idx on supplier_payments(payment_voucher_id);

create table payment_allocations (
  id uuid primary key default gen_random_uuid(),
  supplier_payment_id uuid not null references supplier_payments(id) on delete cascade,
  purchase_id uuid not null references purchases(id),
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index payment_allocations_payment_idx on payment_allocations(supplier_payment_id);
create index payment_allocations_purchase_idx on payment_allocations(purchase_id);

alter table payment_vouchers enable row level security;
alter table payment_voucher_items enable row level security;
alter table supplier_payments enable row level security;
alter table payment_allocations enable row level security;

create policy payment_vouchers_select on payment_vouchers for select
  using (app.has_restaurant_access(restaurant_id));
create policy payment_vouchers_insert on payment_vouchers for insert
  with check (app.has_restaurant_access(restaurant_id) and app.has_permission('payments.create'));
create policy payment_vouchers_update on payment_vouchers for update
  using (app.has_restaurant_access(restaurant_id) and (
    (status = 'draft' and app.has_permission('payments.create'))
    or app.has_permission('payments.approve')
    or app.has_permission('payments.post')
  ))
  with check (app.has_restaurant_access(restaurant_id));

create policy payment_voucher_items_select on payment_voucher_items for select
  using (exists (select 1 from payment_vouchers v where v.id = payment_voucher_id and app.has_restaurant_access(v.restaurant_id)));
create policy payment_voucher_items_write on payment_voucher_items for all
  using (exists (select 1 from payment_vouchers v where v.id = payment_voucher_id and app.has_restaurant_access(v.restaurant_id) and app.has_permission('payments.create')))
  with check (exists (select 1 from payment_vouchers v where v.id = payment_voucher_id and app.has_restaurant_access(v.restaurant_id) and app.has_permission('payments.create')));

create policy supplier_payments_select on supplier_payments for select
  using (app.has_restaurant_access(restaurant_id));
create policy supplier_payments_write on supplier_payments for all
  using (app.has_restaurant_access(restaurant_id) and app.has_permission('payments.post'))
  with check (app.has_restaurant_access(restaurant_id) and app.has_permission('payments.post'));

create policy payment_allocations_select on payment_allocations for select
  using (exists (select 1 from supplier_payments sp where sp.id = supplier_payment_id and app.has_restaurant_access(sp.restaurant_id)));
create policy payment_allocations_write on payment_allocations for all
  using (exists (select 1 from supplier_payments sp where sp.id = supplier_payment_id and app.has_restaurant_access(sp.restaurant_id) and app.has_permission('payments.post')))
  with check (exists (select 1 from supplier_payments sp where sp.id = supplier_payment_id and app.has_restaurant_access(sp.restaurant_id) and app.has_permission('payments.post')));
