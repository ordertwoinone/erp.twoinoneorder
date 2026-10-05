-- Purchase lines keep their own item description (as typed or as printed on
-- the supplier's invoice), separate from the catalogue item they're linked to.
-- save_purchase_draft is the 0051 version plus the description column.
-- Safe to re-run.

alter table purchase_items add column if not exists description text;

-- === save_purchase_draft (replaces 0051) =========================================
create or replace function public.save_purchase_draft(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase_id uuid;
  v_restaurant_id uuid;
  v_supplier_id uuid;
  v_status purchase_status;
  v_subtotal numeric(14,2) := 0;
  v_discount numeric(14,2) := 0;
  v_tax numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_net_total numeric(14,2) := 0;
  v_other numeric(14,2) := 0;
  v_terms integer := nullif(payload ->> 'payment_terms_days', '')::integer;
  v_tax_disabled boolean := coalesce((payload ->> 'tax_disabled')::boolean, false);
  v_items jsonb;
begin
  v_restaurant_id := (payload ->> 'restaurant_id')::uuid;
  v_supplier_id := (payload ->> 'supplier_id')::uuid;

  if not app.has_restaurant_access(v_restaurant_id) then
    raise exception 'Not authorized for this restaurant';
  end if;
  if not app.has_permission('purchases.create') then
    raise exception 'Not authorized to create purchases';
  end if;
  if jsonb_array_length(coalesce(payload -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'A purchase needs at least one line item';
  end if;

  v_purchase_id := nullif(payload ->> 'id', '')::uuid;

  if v_purchase_id is not null then
    select status into v_status from purchases where id = v_purchase_id;
    if v_status is null then
      raise exception 'Purchase not found';
    end if;
    if v_status not in ('draft', 'returned') then
      raise exception 'Only draft or returned purchases can be edited';
    end if;
  end if;

  if v_terms is null then
    select payment_terms_days into v_terms from suppliers where id = v_supplier_id;
  end if;

  -- "Disable tax" zero-rates every line regardless of what the client sent.
  select jsonb_agg(case when v_tax_disabled then item || '{"vat_rate": 0}'::jsonb else item end)
  into v_items
  from jsonb_array_elements(payload -> 'items') as item;

  select
    coalesce(sum(round((item ->> 'quantity')::numeric * (item ->> 'unit_price')::numeric, 2)), 0),
    coalesce(sum(coalesce((item ->> 'discount_amount')::numeric, 0)), 0),
    coalesce(sum(app.line_vat(item)), 0)
  into v_subtotal, v_discount, v_tax
  from jsonb_array_elements(v_items) as item;

  v_total := v_subtotal - v_discount + v_tax;
  v_net_total := v_subtotal - v_discount;

  select coalesce(sum(nullif(e ->> 'amount', '')::numeric), 0) into v_other
  from jsonb_array_elements(coalesce(payload -> 'expenses', '[]'::jsonb)) as e;

  if v_purchase_id is null then
    insert into purchases (
      purchase_number, restaurant_id, supplier_id, invoice_number, invoice_date, payment_terms_days,
      status, source, subtotal_amount, discount_amount, tax_amount, total_amount, notes, created_by,
      received_date, payment_mode, po_reference, tax_disabled, currency_code, exchange_rate,
      bill_discount_percent, other_expenses_amount
    ) values (
      app.next_document_number('PUR'), v_restaurant_id, v_supplier_id,
      payload ->> 'invoice_number', (payload ->> 'invoice_date')::date, v_terms,
      'draft', coalesce(nullif(payload ->> 'source', ''), 'manual'),
      v_subtotal, v_discount, v_tax, v_total, nullif(payload ->> 'notes', ''), auth.uid(),
      nullif(payload ->> 'received_date', '')::date, nullif(payload ->> 'payment_mode', ''),
      nullif(payload ->> 'po_reference', ''), v_tax_disabled,
      coalesce(nullif(payload ->> 'currency_code', ''), 'AED'),
      coalesce(nullif(payload ->> 'exchange_rate', '')::numeric, 1),
      nullif(payload ->> 'bill_discount_percent', '')::numeric, v_other
    ) returning id into v_purchase_id;
  else
    update purchases set
      supplier_id = v_supplier_id,
      invoice_number = payload ->> 'invoice_number',
      invoice_date = (payload ->> 'invoice_date')::date,
      payment_terms_days = v_terms,
      status = 'draft',
      subtotal_amount = v_subtotal,
      discount_amount = v_discount,
      tax_amount = v_tax,
      total_amount = v_total,
      notes = nullif(payload ->> 'notes', ''),
      received_date = nullif(payload ->> 'received_date', '')::date,
      payment_mode = nullif(payload ->> 'payment_mode', ''),
      po_reference = nullif(payload ->> 'po_reference', ''),
      tax_disabled = v_tax_disabled,
      currency_code = coalesce(nullif(payload ->> 'currency_code', ''), 'AED'),
      exchange_rate = coalesce(nullif(payload ->> 'exchange_rate', '')::numeric, 1),
      bill_discount_percent = nullif(payload ->> 'bill_discount_percent', '')::numeric,
      other_expenses_amount = v_other
    where id = v_purchase_id;

    delete from purchase_items where purchase_id = v_purchase_id;
    delete from purchase_expenses where purchase_id = v_purchase_id;
  end if;

  insert into purchase_items (
    purchase_id, product_id, unit_id, pack_size, quantity, unit_price,
    discount_amount, tax_amount, line_total, agreed_price_at_entry,
    foc_quantity, unit_discount, foreign_unit_price, landing_cost, description
  )
  select
    v_purchase_id,
    (item ->> 'product_id')::uuid,
    (item ->> 'unit_id')::uuid,
    nullif(item ->> 'pack_size', '')::numeric,
    (item ->> 'quantity')::numeric,
    (item ->> 'unit_price')::numeric,
    coalesce((item ->> 'discount_amount')::numeric, 0),
    app.line_vat(item),
    round((item ->> 'quantity')::numeric * (item ->> 'unit_price')::numeric, 2)
      - coalesce((item ->> 'discount_amount')::numeric, 0)
      + app.line_vat(item),
    app.current_agreed_price(v_supplier_id, (item ->> 'product_id')::uuid, (item ->> 'unit_id')::uuid, v_restaurant_id),
    coalesce(nullif(item ->> 'foc_quantity', '')::numeric, 0),
    coalesce(nullif(item ->> 'unit_discount', '')::numeric, 0),
    nullif(item ->> 'foreign_unit_price', '')::numeric,
    -- Landing cost per unit received (paid + free): the line's cost after
    -- discount, excluding recoverable VAT, plus its value-weighted share of
    -- the other related expenses.
    round(
      (net.amount + case when v_net_total > 0 then v_other * net.amount / v_net_total else 0 end)
      / nullif((item ->> 'quantity')::numeric + coalesce(nullif(item ->> 'foc_quantity', '')::numeric, 0), 0),
      4
    ),
    nullif(trim(item ->> 'description'), '')
  from jsonb_array_elements(v_items) as item
  cross join lateral (
    select round((item ->> 'quantity')::numeric * (item ->> 'unit_price')::numeric, 2)
           - coalesce((item ->> 'discount_amount')::numeric, 0) as amount
  ) net;

  insert into purchase_expenses (purchase_id, description, payee, amount)
  select v_purchase_id, coalesce(nullif(trim(e ->> 'description'), ''), 'Expense'), nullif(e ->> 'payee', ''),
         coalesce(nullif(e ->> 'amount', '')::numeric, 0)
  from jsonb_array_elements(coalesce(payload -> 'expenses', '[]'::jsonb)) as e;

  return v_purchase_id;
end;
$$;

grant execute on function public.save_purchase_draft(jsonb) to authenticated;
