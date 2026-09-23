-- app.get_my_context() / app.get_my_permissions() (0005_organization_rls.sql)
-- live in the `app` schema, which is never exposed via the Supabase API
-- (only `public` is, by default) — so the frontend's supabase.rpc() calls
-- to them 404 silently and the app falls back to "no permissions". Expose
-- thin public-schema wrappers instead of re-exposing all of `app`.

create or replace function public.get_my_context()
returns table (
  profile_id uuid,
  full_name text,
  email text,
  is_all_restaurants boolean,
  restaurant_ids uuid[],
  role_keys text[],
  permission_keys text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select * from app.get_my_context();
$$;

create or replace function public.get_my_permissions()
returns table (permission_key text)
language sql
stable
security definer
set search_path = public
as $$
  select * from app.get_my_permissions();
$$;

grant execute on function public.get_my_context() to authenticated;
grant execute on function public.get_my_permissions() to authenticated;
