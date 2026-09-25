# ERP.TWOINONEORDER

Production-grade restaurant ERP for a multi-branch restaurant group (8 restaurants + head office). See `docs/architecture.md`, `docs/database-design.md` and `docs/business-workflows.md` for the full design.

**Status**: Foundation phase complete — project scaffold, full database schema (migrations), RLS, RBAC, authentication, and the application shell (sidebar/header/routing/dashboard) are built. Business modules (purchasing, sales, settlements, payroll, accounting, reports, AI scanning) are scaffolded as routes and come online module-by-module next — see the phase list in the original spec (§53).

## 1. Stack

React 19 + Vite + TypeScript · Tailwind CSS v4 + shadcn/ui · TanStack Query/Table · React Hook Form + Zod · Supabase (PostgreSQL, Auth, Storage) · Vercel (hosting + serverless functions). No ORM, no Next.js — see `docs/architecture.md` §2 for why.

## 2. Local setup

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values below
npm run dev
```

The app runs at `http://localhost:5173`.

## 3. Supabase setup

### 3.1 Environment variables

Fill `.env.local` (never committed — see `.gitignore`):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key, from Project Settings → API>
SUPABASE_SERVICE_ROLE_KEY=<service role key — server-side only, never VITE_-prefixed>
GEMINI_API_KEY=<Google Gemini key for the AI invoice/quotation/labour-list scanners>
```

The anon key is safe in the browser bundle — it only grants what RLS allows. The service-role key bypasses RLS entirely and must only ever be used from Vercel serverless functions (`/api`), never from `src/`.

### 3.2 Database migrations

All schema is in `supabase/migrations/`, numbered and applied in order. Apply them with the Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Or paste each file's contents into the Supabase Dashboard's SQL Editor, in numeric order (`0001_...` through `0023_...`), if you'd rather not install the CLI. Every schema change from here on must be a new numbered migration file — never a manual, undocumented change against the live database (spec §51).

**What the migrations set up**: extensions, all enum types, the full table set for every module (organization/RBAC, products, suppliers, purchasing, payments, sales, card machines, delivery platforms, banking, employees, payroll, expenses, inventory, accounting, AI staging, system/audit), Row Level Security policies on every table, private Storage buckets with path-based RLS, and reference data (the 5 roles, the full permission catalog, base lookups like units/sales channels/payment methods, a starter chart of accounts).

### 3.3 Creating your first real users

Migrations seed **roles and permissions**, but not user accounts — real accounts must go through Supabase Auth, never a SQL insert into `auth.users` (spec §7). After a person signs up or is invited (Supabase Dashboard → Authentication → Add User, or your own invite flow once built):

```sql
-- 1. Find their profile (auto-created by the on_auth_user_created trigger)
select id, email from profiles where email = 'someone@example.com';

-- 2. Grant a role
insert into user_roles (profile_id, role_id)
select '<profile-id>', id from roles where key = 'branch_manager';

-- 3. Grant restaurant access (skip this for accounts_manager/owner_admin —
--    their role already has is_all_restaurants = true)
insert into user_restaurants (profile_id, restaurant_id)
select '<profile-id>', id from restaurants where code = 'R01';
```

Role keys: `owner_admin`, `accounts_manager`, `accountant`, `branch_manager`, `data_entry_staff` (see `supabase/migrations/0023_reference_data.sql`).

### 3.4 Seed / demo data

`supabase/seed.sql` has sample restaurants, suppliers, products, employees, bank accounts and the 13 card machines — **local/dev only, never run against production** (spec §49). Apply it manually via the SQL Editor, or:

```bash
npx supabase db reset   # local Supabase stack only — re-applies migrations + seed.sql
```

## 4. Authentication & RBAC

- Supabase Auth handles sign-in, session persistence, password reset. See `src/lib/auth/AuthContext.tsx`.
- On every sign-in, the frontend calls the `get_my_context()` Postgres function (SECURITY DEFINER) to get the user's profile, roles, permissions, and accessible restaurant IDs — see `src/hooks/useAuth.ts`.
- The frontend uses this only to **show/hide UI** (`hasPermission()`, the nav config in `src/components/layout/nav-config.ts`). The real authorization boundary is **Row Level Security**, enforced in PostgreSQL regardless of what the frontend does — see `docs/database-design.md` §5.
- Restaurant switching (`src/hooks/useRestaurantScope.ts`) is also a UI convenience; every query is re-checked against `user_restaurants`/`is_all_restaurants` server-side.

## 5. Row Level Security

Every table has RLS enabled with explicit policies — there is no table left with a permissive `using (true)`. Four SQL helper functions in `0004_auth_helpers.sql` are the building blocks every policy is written from: `app.current_profile_id()`, `app.is_all_restaurants_user()`, `app.has_restaurant_access(restaurant_id)`, `app.has_permission(key)`. Read `docs/database-design.md` §5 before adding a new table — reuse these, don't invent a parallel access-control mechanism.

## 6. Storage

Every document bucket (`invoices`, `purchase-documents`, `employee-documents`, `salary-documents`, etc.) is **private**. Object paths follow `<restaurant_id>/<entity_type>/<entity_id>/<filename>` so `storage.objects` RLS can reuse `has_restaurant_access()` by parsing the restaurant id out of the path — see `0022_storage.sql`. Fetch files via signed URLs, never public URLs.

## 7. AI configuration

Invoice, quotation and labour-list scanning run in Vercel serverless functions (`api/scan-*.ts`, never from the browser) that call Google Gemini using `GEMINI_API_KEY` (model override: `GEMINI_MODEL`, default `gemini-2.5-flash`). Results land in staging tables for human review before anything becomes a real record.

## 8. Development commands

```bash
npm run dev       # start Vite dev server
npm run build      # tsc -b && vite build
npm run lint         # oxlint
npm run preview        # preview the production build locally
```

## 9. Production deployment (Vercel)

1. Import the repo into Vercel.
2. Set environment variables in the Vercel project settings — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` for the client build; `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` as **server-only** variables (not exposed to the client bundle — do not prefix with `VITE_`).
3. Build command: `npm run build`. Output directory: `dist`.
4. Apply any pending migrations to the production Supabase project *before* deploying code that depends on them.
5. Server-side logic (AI calls, service-role operations) belongs in `/api` as Vercel serverless functions — stateless, no assumption of a persistent process.

## 10. Troubleshooting

- **"Missing Supabase environment variables"** — copy `.env.example` to `.env.local` and fill in the values; restart `npm run dev` (Vite only reads env files at startup).
- **Signed in but see no data anywhere** — the profile likely has no `user_roles`/`user_restaurants` rows yet; see §3.3. Everything is deny-by-default.
- **A new table's rows never show up** — check RLS is enabled and a `select` policy exists; an RLS-enabled table with zero policies returns zero rows to everyone except the service role.
- **TypeScript errors on Supabase queries after adding a table** — `src/types/database.ts` is hand-maintained for the tables the app currently uses; regenerate it (see the comment at the top of that file) once the Supabase CLI is linked to your project.
