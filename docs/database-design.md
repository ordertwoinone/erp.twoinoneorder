# Database Design — ERP.TWOINONEORDER

This document explains the *shape and reasoning* of the schema. Exact columns, types, constraints and indexes are authoritative in `supabase/migrations/` — this file should never drift into a second source of truth for column lists; read the migration for that. What belongs here is *why the schema is shaped this way*.

## 1. Conventions used across every table

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` (kept current by a shared `set_updated_at()` trigger)
- `created_by uuid references profiles(id)` on tables where "who entered this" matters for audit/accountability
- Money: `numeric(14,2)`. Never `float`/`double precision` for anything financial.
- Every branch-scoped table has `restaurant_id uuid not null references restaurants(id)`, indexed.
- Status columns are Postgres `enum` types (not free-text) so invalid states are rejected by the database, not just the UI.
- Nothing financial is hard-deleted. Cancellation/reversal is a status + a linked reversal record, never a `DELETE`.

## 2. Entity groups

### 2.1 Organization & access control
`restaurants`, `profiles` (1:1 with `auth.users`), `roles`, `permissions`, `role_permissions`, `user_roles`, `user_restaurants`.

- A profile can hold one or more roles (`user_roles`), and each role carries a set of permissions (`role_permissions` → `permissions`). This is deliberately many-to-many at both levels so "custom permission for one user" (spec §8) is possible without new code — it's a data change (grant an extra role, or a role with exactly one permission).
- `user_restaurants` is the branch-isolation table: which restaurants a profile may access. Head Office / Accounts Manager profiles get an `is_all_restaurants` flag instead of enumerating all 8+ rows, so a new restaurant is visible to them automatically.
- See §5 for how this drives RLS.

### 2.2 Products
`categories`, `brands`, `units`, `products` (with pack size fields inline rather than a separate `pack_sizes` table — a product's pack size is an attribute of that product/supplier combination, not an independent entity with its own lifecycle).

### 2.3 Suppliers & price control
`suppliers`, `supplier_contacts`, `supplier_quotations` + `supplier_quotation_items`, `supplier_price_locks`, `supplier_price_history`.

- `supplier_price_locks` holds the *currently agreed* price per supplier/item/unit/restaurant-scope. It is never overwritten in place — an update closes the current row (`valid_to`) and inserts a new one, so `supplier_price_history` is really just "all rows of `supplier_price_locks` ever," queried by time range. This gives the price-increase/decrease comparison in spec §21 for free: compare an incoming invoice line's price against the row in `supplier_price_locks` valid at the invoice date.

### 2.4 Purchasing
`purchase_requests` + items → `purchase_orders` + items → `purchases` (the actual invoice/bill) + items → `goods_receipts` + items → `purchase_returns` + items, `supplier_credit_notes`.

- The chain mirrors the real-world workflow (spec §22): a request doesn't obligate spend, an order does, a purchase/invoice is what's owed, a goods receipt is what physically arrived (can be partial), a return/credit note reduces what's owed. Keeping these as separate tables (not collapsing purchase orders into purchases) is what makes partial delivery and quantity variance representable at all.
- Manual purchases carry `status` through `draft → pending_approval → returned/rejected → approved → posted → cancelled` (spec §19). Only `posted` purchases count toward accounting/P&L — every reporting query filters on that, never on "exists in the table."

### 2.5 Payments
`payment_vouchers` + items, `supplier_payments`, `payment_allocations`.

- `payment_allocations` is the join between a payment and the specific purchase invoice(s) it settles, supporting partial payment and advances (spec §28) without ambiguity about what's been paid.

### 2.6 Sales
`sales_entries` (one row per restaurant per shift/day) with `sales_payment_breakdowns` (cash/card/Talabat/other, spec §24) as child rows rather than fixed columns — so adding a new payment method later is a data change, not a migration.
`sales_channels`, `payment_methods` are lookup tables, restaurant-configurable.

### 2.7 Card machines & settlement
`card_machines`, `card_machine_assignments` (time-bounded restaurant assignment — spec §25), `card_transactions`, `card_settlements`.

- `card_transactions` stores the `restaurant_id` **at transaction time**, copied from the active assignment when the transaction is recorded — not derived live from `card_machines.current_restaurant`. This is what makes "reassigning the machine must never change historical transactions" (spec §25) true by construction rather than by convention.
- `card_settlements` links a bank credit to the collections it clears. Settling never creates a new sale (spec §26) — it only closes a receivable.

### 2.8 Delivery platforms
`delivery_platforms` (extensible list — Talabat is a row, not a hardcoded concept), `delivery_sales`, `delivery_settlements`. Same non-duplication rule as card settlements (spec §27).

### 2.9 Banking
`bank_accounts`, `cash_accounts`, `bank_transactions`, `bank_deposits`, `bank_reconciliations`.

### 2.10 Employees & payroll
`employees`, `employee_assignments` (restaurant history, spec §29), `employee_documents`, `labour_list_imports` + `labour_list_import_items` (staging table for AI-extracted labour lists — spec §30; nothing here is a live employee until a human confirms it).
`salary_entries`, `salary_payments`, `salary_components`, `employee_advances`, `employee_deductions`, `manpower_costs` (accommodation/transport/visa/etc., allocatable across restaurants for shared employees — spec §31).

### 2.11 Expenses
`expense_categories`, `operating_expenses`, `expense_allocations` (splits one expense across restaurants/head office — spec §32).

### 2.12 Inventory
`stock_movements` (append-only ledger: every purchase receipt, sale consumption, transfer, adjustment is one row), `stock_balances` (derived/maintained running balance per restaurant/product), `branch_transfers` + items, `opening_stock`, `closing_stock`.

- Modeling stock as an append-only movement ledger (rather than mutating a balance in place) is what makes the P&L formula in spec §33 auditable: cost of goods consumed is a query over movements in a period, not a number nobody can explain.

### 2.13 Accounting
`accounting_accounts` (chart of accounts), `journal_entries` + `journal_lines` (double-entry — every entry's lines must sum to zero, enforced by a trigger, not just application code), `accounting_periods` (open/locked, spec §35), `account_balances` (materialized per-period balances for fast P&L, refreshed by the posting functions rather than recomputed live).

### 2.14 AI
`ai_scan_jobs`, `ai_scan_results`, `ai_extracted_items`, `ai_confidence_scores`. Pure staging/review data — see `docs/business-workflows.md` §AI review flow for why these never write financial tables directly.

### 2.15 System
`attachments` (polymorphic: `entity_type` + `entity_id`, backed by Supabase Storage paths, never public URLs for sensitive categories), `approvals` (generic approval-step log usable by purchases, transfers, price-lock changes, etc.), `comments`, `notifications`, `audit_logs` (append-only, who/what/when/old→new for every sensitive action — spec §36).

## 3. Why purchase orders and purchases are not one table

Collapsing "what we ordered" and "what we were billed" into one row is the single most common modeling mistake in ERPs, because it makes partial delivery, price variance at invoice time, and multi-invoice orders unrepresentable without hacks. Keeping them separate costs one extra join and pays for itself the first time a supplier part-ships an order or invoices a different price than quoted.

## 4. Why price locks are append-only

`supplier_price_locks` is never `UPDATE`d in place for the agreed price itself — a price change closes the row and inserts a new one. This is what spec §21 ("maintain complete audit history," "only authorized users can modify locked prices") requires, and it's also what makes "compare this invoice's price to what was agreed *at the time*" a correct query instead of a guess.

## 5. RLS strategy

Three SQL helper functions (defined in `0004_auth_helpers.sql`) are the building blocks for every policy:

- `app.current_profile_id()` — the `profiles.id` for `auth.uid()`.
- `app.is_all_restaurants_user()` — true for profiles flagged Head Office / Accounts Manager (or holding a permission that implies all-restaurant access).
- `app.has_restaurant_access(restaurant_id uuid)` — true if `is_all_restaurants_user()` or the profile has a matching row in `user_restaurants`.
- `app.has_permission(perm_key text)` — true if any of the profile's roles grant that permission key.

Every branch-scoped table's RLS policy is, at minimum:

```sql
using (app.has_restaurant_access(restaurant_id))
```

with `with check` mirroring it for writes, and additional `has_permission(...)` checks layered on for sensitive columns/tables (salaries, bank details, price locks, approvals, user management). Tables are never left with a permissive `using (true)` policy — see §42 of the spec.

Storage: private buckets only for sensitive categories (invoices, salary documents, employee documents, bank receipts). Access goes through signed URLs issued by a check that re-runs the same `has_restaurant_access`/`has_permission` logic before minting the URL — never a public bucket for these categories.

## 6. Indexing strategy

Composite/foreign-key indexes are added where the access pattern is known up front: `restaurant_id` on every branch-scoped table, `(restaurant_id, status)` on workflow tables (purchases, purchase_requests, salary_entries), `(supplier_id, item reference)` on price/quotation tables, and date-range indexes on transaction tables used in reports. Indexes are added in the same migration as the table they belong to; new indexes driven by real query patterns are added in later migrations rather than speculatively.

## 7. Accounting period locking

`accounting_periods` rows move `open → locked`. Every posting function checks the transaction date against the relevant period and refuses to post (or requires an explicit, permissioned "adjustment" path with its own audit trail) if the period is locked — see spec §35 and §36.
