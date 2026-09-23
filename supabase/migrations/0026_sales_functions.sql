-- Atomic create/replace of a sales entry + its payment-method breakdown
-- rows, mirroring save_purchase_draft's pattern (docs/architecture.md §5).
-- Draft/submitted entries are editable; reviewed/posted are not.
create or replace function public.save_sales_entry(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
  v_restaurant_id uuid;
  v_status text;
  v_gross numeric(14,2);
  v_discounts numeric(14,2);
  v_refunds numeric(14,2);
  v_tax numeric(14,2);
begin
  v_restaurant_id := (payload ->> 'restaurant_id')::uuid;

  if not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;
  if not app.has_permission('sales.create') then
    raise exception 'Not authorized to enter sales';
  end if;

  v_gross := coalesce((payload ->> 'gross_sales')::numeric, 0);
  v_discounts := coalesce((payload ->> 'discounts')::numeric, 0);
  v_refunds := coalesce((payload ->> 'refunds')::numeric, 0);
  v_tax := coalesce((payload ->> 'tax_amount')::numeric, 0);

  v_entry_id := nullif(payload ->> 'id', '')::uuid;

  if v_entry_id is not null then
    select status into v_status from sales_entries where id = v_entry_id;
    if v_status is null then raise exception 'Sales entry not found'; end if;
    if v_status not in ('draft', 'submitted') then
      raise exception 'Only draft or submitted entries can be edited';
    end if;

    update sales_entries set
      business_date = (payload ->> 'business_date')::date,
      shift = payload ->> 'shift',
      gross_sales = v_gross,
      discounts = v_discounts,
      refunds = v_refunds,
      tax_amount = v_tax,
      net_sales = v_gross - v_discounts - v_refunds,
      notes = nullif(payload ->> 'notes', '')
    where id = v_entry_id;

    delete from sales_payment_breakdowns where sales_entry_id = v_entry_id;
  else
    insert into sales_entries (
      restaurant_id, business_date, shift, gross_sales, discounts, refunds, tax_amount,
      net_sales, status, submitted_by, notes
    ) values (
      v_restaurant_id, (payload ->> 'business_date')::date, payload ->> 'shift',
      v_gross, v_discounts, v_refunds, v_tax, v_gross - v_discounts - v_refunds,
      'draft', auth.uid(), nullif(payload ->> 'notes', '')
    ) returning id into v_entry_id;
  end if;

  insert into sales_payment_breakdowns (sales_entry_id, sales_channel_id, payment_method_id, amount)
  select
    v_entry_id,
    nullif(item ->> 'sales_channel_id', '')::uuid,
    (item ->> 'payment_method_id')::uuid,
    (item ->> 'amount')::numeric
  from jsonb_array_elements(coalesce(payload -> 'breakdowns', '[]'::jsonb)) as item;

  return v_entry_id;
end;
$$;

create or replace function public.transition_sales_entry(p_sales_entry_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_status text;
begin
  select restaurant_id, status into v_restaurant_id, v_status
  from sales_entries where id = p_sales_entry_id for update;

  if v_restaurant_id is null then raise exception 'Sales entry not found'; end if;
  if not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;

  if p_action = 'submit' then
    if v_status != 'draft' then raise exception 'Only draft entries can be submitted'; end if;
    if not app.has_permission('sales.create') then raise exception 'Not authorized'; end if;
    update sales_entries set status = 'submitted', submitted_by = auth.uid() where id = p_sales_entry_id;
  elsif p_action = 'review' then
    if v_status != 'submitted' then raise exception 'Only submitted entries can be reviewed'; end if;
    if not app.has_permission('sales.review') then raise exception 'Not authorized'; end if;
    update sales_entries set status = 'reviewed', reviewed_by = auth.uid() where id = p_sales_entry_id;
  elsif p_action = 'post' then
    if v_status != 'reviewed' then raise exception 'Only reviewed entries can be posted'; end if;
    if not app.has_permission('sales.review') then raise exception 'Not authorized'; end if;
    update sales_entries set status = 'posted' where id = p_sales_entry_id;
  else
    raise exception 'Unknown action %', p_action;
  end if;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, old_value, new_value)
  values (auth.uid(), p_action, 'sales', 'sales_entry', p_sales_entry_id,
          jsonb_build_object('status', v_status), jsonb_build_object('action', p_action));
end;
$$;

grant execute on function public.save_sales_entry(jsonb) to authenticated;
grant execute on function public.transition_sales_entry(uuid, text) to authenticated;
