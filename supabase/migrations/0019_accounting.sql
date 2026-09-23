create table accounting_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  account_type text not null check (account_type in ('asset', 'liability', 'equity', 'income', 'expense')),
  parent_id uuid references accounting_accounts(id),
  is_active boolean not null default true
);

create table accounting_periods (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id),
  period_month date not null,
  status accounting_period_status not null default 'open',
  locked_by uuid references profiles(id),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (restaurant_id, period_month)
);

create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_number text not null unique,
  restaurant_id uuid not null references restaurants(id),
  entry_date date not null default current_date,
  status journal_entry_status not null default 'posted',
  source_type text not null check (source_type in (
    'purchase', 'supplier_payment', 'sales_entry', 'salary_payment',
    'operating_expense', 'card_settlement', 'delivery_settlement',
    'branch_transfer', 'adjustment', 'manual'
  )),
  source_id uuid,
  reversed_entry_id uuid references journal_entries(id),
  description text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index journal_entries_restaurant_date_idx on journal_entries(restaurant_id, entry_date);
create index journal_entries_source_idx on journal_entries(source_type, source_id);

create table journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references journal_entries(id) on delete cascade,
  accounting_account_id uuid not null references accounting_accounts(id),
  debit_amount numeric(14,2) not null default 0 check (debit_amount >= 0),
  credit_amount numeric(14,2) not null default 0 check (credit_amount >= 0),
  memo text,
  constraint journal_lines_single_side_chk check (
    (debit_amount > 0 and credit_amount = 0) or (credit_amount > 0 and debit_amount = 0)
  )
);
create index journal_lines_entry_idx on journal_lines(journal_entry_id);
create index journal_lines_account_idx on journal_lines(accounting_account_id);

-- A journal entry's lines must sum to zero (double-entry). Checked once per
-- statement at commit time so multi-line inserts within one transaction are
-- allowed to be momentarily unbalanced between statements.
create or replace function app.check_journal_balance()
returns trigger
language plpgsql
as $$
declare
  target_entry_id uuid;
  balance numeric;
begin
  target_entry_id := coalesce(new.journal_entry_id, old.journal_entry_id);
  select coalesce(sum(debit_amount - credit_amount), 0) into balance
  from journal_lines where journal_entry_id = target_entry_id;
  if balance != 0 then
    raise exception 'Journal entry % is not balanced (difference %)', target_entry_id, balance;
  end if;
  return null;
end;
$$;

create constraint trigger journal_lines_balance_chk
  after insert or update or delete on journal_lines
  deferrable initially deferred
  for each row execute function app.check_journal_balance();

-- Materialized per-period balances, refreshed by posting functions rather
-- than recomputed live on every P&L request.
create table account_balances (
  restaurant_id uuid not null references restaurants(id),
  accounting_account_id uuid not null references accounting_accounts(id),
  period_month date not null,
  debit_total numeric(14,2) not null default 0,
  credit_total numeric(14,2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, accounting_account_id, period_month)
);

alter table accounting_accounts enable row level security;
alter table accounting_periods enable row level security;
alter table journal_entries enable row level security;
alter table journal_lines enable row level security;
alter table account_balances enable row level security;

create policy accounting_accounts_select on accounting_accounts for select using (app.has_permission('accounting.view'));
create policy accounting_accounts_write on accounting_accounts for all
  using (app.has_permission('accounting.manage')) with check (app.has_permission('accounting.manage'));

create policy accounting_periods_select on accounting_periods for select
  using (app.has_permission('accounting.view') and (restaurant_id is null or app.has_restaurant_access(restaurant_id)));
create policy accounting_periods_write on accounting_periods for all
  using (app.has_permission('accounting.manage')) with check (app.has_permission('accounting.manage'));

create policy journal_entries_select on journal_entries for select
  using (app.has_permission('accounting.view') and app.has_restaurant_access(restaurant_id));
create policy journal_entries_write on journal_entries for all
  using (app.has_permission('accounting.manage') and app.has_restaurant_access(restaurant_id))
  with check (app.has_permission('accounting.manage') and app.has_restaurant_access(restaurant_id));

create policy journal_lines_select on journal_lines for select
  using (exists (select 1 from journal_entries je where je.id = journal_entry_id and app.has_permission('accounting.view') and app.has_restaurant_access(je.restaurant_id)));
create policy journal_lines_write on journal_lines for all
  using (exists (select 1 from journal_entries je where je.id = journal_entry_id and app.has_permission('accounting.manage') and app.has_restaurant_access(je.restaurant_id)))
  with check (exists (select 1 from journal_entries je where je.id = journal_entry_id and app.has_permission('accounting.manage') and app.has_restaurant_access(je.restaurant_id)));

create policy account_balances_select on account_balances for select
  using (app.has_permission('accounting.view') and app.has_restaurant_access(restaurant_id));
create policy account_balances_write on account_balances for all
  using (app.has_permission('accounting.manage') and app.has_restaurant_access(restaurant_id))
  with check (app.has_permission('accounting.manage') and app.has_restaurant_access(restaurant_id));
