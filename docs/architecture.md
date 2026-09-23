# Architecture — ERP.TWOINONEORDER

## 1. System overview

```
                    ERP.TWOINONEORDER
                           |
                    React + Vite + TS
                           |
             +-------------+-------------+
             |                           |
          Supabase                    Vercel
             |                           |
      +------+--------+            Static hosting
      |      |         |           + serverless functions
 PostgreSQL Auth    Storage
      |
   RLS + SQL functions
      |
      v
 ERP financial data (source of truth)
```

- **Frontend**: React 19 + Vite + TypeScript SPA. No Next.js, no server-rendered pages. Client-side routing via React Router.
- **Backend**: Supabase (PostgreSQL 17, Auth, Storage). No ORM — raw SQL in versioned migrations, Postgres functions/RPC for anything that must be atomic or authoritative (financial posting, settlement reconciliation).
- **Serverless**: Vercel functions handle work the browser must never do directly — calling the AI provider with a secret key, and any operation that requires the Supabase **service role** key (which bypasses RLS). Functions are stateless and short-lived; nothing assumes a long-running process.
- **Authorization boundary**: RLS policies in PostgreSQL, not frontend checks. The frontend hides UI a user can't use; the database refuses to return or mutate rows a user isn't allowed to touch, independent of what the frontend does.

## 2. Why this stack, and the constraints that follow

- **No ORM** — accounting logic (postings, allocations, reversals) lives in explicit, auditable SQL/PL-pgSQL, not behind a query builder that can silently change generated SQL. Every financial write path is a `supabase.rpc()` call into a Postgres function that runs inside a transaction.
- **RLS as the real authorization layer** — branch isolation (section 9 of the spec) and role-based field visibility (salaries, bank details, P&L) are enforced at the row level. A compromised or buggy frontend cannot leak another restaurant's data because the query itself is scoped by `auth.uid()` inside Postgres, not by a `WHERE restaurant_id = ?` the client controls.
- **Vercel serverless, not a persistent server** — every server-side handler is written to be stateless and idempotent where it touches money (payment posting, settlement matching), because serverless invocations can be retried.

## 3. Repository layout

```
erp.twoinoneorder/
├── src/
│   ├── app/              App-level composition: providers, root layout
│   ├── components/
│   │   ├── ui/            shadcn/ui primitives (generated, low-level)
│   │   ├── layout/         Sidebar, header, breadcrumbs, restaurant switcher
│   │   ├── forms/           Reusable form building blocks (RHF + Zod)
│   │   ├── tables/           TanStack Table wrappers (server-side paging/sort/filter)
│   │   ├── charts/            Recharts wrappers
│   │   └── shared/              Status badges, empty states, confirm dialogs, etc.
│   ├── modules/             One folder per business domain (dashboard, purchases,
│   │                        suppliers, sales, payments, settlements, employees,
│   │                        payroll, expenses, inventory, accounting, reports,
│   │                        restaurants, users, settings, auth). Each module owns
│   │                        its pages, module-specific components, hooks and
│   │                        service functions — no cross-module reach-ins except
│   │                        through published hooks/types.
│   ├── hooks/                Cross-cutting hooks (useSession, useRestaurantScope…)
│   ├── lib/
│   │   ├── supabase/          Supabase client + typed RPC wrappers
│   │   ├── auth/                Session/auth context
│   │   ├── permissions/          RBAC helpers (client-side UI gating only)
│   │   └── utils/                  Formatting, currency, date helpers
│   ├── routes/                Route tree + route guards
│   ├── types/                  Generated Supabase types + shared domain types
│   ├── schemas/                 Zod schemas (client + shape mirrors server checks)
│   └── main.tsx
├── api/                    Vercel serverless functions (AI scan, service-role ops)
├── supabase/
│   ├── migrations/          Every schema change, in order, checked into git
│   ├── functions/            Supabase Edge Functions (if used instead of /api)
│   └── seed.sql               Dev/demo seed data only — never run in production
└── docs/                    This documentation
```

## 4. Module boundary rule

A module (`src/modules/<name>`) may:
- Import shared code from `components/`, `hooks/`, `lib/`, `types/`, `schemas/`.
- Import its own files.

A module may **not** reach into another module's internals (`modules/sales/xyz` importing from `modules/purchases/internal-thing`). Cross-module data needs go through a typed hook or a shared type in `types/`.

## 5. Data flow for a financial write (example: posting a supplier payment)

1. UI collects input via React Hook Form, validated client-side with the same Zod schema used to shape the RPC payload.
2. `supabase.rpc('post_supplier_payment', {...})` is called — never a raw multi-table `insert`/`update` sequence from the client.
3. The Postgres function runs in one transaction: writes `payment_vouchers`, updates `supplier` balance, writes `payment_allocations`, writes the bank/cash transaction, writes `journal_entries`/`journal_lines`, writes `audit_logs`. Either all of it commits or none of it does.
4. RLS on every table touched re-checks the caller's role/restaurant access independent of what the RPC's `SECURITY DEFINER` context assumes — the function itself validates `auth.uid()`'s permissions before writing.
5. TanStack Query invalidates the relevant query keys; the UI reflects the new state.

## 6. Branch (restaurant) isolation

Every branch-scoped table carries `restaurant_id`. RLS policies join through `user_restaurants` (which restaurants a profile can access) and `user_roles` (whether the profile is head-office/Accounts Manager, which grants all-restaurant read access). This is enforced identically whether the request comes from a table query, a report, an export, or a storage file read — see `docs/database-design.md` §RLS strategy.

## 7. AI integration boundary

AI (invoice OCR, labour-list extraction) never writes directly to financial tables. It writes to `ai_scan_jobs` / `ai_scan_results` / `ai_extracted_items` with a confidence score and `review_status = 'pending_review'`. A human converts a reviewed AI result into a real purchase/employee record through the normal, validated write path. See `docs/business-workflows.md` §AI review flow.

## 8. Environments

- **Local dev**: Vite dev server (`npm run dev`) against either a local Supabase stack (`supabase start`) or the hosted dev project, controlled by `.env.local`.
- **Production**: Vercel static build + serverless functions, hosted Supabase project. Environment variables are set in the Vercel dashboard, never committed.
