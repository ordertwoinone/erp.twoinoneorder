-- Labour list scanning for the current MOHRE "List of Employees" layout
-- (Passport Number, Person Name + person code, Card Type, Job Name,
-- Nationality, Card Number + expiry, Contract Type).
--
-- confirm_labour_list_import_item (replaces 0047):
--   * stores the new fields: passport number, MOHRE person code, work permit
--     number + type, card expiry (labour card and work permit expiry);
--   * updating an existing employee only writes values that were provided —
--     a blank on the list no longer wipes the Emirates ID, salary, fine, etc.;
--   * a new employee gets the normal EMP-… code when none is typed;
--   * moving an existing employee to another branch closes the old assignment.
-- Re-runnable.

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
  v_previous_restaurant_id uuid;
  v_code text := nullif(trim(payload ->> 'employee_code'), '');
  v_card_expiry date := nullif(payload ->> 'card_expiry', '')::date;
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
  if nullif(trim(payload ->> 'full_name'), '') is null then
    raise exception 'Employee name is required';
  end if;

  v_employee_id := nullif(payload ->> 'employee_id', '')::uuid;
  v_restaurant_id := nullif(payload ->> 'restaurant_id', '')::uuid;
  if v_restaurant_id is not null and not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for the selected restaurant';
  end if;

  if v_employee_id is not null then
    select current_restaurant_id into v_previous_restaurant_id from employees where id = v_employee_id for update;
    if not found then raise exception 'Matched employee no longer exists'; end if;

    update employees set
      full_name = trim(payload ->> 'full_name'),
      employee_code = coalesce(v_code, employee_code),
      job_title = coalesce(nullif(payload ->> 'job_title', ''), job_title),
      current_restaurant_id = coalesce(v_restaurant_id, current_restaurant_id),
      emirates_id = coalesce(nullif(payload ->> 'emirates_id', ''), emirates_id),
      emirates_id_expiry = coalesce(nullif(payload ->> 'emirates_id_expiry', '')::date, emirates_id_expiry),
      medical_entry_date = coalesce(nullif(payload ->> 'medical_entry_date', '')::date, medical_entry_date),
      last_in_country_date = coalesce(nullif(payload ->> 'last_in_country_date', '')::date, last_in_country_date),
      final_status = coalesce(nullif(payload ->> 'final_status', ''), final_status),
      base_salary = coalesce(nullif(payload ->> 'base_salary', '')::numeric, base_salary),
      labour_person_number = coalesce(nullif(payload ->> 'labour_person_number', ''), labour_person_number),
      labour_fine_amount = coalesce(nullif(payload ->> 'labour_fine_amount', '')::numeric, labour_fine_amount),
      nationality = coalesce(nullif(payload ->> 'nationality', ''), nationality),
      passport_number = coalesce(nullif(payload ->> 'passport_number', ''), passport_number),
      work_permit_number = coalesce(nullif(payload ->> 'work_permit_number', ''), work_permit_number),
      work_permit_category = coalesce(nullif(payload ->> 'work_permit_category', ''), work_permit_category),
      labour_permit_expiry = coalesce(v_card_expiry, labour_permit_expiry),
      work_permit_expiry = coalesce(v_card_expiry, work_permit_expiry),
      work_permit_expiry_available = case when v_card_expiry is not null then true else work_permit_expiry_available end
    where id = v_employee_id;

    if v_restaurant_id is not null and v_restaurant_id is distinct from v_previous_restaurant_id then
      update employee_assignments set ends_at = current_date where employee_id = v_employee_id and ends_at is null;
      insert into employee_assignments (employee_id, restaurant_id, starts_at, assigned_by)
      values (v_employee_id, v_restaurant_id, current_date, auth.uid());
    end if;
  else
    begin
      insert into employees (
        employee_code, full_name, job_title, current_restaurant_id, emirates_id, emirates_id_expiry,
        medical_entry_date, last_in_country_date, final_status, base_salary,
        labour_person_number, labour_fine_amount, nationality,
        passport_number, work_permit_number, work_permit_category, labour_permit_expiry, work_permit_expiry
      ) values (
        coalesce(v_code, app.next_document_number('EMP')), trim(payload ->> 'full_name'), nullif(payload ->> 'job_title', ''),
        v_restaurant_id, nullif(payload ->> 'emirates_id', ''), nullif(payload ->> 'emirates_id_expiry', '')::date,
        nullif(payload ->> 'medical_entry_date', '')::date, nullif(payload ->> 'last_in_country_date', '')::date,
        nullif(payload ->> 'final_status', ''), nullif(payload ->> 'base_salary', '')::numeric,
        nullif(payload ->> 'labour_person_number', ''), nullif(payload ->> 'labour_fine_amount', '')::numeric,
        nullif(payload ->> 'nationality', ''),
        nullif(payload ->> 'passport_number', ''), nullif(payload ->> 'work_permit_number', ''),
        nullif(payload ->> 'work_permit_category', ''), v_card_expiry, v_card_expiry
      )
      returning id into v_employee_id;
    exception when unique_violation then
      raise exception 'Employee code "%" is already used by another employee — leave it blank to get a new EMP code', v_code;
    end;

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
