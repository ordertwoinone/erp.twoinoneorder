alter table suppliers
  add column salesman_name text,
  add column credit_limit_amount numeric(14,2),
  add column credit_limit_currency text check (credit_limit_currency in ('AED', 'USD', 'EUR', 'INR', 'EGP'));

-- Manually maintained conversion rates to AED (the base currency every
-- accounting/report figure is expressed in). No live FX feed is connected,
-- so a currency with no rate row here must be shown as "rate not set" —
-- never a fabricated conversion (spec §56/§33: don't present an incomplete
-- calculation as final).
create table exchange_rates (
  currency_code text primary key check (currency_code in ('AED', 'USD', 'EUR', 'INR', 'EGP')),
  rate_to_aed numeric(14,6) not null check (rate_to_aed > 0),
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

insert into exchange_rates (currency_code, rate_to_aed) values ('AED', 1)
on conflict (currency_code) do nothing;

alter table exchange_rates enable row level security;

create policy exchange_rates_select on exchange_rates for select using (auth.uid() is not null);
create policy exchange_rates_write on exchange_rates for all
  using (app.has_permission('accounting.manage')) with check (app.has_permission('accounting.manage'));

create or replace function public.set_exchange_rate(p_currency_code text, p_rate_to_aed numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not app.has_permission('accounting.manage') then
    raise exception 'Not authorized to manage exchange rates';
  end if;
  if p_rate_to_aed <= 0 then
    raise exception 'Rate must be greater than zero';
  end if;

  insert into exchange_rates (currency_code, rate_to_aed, updated_by, updated_at)
  values (p_currency_code, p_rate_to_aed, auth.uid(), now())
  on conflict (currency_code) do update set
    rate_to_aed = excluded.rate_to_aed, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (auth.uid(), 'set_rate', 'accounting', 'exchange_rate', null,
          jsonb_build_object('currency_code', p_currency_code, 'rate_to_aed', p_rate_to_aed));
end;
$$;

grant execute on function public.set_exchange_rate(text, numeric) to authenticated;
