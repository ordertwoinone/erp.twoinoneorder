-- Confirming a scanned labour-list row never saved the person's nationality,
-- even though the review table shows it — so employees created from a scan
-- had none. Same function as 0043, plus nationality (an existing value is
-- kept when the list doesn't provide one).

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
      labour_fine_amount = nullif(payload ->> 'labour_fine_amount', '')::numeric,
      nationality = coalesce(nullif(payload ->> 'nationality', ''), nationality)
    where id = v_employee_id;
  else
    insert into employees (
      employee_code, full_name, job_title, current_restaurant_id, emirates_id, emirates_id_expiry,
      medical_entry_date, last_in_country_date, final_status, base_salary,
      labour_person_number, labour_fine_amount, nationality
    ) values (
      payload ->> 'employee_code', payload ->> 'full_name', nullif(payload ->> 'job_title', ''), v_restaurant_id,
      nullif(payload ->> 'emirates_id', ''), nullif(payload ->> 'emirates_id_expiry', '')::date,
      nullif(payload ->> 'medical_entry_date', '')::date, nullif(payload ->> 'last_in_country_date', '')::date,
      nullif(payload ->> 'final_status', ''), nullif(payload ->> 'base_salary', '')::numeric,
      nullif(payload ->> 'labour_person_number', ''), nullif(payload ->> 'labour_fine_amount', '')::numeric,
      nullif(payload ->> 'nationality', '')
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

-- Deleting an employee. Their own sub-records (documents, vacations,
-- assignments, replacement shortlists) cascade, and a labour-list scan row
-- that matched them just loses the match. Payroll and other financial rows
-- reference employees without cascade on purpose, so an employee with pay
-- history can't be deleted — the admin is told what's linked and should set
-- them to terminated / resigned instead.
create or replace function public.delete_employee(p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_restaurant_id uuid;
  v_message text;
  v_table text;
begin
  if not app.has_permission('employees.manage') then
    raise exception 'Not authorized to delete employees';
  end if;

  select full_name, current_restaurant_id into v_name, v_restaurant_id from employees where id = p_employee_id;
  if v_name is null then
    raise exception 'Employee not found';
  end if;
  if v_restaurant_id is not null and not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this employee';
  end if;

  begin
    update labour_list_import_items set matched_employee_id = null where matched_employee_id = p_employee_id;
    delete from employees where id = p_employee_id;
  exception when foreign_key_violation then
    get stacked diagnostics v_message = message_text;
    v_table := substring(v_message from 'on table "([a-z_]+)"\s*$');
    raise exception '% can''t be deleted because they still have % linked to them. Set their status to terminated or resigned instead to keep their history.',
      v_name, coalesce(replace(v_table, '_', ' '), 'records');
  end;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, old_value)
  values (auth.uid(), 'delete', 'employees', 'employee', p_employee_id, jsonb_build_object('full_name', v_name));
end;
$$;

grant execute on function public.delete_employee(uuid) to authenticated;
