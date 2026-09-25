-- VAT summary for the Accounting page's VAT tab: output VAT (collected on
-- sales) minus input VAT (paid on purchases) for a period/restaurant scope.
-- Same definition as the dashboard's vat_payable tile, but exposed with the
-- two sides broken out for a proper VAT return view instead of just the net.
create or replace function public.get_vat_summary(
  p_restaurant_ids uuid[], p_period_start date, p_period_end date
)
returns table (
  output_vat numeric,
  input_vat numeric,
  net_payable numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ids uuid[] := app.accessible_restaurant_ids(p_restaurant_ids);
  v_output numeric;
  v_input numeric;
begin
  if not app.has_permission('accounting.view') then
    raise exception 'Not authorized to view VAT';
  end if;

  select coalesce(sum(se.tax_amount), 0) into v_output
  from sales_entries se
  where se.restaurant_id = any(v_ids) and se.status = 'posted'
    and se.business_date between p_period_start and p_period_end;

  select coalesce(sum(p.tax_amount), 0) into v_input
  from purchases p
  where p.restaurant_id = any(v_ids) and p.status = 'posted'
    and p.invoice_date between p_period_start and p_period_end;

  return query select v_output, v_input, v_output - v_input;
end;
$$;

grant execute on function public.get_vat_summary(uuid[], date, date) to authenticated;
