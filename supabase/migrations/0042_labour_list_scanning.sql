-- Labour list scanning: the AI staging tables (labour_list_imports,
-- labour_list_import_items) and the employee_match_status enum already
-- existed, but nothing ever wrote to them — no extraction, no RPCs, no UI.
-- This wires up the same scan -> review -> confirm pattern as quotation and
-- invoice scanning, plus the renewal-cycle fields tracked per employee.

alter table employees add column medical_entry_date date;
alter table employees add column last_in_country_date date;
alter table employees add column settlement_proof_attachment_id uuid references attachments(id);
alter table employees add column final_status text check (final_status in ('cancel', 'renew'));

-- labour_list_imports.attachment_id predates attachments (0021), same
-- deferred-FK situation ai_scan_jobs was in before 0037 fixed it.
alter table labour_list_imports add constraint labour_list_imports_attachment_id_fkey
  foreign key (attachment_id) references attachments(id);

-- A person can take more than one vacation over their employment, each
-- potentially paid by a different party (company ticket vs. employee's own
-- expense) — a child table rather than columns on employees.
create table employee_vacations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  start_date date not null,
  end_date date,
  paid_by text check (paid_by in ('company', 'employee', 'shared')),
  amount numeric(14,2),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index employee_vacations_employee_idx on employee_vacations(employee_id, start_date);

alter table employee_vacations enable row level security;
create policy employee_vacations_select on employee_vacations for select using (app.has_permission('employees.view'));
create policy employee_vacations_write on employee_vacations for all
  using (app.has_permission('employees.manage')) with check (app.has_permission('employees.manage'));

-- === Scan job creation ==========================================================
create or replace function public.create_labour_list_scan_job(
  p_restaurant_id uuid, p_storage_path text, p_file_name text, p_mime_type text, p_file_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_import_id uuid;
  v_attachment_id uuid;
begin
  if not app.has_restaurant_access(p_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;
  if not app.has_permission('employees.manage') then
    raise exception 'Not authorized to import labour lists';
  end if;

  insert into labour_list_imports (restaurant_id, status, uploaded_by)
  values (p_restaurant_id, 'queued', auth.uid())
  returning id into v_import_id;

  insert into attachments (
    restaurant_id, entity_type, entity_id, category, storage_bucket, storage_path, file_name, mime_type, file_size_bytes, uploaded_by
  ) values (
    p_restaurant_id, 'labour_list_import', v_import_id, 'employee-documents', 'employee-documents', p_storage_path,
    p_file_name, p_mime_type, p_file_size_bytes, auth.uid()
  )
  returning id into v_attachment_id;

  update labour_list_imports set attachment_id = v_attachment_id where id = v_import_id;

  return v_import_id;
end;
$$;

grant execute on function public.create_labour_list_scan_job(uuid, text, text, text, bigint) to authenticated;

-- === Confirm a reviewed row into a real employee ================================
-- Creates or updates the matched employee, records the assignment if new,
-- inserts any vacation entries, and marks the import row reviewed. All in
-- one call so a half-confirmed row can't happen.
create or replace function public.confirm_labour_list_import_item(p_item_id uuid, payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_import_restaurant_id uuid;
  v_employee_id uuid;
  v_restaurant_id uuid;
  v_vacation jsonb;
begin
  select li.restaurant_id into v_import_restaurant_id
  from labour_list_import_items lii join labour_list_imports li on li.id = lii.labour_list_import_id
  where lii.id = p_item_id;

  if v_import_restaurant_id is null then
    raise exception 'Labour list item not found';
  end if;
  if not app.has_restaurant_access(v_import_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;
  if not app.has_permission('employees.manage') then
    raise exception 'Not authorized to confirm employees';
  end if;

  v_employee_id := nullif(payload ->> 'employee_id', '')::uuid;
  v_restaurant_id := (payload ->> 'restaurant_id')::uuid;

  if v_employee_id is not null then
    update employees set
      full_name = payload ->> 'full_name',
      job_title = nullif(payload ->> 'job_title', ''),
      current_restaurant_id = v_restaurant_id,
      emirates_id = nullif(payload ->> 'emirates_id', ''),
      emirates_id_expiry = nullif(payload ->> 'emirates_id_expiry', '')::date,
      medical_entry_date = nullif(payload ->> 'medical_entry_date', '')::date,
      last_in_country_date = nullif(payload ->> 'last_in_country_date', '')::date,
      final_status = nullif(payload ->> 'final_status', ''),
      base_salary = nullif(payload ->> 'base_salary', '')::numeric
    where id = v_employee_id;
  else
    insert into employees (
      employee_code, full_name, job_title, current_restaurant_id, emirates_id, emirates_id_expiry,
      medical_entry_date, last_in_country_date, final_status, base_salary
    ) values (
      payload ->> 'employee_code', payload ->> 'full_name', nullif(payload ->> 'job_title', ''), v_restaurant_id,
      nullif(payload ->> 'emirates_id', ''), nullif(payload ->> 'emirates_id_expiry', '')::date,
      nullif(payload ->> 'medical_entry_date', '')::date, nullif(payload ->> 'last_in_country_date', '')::date,
      nullif(payload ->> 'final_status', ''), nullif(payload ->> 'base_salary', '')::numeric
    )
    returning id into v_employee_id;

    if v_restaurant_id is not null then
      insert into employee_assignments (employee_id, restaurant_id, starts_at, assigned_by)
      values (v_employee_id, v_restaurant_id, current_date, auth.uid());
    end if;
  end if;

  for v_vacation in select * from jsonb_array_elements(coalesce(payload -> 'vacations', '[]'::jsonb))
  loop
    insert into employee_vacations (employee_id, start_date, end_date, paid_by, amount, notes, created_by)
    values (
      v_employee_id, (v_vacation ->> 'start_date')::date, nullif(v_vacation ->> 'end_date', '')::date,
      nullif(v_vacation ->> 'paid_by', ''), nullif(v_vacation ->> 'amount', '')::numeric,
      nullif(v_vacation ->> 'notes', ''), auth.uid()
    );
  end loop;

  update labour_list_import_items set
    matched_employee_id = v_employee_id, match_status = 'matched', reviewed = true, reviewed_by = auth.uid()
  where id = p_item_id;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (auth.uid(), 'confirm_labour_list_item', 'employees', 'employee', v_employee_id,
          jsonb_build_object('labour_list_import_item_id', p_item_id));

  return v_employee_id;
end;
$$;

grant execute on function public.confirm_labour_list_import_item(uuid, jsonb) to authenticated;

-- Skips a row without creating/updating an employee (e.g. a duplicate line
-- or someone already fully handled elsewhere).
create or replace function public.ignore_labour_list_import_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
begin
  select li.restaurant_id into v_restaurant_id
  from labour_list_import_items lii join labour_list_imports li on li.id = lii.labour_list_import_id
  where lii.id = p_item_id;

  if v_restaurant_id is null then raise exception 'Labour list item not found'; end if;
  if not app.has_restaurant_access(v_restaurant_id) then raise exception 'Not authorized for this restaurant'; end if;
  if not app.has_permission('employees.manage') then raise exception 'Not authorized'; end if;

  update labour_list_import_items set match_status = 'ignored', reviewed = true, reviewed_by = auth.uid()
  where id = p_item_id;
end;
$$;

grant execute on function public.ignore_labour_list_import_item(uuid) to authenticated;
