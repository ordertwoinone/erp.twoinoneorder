-- Labour list number (the person's number on the MOHRE labour list) and any
-- outstanding labour fine, tracked per employee alongside the other
-- renewal-cycle fields from 0042.
alter table employees add column labour_person_number text;
alter table employees add column labour_fine_amount numeric(14,2) check (labour_fine_amount >= 0);

create index employees_labour_person_number_idx on employees(labour_person_number) where labour_person_number is not null;

-- Same as 0042's version, plus the two new fields.
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
      base_salary = nullif(payload ->> 'base_salary', '')::numeric,
      labour_person_number = coalesce(nullif(payload ->> 'labour_person_number', ''), labour_person_number),
      labour_fine_amount = nullif(payload ->> 'labour_fine_amount', '')::numeric
    where id = v_employee_id;
  else
    insert into employees (
      employee_code, full_name, job_title, current_restaurant_id, emirates_id, emirates_id_expiry,
      medical_entry_date, last_in_country_date, final_status, base_salary,
      labour_person_number, labour_fine_amount
    ) values (
      payload ->> 'employee_code', payload ->> 'full_name', nullif(payload ->> 'job_title', ''), v_restaurant_id,
      nullif(payload ->> 'emirates_id', ''), nullif(payload ->> 'emirates_id_expiry', '')::date,
      nullif(payload ->> 'medical_entry_date', '')::date, nullif(payload ->> 'last_in_country_date', '')::date,
      nullif(payload ->> 'final_status', ''), nullif(payload ->> 'base_salary', '')::numeric,
      nullif(payload ->> 'labour_person_number', ''), nullif(payload ->> 'labour_fine_amount', '')::numeric
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
