-- Purchase Request screen, round 2:
--  * monthly purchase budget per restaurant with a performance bonus
--    (<=60% used -> good bonus, 60-80% -> safe bonus, 80-100% -> none,
--    >100% -> over budget)
--  * average item price variance vs last month, and per-item badges
--  * chef / employee login with a PIN on a shared tablet; the items a chef
--    sees follow the categories they're allowed, and the request records who
--    asked for it
--  * a supplier and unit per request line, a "for" date, pinned items
-- Every figure on the screen comes from get_purchase_request_dashboard, so
-- the cards can never disagree with each other.
-- Safe to re-run. Requires 0055.

-- === Columns =====================================================================
alter table restaurants
  add column if not exists monthly_purchase_budget numeric(14,2) check (monthly_purchase_budget >= 0),
  add column if not exists bonus_good_amount numeric(14,2) check (bonus_good_amount >= 0),
  add column if not exists bonus_safe_amount numeric(14,2) check (bonus_safe_amount >= 0);

alter table employees
  add column if not exists request_pin_hash text,
  add column if not exists request_category_ids uuid[],
  add column if not exists pin_failed_attempts integer not null default 0,
  add column if not exists pin_locked_until timestamptz;

alter table purchase_requests
  add column if not exists needed_date date,
  add column if not exists requested_by_employee_id uuid references employees(id) on delete set null;

alter table purchase_request_items
  add column if not exists supplier_id uuid references suppliers(id);

create table if not exists restaurant_pinned_products (
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  primary key (restaurant_id, product_id)
);
alter table restaurant_pinned_products enable row level security;
drop policy if exists restaurant_pinned_products_select on restaurant_pinned_products;
create policy restaurant_pinned_products_select on restaurant_pinned_products for select using (app.has_restaurant_access(restaurant_id));

-- === Chef PIN ====================================================================
-- Employees who can place requests at a restaurant (names only — no salary or
-- documents), for the "Employee / Chef" picker on a shared tablet.
create or replace function public.list_request_employees(p_restaurant_id uuid)
returns table (employee_id uuid, full_name text, job_title text, has_pin boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not app.has_restaurant_access(p_restaurant_id) then raise exception 'Not authorized for this restaurant'; end if;
  if not app.has_permission('purchases.create') then raise exception 'Not authorized'; end if;
  return query
  select e.id, e.full_name, e.job_title, e.request_pin_hash is not null
  from employees e
  where e.current_restaurant_id = p_restaurant_id and e.employment_status = 'active'
  order by (e.request_pin_hash is null), e.full_name;
end;
$$;
grant execute on function public.list_request_employees(uuid) to authenticated;

-- Checks a chef's PIN. Five wrong tries lock the PIN for 5 minutes.
-- Returns the categories the chef may order from (null = all).
create or replace function app.check_request_pin(p_employee_id uuid, p_pin text)
returns uuid[]
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_emp employees%rowtype;
begin
  select * into v_emp from employees where id = p_employee_id for update;
  if v_emp.id is null then raise exception 'Employee not found'; end if;
  if v_emp.current_restaurant_id is null or not app.has_restaurant_access(v_emp.current_restaurant_id) then
    raise exception 'Not authorized for this employee';
  end if;
  if v_emp.request_pin_hash is null then raise exception '% has no PIN set yet', v_emp.full_name; end if;
  if v_emp.pin_locked_until is not null and v_emp.pin_locked_until > now() then
    raise exception 'Too many wrong PINs — try again after %', to_char(v_emp.pin_locked_until at time zone 'Asia/Dubai', 'HH24:MI');
  end if;
  if crypt(coalesce(p_pin, ''), v_emp.request_pin_hash) <> v_emp.request_pin_hash then
    update employees set
      pin_failed_attempts = pin_failed_attempts + 1,
      pin_locked_until = case when pin_failed_attempts + 1 >= 5 then now() + interval '5 minutes' else pin_locked_until end
    where id = p_employee_id;
    return null; -- caller raises; the attempt counter must still be saved
  end if;
  update employees set pin_failed_attempts = 0, pin_locked_until = null where id = p_employee_id;
  return coalesce(v_emp.request_category_ids, '{}'::uuid[]);
end;
$$;

create or replace function public.verify_request_pin(p_employee_id uuid, p_pin text)
returns table (employee_id uuid, full_name text, job_title text, category_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_categories uuid[];
begin
  if not app.has_permission('purchases.create') then raise exception 'Not authorized'; end if;
  v_categories := app.check_request_pin(p_employee_id, p_pin);
  if v_categories is null then
    return; -- wrong PIN: empty result (the failed attempt is recorded)
  end if;
  return query
  select e.id, e.full_name, e.job_title, nullif(v_categories, '{}'::uuid[])
  from employees e where e.id = p_employee_id;
end;
$$;
grant execute on function public.verify_request_pin(uuid, text) to authenticated;

-- HR / managers set a chef's PIN (4-6 digits; null keeps the current one) and
-- the categories they may order (null or empty = all).
create or replace function public.set_employee_request_access(p_employee_id uuid, p_pin text, p_category_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not app.has_permission('employees.manage') then raise exception 'Not authorized to manage chef access'; end if;
  if p_pin is not null and p_pin !~ '^\d{4,6}$' then raise exception 'PIN must be 4 to 6 digits'; end if;
  update employees set
    request_pin_hash = case when p_pin is null then request_pin_hash else crypt(p_pin, gen_salt('bf')) end,
    request_category_ids = nullif(p_category_ids, '{}'::uuid[]),
    pin_failed_attempts = case when p_pin is null then pin_failed_attempts else 0 end,
    pin_locked_until = case when p_pin is null then pin_locked_until else null end
  where id = p_employee_id;
  if not found then raise exception 'Employee not found'; end if;
  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (auth.uid(), 'set_request_access', 'employees', 'employee', p_employee_id,
          jsonb_build_object('pin_changed', p_pin is not null, 'category_ids', p_category_ids));
end;
$$;
grant execute on function public.set_employee_request_access(uuid, text, uuid[]) to authenticated;

create or replace function public.get_employee_request_access(p_employee_id uuid)
returns table (has_pin boolean, category_ids uuid[])
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not app.has_permission('employees.manage') then raise exception 'Not authorized'; end if;
  return query select e.request_pin_hash is not null, e.request_category_ids from employees e where e.id = p_employee_id;
end;
$$;
grant execute on function public.get_employee_request_access(uuid) to authenticated;

-- === Pins =========================================================================
create or replace function public.toggle_request_pin(p_restaurant_id uuid, p_product_id uuid, p_pinned boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not app.has_restaurant_access(p_restaurant_id) then raise exception 'Not authorized for this restaurant'; end if;
  if not app.has_permission('purchases.create') then raise exception 'Not authorized'; end if;
  if p_pinned then
    insert into restaurant_pinned_products (restaurant_id, product_id, created_by) values (p_restaurant_id, p_product_id, auth.uid())
    on conflict do nothing;
  else
    delete from restaurant_pinned_products where restaurant_id = p_restaurant_id and product_id = p_product_id;
  end if;
end;
$$;
grant execute on function public.toggle_request_pin(uuid, uuid, boolean) to authenticated;

-- === Budget settings ==============================================================
create or replace function public.set_restaurant_purchase_budget(
  p_restaurant_id uuid, p_daily_target numeric, p_monthly_budget numeric, p_bonus_good numeric, p_bonus_safe numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not app.has_permission('restaurants.manage') then raise exception 'Not authorized to change purchase budgets'; end if;
  update restaurants set
    daily_purchase_target = p_daily_target,
    monthly_purchase_budget = p_monthly_budget,
    bonus_good_amount = p_bonus_good,
    bonus_safe_amount = p_bonus_safe
  where id = p_restaurant_id;
  if not found then raise exception 'Restaurant not found'; end if;
  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (auth.uid(), 'set_purchase_budget', 'organization', 'restaurant', p_restaurant_id,
          jsonb_build_object('daily_target', p_daily_target, 'monthly_budget', p_monthly_budget, 'bonus_good', p_bonus_good, 'bonus_safe', p_bonus_safe));
end;
$$;
grant execute on function public.set_restaurant_purchase_budget(uuid, numeric, numeric, numeric, numeric) to authenticated;

-- === save_purchase_request (replaces 0055) ========================================
-- Adds: needed_date, a supplier per line, and the chef. When the restaurant
-- has any chef with a PIN, sending a request needs a chef login; the PIN is
-- re-checked here, never trusted from the browser.
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
  v_submit boolean := coalesce((payload ->> 'submit')::boolean, true);
  v_new_status purchase_request_status;
  v_employee_id uuid := nullif(payload ->> 'employee_id', '')::uuid;
  v_categories uuid[];
begin
  if not app.has_permission('purchases.create') then
    raise exception 'Not authorized to create purchase requests';
  end if;
  if jsonb_array_length(coalesce(payload -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'Add at least one item';
  end if;

  v_request_id := nullif(payload ->> 'id', '')::uuid;
  v_new_status := case when v_submit then 'requested' else 'draft' end;

  if v_request_id is not null then
    select restaurant_id, status into v_restaurant_id, v_status from purchase_requests where id = v_request_id;
    if v_restaurant_id is null then raise exception 'Purchase request not found'; end if;
    if v_status not in ('draft', 'requested') then raise exception 'Only draft or unreviewed requests can be edited'; end if;
    if v_status = 'requested' and not v_submit then raise exception 'A sent request cannot go back to draft'; end if;
  else
    v_restaurant_id := (payload ->> 'restaurant_id')::uuid;
  end if;

  if not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;

  if v_employee_id is not null then
    v_categories := app.check_request_pin(v_employee_id, payload ->> 'employee_pin');
    if v_categories is null then raise exception 'Wrong PIN — log in again'; end if;
    if (select current_restaurant_id from employees where id = v_employee_id) is distinct from v_restaurant_id then
      raise exception 'This employee is not assigned to this restaurant';
    end if;
    -- A chef may only order items from their allowed categories.
    if cardinality(v_categories) > 0 and exists (
      select 1 from jsonb_array_elements(payload -> 'items') item
      join products p on p.id = (item ->> 'product_id')::uuid
      where p.category_id is null or not (p.category_id = any (v_categories))
    ) then
      raise exception 'Some items are outside the categories this employee may order';
    end if;
  elsif v_submit and exists (
    select 1 from employees e where e.current_restaurant_id = v_restaurant_id and e.request_pin_hash is not null and e.employment_status = 'active'
  ) then
    raise exception 'Log in with your employee PIN before submitting';
  end if;

  if v_request_id is not null then
    update purchase_requests set
      notes = nullif(left(payload ->> 'notes', 300), ''),
      status = v_new_status,
      needed_date = nullif(payload ->> 'needed_date', '')::date,
      requested_by_employee_id = coalesce(v_employee_id, requested_by_employee_id),
      requested_at = case when v_status = 'draft' and v_submit then now() else requested_at end
    where id = v_request_id;
    delete from purchase_request_items where purchase_request_id = v_request_id;
  else
    insert into purchase_requests (request_number, restaurant_id, status, notes, requested_by, needed_date, requested_by_employee_id)
    values (app.next_document_number('PR'), v_restaurant_id, v_new_status, nullif(left(payload ->> 'notes', 300), ''), auth.uid(),
            nullif(payload ->> 'needed_date', '')::date, v_employee_id)
    returning id into v_request_id;
  end if;

  insert into purchase_request_items (purchase_request_id, product_id, unit_id, quantity, notes, unit_price, vat_rate, supplier_id)
  select v_request_id, (item ->> 'product_id')::uuid, (item ->> 'unit_id')::uuid,
         (item ->> 'quantity')::numeric, nullif(item ->> 'notes', ''),
         nullif(item ->> 'unit_price', '')::numeric,
         coalesce(nullif(item ->> 'vat_rate', '')::numeric, 0.05),
         nullif(item ->> 'supplier_id', '')::uuid
  from jsonb_array_elements(payload -> 'items') as item;

  if v_submit then
    insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
    values (auth.uid(), 'submit', 'purchasing', 'purchase_request', v_request_id,
            jsonb_build_object('status', 'requested', 'employee_id', v_employee_id));
  end if;

  return v_request_id;
end;
$$;

grant execute on function public.save_purchase_request(jsonb) to authenticated;

-- === One calculation for every card on the screen (replaces 0055) ================
-- A request counts towards a day on its "for" date (needed_date), or the day it
-- was sent. Drafts, rejected and cancelled requests never count. The request
-- being edited is left out so the screen can add its live total.
drop function if exists public.get_purchase_request_dashboard(uuid, uuid);
drop function if exists public.get_purchase_request_dashboard(uuid, date, uuid);

create function public.get_purchase_request_dashboard(p_restaurant_id uuid, p_date date default current_date, p_exclude_request_id uuid default null)
returns table (
  daily_purchase_target numeric,
  monthly_purchase_budget numeric,
  bonus_good_amount numeric,
  bonus_safe_amount numeric,
  day_total numeric,
  day_count bigint,
  month_total numeric,
  price_variance_pct numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_month_start date := date_trunc('month', p_date)::date;
  v_last_month_start date := (date_trunc('month', p_date) - interval '1 month')::date;
begin
  if not app.has_restaurant_access(p_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;
  return query
  with req as (
    select coalesce(pr.needed_date, pr.requested_at::date) as day,
           round(i.quantity * coalesce(i.unit_price, 0) * (1 + i.vat_rate), 2) as amount, pr.id
    from purchase_requests pr join purchase_request_items i on i.purchase_request_id = pr.id
    where pr.restaurant_id = p_restaurant_id
      and pr.status not in ('draft', 'rejected', 'cancelled')
      and pr.id is distinct from p_exclude_request_id
  ),
  -- Average unit price per item this month and last month (same unit), from invoices.
  prices as (
    select pi.product_id, pi.unit_id,
           avg(pi.unit_price) filter (where po.invoice_date >= v_month_start and po.invoice_date <= p_date) as this_month,
           avg(pi.unit_price) filter (where po.invoice_date >= v_last_month_start and po.invoice_date < v_month_start) as last_month
    from purchase_items pi join purchases po on po.id = pi.purchase_id
    where po.restaurant_id = p_restaurant_id and po.status != 'cancelled'
      and po.invoice_date >= v_last_month_start and po.invoice_date <= p_date
    group by pi.product_id, pi.unit_id
  )
  select
    r.daily_purchase_target,
    r.monthly_purchase_budget,
    r.bonus_good_amount,
    r.bonus_safe_amount,
    coalesce((select sum(amount) from req where day = p_date), 0),
    (select count(distinct id) from req where day = p_date),
    coalesce((select sum(amount) from req where day >= v_month_start and day <= p_date), 0),
    (select round(avg((this_month - last_month) / last_month * 100), 1) from prices where this_month is not null and last_month > 0)
  from restaurants r
  where r.id = p_restaurant_id;
end;
$$;

grant execute on function public.get_purchase_request_dashboard(uuid, date, uuid) to authenticated;

-- === Item cards (replaces 0055) ===================================================
-- Adds: pinned, price change vs last month's average, and the suppliers that
-- can supply the item with their price per unit (current locked price first,
-- otherwise the last invoice price).
drop function if exists public.get_request_catalog(uuid);

create function public.get_request_catalog(p_restaurant_id uuid)
returns table (
  product_id uuid,
  name text,
  sku text,
  category_id uuid,
  category_name text,
  image_path text,
  base_unit_id uuid,
  unit_code text,
  price numeric,
  times_purchased bigint,
  pinned boolean,
  price_change_pct numeric,
  suppliers jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not app.has_restaurant_access(p_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;
  return query
  select
    p.id, p.name, p.sku, p.category_id, c.name, p.image_path, p.base_unit_id, u.code,
    coalesce(lp.unit_price, lk.agreed_price),
    coalesce(freq.n, 0),
    pin.product_id is not null,
    case when lm.avg_price > 0 and coalesce(lp.unit_price, lk.agreed_price) is not null
         then round((coalesce(lp.unit_price, lk.agreed_price) - lm.avg_price) / lm.avg_price * 100, 1) end,
    coalesce(sup.list, '[]'::jsonb)
  from products p
  join units u on u.id = p.base_unit_id
  left join categories c on c.id = p.category_id
  left join restaurant_pinned_products pin on pin.restaurant_id = p_restaurant_id and pin.product_id = p.id
  left join lateral (
    select pi.unit_price
    from purchase_items pi join purchases po on po.id = pi.purchase_id
    where pi.product_id = p.id and pi.unit_id = p.base_unit_id and po.restaurant_id = p_restaurant_id and po.status != 'cancelled'
    order by po.invoice_date desc, po.created_at desc
    limit 1
  ) lp on true
  left join lateral (
    select min(spl.agreed_price) as agreed_price
    from supplier_price_locks spl
    where spl.product_id = p.id and spl.unit_id = p.base_unit_id and spl.is_current
  ) lk on true
  left join lateral (
    select avg(pi.unit_price) as avg_price
    from purchase_items pi join purchases po on po.id = pi.purchase_id
    where pi.product_id = p.id and pi.unit_id = p.base_unit_id and po.restaurant_id = p_restaurant_id and po.status != 'cancelled'
      and po.invoice_date >= (date_trunc('month', current_date) - interval '1 month')::date
      and po.invoice_date < date_trunc('month', current_date)::date
  ) lm on true
  left join lateral (
    select count(*) as n
    from purchase_items pi join purchases po on po.id = pi.purchase_id
    where pi.product_id = p.id and po.restaurant_id = p_restaurant_id and po.status != 'cancelled'
  ) freq on true
  left join lateral (
    select jsonb_agg(jsonb_build_object(
             'supplier_id', x.supplier_id, 'supplier_name', x.supplier_name, 'unit_id', x.unit_id,
             'unit_code', x.unit_code, 'price', x.price, 'locked', x.locked
           ) order by x.locked desc, x.last_date desc nulls last) as list
    from (
      select distinct on (s.id, src.unit_id)
        s.id as supplier_id, s.name as supplier_name, src.unit_id, uu.code as unit_code, src.price, src.locked, src.last_date
      from (
        select spl.supplier_id, spl.unit_id, spl.agreed_price as price, true as locked, spl.valid_from as last_date
        from supplier_price_locks spl
        where spl.product_id = p.id and spl.is_current
          and (not exists (select 1 from supplier_price_lock_restaurants x where x.price_lock_id = spl.id)
               or exists (select 1 from supplier_price_lock_restaurants x where x.price_lock_id = spl.id and x.restaurant_id = p_restaurant_id))
        union all
        select po.supplier_id, pi.unit_id, pi.unit_price, false, po.invoice_date
        from purchase_items pi join purchases po on po.id = pi.purchase_id
        where pi.product_id = p.id and po.restaurant_id = p_restaurant_id and po.status != 'cancelled'
      ) src
      join suppliers s on s.id = src.supplier_id and s.is_active
      join units uu on uu.id = src.unit_id
      order by s.id, src.unit_id, src.locked desc, src.last_date desc
    ) x
  ) sup on true
  where p.is_active
  order by pin.product_id is not null desc, coalesce(freq.n, 0) desc, p.name;
end;
$$;

grant execute on function public.get_request_catalog(uuid) to authenticated;
