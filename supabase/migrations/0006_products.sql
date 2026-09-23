create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references categories(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on categories
  for each row execute function app.set_updated_at();

create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null
);

create table products (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null,
  description text,
  category_id uuid references categories(id),
  brand_id uuid references brands(id),
  base_unit_id uuid not null references units(id),
  pack_size numeric(12,3),
  pack_unit_id uuid references units(id),
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on products
  for each row execute function app.set_updated_at();
create index products_category_idx on products(category_id);
create index products_brand_idx on products(brand_id);
create index products_name_trgm_idx on products using gin (name gin_trgm_ops);

alter table categories enable row level security;
alter table brands enable row level security;
alter table units enable row level security;
alter table products enable row level security;

-- Reference/catalog data: readable by any authenticated user, writable only
-- by users with inventory/catalog management permission.
create policy categories_select on categories for select using (auth.uid() is not null);
create policy categories_write on categories for all
  using (app.has_permission('catalog.manage')) with check (app.has_permission('catalog.manage'));

create policy brands_select on brands for select using (auth.uid() is not null);
create policy brands_write on brands for all
  using (app.has_permission('catalog.manage')) with check (app.has_permission('catalog.manage'));

create policy units_select on units for select using (auth.uid() is not null);
create policy units_write on units for all
  using (app.has_permission('catalog.manage')) with check (app.has_permission('catalog.manage'));

create policy products_select on products for select using (auth.uid() is not null);
create policy products_write on products for all
  using (app.has_permission('catalog.manage')) with check (app.has_permission('catalog.manage'));
