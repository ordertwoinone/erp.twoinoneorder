-- Visa sponsorship types: drop golden / investor / mission, add work_permit.
-- Existing rows on a removed type become 'other' so the new check holds.
update employees set visa_sponsorship_type = 'other'
where visa_sponsorship_type in ('golden', 'investor', 'mission');

alter table employees drop constraint if exists employees_visa_sponsorship_type_check;
alter table employees add constraint employees_visa_sponsorship_type_check
  check (visa_sponsorship_type in ('company', 'family', 'work_permit', 'freelance', 'other'));

-- Deleting a restaurant. Almost every operational table references
-- restaurants without cascade, which is deliberate: invoices, sales,
-- payroll and ledger history must never disappear with a branch. So only a
-- restaurant with no records can be deleted; otherwise this explains what's
-- linked and the admin should mark it inactive instead.
create or replace function public.delete_restaurant(p_restaurant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_message text;
  v_table text;
begin
  if not app.has_permission('restaurants.manage') then
    raise exception 'Not authorized to delete restaurants';
  end if;

  select name into v_name from restaurants where id = p_restaurant_id;
  if v_name is null then
    raise exception 'Restaurant not found';
  end if;

  begin
    -- Pure configuration links that shouldn't block a delete.
    update profiles set primary_restaurant_id = null where primary_restaurant_id = p_restaurant_id;
    delete from restaurants where id = p_restaurant_id;
  exception when foreign_key_violation then
    get stacked diagnostics v_message = message_text;
    v_table := substring(v_message from 'on table "([a-z_]+)"\s*$');
    raise exception '% can''t be deleted because it still has % linked to it. Mark it inactive instead to hide it while keeping its history.',
      v_name, coalesce(replace(v_table, '_', ' '), 'records');
  end;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, old_value)
  values (auth.uid(), 'delete', 'organization', 'restaurant', p_restaurant_id, jsonb_build_object('name', v_name));
end;
$$;

grant execute on function public.delete_restaurant(uuid) to authenticated;
