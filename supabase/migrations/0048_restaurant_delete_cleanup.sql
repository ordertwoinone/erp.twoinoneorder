-- Deleting a restaurant (replaces 0046). The 0046 version refused whenever
-- anything at all pointed at the branch, including leftovers that aren't
-- history: labour-list scans, AI scan jobs, staff currently assigned there,
-- empty accounting periods. Those are now cleared or detached first.
--
-- Financial records (purchases, sales, payments, payroll, bank/card/delivery
-- transactions, expenses, inventory, journal entries) still block the delete
-- on purpose. Everything below runs in one sub-transaction, so if the delete
-- is refused nothing has been changed.
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
  v_attachment_ids uuid[];
begin
  if not app.has_permission('restaurants.manage') then
    raise exception 'Not authorized to delete restaurants';
  end if;

  select name into v_name from restaurants where id = p_restaurant_id;
  if v_name is null then
    raise exception 'Restaurant not found';
  end if;

  begin
    update profiles set primary_restaurant_id = null where primary_restaurant_id = p_restaurant_id;

    -- Scan staging data (labour lists, invoice / quotation scans). Rows that
    -- became real employees or purchases live on in their own tables.
    select coalesce(array_agg(attachment_id), '{}') into v_attachment_ids
    from (
      select attachment_id from labour_list_imports where restaurant_id = p_restaurant_id and attachment_id is not null
      union
      select attachment_id from ai_scan_jobs where restaurant_id = p_restaurant_id and attachment_id is not null
    ) a;

    delete from labour_list_imports where restaurant_id = p_restaurant_id;
    delete from ai_scan_jobs where restaurant_id = p_restaurant_id;
    delete from attachments where id = any (v_attachment_ids);
    delete from attachments
    where restaurant_id = p_restaurant_id and entity_type in ('labour_list_import', 'ai_scan_job');

    -- Staff stay in the employee register, unassigned, so they can be moved
    -- to another branch. Their documents stay attached to them.
    update employees set current_restaurant_id = null where current_restaurant_id = p_restaurant_id;
    delete from employee_assignments where restaurant_id = p_restaurant_id;
    update attachments set restaurant_id = null
    where restaurant_id = p_restaurant_id and entity_type = 'employee';

    -- Period rows are just open/locked flags; any posted entries in them
    -- (journal_entries) still block the delete below.
    delete from accounting_periods where restaurant_id = p_restaurant_id;

    delete from restaurants where id = p_restaurant_id;
  exception when foreign_key_violation then
    get stacked diagnostics v_message = message_text;
    v_table := substring(v_message from 'on table "([a-z_]+)"\s*$');
    raise exception '% can''t be deleted because it still has % linked to it. Financial history is never deleted — mark the restaurant inactive instead to hide it.',
      v_name, coalesce(replace(v_table, '_', ' '), 'records');
  end;

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, old_value)
  values (auth.uid(), 'delete', 'organization', 'restaurant', p_restaurant_id, jsonb_build_object('name', v_name));
end;
$$;

grant execute on function public.delete_restaurant(uuid) to authenticated;
