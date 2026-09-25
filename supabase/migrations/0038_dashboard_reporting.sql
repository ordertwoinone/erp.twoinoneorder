-- Group Operations dashboard: supplier categorization + read-only reporting
-- RPCs. All of these are aggregations over existing tables (purchase
-- workflow, price locks, banking, card settlements) — no new source-of-truth
-- data is introduced here except supplier type/category tagging.

-- === Supplier type & categories ==============================================
alter table suppliers add column supplier_type text
  check (supplier_type in ('distributor', 'manufacturer', 'wholesaler', 'farm', 'importer', 'other'));

create table supplier_categories (
  supplier_id uuid not null references suppliers(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  primary key (supplier_id, category_id)
);
create index supplier_categories_category_idx on supplier_categories(category_id);

alter table supplier_categories enable row level security;
create policy supplier_categories_select on supplier_categories for select using (auth.uid() is not null);
create policy supplier_categories_write on supplier_categories for all
  using (app.has_permission('suppliers.manage')) with check (app.has_permission('suppliers.manage'));

-- === Restaurant scope resolution ==============================================
-- Every dashboard RPC below takes p_restaurant_ids (null = "all restaurants
-- the caller can see"). This resolves that request against the caller's
-- actual access rather than trusting the array, since these functions are
-- security definer and therefore bypass RLS on the tables they aggregate.
create or replace function app.accessible_restaurant_ids(p_requested uuid[])
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  if app.is_all_restaurants_user() then
    if p_requested is null or array_length(p_requested, 1) is null then
      select array_agg(id) into v_ids from restaurants;
    else
      v_ids := p_requested;
    end if;
  else
    select array_agg(ur.restaurant_id) into v_ids
    from user_restaurants ur
    where ur.profile_id = auth.uid()
      and (p_requested is null or ur.restaurant_id = any(p_requested));
  end if;
  return coalesce(v_ids, '{}');
end;
$$;

-- === Purchasing pipeline stage counts =========================================
create or replace function public.get_dashboard_pipeline_counts(
  p_restaurant_ids uuid[], p_period_start date, p_period_end date
)
returns table (
  request_count bigint,
  order_count bigint,
  receive_count bigint,
  invoice_count bigint,
  approve_awaiting_count bigint,
  pay_awaiting_count bigint,
  reconcile_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ids uuid[] := app.accessible_restaurant_ids(p_restaurant_ids);
  v_can_view_banking boolean := app.has_permission('banking.view');
begin
  return query
  select
    (select count(*) from purchase_requests pr
       where pr.restaurant_id = any(v_ids) and pr.requested_at::date between p_period_start and p_period_end),
    (select count(*) from purchase_orders po
       where po.restaurant_id = any(v_ids) and po.order_date between p_period_start and p_period_end),
    (select count(*) from goods_receipts gr
       where gr.restaurant_id = any(v_ids) and gr.status = 'confirmed'
         and gr.received_date between p_period_start and p_period_end),
    (select count(*) from purchases p
       where p.restaurant_id = any(v_ids) and p.invoice_date between p_period_start and p_period_end),
    (select count(*) from purchases p
       where p.restaurant_id = any(v_ids) and p.status = 'pending_approval'),
    (select count(*) from purchases p
       where p.restaurant_id = any(v_ids) and p.status = 'posted' and p.payment_status in ('unpaid', 'partially_paid')),
    case when v_can_view_banking then
      (select count(*) from bank_reconciliations br
         join bank_accounts ba on ba.id = br.bank_account_id
         where (ba.restaurant_id is null or ba.restaurant_id = any(v_ids))
           and br.period_end between p_period_start and p_period_end
           and br.status = 'completed')
    else null end;
end;
$$;

grant execute on function public.get_dashboard_pipeline_counts(uuid[], date, date) to authenticated;

-- === Exception queue ===========================================================
-- Three exception types, unioned:
--  - price_above_contract: an invoice line billed above its agreed price at
--    entry, by more than a 2% materiality threshold (avoids flagging rounding).
--  - missing_goods_receipt: an approved/posted invoice tied to a PO with no
--    confirmed goods receipt recorded against it.
--  - duplicate_invoice: the hard DB constraint blocks an exact re-save, but a
--    re-keyed invoice (typo'd number) can still slip through — flagged as a
--    near-duplicate when the same supplier+restaurant has another
--    non-cancelled invoice within 7 days for a near-identical total.
create or replace function app.exception_rows(
  p_restaurant_ids uuid[], p_period_start date, p_period_end date
)
returns table (
  purchase_id uuid,
  restaurant_id uuid,
  restaurant_name text,
  supplier_id uuid,
  supplier_name text,
  invoice_number text,
  invoice_date date,
  total_amount numeric,
  exception_type text,
  variance_pct numeric,
  owner_name text,
  status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ids uuid[] := app.accessible_restaurant_ids(p_restaurant_ids);
begin
  return query
  select p.id, p.restaurant_id, r.name, p.supplier_id, s.name, p.invoice_number, p.invoice_date,
         p.total_amount, 'price_above_contract', round(max_variance.pct, 1),
         prof.full_name, p.status::text
  from purchases p
  join restaurants r on r.id = p.restaurant_id
  join suppliers s on s.id = p.supplier_id
  left join profiles prof on prof.id = p.created_by
  join lateral (
    select max((pi.unit_price - pi.agreed_price_at_entry) / pi.agreed_price_at_entry * 100) as pct
    from purchase_items pi
    where pi.purchase_id = p.id and pi.agreed_price_at_entry > 0
  ) max_variance on max_variance.pct > 2
  where p.restaurant_id = any(v_ids) and p.invoice_date between p_period_start and p_period_end

  union all

  select p.id, p.restaurant_id, r.name, p.supplier_id, s.name, p.invoice_number, p.invoice_date,
         p.total_amount, 'missing_goods_receipt', null,
         prof.full_name, p.status::text
  from purchases p
  join restaurants r on r.id = p.restaurant_id
  join suppliers s on s.id = p.supplier_id
  left join profiles prof on prof.id = p.created_by
  where p.restaurant_id = any(v_ids) and p.invoice_date between p_period_start and p_period_end
    and p.purchase_order_id is not null
    and p.status in ('approved', 'posted')
    and not exists (
      select 1 from goods_receipts gr where gr.purchase_id = p.id and gr.status = 'confirmed'
    )

  union all

  select p.id, p.restaurant_id, r.name, p.supplier_id, s.name, p.invoice_number, p.invoice_date,
         p.total_amount, 'duplicate_invoice', null,
         prof.full_name, p.status::text
  from purchases p
  join restaurants r on r.id = p.restaurant_id
  join suppliers s on s.id = p.supplier_id
  left join profiles prof on prof.id = p.created_by
  where p.restaurant_id = any(v_ids) and p.invoice_date between p_period_start and p_period_end
    and p.status != 'cancelled'
    and exists (
      select 1 from purchases p2
      where p2.id != p.id and p2.supplier_id = p.supplier_id and p2.restaurant_id = p.restaurant_id
        and p2.status != 'cancelled'
        and abs(p2.total_amount - p.total_amount) < 1
        and abs(p2.invoice_date - p.invoice_date) <= 7
        and p2.created_at < p.created_at
    );
end;
$$;

create or replace function public.get_dashboard_exceptions(
  p_restaurant_ids uuid[], p_period_start date, p_period_end date, p_limit int default 50
)
returns setof app.exception_rows
language sql
stable
security definer
set search_path = public
as $$
  select * from app.exception_rows(p_restaurant_ids, p_period_start, p_period_end)
  order by invoice_date desc
  limit p_limit;
$$;

grant execute on function public.get_dashboard_exceptions(uuid[], date, date, int) to authenticated;

-- === KPI cards (current period + prior period for the delta) =================
create or replace function public.get_dashboard_kpis(
  p_restaurant_ids uuid[], p_period_start date, p_period_end date
)
returns table (
  purchases_total numeric,
  purchases_prior numeric,
  sales_total numeric,
  sales_prior numeric,
  payables_total numeric,
  payables_prior numeric,
  exceptions_count bigint,
  exceptions_prior_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ids uuid[] := app.accessible_restaurant_ids(p_restaurant_ids);
  v_period_days int := p_period_end - p_period_start + 1;
  v_prior_start date := p_period_start - v_period_days;
  v_prior_end date := p_period_start - 1;
begin
  return query
  select
    (select coalesce(sum(p.total_amount), 0) from purchases p
       where p.restaurant_id = any(v_ids) and p.status = 'posted' and p.invoice_date between p_period_start and p_period_end),
    (select coalesce(sum(p.total_amount), 0) from purchases p
       where p.restaurant_id = any(v_ids) and p.status = 'posted' and p.invoice_date between v_prior_start and v_prior_end),
    (select coalesce(sum(se.net_sales), 0) from sales_entries se
       where se.restaurant_id = any(v_ids) and se.status = 'posted' and se.business_date between p_period_start and p_period_end),
    (select coalesce(sum(se.net_sales), 0) from sales_entries se
       where se.restaurant_id = any(v_ids) and se.status = 'posted' and se.business_date between v_prior_start and v_prior_end),
    (select coalesce(sum(p.total_amount - p.paid_amount), 0) from purchases p
       where p.restaurant_id = any(v_ids) and p.status = 'posted' and p.invoice_date <= p_period_end),
    (select coalesce(sum(p.total_amount - p.paid_amount), 0) from purchases p
       where p.restaurant_id = any(v_ids) and p.status = 'posted' and p.invoice_date <= v_prior_end),
    (select count(*) from app.exception_rows(p_restaurant_ids, p_period_start, p_period_end)),
    (select count(*) from app.exception_rows(p_restaurant_ids, v_prior_start, v_prior_end));
end;
$$;

grant execute on function public.get_dashboard_kpis(uuid[], date, date) to authenticated;

-- === Supplier performance (purchase volume + price reliability) ==============
-- Price reliability compares each purchase line's billed price against the
-- agreed price locked in at entry time (purchase_items.agreed_price_at_entry),
-- not the live price lock — so historical results don't shift if the
-- contract price changes later. has_sufficient_data is false when no line in
-- the period had an agreed price to compare against.
create or replace function public.get_supplier_performance(
  p_restaurant_ids uuid[], p_period_start date, p_period_end date, p_limit int default 20
)
returns table (
  supplier_id uuid,
  supplier_name text,
  supplier_type text,
  purchase_volume numeric,
  price_increase_count bigint,
  price_increase_value numeric,
  price_decrease_count bigint,
  price_decrease_value numeric,
  has_sufficient_data boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ids uuid[] := app.accessible_restaurant_ids(p_restaurant_ids);
begin
  return query
  select
    s.id, s.name, s.supplier_type,
    coalesce(sum(p.total_amount) filter (where p.status = 'posted'), 0),
    count(pi.id) filter (where pi.unit_price > pi.agreed_price_at_entry),
    coalesce(sum((pi.unit_price - pi.agreed_price_at_entry) * pi.quantity)
      filter (where pi.unit_price > pi.agreed_price_at_entry), 0),
    count(pi.id) filter (where pi.unit_price < pi.agreed_price_at_entry),
    coalesce(sum((pi.agreed_price_at_entry - pi.unit_price) * pi.quantity)
      filter (where pi.unit_price < pi.agreed_price_at_entry), 0),
    count(pi.id) filter (where pi.agreed_price_at_entry is not null) > 0
  from suppliers s
  join purchases p on p.supplier_id = s.id
    and p.restaurant_id = any(v_ids) and p.invoice_date between p_period_start and p_period_end
  left join purchase_items pi on pi.purchase_id = p.id and pi.agreed_price_at_entry is not null
  group by s.id, s.name, s.supplier_type
  order by coalesce(sum(p.total_amount) filter (where p.status = 'posted'), 0) desc
  limit p_limit;
end;
$$;

grant execute on function public.get_supplier_performance(uuid[], date, date, int) to authenticated;

-- === Accounting overview =======================================================
-- vat_payable/unsettled_card_amount/bank_reconciled_count come back null when
-- the caller lacks the relevant view permission, rather than silently
-- showing zero (spec: never present incomplete data as final).
create or replace function public.get_dashboard_accounting_overview(
  p_restaurant_ids uuid[], p_period_start date, p_period_end date
)
returns table (
  bank_reconciled_count bigint,
  bank_total_count bigint,
  vat_payable numeric,
  unsettled_card_amount numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ids uuid[] := app.accessible_restaurant_ids(p_restaurant_ids);
begin
  return query
  select
    case when app.has_permission('banking.view') then
      (select count(*) from bank_reconciliations br join bank_accounts ba on ba.id = br.bank_account_id
         where (ba.restaurant_id is null or ba.restaurant_id = any(v_ids))
           and br.period_end between p_period_start and p_period_end and br.status = 'completed')
    else null end,
    case when app.has_permission('banking.view') then
      (select count(*) from bank_reconciliations br join bank_accounts ba on ba.id = br.bank_account_id
         where (ba.restaurant_id is null or ba.restaurant_id = any(v_ids))
           and br.period_end between p_period_start and p_period_end)
    else null end,
    case when app.has_permission('accounting.view') then
      (select coalesce(sum(se.tax_amount), 0) from sales_entries se
         where se.restaurant_id = any(v_ids) and se.status = 'posted' and se.business_date between p_period_start and p_period_end)
      - (select coalesce(sum(p.tax_amount), 0) from purchases p
         where p.restaurant_id = any(v_ids) and p.status = 'posted' and p.invoice_date between p_period_start and p_period_end)
    else null end,
    case when app.has_permission('settlements.view') then
      (select coalesce(sum(ct.net_amount), 0) from card_transactions ct
         where ct.restaurant_id = any(v_ids) and ct.transaction_date between p_period_start and p_period_end)
      - (select coalesce(sum(csa.amount), 0) from card_settlement_allocations csa
         join card_settlements cs on cs.id = csa.card_settlement_id
         where csa.restaurant_id = any(v_ids) and cs.status = 'matched'
           and csa.covers_from >= p_period_start and csa.covers_to <= p_period_end)
    else null end;
end;
$$;

grant execute on function public.get_dashboard_accounting_overview(uuid[], date, date) to authenticated;
