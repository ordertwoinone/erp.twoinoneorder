-- Adding a brand straight from "Add new item" on New Purchase. Writing to
-- brands directly needs catalog.manage, but whoever enters purchases can
-- already create products (quick_create_product), so they may create the
-- brand for it too. An existing brand with the same name (ignoring case and
-- extra spaces) is returned instead of creating a near-duplicate.
-- Safe to re-run.
create or replace function public.quick_create_brand(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_brand_id uuid;
begin
  if not (app.has_permission('supplier_prices.manage') or app.has_permission('catalog.manage') or app.has_permission('purchases.create')) then
    raise exception 'Not authorized to create brands';
  end if;
  if v_name = '' then
    raise exception 'Brand name is required';
  end if;

  select id into v_brand_id from brands where lower(name) = lower(v_name) limit 1;
  if v_brand_id is not null then
    update brands set is_active = true where id = v_brand_id and not is_active;
    return v_brand_id;
  end if;

  insert into brands (name) values (v_name) returning id into v_brand_id;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (auth.uid(), 'create', 'catalog', 'brand', v_brand_id, jsonb_build_object('name', v_name));

  return v_brand_id;
end;
$$;

grant execute on function public.quick_create_brand(text) to authenticated;
