-- Draft creation/edit for a payment voucher, mirroring save_purchase_draft.
-- `items` is an optional description breakdown (e.g. for an expense split);
-- when omitted, `amount` is taken directly from the payload.
create or replace function public.save_payment_voucher_draft(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher_id uuid;
  v_restaurant_id uuid;
  v_status voucher_status;
  v_amount numeric(14,2);
begin
  v_restaurant_id := (payload ->> 'restaurant_id')::uuid;
  if not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;
  if not app.has_permission('payments.create') then
    raise exception 'Not authorized to create payment vouchers';
  end if;

  if jsonb_array_length(coalesce(payload -> 'items', '[]'::jsonb)) > 0 then
    select coalesce(sum((item ->> 'amount')::numeric), 0) into v_amount
    from jsonb_array_elements(payload -> 'items') as item;
  else
    v_amount := (payload ->> 'amount')::numeric;
  end if;

  if v_amount is null or v_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  v_voucher_id := nullif(payload ->> 'id', '')::uuid;

  if v_voucher_id is not null then
    select status into v_status from payment_vouchers where id = v_voucher_id;
    if v_status is null then raise exception 'Payment voucher not found'; end if;
    if v_status != 'draft' then raise exception 'Only draft vouchers can be edited'; end if;

    update payment_vouchers set
      payee_type = payload ->> 'payee_type',
      supplier_id = nullif(payload ->> 'supplier_id', '')::uuid,
      expense_category_id = nullif(payload ->> 'expense_category_id', '')::uuid,
      amount = v_amount,
      payment_method = payload ->> 'payment_method',
      bank_account_id = nullif(payload ->> 'bank_account_id', '')::uuid,
      cash_account_id = nullif(payload ->> 'cash_account_id', '')::uuid,
      payment_reference = nullif(payload ->> 'payment_reference', ''),
      voucher_date = (payload ->> 'voucher_date')::date,
      notes = nullif(payload ->> 'notes', '')
    where id = v_voucher_id;

    delete from payment_voucher_items where payment_voucher_id = v_voucher_id;
  else
    insert into payment_vouchers (
      voucher_number, restaurant_id, payee_type, supplier_id, expense_category_id,
      amount, payment_method, bank_account_id, cash_account_id, payment_reference,
      voucher_date, status, notes, created_by
    ) values (
      app.next_document_number('PV'), v_restaurant_id, payload ->> 'payee_type',
      nullif(payload ->> 'supplier_id', '')::uuid, nullif(payload ->> 'expense_category_id', '')::uuid,
      v_amount, payload ->> 'payment_method', nullif(payload ->> 'bank_account_id', '')::uuid,
      nullif(payload ->> 'cash_account_id', '')::uuid, nullif(payload ->> 'payment_reference', ''),
      (payload ->> 'voucher_date')::date, 'draft', nullif(payload ->> 'notes', ''), auth.uid()
    ) returning id into v_voucher_id;
  end if;

  insert into payment_voucher_items (payment_voucher_id, description, amount)
  select v_voucher_id, item ->> 'description', (item ->> 'amount')::numeric
  from jsonb_array_elements(coalesce(payload -> 'items', '[]'::jsonb)) as item;

  return v_voucher_id;
end;
$$;

create or replace function public.transition_payment_voucher(
  p_voucher_id uuid, p_action text, p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_status voucher_status;
  v_new_status voucher_status;
  v_approval_action approval_action;
begin
  select restaurant_id, status into v_restaurant_id, v_status
  from payment_vouchers where id = p_voucher_id for update;

  if v_restaurant_id is null then raise exception 'Payment voucher not found'; end if;
  if not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;

  if p_action = 'submit' then
    if v_status != 'draft' then raise exception 'Only draft vouchers can be submitted'; end if;
    if not app.has_permission('payments.create') then raise exception 'Not authorized'; end if;
    v_new_status := 'pending_approval';
    v_approval_action := 'submitted';
  elsif p_action = 'approve' then
    if v_status != 'pending_approval' then raise exception 'Only pending vouchers can be approved'; end if;
    if not app.has_permission('payments.approve') then raise exception 'Not authorized'; end if;
    v_new_status := 'approved';
    v_approval_action := 'approved';
  elsif p_action = 'reject' then
    if v_status != 'pending_approval' then raise exception 'Only pending vouchers can be rejected'; end if;
    if not app.has_permission('payments.approve') then raise exception 'Not authorized'; end if;
    v_new_status := 'rejected';
    v_approval_action := 'rejected';
  elsif p_action = 'cancel' then
    if v_status not in ('draft', 'pending_approval') then
      raise exception 'A voucher in this state cannot be cancelled';
    end if;
    if not (app.has_permission('payments.create') or app.has_permission('payments.approve')) then
      raise exception 'Not authorized';
    end if;
    v_new_status := 'cancelled';
    v_approval_action := null;
  else
    raise exception 'Unknown action %', p_action;
  end if;

  update payment_vouchers set status = v_new_status where id = p_voucher_id;

  if v_approval_action is not null then
    insert into approvals (entity_type, entity_id, action, comment, actor_id)
    values ('payment_voucher', p_voucher_id, v_approval_action, p_comment, auth.uid());
  end if;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, old_value, new_value)
  values (
    auth.uid(), p_action, 'payments', 'payment_voucher', p_voucher_id,
    jsonb_build_object('status', v_status), jsonb_build_object('status', v_new_status)
  );
end;
$$;

-- The actual posting step — the multi-table atomic write
-- docs/architecture.md §5 uses as its example. `p_allocations` (optional,
-- supplier payments only) is [{purchase_id, amount}]; unallocated amount is
-- recorded as a supplier advance (spec §28).
create or replace function public.post_payment_voucher(p_voucher_id uuid, p_allocations jsonb default '[]'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher payment_vouchers%rowtype;
  v_supplier_payment_id uuid;
  v_allocated numeric(14,2) := 0;
  v_alloc record;
  v_entry_id uuid;
  v_cash_account uuid;
  v_offset_account uuid;
  v_period_status accounting_period_status;
begin
  select * into v_voucher from payment_vouchers where id = p_voucher_id for update;
  if v_voucher.id is null then raise exception 'Payment voucher not found'; end if;
  if not app.has_restaurant_access(v_voucher.restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;
  if not app.has_permission('payments.post') then
    raise exception 'Not authorized to post payments';
  end if;
  if v_voucher.status != 'approved' then
    raise exception 'Only approved vouchers can be posted';
  end if;

  select status into v_period_status from accounting_periods
  where (restaurant_id = v_voucher.restaurant_id or restaurant_id is null)
    and period_month = date_trunc('month', v_voucher.voucher_date)::date
  order by restaurant_id nulls last
  limit 1;
  if v_period_status = 'locked' then
    raise exception 'The accounting period for % is locked', to_char(v_voucher.voucher_date, 'Mon YYYY');
  end if;

  insert into bank_transactions (
    restaurant_id, bank_account_id, cash_account_id, transaction_date, direction, amount,
    source_type, source_id, reference, created_by
  ) values (
    v_voucher.restaurant_id, v_voucher.bank_account_id, v_voucher.cash_account_id, v_voucher.voucher_date,
    'debit', v_voucher.amount, 'supplier_payment', p_voucher_id, v_voucher.payment_reference, auth.uid()
  );

  select id into v_cash_account from accounting_accounts where code = '1000';

  if v_voucher.payee_type = 'supplier' then
    insert into supplier_payments (payment_voucher_id, supplier_id, restaurant_id, amount, is_advance, payment_date)
    values (
      p_voucher_id, v_voucher.supplier_id, v_voucher.restaurant_id, v_voucher.amount,
      jsonb_array_length(p_allocations) = 0, v_voucher.voucher_date
    )
    returning id into v_supplier_payment_id;

    for v_alloc in select * from jsonb_to_recordset(p_allocations) as x(purchase_id uuid, amount numeric)
    loop
      insert into payment_allocations (supplier_payment_id, purchase_id, amount)
      values (v_supplier_payment_id, v_alloc.purchase_id, v_alloc.amount);

      update purchases set
        paid_amount = paid_amount + v_alloc.amount,
        payment_status = case
          when paid_amount + v_alloc.amount >= total_amount then 'paid'
          when paid_amount + v_alloc.amount > 0 then 'partially_paid'
          else 'unpaid'
        end
      where id = v_alloc.purchase_id;

      v_allocated := v_allocated + v_alloc.amount;
    end loop;

    select id into v_offset_account from accounting_accounts where code = '2000'; -- Accounts Payable
  else
    select id into v_offset_account from accounting_accounts where code = '5200'; -- Operating Expenses
  end if;

  insert into journal_entries (entry_number, restaurant_id, entry_date, source_type, source_id, description, created_by)
  values (
    app.next_document_number('JE'), v_voucher.restaurant_id, v_voucher.voucher_date, 'supplier_payment', p_voucher_id,
    'Payment voucher ' || v_voucher.voucher_number, auth.uid()
  )
  returning id into v_entry_id;

  insert into journal_lines (journal_entry_id, accounting_account_id, debit_amount, credit_amount, memo)
  values (v_entry_id, v_offset_account, v_voucher.amount, 0, 'Payment issued');

  insert into journal_lines (journal_entry_id, accounting_account_id, debit_amount, credit_amount, memo)
  values (v_entry_id, v_cash_account, 0, v_voucher.amount, 'Cash/bank paid out');

  update payment_vouchers set status = 'posted', posted_at = now() where id = p_voucher_id;

  insert into approvals (entity_type, entity_id, action, actor_id)
  values ('payment_voucher', p_voucher_id, 'posted', auth.uid());

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (auth.uid(), 'post', 'payments', 'payment_voucher', p_voucher_id, jsonb_build_object('amount', v_voucher.amount));
end;
$$;

grant execute on function public.save_payment_voucher_draft(jsonb) to authenticated;
grant execute on function public.transition_payment_voucher(uuid, text, text) to authenticated;
grant execute on function public.post_payment_voucher(uuid, jsonb) to authenticated;
