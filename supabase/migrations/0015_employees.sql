create table employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique,
  full_name text not null,
  job_title text,
  joining_date date,
  base_salary numeric(14,2),
  employment_status employment_status not null default 'active',
  current_restaurant_id uuid references restaurants(id),
  phone text,
  email text,
  emirates_id text,
  passport_number text,
  visa_expiry date,
  emirates_id_expiry date,
  is_shared_employee boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on employees
  for each row execute function app.set_updated_at();
create index employees_restaurant_idx on employees(current_restaurant_id);
create index employees_name_trgm_idx on employees using gin (full_name gin_trgm_ops);

create table employee_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id),
  starts_at date not null,
  ends_at date,
  assigned_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index employee_assignments_employee_idx on employee_assignments(employee_id, starts_at);

create table employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  document_type text not null,
  document_number text,
  expiry_date date,
  attachment_id uuid,
  created_at timestamptz not null default now()
);
create index employee_documents_employee_idx on employee_documents(employee_id);
create index employee_documents_expiry_idx on employee_documents(expiry_date);

-- Staging area for AI-extracted labour lists. Nothing here is a live
-- employee until a human confirms it (spec §30).
create table labour_list_imports (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  status ai_scan_status not null default 'queued',
  attachment_id uuid,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on labour_list_imports
  for each row execute function app.set_updated_at();

create table labour_list_import_items (
  id uuid primary key default gen_random_uuid(),
  labour_list_import_id uuid not null references labour_list_imports(id) on delete cascade,
  matched_employee_id uuid references employees(id),
  match_status employee_match_status not null default 'uncertain',
  extracted_data jsonb not null default '{}'::jsonb,
  confidence_score numeric(5,2),
  reviewed boolean not null default false,
  reviewed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index labour_list_import_items_import_idx on labour_list_import_items(labour_list_import_id);

alter table employees enable row level security;
alter table employee_assignments enable row level security;
alter table employee_documents enable row level security;
alter table labour_list_imports enable row level security;
alter table labour_list_import_items enable row level security;

create policy employees_select on employees for select
  using (app.has_permission('employees.view') and (current_restaurant_id is null or app.has_restaurant_access(current_restaurant_id)));
create policy employees_write on employees for all
  using (app.has_permission('employees.manage')) with check (app.has_permission('employees.manage'));

create policy employee_assignments_select on employee_assignments for select
  using (app.has_permission('employees.view') and app.has_restaurant_access(restaurant_id));
create policy employee_assignments_write on employee_assignments for all
  using (app.has_permission('employees.manage') and app.has_restaurant_access(restaurant_id))
  with check (app.has_permission('employees.manage') and app.has_restaurant_access(restaurant_id));

create policy employee_documents_select on employee_documents for select
  using (app.has_permission('employees.view'));
create policy employee_documents_write on employee_documents for all
  using (app.has_permission('employees.manage')) with check (app.has_permission('employees.manage'));

create policy labour_list_imports_select on labour_list_imports for select
  using (app.has_permission('employees.manage') and app.has_restaurant_access(restaurant_id));
create policy labour_list_imports_write on labour_list_imports for all
  using (app.has_permission('employees.manage') and app.has_restaurant_access(restaurant_id))
  with check (app.has_permission('employees.manage') and app.has_restaurant_access(restaurant_id));

create policy labour_list_import_items_select on labour_list_import_items for select
  using (exists (select 1 from labour_list_imports i where i.id = labour_list_import_id and app.has_permission('employees.manage') and app.has_restaurant_access(i.restaurant_id)));
create policy labour_list_import_items_write on labour_list_import_items for all
  using (exists (select 1 from labour_list_imports i where i.id = labour_list_import_id and app.has_permission('employees.manage') and app.has_restaurant_access(i.restaurant_id)))
  with check (exists (select 1 from labour_list_imports i where i.id = labour_list_import_id and app.has_permission('employees.manage') and app.has_restaurant_access(i.restaurant_id)));
