-- Full employee record: visa & sponsorship, work permit, document dates,
-- passport, renewal salary, flight tickets, potential replacements and the
-- renewal/settlement outcome — everything on the Employee Details page.

-- === Employee columns ============================================================
alter table employees
  add column visa_sponsorship_type text
    check (visa_sponsorship_type in ('company', 'family', 'investor', 'golden', 'freelance', 'mission', 'other')),
  add column sponsor_name text,
  add column work_permit_category text,
  add column visa_status text
    check (visa_status in ('active', 'under_process', 'expired', 'cancelled', 'absconding', 'on_hold')),
  add column work_permit_expiry_available boolean not null default true,
  add column work_permit_expiry date,
  add column work_permit_salary numeric(14,2) check (work_permit_salary >= 0),
  add column work_permit_number text,
  add column labour_permit_expiry date,
  add column permit_issue_date date,
  add column medical_expiry_date date,
  add column last_exit_date date,
  add column presence_status text check (presence_status in ('in_country', 'outside_country', 'on_vacation')),
  add column passport_issue_date date,
  add column passport_expiry_date date,
  add column nationality text,
  add column renewal_salary numeric(14,2) check (renewal_salary >= 0),
  add column flight_ticket_claimed boolean not null default false,
  add column decision_date date,
  add column settlement_date date,
  add column settlement_amount numeric(14,2) check (settlement_amount >= 0),
  add column settlement_status text not null default 'pending'
    check (settlement_status in ('pending', 'partially_paid', 'paid', 'not_applicable')),
  add column settlement_document_type text,
  add column settlement_reference text,
  add column renewal_notes text;

create index employees_labour_permit_expiry_idx on employees(labour_permit_expiry) where labour_permit_expiry is not null;

-- === Vacation / flight ticket rows ===============================================
alter table employee_vacations
  add column ticket_claim_status text check (ticket_claim_status in ('claimed', 'not_claimed', 'pending')),
  add column attachment_id uuid references attachments(id);

-- employee_documents (0015) is the per-type document register; attachments
-- hold the files. Index for the page's document-type filter.
-- not valid: enforce for new rows without failing on any pre-existing ones.
alter table employee_documents add constraint employee_documents_attachment_id_fkey
  foreign key (attachment_id) references attachments(id) not valid;
create index employee_documents_type_idx on employee_documents(employee_id, document_type);

-- === Potential replacements ======================================================
-- Either an existing employee (replacement_employee_id) or an outside
-- candidate (candidate_name), shortlisted in case this employee isn't renewed.
create table employee_replacements (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  replacement_employee_id uuid references employees(id) on delete set null,
  candidate_name text,
  position text,
  source text,
  availability text not null default 'available_now'
    check (availability in ('available_now', 'available_from', 'interview_pending', 'not_available')),
  available_from date,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  constraint employee_replacements_who_chk check (replacement_employee_id is not null or candidate_name is not null)
);
create index employee_replacements_employee_idx on employee_replacements(employee_id);

alter table employee_replacements enable row level security;
create policy employee_replacements_select on employee_replacements for select using (app.has_permission('employees.view'));
create policy employee_replacements_write on employee_replacements for all
  using (app.has_permission('employees.manage')) with check (app.has_permission('employees.manage'));

-- === Save the whole record in one transaction ====================================
-- The client generates the id for a new employee so files can be uploaded
-- and attached before this runs; child rows (documents, vacations,
-- replacements) are synced to exactly what the page submits.
create or replace function public.save_employee_record(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := (payload ->> 'id')::uuid;
  v_restaurant_id uuid := nullif(payload ->> 'current_restaurant_id', '')::uuid;
  v_existing_restaurant_id uuid;
  v_exists boolean;
  v_code text := nullif(trim(payload ->> 'employee_code'), '');
  v_item jsonb;
begin
  if not app.has_permission('employees.manage') then
    raise exception 'Not authorized to manage employees';
  end if;
  if v_restaurant_id is not null and not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this branch';
  end if;
  if nullif(trim(payload ->> 'full_name'), '') is null then
    raise exception 'Employee name is required';
  end if;

  select true, current_restaurant_id into v_exists, v_existing_restaurant_id from employees where id = v_id;
  if v_exists and v_existing_restaurant_id is not null and not app.has_restaurant_access(v_existing_restaurant_id) then
    raise exception 'Not authorized for this employee';
  end if;

  if not coalesce(v_exists, false) then
    insert into employees (id, employee_code, full_name, current_restaurant_id)
    values (v_id, coalesce(v_code, app.next_document_number('EMP')), payload ->> 'full_name', v_restaurant_id);

    if v_restaurant_id is not null then
      insert into employee_assignments (employee_id, restaurant_id, starts_at, assigned_by)
      values (v_id, v_restaurant_id, current_date, auth.uid());
    end if;
  elsif v_restaurant_id is distinct from v_existing_restaurant_id and v_restaurant_id is not null then
    update employee_assignments set ends_at = current_date where employee_id = v_id and ends_at is null;
    insert into employee_assignments (employee_id, restaurant_id, starts_at, assigned_by)
    values (v_id, v_restaurant_id, current_date, auth.uid());
  end if;

  update employees set
    employee_code = coalesce(v_code, employee_code),
    full_name = payload ->> 'full_name',
    current_restaurant_id = v_restaurant_id,
    job_title = nullif(payload ->> 'job_title', ''),
    base_salary = nullif(payload ->> 'base_salary', '')::numeric,
    renewal_salary = nullif(payload ->> 'renewal_salary', '')::numeric,
    visa_sponsorship_type = nullif(payload ->> 'visa_sponsorship_type', ''),
    sponsor_name = nullif(payload ->> 'sponsor_name', ''),
    work_permit_category = nullif(payload ->> 'work_permit_category', ''),
    visa_status = nullif(payload ->> 'visa_status', ''),
    work_permit_expiry_available = coalesce((payload ->> 'work_permit_expiry_available')::boolean, true),
    work_permit_expiry = case when coalesce((payload ->> 'work_permit_expiry_available')::boolean, true)
                              then nullif(payload ->> 'work_permit_expiry', '')::date end,
    work_permit_salary = nullif(payload ->> 'work_permit_salary', '')::numeric,
    work_permit_number = nullif(payload ->> 'work_permit_number', ''),
    labour_person_number = nullif(payload ->> 'labour_person_number', ''),
    labour_permit_expiry = nullif(payload ->> 'labour_permit_expiry', '')::date,
    permit_issue_date = nullif(payload ->> 'permit_issue_date', '')::date,
    medical_entry_date = nullif(payload ->> 'medical_entry_date', '')::date,
    medical_expiry_date = nullif(payload ->> 'medical_expiry_date', '')::date,
    emirates_id = nullif(payload ->> 'emirates_id', ''),
    emirates_id_expiry = nullif(payload ->> 'emirates_id_expiry', '')::date,
    last_exit_date = nullif(payload ->> 'last_exit_date', '')::date,
    last_in_country_date = nullif(payload ->> 'last_in_country_date', '')::date,
    presence_status = nullif(payload ->> 'presence_status', ''),
    passport_number = nullif(payload ->> 'passport_number', ''),
    passport_issue_date = nullif(payload ->> 'passport_issue_date', '')::date,
    passport_expiry_date = nullif(payload ->> 'passport_expiry_date', '')::date,
    nationality = nullif(payload ->> 'nationality', ''),
    flight_ticket_claimed = coalesce((payload ->> 'flight_ticket_claimed')::boolean, false),
    decision_date = nullif(payload ->> 'decision_date', '')::date,
    final_status = nullif(payload ->> 'final_status', ''),
    settlement_date = nullif(payload ->> 'settlement_date', '')::date,
    settlement_amount = nullif(payload ->> 'settlement_amount', '')::numeric,
    labour_fine_amount = nullif(payload ->> 'labour_fine_amount', '')::numeric,
    settlement_status = coalesce(nullif(payload ->> 'settlement_status', ''), 'pending'),
    settlement_document_type = nullif(payload ->> 'settlement_document_type', ''),
    settlement_reference = nullif(payload ->> 'settlement_reference', ''),
    renewal_notes = nullif(payload ->> 'renewal_notes', '')
  where id = v_id;

  -- Documents: keep submitted existing rows, add new ones, drop the rest.
  delete from employee_documents
  where employee_id = v_id
    and id not in (
      select (d ->> 'id')::uuid from jsonb_array_elements(coalesce(payload -> 'documents', '[]'::jsonb)) d
      where nullif(d ->> 'id', '') is not null
    );
  insert into employee_documents (employee_id, document_type, attachment_id)
  select v_id, d ->> 'document_type', (d ->> 'attachment_id')::uuid
  from jsonb_array_elements(coalesce(payload -> 'documents', '[]'::jsonb)) d
  where nullif(d ->> 'id', '') is null;

  -- Vacations & flight tickets.
  delete from employee_vacations
  where employee_id = v_id
    and id not in (
      select (v ->> 'id')::uuid from jsonb_array_elements(coalesce(payload -> 'vacations', '[]'::jsonb)) v
      where nullif(v ->> 'id', '') is not null
    );
  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'vacations', '[]'::jsonb))
  loop
    if nullif(v_item ->> 'id', '') is not null then
      update employee_vacations set
        start_date = (v_item ->> 'start_date')::date,
        end_date = nullif(v_item ->> 'end_date', '')::date,
        paid_by = nullif(v_item ->> 'paid_by', ''),
        amount = nullif(v_item ->> 'amount', '')::numeric,
        ticket_claim_status = nullif(v_item ->> 'ticket_claim_status', ''),
        attachment_id = nullif(v_item ->> 'attachment_id', '')::uuid
      where id = (v_item ->> 'id')::uuid and employee_id = v_id;
    else
      insert into employee_vacations (employee_id, start_date, end_date, paid_by, amount, ticket_claim_status, attachment_id, created_by)
      values (
        v_id, (v_item ->> 'start_date')::date, nullif(v_item ->> 'end_date', '')::date,
        nullif(v_item ->> 'paid_by', ''), nullif(v_item ->> 'amount', '')::numeric,
        nullif(v_item ->> 'ticket_claim_status', ''), nullif(v_item ->> 'attachment_id', '')::uuid, auth.uid()
      );
    end if;
  end loop;

  -- Potential replacements.
  delete from employee_replacements
  where employee_id = v_id
    and id not in (
      select (r ->> 'id')::uuid from jsonb_array_elements(coalesce(payload -> 'replacements', '[]'::jsonb)) r
      where nullif(r ->> 'id', '') is not null
    );
  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'replacements', '[]'::jsonb))
  loop
    if nullif(v_item ->> 'id', '') is not null then
      update employee_replacements set
        availability = coalesce(nullif(v_item ->> 'availability', ''), 'available_now'),
        available_from = nullif(v_item ->> 'available_from', '')::date,
        position = nullif(v_item ->> 'position', ''),
        source = nullif(v_item ->> 'source', ''),
        notes = nullif(v_item ->> 'notes', '')
      where id = (v_item ->> 'id')::uuid and employee_id = v_id;
    else
      insert into employee_replacements (
        employee_id, replacement_employee_id, candidate_name, position, source, availability, available_from, notes, created_by
      ) values (
        v_id, nullif(v_item ->> 'replacement_employee_id', '')::uuid, nullif(v_item ->> 'candidate_name', ''),
        nullif(v_item ->> 'position', ''), nullif(v_item ->> 'source', ''),
        coalesce(nullif(v_item ->> 'availability', ''), 'available_now'),
        nullif(v_item ->> 'available_from', '')::date, nullif(v_item ->> 'notes', ''), auth.uid()
      );
    end if;
  end loop;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, new_value)
  values (
    auth.uid(), case when coalesce(v_exists, false) then 'update' else 'create' end, 'employees', 'employee', v_id,
    jsonb_build_object('final_status', payload ->> 'final_status', 'settlement_status', payload ->> 'settlement_status')
  );

  return v_id;
end;
$$;

grant execute on function public.save_employee_record(jsonb) to authenticated;
