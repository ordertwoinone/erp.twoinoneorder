-- Generic ledger of money movement through a bank/cash account. source_type
-- links back to whatever caused it (supplier_payment, card_settlement,
-- delivery_settlement, salary_payment, deposit, manual) without a forest of
-- nullable foreign keys.
create table bank_transactions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  bank_account_id uuid references bank_accounts(id),
  cash_account_id uuid references cash_accounts(id),
  transaction_date date not null,
  direction text not null check (direction in ('credit', 'debit')),
  amount numeric(14,2) not null check (amount > 0),
  source_type text not null check (source_type in (
    'supplier_payment', 'card_settlement', 'delivery_settlement',
    'salary_payment', 'deposit', 'expense', 'manual'
  )),
  source_id uuid,
  reference text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  constraint bank_transactions_account_chk check (
    (bank_account_id is not null and cash_account_id is null)
    or (bank_account_id is null and cash_account_id is not null)
  )
);
create index bank_transactions_bank_account_idx on bank_transactions(bank_account_id, transaction_date);
create index bank_transactions_cash_account_idx on bank_transactions(cash_account_id, transaction_date);
create index bank_transactions_source_idx on bank_transactions(source_type, source_id);

create table bank_deposits (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  bank_account_id uuid not null references bank_accounts(id),
  deposit_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  deposited_by uuid references profiles(id),
  reference text,
  attachment_id uuid,
  created_at timestamptz not null default now()
);
create index bank_deposits_bank_account_idx on bank_deposits(bank_account_id, deposit_date);

create table bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references bank_accounts(id),
  period_start date not null,
  period_end date not null,
  statement_closing_balance numeric(14,2) not null,
  ledger_closing_balance numeric(14,2) not null,
  difference numeric(14,2) not null generated always as (statement_closing_balance - ledger_closing_balance) stored,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  reconciled_by uuid references profiles(id),
  reconciled_at timestamptz,
  created_at timestamptz not null default now()
);
create index bank_reconciliations_account_idx on bank_reconciliations(bank_account_id, period_end);

alter table bank_transactions enable row level security;
alter table bank_deposits enable row level security;
alter table bank_reconciliations enable row level security;

create policy bank_transactions_select on bank_transactions for select
  using (app.has_restaurant_access(restaurant_id) and app.has_permission('banking.view'));
create policy bank_transactions_write on bank_transactions for all
  using (app.has_restaurant_access(restaurant_id) and app.has_permission('banking.manage'))
  with check (app.has_restaurant_access(restaurant_id) and app.has_permission('banking.manage'));

create policy bank_deposits_select on bank_deposits for select
  using (app.has_restaurant_access(restaurant_id) and app.has_permission('banking.view'));
create policy bank_deposits_write on bank_deposits for all
  using (app.has_restaurant_access(restaurant_id) and app.has_permission('banking.manage'))
  with check (app.has_restaurant_access(restaurant_id) and app.has_permission('banking.manage'));

create policy bank_reconciliations_select on bank_reconciliations for select
  using (app.has_permission('banking.view'));
create policy bank_reconciliations_write on bank_reconciliations for all
  using (app.has_permission('banking.manage')) with check (app.has_permission('banking.manage'));
