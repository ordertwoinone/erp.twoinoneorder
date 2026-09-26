-- New Purchase page, round 2:
--  * per-invoice payment terms (defaulted from the supplier, editable)
--  * VAT computed server-side from a per-line rate instead of trusting a
--    client-sent amount (the client was sending 0, so VAT was never saved)
--  * item search can be narrowed to one product category

alter table purchases add column payment_terms_days integer check (payment_terms_days >= 0);

-- UAE VAT rates a purchase line may carry: 5% standard, 0% zero-rated/exempt.
create or replace function app.line_vat(p_item jsonb)
returns numeric
language plpgsql
immutable
as $$
declare
  v_rate numeric := nullif(p_item ->> 'vat_rate', '')::numeric;
  -- Rounded to fils before the rate is applied, matching the client's
  -- computeLines() so the saved VAT equals the VAT the user saw.
  v_net numeric := round((p_item ->> 'quantity')::numeric * (p_item ->> 'unit_price')::numeric, 2)
                   - coalesce((p_item ->> 'discount_amount')::numeric, 0);
begin
  if v_rate is null then
    return coalesce((p_item ->> 'tax_amount')::numeric, 0);
  end if;
  if v_rate not in (0, 0.05) then
    raise exception 'Unsupported VAT rate % (allowed: 0%% or 5%%)', v_rate * 100;
  end if;
  return round(greatest(v_net, 0) * v_rate, 2);
end;
$$;

create or replace function public.save_purchase_draft(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase_id uuid;
  v_restaurant_id uuid;
  v_supplier_id uuid;
  v_status purchase_status;
  v_subtotal numeric(14,2) := 0;
  v_discount numeric(14,2) := 0;
  v_tax numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_terms integer := nullif(payload ->> 'payment_terms_days', '')::integer;
begin
  v_restaurant_id := (payload ->> 'restaurant_id')::uuid;
  v_supplier_id := (payload ->> 'supplier_id')::uuid;

  if not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;
  if not app.has_permission('purchases.create') then
    raise exception 'Not authorized to create purchases';
  end if;
  if jsonb_array_length(coalesce(payload -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'A purchase needs at least one line item';
  end if;

  v_purchase_id := nullif(payload ->> 'id', '')::uuid;

  if v_purchase_id is not null then
    select status into v_status from purchases where id = v_purchase_id;
    if v_status is null then
      raise exception 'Purchase not found';
    end if;
    if v_status not in ('draft', 'returned') then
      raise exception 'Only draft or returned purchases can be edited';
    end if;
  end if;

  if v_terms is null then
    select payment_terms_days into v_terms from suppliers where id = v_supplier_id;
  end if;

  select
    coalesce(sum(round((item ->> 'quantity')::numeric * (item ->> 'unit_price')::numeric, 2)), 0),
    coalesce(sum(coalesce((item ->> 'discount_amount')::numeric, 0)), 0),
    coalesce(sum(app.line_vat(item)), 0)
  into v_subtotal, v_discount, v_tax
  from jsonb_array_elements(payload -> 'items') as item;

  v_total := v_subtotal - v_discount + v_tax;

  if v_purchase_id is null then
    insert into purchases (
      purchase_number, restaurant_id, supplier_id, invoice_number, invoice_date, payment_terms_days,
      status, source, subtotal_amount, discount_amount, tax_amount, total_amount, notes, created_by
    ) values (
      app.next_document_number('PUR'), v_restaurant_id, v_supplier_id,
      payload ->> 'invoice_number', (payload ->> 'invoice_date')::date, v_terms,
      'draft', coalesce(nullif(payload ->> 'source', ''), 'manual'),
      v_subtotal, v_discount, v_tax, v_total, nullif(payload ->> 'notes', ''), auth.uid()
    ) returning id into v_purchase_id;
  else
    update purchases set
      supplier_id = v_supplier_id,
      invoice_number = payload ->> 'invoice_number',
      invoice_date = (payload ->> 'invoice_date')::date,
      payment_terms_days = v_terms,
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
    discount_amount, tax_amount, line_total, agreed_price_at_entry
  )
  select
    v_purchase_id,
    (item ->> 'product_id')::uuid,
    (item ->> 'unit_id')::uuid,
    nullif(item ->> 'pack_size', '')::numeric,
    (item ->> 'quantity')::numeric,
    (item ->> 'unit_price')::numeric,
    coalesce((item ->> 'discount_amount')::numeric, 0),
    app.line_vat(item),
    round((item ->> 'quantity')::numeric * (item ->> 'unit_price')::numeric, 2)
      - coalesce((item ->> 'discount_amount')::numeric, 0)
      + app.line_vat(item),
    app.current_agreed_price(v_supplier_id, (item ->> 'product_id')::uuid, (item ->> 'unit_id')::uuid, v_restaurant_id)
  from jsonb_array_elements(payload -> 'items') as item;

  return v_purchase_id;
end;
$$;

-- Adds an optional category filter (the category chips on New Purchase).
-- The return type changes too (category_id), so drop and recreate.
drop function if exists public.search_items_for_purchase(uuid, uuid, text, int);

create function public.search_items_for_purchase(
  p_supplier_id uuid, p_restaurant_id uuid, p_search text, p_limit int default 15, p_category_id uuid default null
)
returns table (
  product_id uuid,
  name text,
  sku text,
  barcode text,
  brand_name text,
  category_id uuid,
  category_name text,
  base_unit_id uuid,
  base_unit_code text,
  pack_size numeric,
  pack_unit_code text,
  agreed_price numeric,
  last_purchase_price numeric,
  last_purchase_date date
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
    p.id, p.name, p.sku, p.barcode, b.name, p.category_id, c.name, p.base_unit_id, u.code, p.pack_size, pu.code,
    app.current_agreed_price(p_supplier_id, p.id, p.base_unit_id, p_restaurant_id),
    lp.unit_price, lp.invoice_date
  from products p
  left join brands b on b.id = p.brand_id
  left join categories c on c.id = p.category_id
  join units u on u.id = p.base_unit_id
  left join units pu on pu.id = p.pack_unit_id
  left join lateral (
    select pi.unit_price, po.invoice_date
    from purchase_items pi
    join purchases po on po.id = pi.purchase_id
    where po.supplier_id = p_supplier_id and pi.product_id = p.id and po.restaurant_id = p_restaurant_id
      and po.status != 'cancelled'
    order by po.invoice_date desc
    limit 1
  ) lp on true
  where p.is_active
    and (p_category_id is null or p.category_id = p_category_id)
    and (
      p_search is null or p_search = ''
      or p.name ilike '%' || p_search || '%'
      or p.sku ilike '%' || p_search || '%'
      or p.barcode ilike '%' || p_search || '%'
      or b.name ilike '%' || p_search || '%'
    )
  order by p.name
  limit p_limit;
end;
$$;

grant execute on function public.search_items_for_purchase(uuid, uuid, text, int, uuid) to authenticated;
