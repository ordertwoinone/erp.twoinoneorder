create table bank_accounts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id),
  bank_name text not null,
  account_name text not null,
  account_number text not null,
  iban text,
  swift text,
  currency text not null default 'AED',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on bank_accounts
  for each row execute function app.set_updated_at();
create index bank_accounts_restaurant_idx on bank_accounts(restaurant_id);

create table cash_accounts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on cash_accounts
  for each row execute function app.set_updated_at();
create index cash_accounts_restaurant_idx on cash_accounts(restaurant_id);

alter table bank_accounts enable row level security;
alter table cash_accounts enable row level security;

-- Bank account visibility is a named sensitive permission (spec §8:
-- "viewing bank information") independent of general restaurant access.
create policy bank_accounts_select on bank_accounts for select
  using (
    app.has_permission('banking.view')
    and (restaurant_id is null or app.has_restaurant_access(restaurant_id))
  );
create policy bank_accounts_write on bank_accounts for all
  using (app.has_permission('banking.manage')) with check (app.has_permission('banking.manage'));

create policy cash_accounts_select on cash_accounts for select
  using (app.has_permission('banking.view') and app.has_restaurant_access(restaurant_id));
create policy cash_accounts_write on cash_accounts for all
  using (app.has_permission('banking.manage') and app.has_restaurant_access(restaurant_id))
  with check (app.has_permission('banking.manage') and app.has_restaurant_access(restaurant_id));
