-- New Purchase page: item search (name/SKU/brand/barcode), agreed-price
-- capture at entry, and AI invoice scanning (mirrors the quotation-scanning
-- pipeline from 0037, but produces a purchase draft instead of price locks).

alter table products add column barcode text;
create index products_barcode_idx on products(barcode) where barcode is not null;

-- === Agreed price lookup ======================================================
-- Shared by search results (live variance preview) and save_purchase_draft
-- (the price-at-entry snapshot actually stored on the line). A lock with no
-- rows in supplier_price_lock_restaurants applies to every restaurant.
create or replace function app.current_agreed_price(
  p_supplier_id uuid, p_product_id uuid, p_unit_id uuid, p_restaurant_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select spl.agreed_price
  from supplier_price_locks spl
  where spl.supplier_id = p_supplier_id and spl.product_id = p_product_id and spl.unit_id = p_unit_id
    and spl.is_current
    and (
      not exists (select 1 from supplier_price_lock_restaurants x where x.price_lock_id = spl.id)
      or exists (select 1 from supplier_price_lock_restaurants x where x.price_lock_id = spl.id and x.restaurant_id = p_restaurant_id)
    )
  order by spl.valid_from desc
  limit 1;
$$;

-- === Item search for the New Purchase page ====================================
create or replace function public.search_items_for_purchase(
  p_supplier_id uuid, p_restaurant_id uuid, p_search text, p_limit int default 15
)
returns table (
  product_id uuid,
  name text,
  sku text,
  barcode text,
  brand_name text,
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
    p.id, p.name, p.sku, p.barcode, b.name, c.name, p.base_unit_id, u.code, p.pack_size, pu.code,
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

grant execute on function public.search_items_for_purchase(uuid, uuid, text, int) to authenticated;

-- === quick_create_product: also accept brand/barcode from the New Purchase =====
-- page's "Add new item" flow (previously only name/unit/sku, for the
-- quotation-review screen).
create or replace function public.quick_create_product(
  p_name text, p_base_unit_id uuid, p_sku text default null, p_brand_id uuid default null, p_barcode text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
begin
  if not (app.has_permission('supplier_prices.manage') or app.has_permission('catalog.manage') or app.has_permission('purchases.create')) then
    raise exception 'Not authorized to create products';
  end if;

  insert into products (name, base_unit_id, sku, brand_id, barcode, created_by)
  values (p_name, p_base_unit_id, nullif(p_sku, ''), p_brand_id, nullif(p_barcode, ''), auth.uid())
  returning id into v_product_id;

  return v_product_id;
end;
$$;

grant execute on function public.quick_create_product(text, uuid, text, uuid, text) to authenticated;

-- === save_purchase_draft: capture agreed_price_at_entry per line =============
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
      status, source, subtotal_amount, discount_amount, tax_amount, total_amount, notes, created_by
    ) values (
      app.next_document_number('PUR'), v_restaurant_id, v_supplier_id,
      payload ->> 'invoice_number', (payload ->> 'invoice_date')::date,
      'draft', coalesce(nullif(payload ->> 'source', ''), 'manual'),
      v_subtotal, v_discount, v_tax, v_total, nullif(payload ->> 'notes', ''), auth.uid()
    ) returning id into v_purchase_id;
  else
    update purchases set
      supplier_id = v_supplier_id,
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
    coalesce((item ->> 'tax_amount')::numeric, 0),
    ((item ->> 'quantity')::numeric * (item ->> 'unit_price')::numeric)
      - coalesce((item ->> 'discount_amount')::numeric, 0)
      + coalesce((item ->> 'tax_amount')::numeric, 0),
    app.current_agreed_price(v_supplier_id, (item ->> 'product_id')::uuid, (item ->> 'unit_id')::uuid, v_restaurant_id)
  from jsonb_array_elements(payload -> 'items') as item;

  return v_purchase_id;
end;
$$;

-- === Invoice scanning =========================================================
create or replace function public.create_invoice_scan_job(
  p_restaurant_id uuid, p_supplier_id uuid, p_storage_path text, p_file_name text, p_mime_type text, p_file_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_attachment_id uuid;
begin
  if not app.has_restaurant_access(p_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;
  if not app.has_permission('purchases.create') then
    raise exception 'Not authorized to scan invoices';
  end if;

  insert into ai_scan_jobs (job_type, status, restaurant_id, supplier_id, uploaded_by)
  values ('invoice', 'queued', p_restaurant_id, p_supplier_id, auth.uid())
  returning id into v_job_id;

  insert into attachments (
    restaurant_id, entity_type, entity_id, category, storage_bucket, storage_path, file_name, mime_type, file_size_bytes, uploaded_by
  ) values (
    p_restaurant_id, 'ai_scan_job', v_job_id, 'invoices', 'invoices', p_storage_path, p_file_name,
    p_mime_type, p_file_size_bytes, auth.uid()
  )
  returning id into v_attachment_id;

  update ai_scan_jobs set attachment_id = v_attachment_id where id = v_job_id;

  return v_job_id;
end;
$$;

grant execute on function public.create_invoice_scan_job(uuid, uuid, text, text, text, bigint) to authenticated;

-- Confirms a reviewed invoice scan as a real (draft) purchase, reusing
-- save_purchase_draft so the two entry paths (manual, scanned) stay
-- identical from that point on — including the approval workflow below.
create or replace function public.confirm_purchase_scan(p_scan_result_id uuid, payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_restaurant_id uuid;
  v_purchase_id uuid;
begin
  select j.id, j.restaurant_id into v_job_id, v_restaurant_id
  from ai_scan_results r join ai_scan_jobs j on j.id = r.ai_scan_job_id
  where r.id = p_scan_result_id;

  if v_job_id is null then
    raise exception 'Scan result not found';
  end if;
  if not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;

  v_purchase_id := public.save_purchase_draft(payload || jsonb_build_object('source', 'ai_scan'));

  update purchases set ai_scan_job_id = v_job_id where id = v_purchase_id;

  update ai_scan_results set
    review_status = 'confirmed', reviewed_by = auth.uid(), reviewed_at = now(),
    resulting_entity_type = 'purchase', resulting_entity_id = v_purchase_id
  where id = p_scan_result_id;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (auth.uid(), 'confirm_scan', 'purchases', 'ai_scan_result', p_scan_result_id,
          jsonb_build_object('purchase_id', v_purchase_id));

  return v_purchase_id;
end;
$$;

grant execute on function public.confirm_purchase_scan(uuid, jsonb) to authenticated;
