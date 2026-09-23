-- Structural reference data required in every environment (roles,
-- permissions, base lookups). Demo/sample business data (restaurants,
-- sample users, suppliers, products) lives in supabase/seed.sql instead —
-- see spec §49/§51.

insert into permissions (key, name, category) values
  ('restaurants.manage', 'Manage restaurants', 'organization'),
  ('users.manage', 'Manage users & roles', 'organization'),
  ('catalog.manage', 'Manage product catalog', 'purchasing'),
  ('suppliers.manage', 'Manage suppliers', 'suppliers'),
  ('suppliers.view_bank_details', 'View supplier bank information', 'suppliers'),
  ('supplier_prices.manage', 'Manage locked/agreed supplier prices', 'suppliers'),
  ('purchases.create', 'Create purchases & purchase requests', 'purchasing'),
  ('purchases.approve', 'Approve/reject/return purchases', 'purchasing'),
  ('purchases.post', 'Post approved purchases', 'purchasing'),
  ('purchase_orders.manage', 'Manage purchase orders', 'purchasing'),
  ('payments.create', 'Create payment vouchers', 'payments'),
  ('payments.approve', 'Approve payment vouchers', 'payments'),
  ('payments.post', 'Post supplier payments', 'payments'),
  ('sales.create', 'Enter daily sales', 'sales'),
  ('sales.review', 'Review/reconcile sales entries', 'sales'),
  ('card_machines.manage', 'Manage card machines & assignments', 'settlements'),
  ('settlements.view', 'View card/delivery settlements', 'settlements'),
  ('settlements.manage', 'Reconcile card/delivery settlements', 'settlements'),
  ('banking.view', 'View bank account information', 'banking'),
  ('banking.manage', 'Manage bank accounts & transactions', 'banking'),
  ('employees.view', 'View employee records', 'employees'),
  ('employees.manage', 'Manage employee records', 'employees'),
  ('payroll.view', 'View salaries', 'payroll'),
  ('payroll.manage', 'Manage salary entries & payments', 'payroll'),
  ('expenses.manage', 'Manage operating expenses', 'expenses'),
  ('inventory.manage', 'Manage stock & branch transfers', 'inventory'),
  ('accounting.view', 'View accounting ledger', 'accounting'),
  ('accounting.manage', 'Post/reverse journal entries, lock periods', 'accounting'),
  ('pnl.view', 'View P&L reports', 'reports'),
  ('reports.view', 'View reports', 'reports'),
  ('reports.export', 'Export reports (Excel/PDF)', 'reports'),
  ('audit.view', 'View audit trail', 'system'),
  ('attachments.delete', 'Delete uploaded attachments', 'system')
on conflict (key) do nothing;

insert into roles (key, name, description, is_all_restaurants, is_system_role) values
  ('owner_admin', 'Owner / Admin', 'Full system access across all restaurants.', true, true),
  ('accounts_manager', 'Accounts Manager', 'Head-office financial oversight across all restaurants.', true, true),
  ('accountant', 'Accountant', 'Branch/group accounting and payment posting.', false, true),
  ('branch_manager', 'Branch Manager', 'Single-restaurant operational management.', false, true),
  ('data_entry_staff', 'Data Entry Staff', 'Restricted data entry for a single restaurant.', false, true)
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p where r.key = 'owner_admin'
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on p.key = any(array[
  'catalog.manage','suppliers.manage','suppliers.view_bank_details','supplier_prices.manage',
  'purchases.create','purchases.approve','purchases.post','purchase_orders.manage',
  'payments.create','payments.approve','payments.post',
  'sales.review','card_machines.manage','settlements.view','settlements.manage',
  'banking.view','banking.manage','employees.view','employees.manage',
  'payroll.view','payroll.manage','expenses.manage','inventory.manage',
  'accounting.view','accounting.manage','pnl.view','reports.view','reports.export',
  'audit.view','attachments.delete'
])
where r.key = 'accounts_manager'
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on p.key = any(array[
  'purchases.create','purchases.post','payments.create','payments.post',
  'sales.review','banking.view','banking.manage','expenses.manage','inventory.manage',
  'accounting.view','accounting.manage','payroll.view','payroll.manage',
  'suppliers.manage','reports.view','reports.export','pnl.view'
])
where r.key = 'accountant'
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on p.key = any(array[
  'purchases.create','sales.create','expenses.manage','employees.view',
  'reports.view','inventory.manage'
])
where r.key = 'branch_manager'
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on p.key = any(array[
  'purchases.create','sales.create'
])
where r.key = 'data_entry_staff'
on conflict do nothing;

-- Base lookups.
insert into units (code, name) values
  ('pc', 'Piece'), ('kg', 'Kilogram'), ('g', 'Gram'), ('l', 'Litre'), ('ml', 'Millilitre'),
  ('box', 'Box'), ('ctn', 'Carton'), ('pack', 'Pack'), ('btl', 'Bottle')
on conflict (code) do nothing;

insert into sales_channels (code, name) values
  ('dine_in', 'Dine In'), ('takeaway', 'Takeaway'), ('delivery', 'Delivery')
on conflict (code) do nothing;

insert into payment_methods (code, name) values
  ('cash', 'Cash'), ('card', 'Card'), ('talabat', 'Talabat'), ('other', 'Other')
on conflict (code) do nothing;

insert into delivery_platforms (code, name, integration_status) values
  ('talabat', 'Talabat', 'pending_configuration')
on conflict (code) do nothing;

insert into expense_categories (name, is_head_office_only) values
  ('Rent', false), ('Utilities', false), ('Maintenance', false), ('Cleaning', false),
  ('Packaging', false), ('Delivery Costs', false), ('Licences', false), ('Software', true),
  ('Marketing', true), ('Other', false)
on conflict (name) do nothing;

insert into accounting_accounts (code, name, account_type) values
  ('1000', 'Cash & Bank', 'asset'),
  ('1100', 'Accounts Receivable', 'asset'),
  ('1200', 'Inventory', 'asset'),
  ('2000', 'Accounts Payable', 'liability'),
  ('3000', 'Owner Equity', 'equity'),
  ('4000', 'Sales Revenue', 'income'),
  ('5000', 'Cost of Goods Sold', 'expense'),
  ('5100', 'Salaries & Manpower', 'expense'),
  ('5200', 'Operating Expenses', 'expense'),
  ('5300', 'Card & Delivery Fees', 'expense')
on conflict (code) do nothing;
