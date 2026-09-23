-- Restaurant-level P&L for a date range, computed from posted operational
-- data (not re-derived from the journal, since sales/COGS recognition
-- isn't journal-posted in this build — see docs/business-workflows.md §7).
-- cogs/gross_profit/net_profit come back null and is_provisional=true
-- whenever opening/closing stock hasn't been entered for the period, per
-- spec §33 ("never present incomplete calculations as final").
create or replace function public.get_pnl_report(p_restaurant_id uuid, p_period_start date, p_period_end date)
returns table (
  net_sales numeric,
  opening_stock_value numeric,
  purchases_value numeric,
  closing_stock_value numeric,
  transfers_net numeric,
  cogs numeric,
  gross_profit numeric,
  salaries_total numeric,
  opex_total numeric,
  card_fees numeric,
  delivery_commissions numeric,
  net_profit numeric,
  is_provisional boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_net_sales numeric := 0;
  v_opening numeric;
  v_purchases numeric := 0;
  v_closing numeric;
  v_transfers numeric := 0;
  v_cogs numeric;
  v_gross_profit numeric;
  v_salaries numeric := 0;
  v_opex numeric := 0;
  v_card_fees numeric := 0;
  v_delivery_commissions numeric := 0;
  v_net_profit numeric;
  v_provisional boolean := false;
begin
  if not app.has_restaurant_access(p_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;
  if not app.has_permission('pnl.view') then
    raise exception 'Not authorized to view P&L';
  end if;

  select coalesce(sum(se.net_sales), 0) into v_net_sales
  from sales_entries se
  where se.restaurant_id = p_restaurant_id and se.status = 'posted'
    and se.business_date between p_period_start and p_period_end;

  select coalesce(sum(p.total_amount), 0) into v_purchases
  from purchases p
  where p.restaurant_id = p_restaurant_id and p.status = 'posted'
    and p.invoice_date between p_period_start and p_period_end;

  select coalesce(sum(os.quantity * os.unit_cost), null) into v_opening
  from opening_stock os
  where os.restaurant_id = p_restaurant_id and os.period_month = date_trunc('month', p_period_start)::date;

  select coalesce(sum(cs.quantity * cs.unit_cost), null) into v_closing
  from closing_stock cs
  where cs.restaurant_id = p_restaurant_id and cs.period_month = date_trunc('month', p_period_start)::date;

  select coalesce(sum(sm.total_cost), 0) into v_transfers
  from stock_movements sm
  where sm.restaurant_id = p_restaurant_id
    and sm.movement_type in ('transfer_in', 'transfer_out')
    and sm.movement_date between p_period_start and p_period_end;

  select coalesce(sum(sal.net_salary), 0) into v_salaries
  from salary_entries sal
  where sal.restaurant_id = p_restaurant_id and sal.status = 'posted'
    and sal.period_month between date_trunc('month', p_period_start)::date and p_period_end;

  select coalesce(sum(oe.amount), 0) into v_opex
  from operating_expenses oe
  where oe.restaurant_id = p_restaurant_id and oe.status = 'posted'
    and oe.expense_date between p_period_start and p_period_end;

  select coalesce(sum(ct.fee_amount), 0) into v_card_fees
  from card_transactions ct
  where ct.restaurant_id = p_restaurant_id
    and ct.transaction_date between p_period_start and p_period_end;

  select coalesce(sum(ds.commission_amount), 0) into v_delivery_commissions
  from delivery_sales ds
  where ds.restaurant_id = p_restaurant_id
    and ds.business_date between p_period_start and p_period_end;

  if v_opening is null or v_closing is null then
    v_provisional := true;
    v_cogs := null;
    v_gross_profit := null;
    v_net_profit := null;
  else
    v_cogs := v_opening + v_purchases + v_transfers - v_closing;
    v_gross_profit := v_net_sales - v_cogs;
    v_net_profit := v_gross_profit - v_salaries - v_opex - v_card_fees - v_delivery_commissions;
  end if;

  return query select
    v_net_sales, v_opening, v_purchases, v_closing, v_transfers, v_cogs, v_gross_profit,
    v_salaries, v_opex, v_card_fees, v_delivery_commissions, v_net_profit, v_provisional;
end;
$$;

grant execute on function public.get_pnl_report(uuid, date, date) to authenticated;

-- Period locking: opens/locks an accounting period for a restaurant/month.
create or replace function public.set_accounting_period_status(p_restaurant_id uuid, p_period_month date, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not app.has_permission('accounting.manage') then
    raise exception 'Not authorized to manage accounting periods';
  end if;
  if p_status not in ('open', 'locked') then
    raise exception 'Invalid status %', p_status;
  end if;

  insert into accounting_periods (restaurant_id, period_month, status, locked_by, locked_at)
  values (
    p_restaurant_id, date_trunc('month', p_period_month)::date, p_status,
    case when p_status = 'locked' then auth.uid() else null end,
    case when p_status = 'locked' then now() else null end
  )
  on conflict (restaurant_id, period_month) do update set
    status = excluded.status,
    locked_by = excluded.locked_by,
    locked_at = excluded.locked_at;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (auth.uid(), 'period_' || p_status, 'accounting', 'accounting_period', null,
          jsonb_build_object('restaurant_id', p_restaurant_id, 'period_month', p_period_month, 'status', p_status));
end;
$$;

grant execute on function public.set_accounting_period_status(uuid, date, text) to authenticated;
