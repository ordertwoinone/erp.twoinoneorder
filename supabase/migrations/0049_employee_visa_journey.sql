-- Employee record, part 2: everything from the "Visa journey & settlement"
-- design that the page didn't have yet, kept on the same single page —
-- entry / initial visa details, passport custody, health & employment
-- insurance, visit-visa funding, and a per-step visa journey (job offer ->
-- work permit -> entry permit -> medical -> Emirates ID -> residence) with
-- the fees, payments, fines and receipt for each step.

-- === Employee columns ============================================================
alter table employees
  add column initial_visa_type text check (initial_visa_type in ('visit_visa', 'employment_visa', 'other_sponsor')),
  add column entry_date date,
  add column allowed_stay_days integer check (allowed_stay_days >= 0),
  add column passport_status text
    check (passport_status in ('with_employee', 'with_company', 'submitted_for_processing', 'lost', 'other')),
  add column passport_location text,
  add column health_insurance_expiry date,
  add column insurance_applicable boolean not null default false,
  add column insurance_start_date date,
  add column insurance_expiry_date date,
  add column insurance_fine_applicable boolean not null default false,
  add column insurance_fine_amount numeric(14,2) check (insurance_fine_amount >= 0),
  add column insurance_status text
    check (insurance_status in ('pending_verification', 'active', 'expired', 'cancelled', 'not_applicable')),
  add column visit_visa_source text check (visit_visa_source in ('company_arranged', 'self_arranged', 'agency')),
  add column visit_visa_support text check (visit_visa_support in ('recoverable_loan', 'company_paid', 'employee_paid')),
  add column visit_visa_cost numeric(14,2) check (visit_visa_cost >= 0),
  add column visit_visa_loan_amount numeric(14,2) check (visit_visa_loan_amount >= 0),
  add column visit_visa_disbursed_date date,
  add column visit_visa_repayment_start date,
  add column visit_visa_monthly_deduction numeric(14,2) check (visit_visa_monthly_deduction >= 0),
  add column visit_visa_recovered_amount numeric(14,2) check (visit_visa_recovered_amount >= 0);

-- === Visa journey steps ==========================================================
-- One row per step the employee has any data for; the step list itself lives
-- in the app (employeeOptions VISA_STEPS).
create table employee_visa_steps (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  step_key text not null,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'pending_payment', 'approved', 'completed', 'rejected', 'expired', 'not_applicable')),
  application_date date,
  approval_date date,
  expiry_date date,
  government_fee numeric(14,2) check (government_fee >= 0),
  other_charges numeric(14,2) check (other_charges >= 0),
  amount_paid numeric(14,2) check (amount_paid >= 0),
  fine_amount numeric(14,2) check (fine_amount >= 0),
  fine_status text check (fine_status in ('none', 'pending_verification', 'paid', 'waived')),
  payment_date date,
  notes text,
  attachment_id uuid references attachments(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, step_key)
);
create trigger set_updated_at before update on employee_visa_steps
  for each row execute function app.set_updated_at();

alter table employee_visa_steps enable row level security;
create policy employee_visa_steps_select on employee_visa_steps for select using (app.has_permission('employees.view'));
create policy employee_visa_steps_write on employee_visa_steps for all
  using (app.has_permission('employees.manage')) with check (app.has_permission('employees.manage'));

-- === Save the whole record in one transaction (replaces 0044) ====================
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
    renewal_notes = nullif(payload ->> 'renewal_notes', ''),
    initial_visa_type = nullif(payload ->> 'initial_visa_type', ''),
    entry_date = nullif(payload ->> 'entry_date', '')::date,
    allowed_stay_days = nullif(payload ->> 'allowed_stay_days', '')::integer,
    passport_status = nullif(payload ->> 'passport_status', ''),
    passport_location = nullif(payload ->> 'passport_location', ''),
    health_insurance_expiry = nullif(payload ->> 'health_insurance_expiry', '')::date,
    insurance_applicable = coalesce((payload ->> 'insurance_applicable')::boolean, false),
    insurance_start_date = nullif(payload ->> 'insurance_start_date', '')::date,
    insurance_expiry_date = nullif(payload ->> 'insurance_expiry_date', '')::date,
    insurance_fine_applicable = coalesce((payload ->> 'insurance_fine_applicable')::boolean, false),
    insurance_fine_amount = case when coalesce((payload ->> 'insurance_fine_applicable')::boolean, false)
                                 then nullif(payload ->> 'insurance_fine_amount', '')::numeric end,
    insurance_status = nullif(payload ->> 'insurance_status', ''),
    visit_visa_source = nullif(payload ->> 'visit_visa_source', ''),
    visit_visa_support = nullif(payload ->> 'visit_visa_support', ''),
    visit_visa_cost = nullif(payload ->> 'visit_visa_cost', '')::numeric,
    visit_visa_loan_amount = nullif(payload ->> 'visit_visa_loan_amount', '')::numeric,
    visit_visa_disbursed_date = nullif(payload ->> 'visit_visa_disbursed_date', '')::date,
    visit_visa_repayment_start = nullif(payload ->> 'visit_visa_repayment_start', '')::date,
    visit_visa_monthly_deduction = nullif(payload ->> 'visit_visa_monthly_deduction', '')::numeric,
    visit_visa_recovered_amount = nullif(payload ->> 'visit_visa_recovered_amount', '')::numeric
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

  -- Visa journey: the page sends every step that has any data; steps it
  -- leaves out were cleared.
  delete from employee_visa_steps
  where employee_id = v_id
    and step_key not in (
      select s ->> 'step_key' from jsonb_array_elements(coalesce(payload -> 'visa_steps', '[]'::jsonb)) s
    );
  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'visa_steps', '[]'::jsonb))
  loop
    insert into employee_visa_steps (
      employee_id, step_key, status, application_date, approval_date, expiry_date,
      government_fee, other_charges, amount_paid, fine_amount, fine_status, payment_date, notes, attachment_id
    ) values (
      v_id, v_item ->> 'step_key', coalesce(nullif(v_item ->> 'status', ''), 'not_started'),
      nullif(v_item ->> 'application_date', '')::date, nullif(v_item ->> 'approval_date', '')::date,
      nullif(v_item ->> 'expiry_date', '')::date,
      nullif(v_item ->> 'government_fee', '')::numeric, nullif(v_item ->> 'other_charges', '')::numeric,
      nullif(v_item ->> 'amount_paid', '')::numeric, nullif(v_item ->> 'fine_amount', '')::numeric,
      nullif(v_item ->> 'fine_status', ''), nullif(v_item ->> 'payment_date', '')::date,
      nullif(v_item ->> 'notes', ''), nullif(v_item ->> 'attachment_id', '')::uuid
    )
    on conflict (employee_id, step_key) do update set
      status = excluded.status,
      application_date = excluded.application_date,
      approval_date = excluded.approval_date,
      expiry_date = excluded.expiry_date,
      government_fee = excluded.government_fee,
      other_charges = excluded.other_charges,
      amount_paid = excluded.amount_paid,
      fine_amount = excluded.fine_amount,
      fine_status = excluded.fine_status,
      payment_date = excluded.payment_date,
      notes = excluded.notes,
      attachment_id = excluded.attachment_id;
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
