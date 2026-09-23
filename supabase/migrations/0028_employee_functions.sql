-- Transfers an employee to a new restaurant, closing the current
-- employee_assignments row and opening a new one, so assignment history is
-- always complete (spec §29).
create or replace function public.transfer_employee(p_employee_id uuid, p_new_restaurant_id uuid, p_effective_date date default current_date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_restaurant_id uuid;
begin
  if not app.has_permission('employees.manage') then
    raise exception 'Not authorized to transfer employees';
  end if;
  if not app.has_restaurant_access(p_new_restaurant_id) then
    raise exception 'Not authorized for the destination restaurant';
  end if;

  select current_restaurant_id into v_current_restaurant_id from employees where id = p_employee_id;
  if v_current_restaurant_id is null and not found then
    raise exception 'Employee not found';
  end if;

  update employee_assignments
  set ends_at = p_effective_date
  where employee_id = p_employee_id and ends_at is null;

  insert into employee_assignments (employee_id, restaurant_id, starts_at, assigned_by)
  values (p_employee_id, p_new_restaurant_id, p_effective_date, auth.uid());

  update employees set current_restaurant_id = p_new_restaurant_id where id = p_employee_id;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, old_value, new_value)
  values (
    auth.uid(), 'transfer', 'employees', 'employee', p_employee_id,
    jsonb_build_object('restaurant_id', v_current_restaurant_id),
    jsonb_build_object('restaurant_id', p_new_restaurant_id)
  );
end;
$$;

grant execute on function public.transfer_employee(uuid, uuid, date) to authenticated;
