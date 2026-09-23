# Business Workflows — ERP.TWOINONEORDER

## 1. Manual purchase approval flow

```
Draft → Pending Approval → [Approved → Posted]
                          → Returned (back to Draft, with comment)
                          → Rejected
                                        Cancelled (from Draft/Pending only)
```

- Only **Posted** purchases affect stock, supplier balance, or accounting. A `Pending Approval` or `Returned` purchase is fully visible (for the approver and the branch that created it) but invisible to every financial calculation — P&L, supplier outstanding balance, stock cost.
- Approval/rejection/return each write a row to `approvals` (generic: `entity_type = 'purchase'`, `entity_id`, `action`, `comment`, `actor`) so the full back-and-forth is auditable, not just the final state.
- Posting a purchase is one `supabase.rpc('post_purchase', {...})` call — writes `purchases`/`purchase_items` status, `stock_movements`, updates `supplier` outstanding balance, writes `journal_entries`/`journal_lines`, writes `audit_logs`, all in one transaction.

## 2. AI invoice scanning → review → posting

```
Upload → ai_scan_jobs (queued) → processing → ai_scan_results + ai_extracted_items
                                                        |
                                              user reviews/edits extracted fields
                                                        |
                                    duplicate check + price-vs-lock comparison shown
                                                        |
                                     user confirms  →  creates a normal manual
                                                        purchase (status: pending_approval
                                                        or draft) from the reviewed data
```

- The AI never writes to `purchases` directly. It only ever produces a *proposal* (`ai_extracted_items`, with `confidence_score` per field) that a human turns into a real record through the exact same code path as a manually typed purchase. This is why AI-entered and manually-entered purchases go through identical approval/posting rules — there is no separate "AI purchase" object.
- Low-confidence fields are flagged in the UI (`confidence_score < threshold`) and block one-click confirm until the user touches that field.
- Duplicate detection compares (supplier, invoice_number, invoice_date, total) against existing `purchases` before allowing confirm; a match is a hard warning, not a block, since legitimate re-uploads happen (e.g. rescanning a blurry photo).

## 3. AI labour-list import → employee sync

```
Upload → labour_list_imports (queued) → labour_list_import_items
   (each item: matched_employee_id | new | changed | uncertain)
                                                        |
                                        user reviews proposed changes
                                                        |
                                confirm  →  creates/updates `employees` rows,
                                            writes `employee_assignments` history
```

- An employee missing from a newly uploaded list is **never** auto-deleted or auto-deactivated (spec §30). Absence just means that item has no match; it has no effect on the existing employee record unless a human acts on it.
- Matching uses reliable identifiers first (employee ID / passport / Emirates ID if present), falls back to fuzzy name+DOB match flagged `uncertain`, and never auto-merges an `uncertain` match.

## 4. Card machine settlement reconciliation

```
Machine assigned to Restaurant A (assignment period)
        |
Transactions recorded during that period → card_transactions.restaurant_id = A (frozen)
        |
Machine reassigned to Restaurant B  → does NOT touch existing card_transactions
        |
Bank credit arrives → card_settlements row links (machine, date range, bank_transaction)
        |
Settlement amount allocated back to the restaurant(s) whose transactions it covers
        |
Clears the receivable per restaurant; does NOT create a new sales_entries row
```

Overlapping or missing assignment periods are flagged by a constraint/check query (`docs/database-design.md` §2.7) rather than silently accepted, since an unassigned transaction has no restaurant to bill.

## 5. Delivery platform (Talabat) reconciliation

Same shape as §4: `delivery_sales` (gross, commission, adjustments) is what the restaurant is owed; `delivery_settlements` links an actual bank credit against it. The settlement clears the receivable balance — it is never summed into `sales_entries` a second time. Reports that show "total sales" join `sales_entries` + `delivery_sales` and must not also include the settlement amounts, or revenue would double-count.

## 6. Branch transfer

```
Restaurant A dispatches item → branch_transfers (status: dispatched)
        |
stock_movements: -qty at A (transfer_out), cost carried at A's cost
        |
Restaurant B confirms receipt → branch_transfers (status: received)
        |
stock_movements: +qty at B (transfer_in), same cost
```

- A transfer is *never* a purchase for B or a sale for A. Consolidated (group-level) reports explicitly exclude `stock_movements` of type `transfer_in`/`transfer_out` from purchase/sales totals — they exist only to move cost between branches, and must net to zero at group level by construction (every `transfer_out` has a matching `transfer_in` of equal value).

## 7. Profit & Loss calculation

```
Cost of Goods Consumed = Opening Stock + Purchases (posted only) − Returns
                          ± Transfers (net zero at group level) − Closing Stock

Gross Profit = Net Sales − Cost of Goods Consumed
Net Profit   = Gross Profit − Salaries − Manpower Costs − Operating Expenses
               − Card Fees − Delivery Commissions − Allocated HO Expenses
```

- If `closing_stock` for the period/restaurant is missing, the report is computed anyway but returned with `is_provisional = true` and rendered with a **PROVISIONAL P&L** banner (spec §33) — it is never silently presented as final.
- Supplier payments never appear as a second expense line — the expense is recognized once, at `posted` purchase time; a payment only reduces the supplier's outstanding balance (cash flow), which is a different report.

## 8. Period locking

- An `accounting_periods` row for a restaurant/month starts `open`. Posting functions check the transaction's date against the matching period before writing; a `locked` period rejects normal posts.
- Locked-period corrections go through a separate, permissioned "adjustment" RPC that writes a reversal + a new correcting entry (never edits the original), so the audit trail shows both what was originally posted and what corrected it.

## 9. Restaurant/branch data isolation — worked example

A Branch Manager at Restaurant 3 queries `purchases`. The query itself does not filter by restaurant client-side — RLS does it: `app.has_restaurant_access(restaurant_id)` evaluates `false` for any row where `restaurant_id != 3` (since that profile's `user_restaurants` only contains restaurant 3 and `is_all_restaurants_user()` is false for that role). The same profile hitting a report endpoint, an export, or a Storage signed-URL request for an attachment on a Restaurant 5 purchase gets the same `false` — one policy, enforced everywhere, instead of three separate access checks that could drift out of sync.
