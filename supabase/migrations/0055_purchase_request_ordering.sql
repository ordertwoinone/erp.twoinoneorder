-- Purchase Request ordering screen (tablet style): item cards with photos and
-- prices, a running order with VAT, "Save PO" (draft) and "Send Purchase
-- Order", and today's purchase vs a daily target per restaurant.
-- Safe to re-run.

-- Requests can now be kept as a draft before sending.
alter type purchase_request_status add value if not exists 'draft' before 'requested';

-- Daily purchasing target for a restaurant, and how far above it is still
-- acceptable (the allowance) before it's flagged as over budget.
alter table restaurants
  add column if not exists daily_purchase_target numeric(14,2) check (daily_purchase_target >= 0),
  add column if not exists daily_purchase_allowance numeric(14,2) check (daily_purchase_allowance >= 0);

-- Estimated price per line (from the last purchase), so a request has a value.
alter table purchase_request_items
  add column if not exists unit_price numeric(14,2) check (unit_price >= 0),
  add column if not exists vat_rate numeric(4,3) not null default 0.05 check (vat_rate in (0, 0.05));

-- === save_purchase_request (replaces 0035) =======================================
-- payload.submit = true sends it ('requested'); otherwise it's saved as a draft.
-- Drafts and sent-but-not-yet-reviewed requests can still be edited.
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

  if v_request_id is not null then
    update purchase_requests set
      notes = nullif(payload ->> 'notes', ''),
      status = v_new_status,
      -- The request date is when it was sent, not when the draft was started.
      requested_at = case when v_status = 'draft' and v_submit then now() else requested_at end
    where id = v_request_id;
    delete from purchase_request_items where purchase_request_id = v_request_id;
  else
    insert into purchase_requests (request_number, restaurant_id, status, notes, requested_by)
    values (app.next_document_number('PR'), v_restaurant_id, v_new_status, nullif(payload ->> 'notes', ''), auth.uid())
    returning id into v_request_id;
  end if;

  insert into purchase_request_items (purchase_request_id, product_id, unit_id, quantity, notes, unit_price, vat_rate)
  select v_request_id, (item ->> 'product_id')::uuid, (item ->> 'unit_id')::uuid,
         (item ->> 'quantity')::numeric, nullif(item ->> 'notes', ''),
         nullif(item ->> 'unit_price', '')::numeric,
         coalesce(nullif(item ->> 'vat_rate', '')::numeric, 0.05)
  from jsonb_array_elements(payload -> 'items') as item;

  if v_submit then
    insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
    values (auth.uid(), 'submit', 'purchasing', 'purchase_request', v_request_id, jsonb_build_object('status', 'requested'));
  end if;

  return v_request_id;
end;
$$;

grant execute on function public.save_purchase_request(jsonb) to authenticated;

-- === Targets ======================================================================
create or replace function public.set_restaurant_purchase_targets(p_restaurant_id uuid, p_target numeric, p_allowance numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not app.has_permission('restaurants.manage') then
    raise exception 'Not authorized to change purchase targets';
  end if;
  update restaurants set daily_purchase_target = p_target, daily_purchase_allowance = p_allowance where id = p_restaurant_id;
  if not found then raise exception 'Restaurant not found'; end if;
  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (auth.uid(), 'set_purchase_targets', 'organization', 'restaurant', p_restaurant_id,
          jsonb_build_object('daily_purchase_target', p_target, 'daily_purchase_allowance', p_allowance));
end;
$$;

grant execute on function public.set_restaurant_purchase_targets(uuid, numeric, numeric) to authenticated;

-- === Today's figures for the header cards ========================================
-- requests_today: value (incl. VAT) of requests sent today, excluding drafts,
-- rejected and cancelled ones. p_exclude_request_id leaves out the request
-- being edited so the screen can add its live total instead.
create or replace function public.get_purchase_request_dashboard(p_restaurant_id uuid, p_exclude_request_id uuid default null)
returns table (daily_purchase_target numeric, daily_purchase_allowance numeric, requests_today numeric, requests_today_count bigint)
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
    r.daily_purchase_target,
    r.daily_purchase_allowance,
    coalesce((
      select sum(round(i.quantity * coalesce(i.unit_price, 0) * (1 + i.vat_rate), 2))
      from purchase_requests pr join purchase_request_items i on i.purchase_request_id = pr.id
      where pr.restaurant_id = p_restaurant_id and pr.requested_at::date = current_date
        and pr.status not in ('draft', 'rejected', 'cancelled') and pr.id is distinct from p_exclude_request_id
    ), 0),
    (select count(*) from purchase_requests pr
      where pr.restaurant_id = p_restaurant_id and pr.requested_at::date = current_date
        and pr.status not in ('draft', 'rejected', 'cancelled') and pr.id is distinct from p_exclude_request_id)
  from restaurants r
  where r.id = p_restaurant_id;
end;
$$;

grant execute on function public.get_purchase_request_dashboard(uuid, uuid) to authenticated;

-- === Item cards ===================================================================
-- Every active item, with this restaurant's last purchase price (falling back
-- to the lowest current locked price) and how often it's been bought here, so
-- the screen can show the usual items first.
create or replace function public.get_request_catalog(p_restaurant_id uuid)
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
  times_purchased bigint
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
    coalesce(freq.n, 0)
  from products p
  join units u on u.id = p.base_unit_id
  left join categories c on c.id = p.category_id
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
    select count(*) as n
    from purchase_items pi join purchases po on po.id = pi.purchase_id
    where pi.product_id = p.id and po.restaurant_id = p_restaurant_id and po.status != 'cancelled'
  ) freq on true
  where p.is_active
  order by coalesce(freq.n, 0) desc, p.name;
end;
$$;

grant execute on function public.get_request_catalog(uuid) to authenticated;
