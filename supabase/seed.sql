-- =============================================================================
-- DEV / DEMO SEED DATA — DO NOT RUN AGAINST A PRODUCTION PROJECT.
--
-- This seeds sample restaurants, suppliers, products, employees, card
-- machines and bank accounts so the app is usable in local development.
-- It intentionally does NOT create auth users: create real users via
-- Supabase Auth (dashboard invite, or the app's sign-up if enabled), then
-- assign each one a role and restaurant access — see docs/README §Seed data
-- for the exact SQL to run afterward.
-- =============================================================================

insert into restaurants (code, name, city, emirate, is_head_office, is_active) values
  ('HO', 'Head Office', 'Dubai', 'Dubai', true, true),
  ('R01', 'Two In One — Deira', 'Dubai', 'Dubai', false, true),
  ('R02', 'Two In One — Marina', 'Dubai', 'Dubai', false, true),
  ('R03', 'Two In One — Al Barsha', 'Dubai', 'Dubai', false, true),
  ('R04', 'Two In One — Sharjah', 'Sharjah', 'Sharjah', false, true),
  ('R05', 'Two In One — Ajman', 'Ajman', 'Ajman', false, true),
  ('R06', 'Two In One — Abu Dhabi', 'Abu Dhabi', 'Abu Dhabi', false, true),
  ('R07', 'Two In One — Al Ain', 'Al Ain', 'Abu Dhabi', false, true),
  ('R08', 'Two In One — Fujairah', 'Fujairah', 'Fujairah', false, true)
on conflict (code) do nothing;

insert into suppliers (code, name, payment_terms_days) values
  ('SUP001', 'Al Falah Foodstuff Trading LLC', 30),
  ('SUP002', 'Gulf Fresh Produce Co.', 15),
  ('SUP003', 'Emirates Meat & Poultry', 30),
  ('SUP004', 'National Packaging Supplies', 45)
on conflict (code) do nothing;

insert into categories (name) values
  ('Meat & Poultry'), ('Produce'), ('Dairy'), ('Dry Goods'), ('Packaging'), ('Beverages')
on conflict do nothing;

insert into brands (name) values ('Generic'), ('Al Ain'), ('Almarai') on conflict do nothing;

insert into products (sku, name, category_id, brand_id, base_unit_id)
select
  v.sku, v.name,
  (select id from categories where name = v.category_name),
  (select id from brands where name = 'Generic'),
  (select id from units where code = v.unit_code)
from (values
  ('PRD001', 'Chicken Breast', 'Meat & Poultry', 'kg'),
  ('PRD002', 'Beef Mince', 'Meat & Poultry', 'kg'),
  ('PRD003', 'Tomatoes', 'Produce', 'kg'),
  ('PRD004', 'Lettuce', 'Produce', 'kg'),
  ('PRD005', 'Mozzarella Cheese', 'Dairy', 'kg'),
  ('PRD006', 'Burger Buns', 'Dry Goods', 'pc'),
  ('PRD007', 'Takeaway Boxes', 'Packaging', 'pc'),
  ('PRD008', 'Cooking Oil', 'Dry Goods', 'l')
) as v(sku, name, category_name, unit_code)
on conflict (sku) do nothing;

insert into employees (employee_code, full_name, job_title, joining_date, employment_status, current_restaurant_id)
select
  v.employee_code, v.full_name, v.job_title, v.joining_date, 'active',
  (select id from restaurants where code = v.restaurant_code)
from (values
  ('EMP001', 'Ahmed Hassan', 'Branch Manager', date '2023-01-15', 'R01'),
  ('EMP002', 'Fatima Al Suwaidi', 'Head Chef', date '2023-02-01', 'R01'),
  ('EMP003', 'Mohammed Iqbal', 'Cashier', date '2023-03-10', 'R02'),
  ('EMP004', 'Priya Nair', 'Accountant', date '2022-11-01', 'HO')
) as v(employee_code, full_name, job_title, joining_date, restaurant_code)
on conflict (employee_code) do nothing;

insert into bank_accounts (restaurant_id, bank_name, account_name, account_number, currency)
select (select id from restaurants where code = 'HO'), 'Emirates NBD', 'Two In One Order Group', '1015123456789', 'AED'
where not exists (select 1 from bank_accounts where account_number = '1015123456789');

insert into card_machines (machine_name, terminal_id, provider, linked_bank_account_id, status)
select 'Machine ' || gs, 'TID' || lpad(gs::text, 5, '0'), 'Network International',
  (select id from bank_accounts limit 1), 'active'
from generate_series(1, 13) as gs
on conflict (terminal_id) do nothing;
