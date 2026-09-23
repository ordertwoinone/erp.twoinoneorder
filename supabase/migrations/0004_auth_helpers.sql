-- Core RBAC/RLS helper functions. Every RLS policy in this project is built
-- from these four functions so branch isolation and permission checks stay
-- consistent across tables, reports, exports and storage access.

create or replace function app.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from profiles where id = auth.uid();
$$;

create or replace function app.is_all_restaurants_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.profile_id = auth.uid()
      and r.is_all_restaurants
  );
$$;

create or replace function app.has_restaurant_access(target_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    app.is_all_restaurants_user()
    or exists (
      select 1 from user_restaurants ur
      where ur.profile_id = auth.uid()
        and ur.restaurant_id = target_restaurant_id
    );
$$;

create or replace function app.has_permission(perm_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_roles ur
    join role_permissions rp on rp.role_id = ur.role_id
    join permissions p on p.id = rp.permission_id
    where ur.profile_id = auth.uid()
      and p.key = perm_key
  );
$$;

-- Auto-provision a profile row when a new auth user is created (e.g. via
-- Supabase Auth invite/signup). Role and restaurant assignment happen
-- afterward through the Users module, not here.
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();
