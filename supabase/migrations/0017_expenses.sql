create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_head_office_only boolean not null default false,
  is_active boolean not null default true
);

create table operating_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_number text not null unique,
  restaurant_id uuid not null references restaurants(id),
  expense_category_id uuid not null references expense_categories(id),
  amount numeric(14,2) not null check (amount > 0),
  expense_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'posted', 'rejected', 'cancelled')),
  payment_voucher_id uuid references payment_vouchers(id),
  notes text,
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on operating_expenses
  for each row execute function app.set_updated_at();
create index operating_expenses_restaurant_idx on operating_expenses(restaurant_id, status);
create index operating_expenses_category_idx on operating_expenses(expense_category_id);

-- Splits one head-office expense across restaurants (spec §32).
create table expense_allocations (
  id uuid primary key default gen_random_uuid(),
  operating_expense_id uuid not null references operating_expenses(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id),
  amount numeric(14,2) not null check (amount > 0)
);
create index expense_allocations_expense_idx on expense_allocations(operating_expense_id);
create index expense_allocations_restaurant_idx on expense_allocations(restaurant_id);

alter table expense_categories enable row level security;
alter table operating_expenses enable row level security;
alter table expense_allocations enable row level security;

create policy expense_categories_select on expense_categories for select using (auth.uid() is not null);
create policy expense_categories_write on expense_categories for all
  using (app.has_permission('expenses.manage')) with check (app.has_permission('expenses.manage'));

create policy operating_expenses_select on operating_expenses for select
  using (app.has_restaurant_access(restaurant_id));
create policy operating_expenses_write on operating_expenses for all
  using (app.has_restaurant_access(restaurant_id) and app.has_permission('expenses.manage'))
  with check (app.has_restaurant_access(restaurant_id) and app.has_permission('expenses.manage'));

create policy expense_allocations_select on expense_allocations for select
  using (app.has_restaurant_access(restaurant_id));
create policy expense_allocations_write on expense_allocations for all
  using (app.has_restaurant_access(restaurant_id) and app.has_permission('expenses.manage'))
  with check (app.has_restaurant_access(restaurant_id) and app.has_permission('expenses.manage'));
