-- Quotation/price-list scanning is supplier-level, not restaurant-level
-- (a supplier's price list isn't tied to one branch), so ai_scan_jobs needs
-- to support a job with no restaurant_id and an associated supplier.
alter table ai_scan_jobs alter column restaurant_id drop not null;
alter table ai_scan_jobs add column supplier_id uuid references suppliers(id);

-- attachments (0021) is created after ai_scan_jobs (0020), so the original
-- table couldn't declare this FK; add it now so PostgREST can embed
-- attachments through ai_scan_jobs.attachment_id.
alter table ai_scan_jobs add constraint ai_scan_jobs_attachment_id_fkey
  foreign key (attachment_id) references attachments(id);

alter table ai_scan_jobs drop constraint ai_scan_jobs_job_type_check;
alter table ai_scan_jobs add constraint ai_scan_jobs_job_type_check
  check (job_type in ('invoice', 'labour_list', 'sales_document', 'quotation'));

-- Clean, already-structured extraction (header fields + line items) apart
-- from the raw model response, so the review UI never has to re-parse
-- free-form text.
alter table ai_scan_results add column parsed_data jsonb;

alter table ai_scan_results drop constraint ai_scan_results_resulting_entity_type_check;
alter table ai_scan_results add constraint ai_scan_results_resulting_entity_type_check
  check (resulting_entity_type in ('purchase', 'employee', 'sales_entry', 'price_lock'));

-- RLS on ai_scan_jobs/ai_scan_results/ai_extracted_items/ai_confidence_scores
-- was written assuming restaurant_id is always present (has_restaurant_access
-- on the job's restaurant). A quotation job has no restaurant, so add a
-- parallel policy gated on supplier_prices.manage instead, alongside the
-- existing restaurant-scoped ones (permissive policies are OR'd together).
create policy ai_scan_jobs_supplier_select on ai_scan_jobs for select
  using (job_type = 'quotation' and app.has_permission('supplier_prices.manage'));
create policy ai_scan_jobs_supplier_write on ai_scan_jobs for all
  using (job_type = 'quotation' and app.has_permission('supplier_prices.manage'))
  with check (job_type = 'quotation' and app.has_permission('supplier_prices.manage'));

create policy ai_scan_results_supplier_select on ai_scan_results for select
  using (
    exists (select 1 from ai_scan_jobs j where j.id = ai_scan_job_id and j.job_type = 'quotation')
    and app.has_permission('supplier_prices.manage')
  );
create policy ai_scan_results_supplier_write on ai_scan_results for all
  using (
    exists (select 1 from ai_scan_jobs j where j.id = ai_scan_job_id and j.job_type = 'quotation')
    and app.has_permission('supplier_prices.manage')
  )
  with check (
    exists (select 1 from ai_scan_jobs j where j.id = ai_scan_job_id and j.job_type = 'quotation')
    and app.has_permission('supplier_prices.manage')
  );

-- Supplier documents (quotations, price lists) aren't restaurant-scoped, so
-- they can't use the restaurant-id-prefixed storage path convention the
-- other buckets rely on (0022_storage.sql). Add a parallel policy for this
-- one bucket, gated by permission instead of path parsing.
create policy supplier_documents_select on storage.objects for select
  using (bucket_id = 'supplier-documents' and auth.uid() is not null);
create policy supplier_documents_insert on storage.objects for insert
  with check (bucket_id = 'supplier-documents' and app.has_permission('supplier_prices.manage'));

-- Creates the scan job + its attachment record in one call, instead of the
-- client doing a two-step insert.
create or replace function public.create_quotation_scan_job(
  p_supplier_id uuid, p_storage_path text, p_file_name text, p_mime_type text, p_file_size_bytes bigint
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
  if not app.has_permission('supplier_prices.manage') then
    raise exception 'Not authorized to scan supplier documents';
  end if;

  insert into ai_scan_jobs (job_type, status, supplier_id, uploaded_by)
  values ('quotation', 'queued', p_supplier_id, auth.uid())
  returning id into v_job_id;

  insert into attachments (
    entity_type, entity_id, category, storage_bucket, storage_path, file_name, mime_type, file_size_bytes, uploaded_by
  ) values (
    'ai_scan_job', v_job_id, 'supplier-documents', 'supplier-documents', p_storage_path, p_file_name,
    p_mime_type, p_file_size_bytes, auth.uid()
  )
  returning id into v_attachment_id;

  update ai_scan_jobs set attachment_id = v_attachment_id where id = v_job_id;

  return v_job_id;
end;
$$;

grant execute on function public.create_quotation_scan_job(uuid, text, text, text, bigint) to authenticated;

-- Lets a reviewer add a product on the fly while mapping a scanned line
-- item, without leaving the review screen.
create or replace function public.quick_create_product(p_name text, p_base_unit_id uuid, p_sku text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
begin
  if not (app.has_permission('supplier_prices.manage') or app.has_permission('catalog.manage')) then
    raise exception 'Not authorized to create products';
  end if;

  insert into products (name, base_unit_id, sku, created_by)
  values (p_name, p_base_unit_id, nullif(p_sku, ''), auth.uid())
  returning id into v_product_id;

  return v_product_id;
end;
$$;

grant execute on function public.quick_create_product(text, uuid, text) to authenticated;

-- Manual (non-AI) price-lock entry/update — spec §21 requires this to work
-- without AI. Append-only: closes the current lock and inserts a new one
-- rather than overwriting (docs/database-design.md §4).
create or replace function public.save_price_lock(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier_id uuid;
  v_product_id uuid;
  v_unit_id uuid;
  v_lock_id uuid;
begin
  if not app.has_permission('supplier_prices.manage') then
    raise exception 'Not authorized to manage supplier prices';
  end if;

  v_supplier_id := (payload ->> 'supplier_id')::uuid;
  v_product_id := (payload ->> 'product_id')::uuid;
  v_unit_id := (payload ->> 'unit_id')::uuid;

  update supplier_price_locks set is_current = false, valid_to = current_date
  where supplier_id = v_supplier_id and product_id = v_product_id and unit_id = v_unit_id and is_current = true;

  insert into supplier_price_locks (
    supplier_id, product_id, unit_id, pack_size, agreed_price, valid_from, is_current, created_by
  ) values (
    v_supplier_id, v_product_id, v_unit_id, nullif(payload ->> 'pack_size', '')::numeric,
    (payload ->> 'agreed_price')::numeric, current_date, true, auth.uid()
  )
  returning id into v_lock_id;

  insert into supplier_price_lock_restaurants (price_lock_id, restaurant_id)
  select v_lock_id, (r)::uuid
  from jsonb_array_elements_text(coalesce(payload -> 'restaurant_ids', '[]'::jsonb)) as r;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (auth.uid(), 'set_price_lock', 'suppliers', 'supplier_price_lock', v_lock_id,
          jsonb_build_object('supplier_id', v_supplier_id, 'product_id', v_product_id, 'agreed_price', payload ->> 'agreed_price'));

  return v_lock_id;
end;
$$;

grant execute on function public.save_price_lock(jsonb) to authenticated;

-- Confirms reviewed AI-extracted items as real price locks, same
-- close-current-then-insert pattern as save_price_lock, plus marks the scan
-- result reviewed so it drops out of the pending-review queue.
create or replace function public.confirm_supplier_price_locks(p_scan_result_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier_id uuid;
  v_item record;
  v_lock_id uuid;
begin
  if not app.has_permission('supplier_prices.manage') then
    raise exception 'Not authorized to manage supplier prices';
  end if;

  select j.supplier_id into v_supplier_id
  from ai_scan_results r join ai_scan_jobs j on j.id = r.ai_scan_job_id
  where r.id = p_scan_result_id;

  if v_supplier_id is null then
    raise exception 'Scan result not found or has no associated supplier';
  end if;

  for v_item in
    select
      (item ->> 'product_id')::uuid as product_id,
      (item ->> 'unit_id')::uuid as unit_id,
      nullif(item ->> 'pack_size', '')::numeric as pack_size,
      (item ->> 'agreed_price')::numeric as agreed_price,
      coalesce(item -> 'restaurant_ids', '[]'::jsonb) as restaurant_ids
    from jsonb_array_elements(p_items) as item
  loop
    update supplier_price_locks set is_current = false, valid_to = current_date
    where supplier_id = v_supplier_id and product_id = v_item.product_id and unit_id = v_item.unit_id and is_current = true;

    insert into supplier_price_locks (
      supplier_id, product_id, unit_id, pack_size, agreed_price, valid_from, is_current, created_by
    ) values (
      v_supplier_id, v_item.product_id, v_item.unit_id, v_item.pack_size, v_item.agreed_price,
      current_date, true, auth.uid()
    )
    returning id into v_lock_id;

    insert into supplier_price_lock_restaurants (price_lock_id, restaurant_id)
    select v_lock_id, (r)::uuid from jsonb_array_elements_text(v_item.restaurant_ids) as r;
  end loop;

  update ai_scan_results set
    review_status = 'confirmed', reviewed_by = auth.uid(), reviewed_at = now(),
    resulting_entity_type = 'price_lock'
  where id = p_scan_result_id;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (auth.uid(), 'confirm_scan', 'suppliers', 'ai_scan_result', p_scan_result_id,
          jsonb_build_object('supplier_id', v_supplier_id, 'item_count', jsonb_array_length(p_items)));
end;
$$;

grant execute on function public.confirm_supplier_price_locks(uuid, jsonb) to authenticated;
