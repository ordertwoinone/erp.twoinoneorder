-- Expense heads (expense_categories) get full CRUD with a ledger, a
-- description and an optional restaurant; ledgers (accounting_accounts) can
-- belong to one restaurant. A head's ledger is what posting an expense
-- debits (falling back to 5200 Operating Expenses as before).
-- Safe to re-run.

-- === Columns =====================================================================
-- Ledger owned by one restaurant; null = shared by every restaurant.
alter table accounting_accounts
  add column if not exists restaurant_id uuid references restaurants(id) on delete cascade,
  add column if not exists description text;

alter table expense_categories
  add column if not exists description text,
  add column if not exists ledger_account_id uuid references accounting_accounts(id),
  -- Head used only by one restaurant; null = available to every restaurant.
  add column if not exists restaurant_id uuid references restaurants(id) on delete cascade,
  add column if not exists created_at timestamptz not null default now();

-- The same head name may now exist for different restaurants, but not twice
-- for the same one (or twice as a shared head).
alter table expense_categories drop constraint if exists expense_categories_name_key;
create unique index if not exists expense_categories_name_scope_idx
  on expense_categories (coalesce(restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- Restaurant heads are only visible to people with access to that restaurant.
drop policy if exists expense_categories_select on expense_categories;
create policy expense_categories_select on expense_categories for select
  using (auth.uid() is not null and (restaurant_id is null or app.has_restaurant_access(restaurant_id)));
drop policy if exists expense_categories_write on expense_categories;
create policy expense_categories_write on expense_categories for all
  using (app.has_permission('expenses.manage') and (restaurant_id is null or app.has_restaurant_access(restaurant_id)))
  with check (app.has_permission('expenses.manage') and (restaurant_id is null or app.has_restaurant_access(restaurant_id)));

-- === Ledger list for the expense head form =======================================
-- accounting_accounts is readable only with accounting.view, but whoever
-- manages expenses must be able to pick the ledger — so this returns just the
-- list (no balances). With p_restaurant_id: shared ledgers + that
-- restaurant's; without: shared + every restaurant the caller can access.
create or replace function public.list_ledgers(p_restaurant_id uuid default null)
returns table (
  id uuid, code text, name text, account_type text, restaurant_id uuid, restaurant_name text, is_active boolean, description text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (app.has_permission('expenses.manage') or app.has_permission('accounting.view')) then
    raise exception 'Not authorized';
  end if;
  if p_restaurant_id is not null and not app.has_restaurant_access(p_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;
  return query
  select a.id, a.code, a.name, a.account_type, a.restaurant_id, r.name, a.is_active, a.description
  from accounting_accounts a
  left join restaurants r on r.id = a.restaurant_id
  where (a.restaurant_id is null
         or (p_restaurant_id is not null and a.restaurant_id = p_restaurant_id)
         or (p_restaurant_id is null and app.has_restaurant_access(a.restaurant_id)))
  order by a.restaurant_id is not null, r.name, a.code;
end;
$$;
grant execute on function public.list_ledgers(uuid) to authenticated;

-- Adds a ledger. Accountants can add any type; expense managers can add
-- expense ledgers (the "New ledger" link on the expense head form). The code
-- is generated (next free 5xxx number) when left blank.
create or replace function public.create_ledger(
  p_name text, p_restaurant_id uuid default null, p_account_type text default 'expense', p_code text default null, p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := nullif(trim(p_code), '');
  v_id uuid;
begin
  if not (app.has_permission('accounting.manage') or (app.has_permission('expenses.manage') and p_account_type = 'expense')) then
    raise exception 'Not authorized to add ledgers';
  end if;
  if nullif(trim(p_name), '') is null then raise exception 'Ledger name is required'; end if;
  if p_account_type not in ('asset', 'liability', 'equity', 'income', 'expense') then raise exception 'Unknown ledger type'; end if;
  if p_restaurant_id is not null and not app.has_restaurant_access(p_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;
  if v_code is null then
    select coalesce(max(code::int), 5399) + 1 into v_code
    from accounting_accounts where code ~ '^5[3-9][0-9]{2}$';
    v_code := v_code::text;
  end if;
  if exists (select 1 from accounting_accounts where code = v_code) then
    raise exception 'Ledger code % is already used', v_code;
  end if;
  insert into accounting_accounts (code, name, account_type, restaurant_id, description)
  values (v_code, trim(p_name), p_account_type, p_restaurant_id, nullif(trim(p_description), ''))
  returning id into v_id;
  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (auth.uid(), 'create', 'accounting', 'ledger', v_id, jsonb_build_object('code', v_code, 'name', p_name, 'restaurant_id', p_restaurant_id));
  return v_id;
end;
$$;
grant execute on function public.create_ledger(text, uuid, text, text, text) to authenticated;

-- === Expense head CRUD ============================================================
-- Create or update (payload.id). The ledger must be an expense ledger that's
-- shared or belongs to the head's restaurant.
create or replace function public.save_expense_head(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := nullif(payload ->> 'id', '')::uuid;
  v_restaurant_id uuid := nullif(payload ->> 'restaurant_id', '')::uuid;
  v_ledger_id uuid := nullif(payload ->> 'ledger_account_id', '')::uuid;
  v_ledger accounting_accounts%rowtype;
  v_existing_restaurant uuid;
begin
  if not app.has_permission('expenses.manage') then raise exception 'Not authorized to manage expense heads'; end if;
  if nullif(trim(payload ->> 'name'), '') is null then raise exception 'Expense head name is required'; end if;
  if v_restaurant_id is not null and not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;
  if v_ledger_id is not null then
    select * into v_ledger from accounting_accounts where id = v_ledger_id;
    if v_ledger.id is null then raise exception 'Ledger not found'; end if;
    if v_ledger.account_type <> 'expense' then raise exception 'Pick an expense ledger (5xxx)'; end if;
    if v_ledger.restaurant_id is not null and v_ledger.restaurant_id is distinct from v_restaurant_id then
      raise exception 'That ledger belongs to another restaurant';
    end if;
  end if;

  if v_id is not null then
    select restaurant_id into v_existing_restaurant from expense_categories where id = v_id;
    if not found then raise exception 'Expense head not found'; end if;
    if v_existing_restaurant is not null and not app.has_restaurant_access(v_existing_restaurant) then
      raise exception 'Not authorized for this expense head';
    end if;
    update expense_categories set
      name = trim(payload ->> 'name'),
      description = nullif(trim(payload ->> 'description'), ''),
      ledger_account_id = v_ledger_id,
      restaurant_id = v_restaurant_id,
      is_head_office_only = coalesce((payload ->> 'is_head_office_only')::boolean, false),
      is_active = coalesce((payload ->> 'is_active')::boolean, true)
    where id = v_id;
  else
    insert into expense_categories (name, description, ledger_account_id, restaurant_id, is_head_office_only, is_active)
    values (trim(payload ->> 'name'), nullif(trim(payload ->> 'description'), ''), v_ledger_id, v_restaurant_id,
            coalesce((payload ->> 'is_head_office_only')::boolean, false), coalesce((payload ->> 'is_active')::boolean, true))
    returning id into v_id;
  end if;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (auth.uid(), case when payload ->> 'id' is null then 'create' else 'update' end, 'expenses', 'expense_head', v_id, payload);
  return v_id;
exception when unique_violation then
  raise exception 'An expense head called "%" already exists for this restaurant', trim(payload ->> 'name');
end;
$$;
grant execute on function public.save_expense_head(jsonb) to authenticated;

-- Heads already used by expenses can't be deleted (history) — deactivate instead.
create or replace function public.delete_expense_head(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_restaurant_id uuid;
  v_used bigint;
begin
  if not app.has_permission('expenses.manage') then raise exception 'Not authorized to manage expense heads'; end if;
  select name, restaurant_id into v_name, v_restaurant_id from expense_categories where id = p_id;
  if v_name is null then raise exception 'Expense head not found'; end if;
  if v_restaurant_id is not null and not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this expense head';
  end if;
  select count(*) into v_used from operating_expenses where expense_category_id = p_id;
  if v_used > 0 then
    raise exception '"%" is used by % expense%. Mark it inactive instead to hide it.', v_name, v_used, case when v_used = 1 then '' else 's' end;
  end if;
  delete from expense_categories where id = p_id;
  insert into audit_logs (actor_id, action, module, entity_type, entity_id, old_value)
  values (auth.uid(), 'delete', 'expenses', 'expense_head', p_id, jsonb_build_object('name', v_name));
end;
$$;
grant execute on function public.delete_expense_head(uuid) to authenticated;

-- === save_expense_draft (replaces 0035) ===========================================
-- Same as before, plus: the head must be active and shared or for this restaurant.
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
  v_head expense_categories%rowtype;
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

  select * into v_head from expense_categories where id = (payload ->> 'expense_category_id')::uuid;
  if v_head.id is null then raise exception 'Expense head not found'; end if;
  if v_head.restaurant_id is not null and v_head.restaurant_id <> v_restaurant_id then
    raise exception 'The expense head "%" belongs to another restaurant', v_head.name;
  end if;

  if v_expense_id is not null then
    update operating_expenses set
      expense_category_id = v_head.id,
      amount = (payload ->> 'amount')::numeric,
      expense_date = (payload ->> 'expense_date')::date,
      status = 'draft',
      notes = nullif(payload ->> 'notes', '')
    where id = v_expense_id;
  else
    insert into operating_expenses (
      expense_number, restaurant_id, expense_category_id, amount, expense_date, status, notes, created_by
    ) values (
      app.next_document_number('EXP'), v_restaurant_id, v_head.id,
      (payload ->> 'amount')::numeric, (payload ->> 'expense_date')::date, 'draft',
      nullif(payload ->> 'notes', ''), auth.uid()
    ) returning id into v_expense_id;
  end if;

  return v_expense_id;
end;
$$;
grant execute on function public.save_expense_draft(jsonb) to authenticated;

-- === transition_expense (replaces 0029) ===========================================
-- Same workflow; posting now debits the head's ledger (5200 when none is set).
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
  v_category_id uuid;
  v_entry_id uuid;
  v_expense_account uuid;
  v_payable_account uuid;
  v_period_status accounting_period_status;
  v_head_name text;
begin
  select restaurant_id, status, amount, expense_date, expense_category_id
  into v_restaurant_id, v_status, v_amount, v_expense_date, v_category_id
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

    select c.ledger_account_id, c.name into v_expense_account, v_head_name from expense_categories c where c.id = v_category_id;
    if v_expense_account is null then
      select id into v_expense_account from accounting_accounts where code = '5200';
    end if;
    select id into v_payable_account from accounting_accounts where code = '2000';

    insert into journal_entries (entry_number, restaurant_id, entry_date, source_type, source_id, description, created_by)
    values (app.next_document_number('JE'), v_restaurant_id, v_expense_date, 'operating_expense', p_expense_id,
            coalesce('Expense: ' || v_head_name, 'Operating expense'), auth.uid())
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
grant execute on function public.transition_expense(uuid, text, text) to authenticated;
