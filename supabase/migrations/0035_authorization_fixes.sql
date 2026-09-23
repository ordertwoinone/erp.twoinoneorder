-- Fixes a real authorization bug shared by every "save draft" RPC added in
-- 0025-0031: on edit, each checked has_restaurant_access() against whatever
-- restaurant_id the CALLER put in the payload, not the restaurant the
-- existing row actually belongs to — and the UPDATE never touches
-- restaurant_id, so a caller could pass a restaurant they legitimately have
-- access to while supplying the id of a draft that belongs to a different,
-- inaccessible restaurant, and the check would wrongly pass. Each fix below
-- re-derives restaurant_id from the existing row on edit and only trusts
-- the payload's restaurant_id when creating a new record.

create or replace function public.save_purchase_draft(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase_id uuid;
  v_restaurant_id uuid;
  v_status purchase_status;
  v_subtotal numeric(14,2) := 0;
  v_discount numeric(14,2) := 0;
  v_tax numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
begin
  if not app.has_permission('purchases.create') then
    raise exception 'Not authorized to create purchases';
  end if;
  if jsonb_array_length(coalesce(payload -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'A purchase needs at least one line item';
  end if;

  v_purchase_id := nullif(payload ->> 'id', '')::uuid;

  if v_purchase_id is not null then
    select restaurant_id, status into v_restaurant_id, v_status from purchases where id = v_purchase_id;
    if v_restaurant_id is null then
      raise exception 'Purchase not found';
    end if;
    if v_status not in ('draft', 'returned') then
      raise exception 'Only draft or returned purchases can be edited';
    end if;
  else
    v_restaurant_id := (payload ->> 'restaurant_id')::uuid;
  end if;

  if not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;

  select
    coalesce(sum((item ->> 'quantity')::numeric * (item ->> 'unit_price')::numeric), 0),
    coalesce(sum(coalesce((item ->> 'discount_amount')::numeric, 0)), 0),
    coalesce(sum(coalesce((item ->> 'tax_amount')::numeric, 0)), 0)
  into v_subtotal, v_discount, v_tax
  from jsonb_array_elements(payload -> 'items') as item;

  v_total := v_subtotal - v_discount + v_tax;

  if v_purchase_id is null then
    insert into purchases (
      purchase_number, restaurant_id, supplier_id, invoice_number, invoice_date,
      status, subtotal_amount, discount_amount, tax_amount, total_amount, notes, created_by
    ) values (
      app.next_document_number('PUR'), v_restaurant_id, (payload ->> 'supplier_id')::uuid,
      payload ->> 'invoice_number', (payload ->> 'invoice_date')::date,
      'draft', v_subtotal, v_discount, v_tax, v_total, nullif(payload ->> 'notes', ''), auth.uid()
    ) returning id into v_purchase_id;
  else
    update purchases set
      supplier_id = (payload ->> 'supplier_id')::uuid,
      invoice_number = payload ->> 'invoice_number',
      invoice_date = (payload ->> 'invoice_date')::date,
      status = 'draft',
      subtotal_amount = v_subtotal,
      discount_amount = v_discount,
      tax_amount = v_tax,
      total_amount = v_total,
      notes = nullif(payload ->> 'notes', '')
    where id = v_purchase_id;

    delete from purchase_items where purchase_id = v_purchase_id;
  end if;

  insert into purchase_items (
    purchase_id, product_id, unit_id, pack_size, quantity, unit_price,
    discount_amount, tax_amount, line_total
  )
  select
    v_purchase_id,
    (item ->> 'product_id')::uuid,
    (item ->> 'unit_id')::uuid,
    nullif(item ->> 'pack_size', '')::numeric,
    (item ->> 'quantity')::numeric,
    (item ->> 'unit_price')::numeric,
    coalesce((item ->> 'discount_amount')::numeric, 0),
    coalesce((item ->> 'tax_amount')::numeric, 0),
    ((item ->> 'quantity')::numeric * (item ->> 'unit_price')::numeric)
      - coalesce((item ->> 'discount_amount')::numeric, 0)
      + coalesce((item ->> 'tax_amount')::numeric, 0)
  from jsonb_array_elements(payload -> 'items') as item;

  return v_purchase_id;
end;
$$;

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
  if not app.has_permission('sales.create') then
    raise exception 'Not authorized to enter sales';
  end if;

  v_gross := coalesce((payload ->> 'gross_sales')::numeric, 0);
  v_discounts := coalesce((payload ->> 'discounts')::numeric, 0);
  v_refunds := coalesce((payload ->> 'refunds')::numeric, 0);
  v_tax := coalesce((payload ->> 'tax_amount')::numeric, 0);

  v_entry_id := nullif(payload ->> 'id', '')::uuid;

  if v_entry_id is not null then
    select restaurant_id, status into v_restaurant_id, v_status from sales_entries where id = v_entry_id;
    if v_restaurant_id is null then raise exception 'Sales entry not found'; end if;
    if v_status not in ('draft', 'submitted') then
      raise exception 'Only draft or submitted entries can be edited';
    end if;
  else
    v_restaurant_id := (payload ->> 'restaurant_id')::uuid;
  end if;

  if not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;

  if v_entry_id is not null then
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
  if not app.has_permission('expenses.manage') then
    raise exception 'Not authorized to manage expenses';
  end if;

  v_expense_id := nullif(payload ->> 'id', '')::uuid;

  if v_expense_id is not null then
    select restaurant_id, status into v_restaurant_id, v_status from operating_expenses where id = v_expense_id;
    if v_restaurant_id is null then raise exception 'Expense not found'; end if;
    if v_status not in ('draft', 'rejected') then raise exception 'Only draft/rejected expenses can be edited'; end if;
  else
    v_restaurant_id := (payload ->> 'restaurant_id')::uuid;
  end if;

  if not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;

  if v_expense_id is not null then
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
    select restaurant_id, status into v_restaurant_id, v_status from salary_entries where id = v_entry_id;
    if v_restaurant_id is null then raise exception 'Salary entry not found'; end if;
    if v_status != 'draft' then raise exception 'Only draft entries can be edited'; end if;
  else
    v_restaurant_id := (payload ->> 'restaurant_id')::uuid;
  end if;

  if not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;

  if v_entry_id is not null then
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
    select restaurant_id, status into v_restaurant_id, v_status from payment_vouchers where id = v_voucher_id;
    if v_restaurant_id is null then raise exception 'Payment voucher not found'; end if;
    if v_status != 'draft' then raise exception 'Only draft vouchers can be edited'; end if;
  else
    v_restaurant_id := (payload ->> 'restaurant_id')::uuid;
  end if;

  if not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;

  if v_voucher_id is not null then
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

create or replace function public.save_purchase_request(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_restaurant_id uuid;
  v_status text;
begin
  if not app.has_permission('purchases.create') then
    raise exception 'Not authorized to create purchase requests';
  end if;
  if jsonb_array_length(coalesce(payload -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'Add at least one item';
  end if;

  v_request_id := nullif(payload ->> 'id', '')::uuid;

  if v_request_id is not null then
    select restaurant_id, status into v_restaurant_id, v_status from purchase_requests where id = v_request_id;
    if v_restaurant_id is null then raise exception 'Purchase request not found'; end if;
    if v_status != 'requested' then raise exception 'Only requests awaiting review can be edited'; end if;
  else
    v_restaurant_id := (payload ->> 'restaurant_id')::uuid;
  end if;

  if not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;

  if v_request_id is not null then
    update purchase_requests set notes = nullif(payload ->> 'notes', '') where id = v_request_id;
    delete from purchase_request_items where purchase_request_id = v_request_id;
  else
    insert into purchase_requests (request_number, restaurant_id, status, notes, requested_by)
    values (app.next_document_number('PR'), v_restaurant_id, 'requested', nullif(payload ->> 'notes', ''), auth.uid())
    returning id into v_request_id;
  end if;

  insert into purchase_request_items (purchase_request_id, product_id, unit_id, quantity, notes)
  select v_request_id, (item ->> 'product_id')::uuid, (item ->> 'unit_id')::uuid,
         (item ->> 'quantity')::numeric, nullif(item ->> 'notes', '')
  from jsonb_array_elements(payload -> 'items') as item;

  return v_request_id;
end;
$$;

-- create_card_settlement (0033) checked settlements.manage but never
-- verified the caller actually has access to each allocation's restaurant —
-- a non-all-restaurant accountant could credit a restaurant they have no
-- access to. Add the missing per-allocation check.
create or replace function public.create_card_settlement(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement_id uuid;
  v_amount numeric(14,2);
  v_allocated numeric(14,2);
  v_alloc_restaurant uuid;
begin
  if not app.has_permission('settlements.manage') then
    raise exception 'Not authorized to manage settlements';
  end if;

  v_amount := (payload ->> 'amount')::numeric;

  select coalesce(sum((item ->> 'amount')::numeric), 0) into v_allocated
  from jsonb_array_elements(coalesce(payload -> 'allocations', '[]'::jsonb)) as item;

  if v_allocated > v_amount then
    raise exception 'Allocated amount (%) exceeds settlement amount (%)', v_allocated, v_amount;
  end if;

  for v_alloc_restaurant in
    select distinct (item ->> 'restaurant_id')::uuid
    from jsonb_array_elements(coalesce(payload -> 'allocations', '[]'::jsonb)) as item
  loop
    if not app.has_restaurant_access(v_alloc_restaurant) then
      raise exception 'Not authorized for restaurant %', v_alloc_restaurant;
    end if;
  end loop;

  insert into card_settlements (card_machine_id, bank_account_id, credit_date, bank_reference, amount, status, notes, created_by)
  values (
    (payload ->> 'card_machine_id')::uuid, (payload ->> 'bank_account_id')::uuid,
    (payload ->> 'credit_date')::date, nullif(payload ->> 'bank_reference', ''), v_amount,
    case when v_allocated = 0 then 'unmatched' when v_allocated < v_amount then 'partially_matched' else 'matched' end,
    nullif(payload ->> 'notes', ''), auth.uid()
  )
  returning id into v_settlement_id;

  insert into card_settlement_allocations (card_settlement_id, restaurant_id, amount, covers_from, covers_to)
  select v_settlement_id, (item ->> 'restaurant_id')::uuid, (item ->> 'amount')::numeric,
         (item ->> 'covers_from')::date, (item ->> 'covers_to')::date
  from jsonb_array_elements(coalesce(payload -> 'allocations', '[]'::jsonb)) as item;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (auth.uid(), 'create', 'settlements', 'card_settlement', v_settlement_id, jsonb_build_object('amount', v_amount));

  return v_settlement_id;
end;
$$;

-- post_payment_voucher (0027) never verified that an allocation's
-- purchase_id actually belongs to the voucher's supplier/restaurant, nor
-- that allocations don't exceed the voucher amount or a purchase's
-- outstanding balance. A caller (or a buggy client) could settle an
-- unrelated purchase, from a different restaurant or supplier entirely,
-- using this voucher's money.
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
  v_purchase purchases%rowtype;
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

  select coalesce(sum((item ->> 'amount')::numeric), 0) into v_allocated
  from jsonb_array_elements(p_allocations) as item;
  if v_allocated > v_voucher.amount then
    raise exception 'Allocated amount (%) exceeds the voucher amount (%)', v_allocated, v_voucher.amount;
  end if;
  v_allocated := 0;

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
      select * into v_purchase from purchases where id = v_alloc.purchase_id;
      if v_purchase.id is null then
        raise exception 'Purchase % not found', v_alloc.purchase_id;
      end if;
      if v_purchase.supplier_id != v_voucher.supplier_id or v_purchase.restaurant_id != v_voucher.restaurant_id then
        raise exception 'Purchase % does not belong to this voucher''s supplier/restaurant', v_alloc.purchase_id;
      end if;
      if v_alloc.amount > (v_purchase.total_amount - v_purchase.paid_amount) then
        raise exception 'Allocation for purchase % exceeds its outstanding balance', v_alloc.purchase_id;
      end if;

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

-- create_branch_transfer (0032) never checked that the source restaurant
-- actually had enough stock before dispatching, so it could silently drive
-- quantity_on_hand negative. Fail loudly instead.
create or replace function public.create_branch_transfer(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer_id uuid;
  v_from_restaurant uuid;
  v_to_restaurant uuid;
  v_item record;
  v_available numeric;
begin
  v_from_restaurant := (payload ->> 'from_restaurant_id')::uuid;
  v_to_restaurant := (payload ->> 'to_restaurant_id')::uuid;

  if v_from_restaurant = v_to_restaurant then
    raise exception 'Source and destination restaurants must differ';
  end if;
  -- Dispatching removes stock from the source restaurant's books, so the
  -- caller must have access to the source specifically — access to only the
  -- destination must not be enough to decrement another restaurant's stock.
  if not app.has_restaurant_access(v_from_restaurant) then
    raise exception 'Not authorized for the source restaurant';
  end if;
  if not app.has_permission('inventory.manage') then
    raise exception 'Not authorized to manage inventory';
  end if;
  if jsonb_array_length(coalesce(payload -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'Add at least one item';
  end if;

  insert into branch_transfers (transfer_number, from_restaurant_id, to_restaurant_id, status, dispatch_date, dispatched_by, notes)
  values (
    app.next_document_number('TRF'), v_from_restaurant, v_to_restaurant, 'dispatched', current_date, auth.uid(),
    nullif(payload ->> 'notes', '')
  )
  returning id into v_transfer_id;

  for v_item in
    select
      (item ->> 'product_id')::uuid as product_id,
      (item ->> 'unit_id')::uuid as unit_id,
      (item ->> 'quantity')::numeric as quantity,
      coalesce((select average_cost from stock_balances where restaurant_id = v_from_restaurant and product_id = (item ->> 'product_id')::uuid), 0) as unit_cost
    from jsonb_array_elements(payload -> 'items') as item
  loop
    select quantity_on_hand into v_available
    from stock_balances where restaurant_id = v_from_restaurant and product_id = v_item.product_id;

    if coalesce(v_available, 0) < v_item.quantity then
      raise exception 'Insufficient stock for product % at source restaurant (have %, need %)',
        v_item.product_id, coalesce(v_available, 0), v_item.quantity;
    end if;

    insert into branch_transfer_items (branch_transfer_id, product_id, unit_id, quantity, unit_cost)
    values (v_transfer_id, v_item.product_id, v_item.unit_id, v_item.quantity, v_item.unit_cost);

    insert into stock_movements (
      restaurant_id, product_id, movement_type, quantity, unit_cost, total_cost,
      source_type, source_id, movement_date, created_by
    ) values (
      v_from_restaurant, v_item.product_id, 'transfer_out', -v_item.quantity, v_item.unit_cost,
      -v_item.quantity * v_item.unit_cost, 'branch_transfer', v_transfer_id, current_date, auth.uid()
    );

    update stock_balances set
      quantity_on_hand = quantity_on_hand - v_item.quantity,
      updated_at = now()
    where restaurant_id = v_from_restaurant and product_id = v_item.product_id;
  end loop;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (auth.uid(), 'dispatch', 'inventory', 'branch_transfer', v_transfer_id,
          jsonb_build_object('from', v_from_restaurant, 'to', v_to_restaurant));

  return v_transfer_id;
end;
$$;
