create or replace function public.save_expense_draft(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense_id uuid;
  v_restaurant_id uuid;
  v_status text;
begin
  v_restaurant_id := (payload ->> 'restaurant_id')::uuid;
  if not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;
  if not app.has_permission('expenses.manage') then
    raise exception 'Not authorized to manage expenses';
  end if;

  v_expense_id := nullif(payload ->> 'id', '')::uuid;

  if v_expense_id is not null then
    select status into v_status from operating_expenses where id = v_expense_id;
    if v_status is null then raise exception 'Expense not found'; end if;
    if v_status not in ('draft', 'rejected') then raise exception 'Only draft/rejected expenses can be edited'; end if;

    update operating_expenses set
      expense_category_id = (payload ->> 'expense_category_id')::uuid,
      amount = (payload ->> 'amount')::numeric,
      expense_date = (payload ->> 'expense_date')::date,
      status = 'draft',
      notes = nullif(payload ->> 'notes', '')
    where id = v_expense_id;
  else
    insert into operating_expenses (
      expense_number, restaurant_id, expense_category_id, amount, expense_date, status, notes, created_by
    ) values (
      app.next_document_number('EXP'), v_restaurant_id, (payload ->> 'expense_category_id')::uuid,
      (payload ->> 'amount')::numeric, (payload ->> 'expense_date')::date, 'draft',
      nullif(payload ->> 'notes', ''), auth.uid()
    ) returning id into v_expense_id;
  end if;

  return v_expense_id;
end;
$$;

create or replace function public.transition_expense(p_expense_id uuid, p_action text, p_comment text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_status text;
  v_new_status text;
  v_approval_action approval_action;
  v_amount numeric(14,2);
  v_expense_date date;
  v_entry_id uuid;
  v_expense_account uuid;
  v_payable_account uuid;
  v_period_status accounting_period_status;
begin
  select restaurant_id, status, amount, expense_date
  into v_restaurant_id, v_status, v_amount, v_expense_date
  from operating_expenses where id = p_expense_id for update;

  if v_restaurant_id is null then raise exception 'Expense not found'; end if;
  if not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;

  if p_action = 'submit' then
    if v_status not in ('draft', 'rejected') then raise exception 'Only draft/rejected expenses can be submitted'; end if;
    if not app.has_permission('expenses.manage') then raise exception 'Not authorized'; end if;
    v_new_status := 'pending_approval';
    v_approval_action := 'submitted';
  elsif p_action = 'approve' then
    if v_status != 'pending_approval' then raise exception 'Only pending expenses can be approved'; end if;
    if not app.has_permission('purchases.approve') then raise exception 'Not authorized'; end if;
    v_new_status := 'approved';
    v_approval_action := 'approved';
  elsif p_action = 'reject' then
    if v_status != 'pending_approval' then raise exception 'Only pending expenses can be rejected'; end if;
    if not app.has_permission('purchases.approve') then raise exception 'Not authorized'; end if;
    v_new_status := 'rejected';
    v_approval_action := 'rejected';
  elsif p_action = 'cancel' then
    if v_status not in ('draft', 'pending_approval', 'rejected') then
      raise exception 'An expense in this state cannot be cancelled';
    end if;
    if not app.has_permission('expenses.manage') then raise exception 'Not authorized'; end if;
    v_new_status := 'cancelled';
    v_approval_action := null;
  elsif p_action = 'post' then
    if v_status != 'approved' then raise exception 'Only approved expenses can be posted'; end if;
    if not app.has_permission('purchases.post') then raise exception 'Not authorized'; end if;

    select status into v_period_status from accounting_periods
    where (restaurant_id = v_restaurant_id or restaurant_id is null)
      and period_month = date_trunc('month', v_expense_date)::date
    order by restaurant_id nulls last limit 1;
    if v_period_status = 'locked' then
      raise exception 'The accounting period for % is locked', to_char(v_expense_date, 'Mon YYYY');
    end if;

    select id into v_expense_account from accounting_accounts where code = '5200';
    select id into v_payable_account from accounting_accounts where code = '2000';

    insert into journal_entries (entry_number, restaurant_id, entry_date, source_type, source_id, description, created_by)
    values (app.next_document_number('JE'), v_restaurant_id, v_expense_date, 'operating_expense', p_expense_id,
            'Operating expense', auth.uid())
    returning id into v_entry_id;

    insert into journal_lines (journal_entry_id, accounting_account_id, debit_amount, credit_amount)
    values (v_entry_id, v_expense_account, v_amount, 0);
    insert into journal_lines (journal_entry_id, accounting_account_id, debit_amount, credit_amount)
    values (v_entry_id, v_payable_account, 0, v_amount);

    v_new_status := 'posted';
    v_approval_action := 'posted';
  else
    raise exception 'Unknown action %', p_action;
  end if;

  update operating_expenses set status = v_new_status,
    approved_by = case when p_action = 'approve' then auth.uid() else approved_by end
  where id = p_expense_id;

  if v_approval_action is not null then
    insert into approvals (entity_type, entity_id, action, comment, actor_id)
    values ('operating_expense', p_expense_id, v_approval_action, p_comment, auth.uid());
  end if;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, old_value, new_value)
  values (auth.uid(), p_action, 'expenses', 'operating_expense', p_expense_id,
          jsonb_build_object('status', v_status), jsonb_build_object('status', v_new_status));
end;
$$;

grant execute on function public.save_expense_draft(jsonb) to authenticated;
grant execute on function public.transition_expense(uuid, text, text) to authenticated;
