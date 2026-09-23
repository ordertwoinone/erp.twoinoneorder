create or replace function public.save_salary_entry_draft(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
  v_restaurant_id uuid;
  v_status text;
  v_basic numeric(14,2);
  v_allowances numeric(14,2);
  v_overtime numeric(14,2);
  v_deductions numeric(14,2);
  v_advances numeric(14,2);
  v_net numeric(14,2);
begin
  v_restaurant_id := (payload ->> 'restaurant_id')::uuid;
  if not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;
  if not app.has_permission('payroll.manage') then
    raise exception 'Not authorized to manage payroll';
  end if;

  v_basic := coalesce((payload ->> 'basic_salary')::numeric, 0);
  v_allowances := coalesce((payload ->> 'allowances_total')::numeric, 0);
  v_overtime := coalesce((payload ->> 'overtime_amount')::numeric, 0);
  v_deductions := coalesce((payload ->> 'deductions_total')::numeric, 0);
  v_advances := coalesce((payload ->> 'advances_deducted')::numeric, 0);
  v_net := v_basic + v_allowances + v_overtime - v_deductions - v_advances;

  v_entry_id := nullif(payload ->> 'id', '')::uuid;

  if v_entry_id is not null then
    select status into v_status from salary_entries where id = v_entry_id;
    if v_status is null then raise exception 'Salary entry not found'; end if;
    if v_status != 'draft' then raise exception 'Only draft entries can be edited'; end if;

    update salary_entries set
      basic_salary = v_basic, allowances_total = v_allowances, overtime_amount = v_overtime,
      deductions_total = v_deductions, advances_deducted = v_advances, net_salary = v_net
    where id = v_entry_id;
  else
    insert into salary_entries (
      employee_id, restaurant_id, period_month, basic_salary, allowances_total, overtime_amount,
      deductions_total, advances_deducted, net_salary, status, created_by
    ) values (
      (payload ->> 'employee_id')::uuid, v_restaurant_id, (payload ->> 'period_month')::date,
      v_basic, v_allowances, v_overtime, v_deductions, v_advances, v_net, 'draft', auth.uid()
    ) returning id into v_entry_id;
  end if;

  return v_entry_id;
end;
$$;

create or replace function public.transition_salary_entry(p_salary_entry_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_status text;
  v_new_status text;
  v_net numeric(14,2);
  v_period date;
  v_entry_id uuid;
  v_salary_account uuid;
  v_payable_account uuid;
  v_period_status accounting_period_status;
begin
  select restaurant_id, status, net_salary, period_month
  into v_restaurant_id, v_status, v_net, v_period
  from salary_entries where id = p_salary_entry_id for update;

  if v_restaurant_id is null then raise exception 'Salary entry not found'; end if;
  if not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;

  if p_action = 'submit' then
    if v_status != 'draft' then raise exception 'Only draft entries can be submitted'; end if;
    if not app.has_permission('payroll.manage') then raise exception 'Not authorized'; end if;
    v_new_status := 'pending_approval';
  elsif p_action = 'approve' then
    if v_status != 'pending_approval' then raise exception 'Only pending entries can be approved'; end if;
    if not app.has_permission('purchases.approve') then raise exception 'Not authorized'; end if;
    v_new_status := 'approved';
  elsif p_action = 'post' then
    if v_status != 'approved' then raise exception 'Only approved entries can be posted'; end if;
    if not app.has_permission('purchases.post') then raise exception 'Not authorized'; end if;

    select status into v_period_status from accounting_periods
    where (restaurant_id = v_restaurant_id or restaurant_id is null)
      and period_month = date_trunc('month', v_period)::date
    order by restaurant_id nulls last limit 1;
    if v_period_status = 'locked' then
      raise exception 'The accounting period for % is locked', to_char(v_period, 'Mon YYYY');
    end if;

    select id into v_salary_account from accounting_accounts where code = '5100';
    select id into v_payable_account from accounting_accounts where code = '2000';

    insert into journal_entries (entry_number, restaurant_id, entry_date, source_type, source_id, description, created_by)
    values (app.next_document_number('JE'), v_restaurant_id, v_period, 'salary_payment', p_salary_entry_id,
            'Salary entry', auth.uid())
    returning id into v_entry_id;

    insert into journal_lines (journal_entry_id, accounting_account_id, debit_amount, credit_amount)
    values (v_entry_id, v_salary_account, v_net, 0);
    insert into journal_lines (journal_entry_id, accounting_account_id, debit_amount, credit_amount)
    values (v_entry_id, v_payable_account, 0, v_net);

    v_new_status := 'posted';
  else
    raise exception 'Unknown action %', p_action;
  end if;

  update salary_entries set status = v_new_status where id = p_salary_entry_id;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, old_value, new_value)
  values (auth.uid(), p_action, 'payroll', 'salary_entry', p_salary_entry_id,
          jsonb_build_object('status', v_status), jsonb_build_object('status', v_new_status));
end;
$$;

-- Records an actual salary payout, mirroring the purchase-payment pattern:
-- a bank/cash transaction, a salary_payments row, a journal entry that
-- clears the payable, and a payment_status update.
create or replace function public.post_salary_payment(
  p_salary_entry_id uuid, p_amount numeric, p_payment_method text,
  p_bank_account_id uuid default null, p_cash_account_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry salary_entries%rowtype;
  v_already_paid numeric(14,2);
  v_new_paid numeric(14,2);
  v_entry_id uuid;
  v_payable_account uuid;
  v_cash_account uuid;
begin
  select * into v_entry from salary_entries where id = p_salary_entry_id for update;
  if v_entry.id is null then raise exception 'Salary entry not found'; end if;
  if not app.has_restaurant_access(v_entry.restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;
  if not app.has_permission('payroll.manage') then raise exception 'Not authorized'; end if;
  if v_entry.status != 'posted' then raise exception 'Only posted salary entries can be paid'; end if;
  if p_amount <= 0 or p_amount > v_entry.net_salary then raise exception 'Invalid payment amount'; end if;

  select coalesce(sum(amount), 0) into v_already_paid from salary_payments where salary_entry_id = p_salary_entry_id;
  v_new_paid := v_already_paid + p_amount;
  if v_new_paid > v_entry.net_salary then raise exception 'Payment exceeds net salary'; end if;

  insert into salary_payments (salary_entry_id, amount, payment_date, payment_method, bank_account_id, cash_account_id, created_by)
  values (p_salary_entry_id, p_amount, current_date, p_payment_method, p_bank_account_id, p_cash_account_id, auth.uid());

  insert into bank_transactions (
    restaurant_id, bank_account_id, cash_account_id, transaction_date, direction, amount,
    source_type, source_id, created_by
  ) values (
    v_entry.restaurant_id, p_bank_account_id, p_cash_account_id, current_date, 'debit', p_amount,
    'salary_payment', p_salary_entry_id, auth.uid()
  );

  select id into v_payable_account from accounting_accounts where code = '2000';
  select id into v_cash_account from accounting_accounts where code = '1000';

  insert into journal_entries (entry_number, restaurant_id, entry_date, source_type, source_id, description, created_by)
  values (app.next_document_number('JE'), v_entry.restaurant_id, current_date, 'salary_payment', p_salary_entry_id,
          'Salary payment', auth.uid())
  returning id into v_entry_id;

  insert into journal_lines (journal_entry_id, accounting_account_id, debit_amount, credit_amount)
  values (v_entry_id, v_payable_account, p_amount, 0);
  insert into journal_lines (journal_entry_id, accounting_account_id, debit_amount, credit_amount)
  values (v_entry_id, v_cash_account, 0, p_amount);

  update salary_entries set
    payment_status = case when v_new_paid >= net_salary then 'paid' else 'partially_paid' end
  where id = p_salary_entry_id;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (auth.uid(), 'pay', 'payroll', 'salary_entry', p_salary_entry_id, jsonb_build_object('amount', p_amount));
end;
$$;

grant execute on function public.save_salary_entry_draft(jsonb) to authenticated;
grant execute on function public.transition_salary_entry(uuid, text) to authenticated;
grant execute on function public.post_salary_payment(uuid, numeric, text, uuid, uuid) to authenticated;
