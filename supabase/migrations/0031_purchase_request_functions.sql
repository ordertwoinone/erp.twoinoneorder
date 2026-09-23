create or replace function public.save_purchase_request(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_restaurant_id uuid;
  v_status text;
begin
  v_restaurant_id := (payload ->> 'restaurant_id')::uuid;
  if not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;
  if not app.has_permission('purchases.create') then
    raise exception 'Not authorized to create purchase requests';
  end if;
  if jsonb_array_length(coalesce(payload -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'Add at least one item';
  end if;

  v_request_id := nullif(payload ->> 'id', '')::uuid;

  if v_request_id is not null then
    select status into v_status from purchase_requests where id = v_request_id;
    if v_status is null then raise exception 'Purchase request not found'; end if;
    if v_status != 'requested' then raise exception 'Only requests awaiting review can be edited'; end if;

    update purchase_requests set notes = nullif(payload ->> 'notes', '') where id = v_request_id;
    delete from purchase_request_items where purchase_request_id = v_request_id;
  else
    insert into purchase_requests (request_number, restaurant_id, status, notes, requested_by)
    values (app.next_document_number('PR'), v_restaurant_id, 'requested', nullif(payload ->> 'notes', ''), auth.uid())
    returning id into v_request_id;
  end if;

  insert into purchase_request_items (purchase_request_id, product_id, unit_id, quantity, notes)
  select v_request_id, (item ->> 'product_id')::uuid, (item ->> 'unit_id')::uuid,
         (item ->> 'quantity')::numeric, nullif(item ->> 'notes', '')
  from jsonb_array_elements(payload -> 'items') as item;

  return v_request_id;
end;
$$;

create or replace function public.review_purchase_request(p_request_id uuid, p_action text, p_comment text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_status text;
  v_new_status text;
begin
  select restaurant_id, status into v_restaurant_id, v_status
  from purchase_requests where id = p_request_id for update;

  if v_restaurant_id is null then raise exception 'Purchase request not found'; end if;
  if not app.has_permission('purchase_orders.manage') then raise exception 'Not authorized to review requests'; end if;

  if p_action = 'approve' then
    if v_status not in ('requested', 'under_review') then raise exception 'Only open requests can be approved'; end if;
    v_new_status := 'approved';
  elsif p_action = 'reject' then
    if v_status not in ('requested', 'under_review') then raise exception 'Only open requests can be rejected'; end if;
    v_new_status := 'rejected';
  elsif p_action = 'cancel' then
    if v_status in ('ordered', 'received', 'invoiced', 'cancelled') then raise exception 'This request can no longer be cancelled'; end if;
    v_new_status := 'cancelled';
  else
    raise exception 'Unknown action %', p_action;
  end if;

  update purchase_requests set status = v_new_status, reviewed_by = auth.uid() where id = p_request_id;

  insert into approvals (entity_type, entity_id, action, comment, actor_id)
  values ('purchase_request', p_request_id,
          case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else 'commented' end::approval_action,
          p_comment, auth.uid());

  insert into audit_logs (actor_id, action, module, entity_type, entity_id, old_value, new_value)
  values (auth.uid(), p_action, 'purchasing', 'purchase_request', p_request_id,
          jsonb_build_object('status', v_status), jsonb_build_object('status', v_new_status));
end;
$$;

grant execute on function public.save_purchase_request(jsonb) to authenticated;
grant execute on function public.review_purchase_request(uuid, text, text) to authenticated;
