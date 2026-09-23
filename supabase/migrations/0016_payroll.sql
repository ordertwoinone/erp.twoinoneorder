create table salary_components (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  component_type text not null check (component_type in ('earning', 'deduction')),
  is_active boolean not null default true
);

create table salary_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  restaurant_id uuid not null references restaurants(id),
  period_month date not null,
  basic_salary numeric(14,2) not null default 0,
  allowances_total numeric(14,2) not null default 0,
  overtime_amount numeric(14,2) not null default 0,
  deductions_total numeric(14,2) not null default 0,
  advances_deducted numeric(14,2) not null default 0,
  net_salary numeric(14,2) not null default 0,
  payment_status salary_payment_status not null default 'pending',
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'posted', 'cancelled')),
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, period_month)
);
create trigger set_updated_at before update on salary_entries
  for each row execute function app.set_updated_at();
create index salary_entries_restaurant_period_idx on salary_entries(restaurant_id, period_month);

create table salary_entry_components (
  id uuid primary key default gen_random_uuid(),
  salary_entry_id uuid not null references salary_entries(id) on delete cascade,
  salary_component_id uuid not null references salary_components(id),
  amount numeric(14,2) not null
);
create index salary_entry_components_entry_idx on salary_entry_components(salary_entry_id);

create table salary_payments (
  id uuid primary key default gen_random_uuid(),
  salary_entry_id uuid not null references salary_entries(id),
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text not null check (payment_method in ('bank', 'cash')),
  bank_account_id uuid references bank_accounts(id),
  cash_account_id uuid references cash_accounts(id),
  reference text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index salary_payments_entry_idx on salary_payments(salary_entry_id);

create table employee_advances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  restaurant_id uuid not null references restaurants(id),
  amount numeric(14,2) not null check (amount > 0),
  advance_date date not null default current_date,
  balance_remaining numeric(14,2) not null,
  status text not null default 'open' check (status in ('open', 'settled', 'cancelled')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index employee_advances_employee_idx on employee_advances(employee_id);

create table employee_deductions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  salary_entry_id uuid references salary_entries(id),
  reason text not null,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index employee_deductions_employee_idx on employee_deductions(employee_id);

-- Accommodation / transport / visa / insurance / recruitment / other costs,
-- allocatable across restaurants for shared employees (spec §31).
create table manpower_costs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  restaurant_id uuid not null references restaurants(id),
  cost_type text not null check (cost_type in (
    'accommodation', 'transport', 'visa', 'insurance', 'recruitment', 'other'
  )),
  amount numeric(14,2) not null check (amount > 0),
  period_month date not null,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index manpower_costs_restaurant_period_idx on manpower_costs(restaurant_id, period_month);

alter table salary_components enable row level security;
alter table salary_entries enable row level security;
alter table salary_entry_components enable row level security;
alter table salary_payments enable row level security;
alter table employee_advances enable row level security;
alter table employee_deductions enable row level security;
alter table manpower_costs enable row level security;

create policy salary_components_select on salary_components for select using (app.has_permission('payroll.view'));
create policy salary_components_write on salary_components for all
  using (app.has_permission('payroll.manage')) with check (app.has_permission('payroll.manage'));

-- Salary visibility is a named sensitive permission (spec §8: "viewing
-- salaries") layered on top of restaurant access.
create policy salary_entries_select on salary_entries for select
  using (app.has_permission('payroll.view') and app.has_restaurant_access(restaurant_id));
create policy salary_entries_write on salary_entries for all
  using (app.has_permission('payroll.manage') and app.has_restaurant_access(restaurant_id))
  with check (app.has_permission('payroll.manage') and app.has_restaurant_access(restaurant_id));

create policy salary_entry_components_select on salary_entry_components for select
  using (exists (select 1 from salary_entries se where se.id = salary_entry_id and app.has_permission('payroll.view') and app.has_restaurant_access(se.restaurant_id)));
create policy salary_entry_components_write on salary_entry_components for all
  using (exists (select 1 from salary_entries se where se.id = salary_entry_id and app.has_permission('payroll.manage') and app.has_restaurant_access(se.restaurant_id)))
  with check (exists (select 1 from salary_entries se where se.id = salary_entry_id and app.has_permission('payroll.manage') and app.has_restaurant_access(se.restaurant_id)));

create policy salary_payments_select on salary_payments for select
  using (exists (select 1 from salary_entries se where se.id = salary_entry_id and app.has_permission('payroll.view') and app.has_restaurant_access(se.restaurant_id)));
create policy salary_payments_write on salary_payments for all
  using (exists (select 1 from salary_entries se where se.id = salary_entry_id and app.has_permission('payroll.manage') and app.has_restaurant_access(se.restaurant_id)))
  with check (exists (select 1 from salary_entries se where se.id = salary_entry_id and app.has_permission('payroll.manage') and app.has_restaurant_access(se.restaurant_id)));

create policy employee_advances_select on employee_advances for select
  using (app.has_permission('payroll.view') and app.has_restaurant_access(restaurant_id));
create policy employee_advances_write on employee_advances for all
  using (app.has_permission('payroll.manage') and app.has_restaurant_access(restaurant_id))
  with check (app.has_permission('payroll.manage') and app.has_restaurant_access(restaurant_id));

create policy employee_deductions_select on employee_deductions for select
  using (app.has_permission('payroll.view'));
create policy employee_deductions_write on employee_deductions for all
  using (app.has_permission('payroll.manage')) with check (app.has_permission('payroll.manage'));

create policy manpower_costs_select on manpower_costs for select
  using (app.has_permission('payroll.view') and app.has_restaurant_access(restaurant_id));
create policy manpower_costs_write on manpower_costs for all
  using (app.has_permission('payroll.manage') and app.has_restaurant_access(restaurant_id))
  with check (app.has_permission('payroll.manage') and app.has_restaurant_access(restaurant_id));
