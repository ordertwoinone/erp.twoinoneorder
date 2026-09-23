create table card_machines (
  id uuid primary key default gen_random_uuid(),
  machine_name text not null,
  terminal_id text not null unique,
  provider text not null,
  linked_bank_account_id uuid references bank_accounts(id),
  status text not null default 'active' check (status in ('active', 'inactive', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on card_machines
  for each row execute function app.set_updated_at();

-- Time-bounded restaurant assignment. A machine may move between restaurants
-- during the day; historical transactions freeze the restaurant that was
-- active at transaction time (see card_transactions.restaurant_id) rather
-- than deriving it live from this table.
create table card_machine_assignments (
  id uuid primary key default gen_random_uuid(),
  card_machine_id uuid not null references card_machines(id),
  restaurant_id uuid not null references restaurants(id),
  starts_at timestamptz not null,
  ends_at timestamptz,
  assigned_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  constraint card_machine_assignments_period_chk check (ends_at is null or ends_at > starts_at)
);
create index card_machine_assignments_machine_idx on card_machine_assignments(card_machine_id, starts_at);
-- Prevent overlapping assignment periods for the same machine.
create unique index card_machine_assignments_no_overlap_idx
  on card_machine_assignments(card_machine_id)
  where ends_at is null;

create table card_transactions (
  id uuid primary key default gen_random_uuid(),
  card_machine_id uuid not null references card_machines(id),
  restaurant_id uuid not null references restaurants(id),
  card_machine_assignment_id uuid references card_machine_assignments(id),
  transaction_date date not null,
  gross_amount numeric(14,2) not null check (gross_amount >= 0),
  fee_amount numeric(14,2) not null default 0,
  refund_amount numeric(14,2) not null default 0,
  net_amount numeric(14,2) not null,
  reference text,
  created_at timestamptz not null default now()
);
create index card_transactions_machine_idx on card_transactions(card_machine_id, transaction_date);
create index card_transactions_restaurant_idx on card_transactions(restaurant_id, transaction_date);

create table card_settlements (
  id uuid primary key default gen_random_uuid(),
  card_machine_id uuid not null references card_machines(id),
  bank_account_id uuid not null references bank_accounts(id),
  credit_date date not null,
  bank_reference text,
  amount numeric(14,2) not null check (amount > 0),
  status card_settlement_status not null default 'unmatched',
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on card_settlements
  for each row execute function app.set_updated_at();
create index card_settlements_machine_idx on card_settlements(card_machine_id, credit_date);

-- A settlement credit can cover multiple restaurants / multiple days of
-- collections; this table allocates the settled amount back to what it
-- clears (spec §26: multiple-day deposits, deposits covering multiple
-- restaurants, partial settlements).
create table card_settlement_allocations (
  id uuid primary key default gen_random_uuid(),
  card_settlement_id uuid not null references card_settlements(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id),
  amount numeric(14,2) not null check (amount > 0),
  covers_from date not null,
  covers_to date not null
);
create index card_settlement_allocations_settlement_idx on card_settlement_allocations(card_settlement_id);
create index card_settlement_allocations_restaurant_idx on card_settlement_allocations(restaurant_id);

alter table card_machines enable row level security;
alter table card_machine_assignments enable row level security;
alter table card_transactions enable row level security;
alter table card_settlements enable row level security;
alter table card_settlement_allocations enable row level security;

create policy card_machines_select on card_machines for select using (auth.uid() is not null);
create policy card_machines_write on card_machines for all
  using (app.has_permission('card_machines.manage')) with check (app.has_permission('card_machines.manage'));

create policy card_machine_assignments_select on card_machine_assignments for select using (auth.uid() is not null);
create policy card_machine_assignments_write on card_machine_assignments for all
  using (app.has_permission('card_machines.manage')) with check (app.has_permission('card_machines.manage'));

create policy card_transactions_select on card_transactions for select
  using (app.has_restaurant_access(restaurant_id));
create policy card_transactions_write on card_transactions for all
  using (app.has_restaurant_access(restaurant_id) and app.has_permission('settlements.manage'))
  with check (app.has_restaurant_access(restaurant_id) and app.has_permission('settlements.manage'));

create policy card_settlements_select on card_settlements for select
  using (app.has_permission('settlements.view'));
create policy card_settlements_write on card_settlements for all
  using (app.has_permission('settlements.manage')) with check (app.has_permission('settlements.manage'));

create policy card_settlement_allocations_select on card_settlement_allocations for select
  using (app.has_restaurant_access(restaurant_id));
create policy card_settlement_allocations_write on card_settlement_allocations for all
  using (app.has_restaurant_access(restaurant_id) and app.has_permission('settlements.manage'))
  with check (app.has_restaurant_access(restaurant_id) and app.has_permission('settlements.manage'));
