-- RPC used by the frontend to fetch the current user's own permission set
-- without granting broad SELECT on roles/permissions/role_permissions.
create or replace function app.get_my_permissions()
returns table (permission_key text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.key
  from user_roles ur
  join role_permissions rp on rp.role_id = ur.role_id
  join permissions p on p.id = rp.permission_id
  where ur.profile_id = auth.uid();
$$;

create or replace function app.get_my_context()
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
  select
    p.id,
    p.full_name,
    p.email,
    app.is_all_restaurants_user(),
    coalesce(
      (select array_agg(ur.restaurant_id) from user_restaurants ur where ur.profile_id = p.id),
      '{}'
    ),
    coalesce(
      (select array_agg(r.key) from user_roles uro join roles r on r.id = uro.role_id where uro.profile_id = p.id),
      '{}'
    ),
    coalesce(
      (select array_agg(distinct perm.key)
       from user_roles uro
       join role_permissions rp on rp.role_id = uro.role_id
       join permissions perm on perm.id = rp.permission_id
       where uro.profile_id = p.id),
      '{}'
    )
  from profiles p
  where p.id = auth.uid();
$$;

alter table restaurants enable row level security;
alter table profiles enable row level security;
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table user_roles enable row level security;
alter table user_restaurants enable row level security;

-- restaurants: visible only if the profile has access to it; management
-- restricted to the restaurants.manage permission.
create policy restaurants_select on restaurants
  for select using (app.has_restaurant_access(id));
create policy restaurants_insert on restaurants
  for insert with check (app.has_permission('restaurants.manage'));
create policy restaurants_update on restaurants
  for update using (app.has_permission('restaurants.manage'))
  with check (app.has_permission('restaurants.manage'));
create policy restaurants_delete on restaurants
  for delete using (app.has_permission('restaurants.manage'));

-- profiles: a user always sees their own profile; user management sees all.
create policy profiles_select on profiles
  for select using (id = auth.uid() or app.has_permission('users.manage'));
create policy profiles_update_self on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on profiles
  for update using (app.has_permission('users.manage'))
  with check (app.has_permission('users.manage'));

-- roles/permissions/role_permissions: admin-only table access. Regular users
-- read their own effective permissions via app.get_my_permissions()/get_my_context().
create policy roles_select on roles
  for select using (app.has_permission('users.manage'));
create policy roles_write on roles
  for all using (app.has_permission('users.manage'))
  with check (app.has_permission('users.manage'));

create policy permissions_select on permissions
  for select using (app.has_permission('users.manage'));

create policy role_permissions_select on role_permissions
  for select using (app.has_permission('users.manage'));
create policy role_permissions_write on role_permissions
  for all using (app.has_permission('users.manage'))
  with check (app.has_permission('users.manage'));

-- user_roles / user_restaurants: a user can see their own assignments; admin
-- manages everyone's.
create policy user_roles_select on user_roles
  for select using (profile_id = auth.uid() or app.has_permission('users.manage'));
create policy user_roles_write on user_roles
  for all using (app.has_permission('users.manage'))
  with check (app.has_permission('users.manage'));

create policy user_restaurants_select on user_restaurants
  for select using (profile_id = auth.uid() or app.has_permission('users.manage'));
create policy user_restaurants_write on user_restaurants
  for all using (app.has_permission('users.manage'))
  with check (app.has_permission('users.manage'));
