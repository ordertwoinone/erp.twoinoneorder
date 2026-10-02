-- Employee record, part 3 (the full "Employee Details / Renewal & Settlement"
-- design): photo, performance, probation, typing-centre payment tracker with
-- a payment ledger, labour-fine details, loan installment, complaints &
-- issues, uniform & accommodation items, and monthly attendance / sales /
-- incentives. Salary & loan history is NOT stored here — the page reads it
-- from payroll (salary_entries, employee_advances).

-- === Employee columns ============================================================
alter table employees
  add column if not exists photo_attachment_id uuid references attachments(id),
  add column if not exists performance_rating numeric(2,1) check (performance_rating between 0 and 5),
  add column if not exists probation_months integer check (probation_months between 0 and 24),
  add column if not exists probation_end_date date,
  add column if not exists probation_status text
    check (probation_status in ('in_probation', 'pending_review', 'confirmed', 'extended', 'terminated')),
  add column if not exists typing_centre_name text,
  add column if not exists typing_centre_contact text,
  add column if not exists typing_application_ref text,
  add column if not exists typing_process text
    check (typing_process in ('new_employment_visa', 'renewal', 'transfer', 'cancellation', 'status_change')),
  add column if not exists labour_fine_status text
    check (labour_fine_status in ('none', 'pending_verification', 'verified', 'paid', 'waived')),
  add column if not exists labour_fine_checked_date date,
  add column if not exists labour_fine_reference text,
  add column if not exists labour_fine_remarks text,
  add column if not exists labour_fine_attachment_id uuid references attachments(id),
  add column if not exists loan_monthly_installment numeric(14,2) check (loan_monthly_installment >= 0),
  add column if not exists incentive_enabled boolean not null default false,
  add column if not exists incentive_basis text check (incentive_basis in ('eligible_sales', 'total_sales', 'orders')),
  add column if not exists incentive_rate numeric(5,2) check (incentive_rate between 0 and 100);

-- === Typing-centre steps (was the 0049 visa journey) =============================
-- The step list changed to the UAE typing-centre process. Carry over the
-- steps that map one-to-one; the rest are dropped on the next save.
alter table employee_visa_steps
  add column if not exists step_option text,
  add column if not exists expiry_not_applicable boolean not null default false;

update employee_visa_steps set step_key = 'offer_letter' where step_key = 'job_offer';
update employee_visa_steps set step_key = 'change_status' where step_key = 'status_adjustment';
update employee_visa_steps set step_key = 'residency_emirates_id'
where step_key = 'residence_permit'
  and not exists (select 1 from employee_visa_steps x where x.employee_id = employee_visa_steps.employee_id and x.step_key = 'residency_emirates_id');

-- Payment ledger for the typing-centre steps. A step's "Paid" is the sum of
-- its payments; amount_paid typed on a step before this migration becomes a
-- payment row so nothing is lost.
create table if not exists employee_typing_payments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  step_key text not null,
  invoice_amount numeric(14,2) check (invoice_amount >= 0),
  payment_amount numeric(14,2) not null check (payment_amount >= 0),
  payment_date date,
  payment_method text check (payment_method in ('cash', 'card', 'bank_transfer', 'cheque')),
  reference text,
  paid_by text check (paid_by in ('company', 'employee')),
  attachment_id uuid references attachments(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists employee_typing_payments_employee_idx on employee_typing_payments(employee_id, step_key);

insert into employee_typing_payments (employee_id, step_key, invoice_amount, payment_amount, payment_date, attachment_id, paid_by)
select s.employee_id, s.step_key, coalesce(s.government_fee, 0) + coalesce(s.other_charges, 0), s.amount_paid, s.payment_date, s.attachment_id, 'company'
from employee_visa_steps s
where coalesce(s.amount_paid, 0) > 0
  -- Safe to re-run: skip steps whose payment was already copied.
  and not exists (select 1 from employee_typing_payments p where p.employee_id = s.employee_id and p.step_key = s.step_key);

-- === Complaints & issues =========================================================
create table if not exists employee_issues (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  issue_date date not null,
  issue_type text not null check (issue_type in ('complaint', 'issue', 'warning', 'request', 'appreciation')),
  description text,
  assigned_to text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  attachment_id uuid references attachments(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists employee_issues_employee_idx on employee_issues(employee_id, issue_date);

-- === Uniform & accommodation items ===============================================
create table if not exists employee_items (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  item_name text not null,
  category text not null default 'uniform' check (category in ('uniform', 'accommodation', 'equipment', 'other')),
  quantity integer not null default 1 check (quantity >= 0),
  size_allocation text,
  issued_date date,
  condition text not null default 'issued' check (condition in ('issued', 'assigned', 'returned', 'damaged', 'lost')),
  acknowledged boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists employee_items_employee_idx on employee_items(employee_id);

-- === Monthly attendance, sales & incentives ======================================
-- restaurant_id is set null if the branch is deleted, so it never blocks
-- delete_restaurant.
create table if not exists employee_monthly_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  period_month date not null check (extract(day from period_month) = 1),
  restaurant_id uuid references restaurants(id) on delete set null,
  attendance_days integer check (attendance_days between 0 and 31),
  working_days integer check (working_days between 0 and 31),
  eligible_sales numeric(14,2) check (eligible_sales >= 0),
  orders_count integer check (orders_count >= 0),
  incentive_rate numeric(5,2) check (incentive_rate between 0 and 100),
  incentive_amount numeric(14,2) check (incentive_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'rejected')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (employee_id, period_month)
);

-- === RLS (same rules as the other employee child tables) =========================
alter table employee_typing_payments enable row level security;
alter table employee_issues enable row level security;
alter table employee_items enable row level security;
alter table employee_monthly_records enable row level security;

drop policy if exists employee_typing_payments_select on employee_typing_payments;
create policy employee_typing_payments_select on employee_typing_payments for select using (app.has_permission('employees.view'));
drop policy if exists employee_typing_payments_write on employee_typing_payments;
create policy employee_typing_payments_write on employee_typing_payments for all
  using (app.has_permission('employees.manage')) with check (app.has_permission('employees.manage'));
drop policy if exists employee_issues_select on employee_issues;
create policy employee_issues_select on employee_issues for select using (app.has_permission('employees.view'));
drop policy if exists employee_issues_write on employee_issues;
create policy employee_issues_write on employee_issues for all
  using (app.has_permission('employees.manage')) with check (app.has_permission('employees.manage'));
drop policy if exists employee_items_select on employee_items;
create policy employee_items_select on employee_items for select using (app.has_permission('employees.view'));
drop policy if exists employee_items_write on employee_items;
create policy employee_items_write on employee_items for all
  using (app.has_permission('employees.manage')) with check (app.has_permission('employees.manage'));
drop policy if exists employee_monthly_records_select on employee_monthly_records;
create policy employee_monthly_records_select on employee_monthly_records for select using (app.has_permission('employees.view'));
drop policy if exists employee_monthly_records_write on employee_monthly_records;
create policy employee_monthly_records_write on employee_monthly_records for all
  using (app.has_permission('employees.manage')) with check (app.has_permission('employees.manage'));

-- === Save the whole record in one transaction (replaces 0049) ====================
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
    joining_date = nullif(payload ->> 'joining_date', '')::date,
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
    visit_visa_recovered_amount = nullif(payload ->> 'visit_visa_recovered_amount', '')::numeric,
    photo_attachment_id = nullif(payload ->> 'photo_attachment_id', '')::uuid,
    performance_rating = nullif(payload ->> 'performance_rating', '')::numeric,
    probation_months = nullif(payload ->> 'probation_months', '')::integer,
    probation_end_date = nullif(payload ->> 'probation_end_date', '')::date,
    probation_status = nullif(payload ->> 'probation_status', ''),
    typing_centre_name = nullif(payload ->> 'typing_centre_name', ''),
    typing_centre_contact = nullif(payload ->> 'typing_centre_contact', ''),
    typing_application_ref = nullif(payload ->> 'typing_application_ref', ''),
    typing_process = nullif(payload ->> 'typing_process', ''),
    labour_fine_status = nullif(payload ->> 'labour_fine_status', ''),
    labour_fine_checked_date = nullif(payload ->> 'labour_fine_checked_date', '')::date,
    labour_fine_reference = nullif(payload ->> 'labour_fine_reference', ''),
    labour_fine_remarks = nullif(payload ->> 'labour_fine_remarks', ''),
    labour_fine_attachment_id = nullif(payload ->> 'labour_fine_attachment_id', '')::uuid,
    loan_monthly_installment = nullif(payload ->> 'loan_monthly_installment', '')::numeric,
    incentive_enabled = coalesce((payload ->> 'incentive_enabled')::boolean, false),
    incentive_basis = nullif(payload ->> 'incentive_basis', ''),
    incentive_rate = nullif(payload ->> 'incentive_rate', '')::numeric
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

  -- Typing-centre steps: the page sends every step that has any data.
  delete from employee_visa_steps
  where employee_id = v_id
    and step_key not in (
      select s ->> 'step_key' from jsonb_array_elements(coalesce(payload -> 'visa_steps', '[]'::jsonb)) s
    );
  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'visa_steps', '[]'::jsonb))
  loop
    insert into employee_visa_steps (
      employee_id, step_key, step_option, status, application_date, approval_date, expiry_date, expiry_not_applicable,
      government_fee, other_charges, fine_amount, fine_status, notes, attachment_id
    ) values (
      v_id, v_item ->> 'step_key', nullif(v_item ->> 'step_option', ''), coalesce(nullif(v_item ->> 'status', ''), 'not_started'),
      nullif(v_item ->> 'application_date', '')::date, nullif(v_item ->> 'approval_date', '')::date,
      nullif(v_item ->> 'expiry_date', '')::date, coalesce((v_item ->> 'expiry_not_applicable')::boolean, false),
      nullif(v_item ->> 'government_fee', '')::numeric, nullif(v_item ->> 'other_charges', '')::numeric,
      nullif(v_item ->> 'fine_amount', '')::numeric, nullif(v_item ->> 'fine_status', ''),
      nullif(v_item ->> 'notes', ''), nullif(v_item ->> 'attachment_id', '')::uuid
    )
    on conflict (employee_id, step_key) do update set
      step_option = excluded.step_option,
      status = excluded.status,
      application_date = excluded.application_date,
      approval_date = excluded.approval_date,
      expiry_date = excluded.expiry_date,
      expiry_not_applicable = excluded.expiry_not_applicable,
      government_fee = excluded.government_fee,
      other_charges = excluded.other_charges,
      fine_amount = excluded.fine_amount,
      fine_status = excluded.fine_status,
      notes = excluded.notes,
      attachment_id = excluded.attachment_id;
  end loop;

  -- The newer child lists all use client-generated ids, so each is "delete
  -- what wasn't sent, upsert what was". The `where employee_id = v_id` on the
  -- conflict update stops a crafted id from touching another employee's row.
  delete from employee_typing_payments where employee_id = v_id
    and id not in (select (x ->> 'id')::uuid from jsonb_array_elements(coalesce(payload -> 'typing_payments', '[]'::jsonb)) x);
  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'typing_payments', '[]'::jsonb))
  loop
    insert into employee_typing_payments as t (
      id, employee_id, step_key, invoice_amount, payment_amount, payment_date, payment_method, reference, paid_by, attachment_id, created_by
    ) values (
      (v_item ->> 'id')::uuid, v_id, v_item ->> 'step_key', nullif(v_item ->> 'invoice_amount', '')::numeric,
      coalesce(nullif(v_item ->> 'payment_amount', '')::numeric, 0), nullif(v_item ->> 'payment_date', '')::date,
      nullif(v_item ->> 'payment_method', ''), nullif(v_item ->> 'reference', ''), nullif(v_item ->> 'paid_by', ''),
      nullif(v_item ->> 'attachment_id', '')::uuid, auth.uid()
    )
    on conflict (id) do update set
      step_key = excluded.step_key, invoice_amount = excluded.invoice_amount, payment_amount = excluded.payment_amount,
      payment_date = excluded.payment_date, payment_method = excluded.payment_method, reference = excluded.reference,
      paid_by = excluded.paid_by, attachment_id = excluded.attachment_id
    where t.employee_id = v_id;
  end loop;

  delete from employee_issues where employee_id = v_id
    and id not in (select (x ->> 'id')::uuid from jsonb_array_elements(coalesce(payload -> 'issues', '[]'::jsonb)) x);
  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'issues', '[]'::jsonb))
  loop
    insert into employee_issues as t (id, employee_id, issue_date, issue_type, description, assigned_to, status, attachment_id, created_by)
    values (
      (v_item ->> 'id')::uuid, v_id, (v_item ->> 'issue_date')::date, coalesce(nullif(v_item ->> 'issue_type', ''), 'issue'),
      nullif(v_item ->> 'description', ''), nullif(v_item ->> 'assigned_to', ''), coalesce(nullif(v_item ->> 'status', ''), 'open'),
      nullif(v_item ->> 'attachment_id', '')::uuid, auth.uid()
    )
    on conflict (id) do update set
      issue_date = excluded.issue_date, issue_type = excluded.issue_type, description = excluded.description,
      assigned_to = excluded.assigned_to, status = excluded.status, attachment_id = excluded.attachment_id
    where t.employee_id = v_id;
  end loop;

  delete from employee_items where employee_id = v_id
    and id not in (select (x ->> 'id')::uuid from jsonb_array_elements(coalesce(payload -> 'items', '[]'::jsonb)) x);
  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'items', '[]'::jsonb))
  loop
    insert into employee_items as t (id, employee_id, item_name, category, quantity, size_allocation, issued_date, condition, acknowledged, created_by)
    values (
      (v_item ->> 'id')::uuid, v_id, v_item ->> 'item_name', coalesce(nullif(v_item ->> 'category', ''), 'uniform'),
      coalesce(nullif(v_item ->> 'quantity', '')::integer, 1), nullif(v_item ->> 'size_allocation', ''),
      nullif(v_item ->> 'issued_date', '')::date, coalesce(nullif(v_item ->> 'condition', ''), 'issued'),
      coalesce((v_item ->> 'acknowledged')::boolean, false), auth.uid()
    )
    on conflict (id) do update set
      item_name = excluded.item_name, category = excluded.category, quantity = excluded.quantity,
      size_allocation = excluded.size_allocation, issued_date = excluded.issued_date,
      condition = excluded.condition, acknowledged = excluded.acknowledged
    where t.employee_id = v_id;
  end loop;

  delete from employee_monthly_records where employee_id = v_id
    and id not in (select (x ->> 'id')::uuid from jsonb_array_elements(coalesce(payload -> 'monthly_records', '[]'::jsonb)) x);
  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'monthly_records', '[]'::jsonb))
  loop
    insert into employee_monthly_records as t (
      id, employee_id, period_month, restaurant_id, attendance_days, working_days, eligible_sales, orders_count,
      incentive_rate, incentive_amount, status, created_by
    ) values (
      (v_item ->> 'id')::uuid, v_id, date_trunc('month', (v_item ->> 'period_month')::date)::date,
      nullif(v_item ->> 'restaurant_id', '')::uuid,
      nullif(v_item ->> 'attendance_days', '')::integer, nullif(v_item ->> 'working_days', '')::integer,
      nullif(v_item ->> 'eligible_sales', '')::numeric, nullif(v_item ->> 'orders_count', '')::integer,
      nullif(v_item ->> 'incentive_rate', '')::numeric, nullif(v_item ->> 'incentive_amount', '')::numeric,
      coalesce(nullif(v_item ->> 'status', ''), 'pending'), auth.uid()
    )
    on conflict (id) do update set
      period_month = excluded.period_month, restaurant_id = excluded.restaurant_id,
      attendance_days = excluded.attendance_days, working_days = excluded.working_days,
      eligible_sales = excluded.eligible_sales, orders_count = excluded.orders_count,
      incentive_rate = excluded.incentive_rate, incentive_amount = excluded.incentive_amount, status = excluded.status
    where t.employee_id = v_id;
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
