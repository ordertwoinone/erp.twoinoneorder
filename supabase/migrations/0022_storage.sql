-- Every document bucket is private. Access goes through signed URLs issued
-- after the same has_restaurant_access/has_permission checks used
-- everywhere else — never a public bucket for these categories (spec §11, §42).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('invoices', 'invoices', false, 20971520, array['application/pdf','image/jpeg','image/jpg','image/png','image/webp']),
  ('purchase-documents', 'purchase-documents', false, 20971520, array['application/pdf','image/jpeg','image/jpg','image/png','image/webp']),
  ('supplier-documents', 'supplier-documents', false, 20971520, array['application/pdf','image/jpeg','image/jpg','image/png','image/webp']),
  ('employee-documents', 'employee-documents', false, 20971520, array['application/pdf','image/jpeg','image/jpg','image/png','image/webp']),
  ('salary-documents', 'salary-documents', false, 20971520, array['application/pdf','image/jpeg','image/jpg','image/png','image/webp']),
  ('sales-receipts', 'sales-receipts', false, 20971520, array['application/pdf','image/jpeg','image/jpg','image/png','image/webp']),
  ('bank-receipts', 'bank-receipts', false, 20971520, array['application/pdf','image/jpeg','image/jpg','image/png','image/webp']),
  ('settlement-documents', 'settlement-documents', false, 20971520, array['application/pdf','image/jpeg','image/jpg','image/png','image/webp']),
  ('transfer-documents', 'transfer-documents', false, 20971520, array['application/pdf','image/jpeg','image/jpg','image/png','image/webp']),
  ('expense-documents', 'expense-documents', false, 20971520, array['application/pdf','image/jpeg','image/jpg','image/png','image/webp']),
  ('attachments', 'attachments', false, 20971520, array['application/pdf','image/jpeg','image/jpg','image/png','image/webp'])
on conflict (id) do nothing;

-- Storage object path convention: <restaurant_id>/<entity_type>/<entity_id>/<filename>
-- The leading path segment is the restaurant id, so RLS on storage.objects
-- can reuse app.has_restaurant_access() by parsing it out of the object name
-- without a join back to the attachments table.
create or replace function app.storage_path_restaurant_id(object_name text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(object_name, '/', 1), '')::uuid;
$$;

create policy attachments_buckets_select on storage.objects for select
  using (
    bucket_id in (
      'invoices','purchase-documents','supplier-documents','employee-documents',
      'salary-documents','sales-receipts','bank-receipts','settlement-documents',
      'transfer-documents','expense-documents','attachments'
    )
    and app.has_restaurant_access(app.storage_path_restaurant_id(name))
  );

create policy attachments_buckets_insert on storage.objects for insert
  with check (
    bucket_id in (
      'invoices','purchase-documents','supplier-documents','employee-documents',
      'salary-documents','sales-receipts','bank-receipts','settlement-documents',
      'transfer-documents','expense-documents','attachments'
    )
    and app.has_restaurant_access(app.storage_path_restaurant_id(name))
  );

create policy attachments_buckets_delete on storage.objects for delete
  using (
    bucket_id in (
      'invoices','purchase-documents','supplier-documents','employee-documents',
      'salary-documents','sales-receipts','bank-receipts','settlement-documents',
      'transfer-documents','expense-documents','attachments'
    )
    and app.has_restaurant_access(app.storage_path_restaurant_id(name))
    and app.has_permission('attachments.delete')
  );
