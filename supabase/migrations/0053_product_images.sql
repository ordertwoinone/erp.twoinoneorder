-- Product photos (Add new item, item cards on Purchase Requests).
-- Product pictures aren't sensitive, so they live in a public, image-only
-- bucket and are shown by public URL; only people who can create items may
-- upload. Safe to re-run.

alter table products add column if not exists image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists product_images_read on storage.objects;
create policy product_images_read on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists product_images_write on storage.objects;
create policy product_images_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (app.has_permission('catalog.manage') or app.has_permission('purchases.create') or app.has_permission('supplier_prices.manage'))
  );

drop policy if exists product_images_update on storage.objects;
create policy product_images_update on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (app.has_permission('catalog.manage') or app.has_permission('purchases.create')));

drop policy if exists product_images_delete on storage.objects;
create policy product_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and app.has_permission('catalog.manage'));

-- quick_create_product gains an image. The signature changes, so drop the
-- old one first (keeping both would make named-argument calls ambiguous).
drop function if exists public.quick_create_product(text, uuid, text, uuid, text);

create or replace function public.quick_create_product(
  p_name text, p_base_unit_id uuid, p_sku text default null, p_brand_id uuid default null, p_barcode text default null,
  p_image_path text default null
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

  insert into products (name, base_unit_id, sku, brand_id, barcode, image_path, created_by)
  values (p_name, p_base_unit_id, nullif(p_sku, ''), p_brand_id, nullif(p_barcode, ''), nullif(p_image_path, ''), auth.uid())
  returning id into v_product_id;

  return v_product_id;
end;
$$;

grant execute on function public.quick_create_product(text, uuid, text, uuid, text, text) to authenticated;

-- Adding / replacing the photo of an existing item from the purchasing screens.
create or replace function public.set_product_image(p_product_id uuid, p_image_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (app.has_permission('catalog.manage') or app.has_permission('purchases.create')) then
    raise exception 'Not authorized to change item photos';
  end if;
  update products set image_path = nullif(p_image_path, '') where id = p_product_id;
  if not found then
    raise exception 'Item not found';
  end if;
end;
$$;

grant execute on function public.set_product_image(uuid, text) to authenticated;

-- Item search (New Purchase) also returns the photo. Return type changes, so
-- drop and recreate (same body as 0045 plus image_path).
drop function if exists public.search_items_for_purchase(uuid, uuid, text, int, uuid);

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
  last_purchase_date date,
  image_path text
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
    lp.unit_price, lp.invoice_date, p.image_path
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
