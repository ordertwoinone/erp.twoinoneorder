-- Polymorphic attachment record backed by a Supabase Storage path. Sensitive
-- categories are never in a public bucket — see 0022_storage.sql.
create table attachments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id),
  entity_type text not null,
  entity_id uuid not null,
  category attachment_category not null,
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index attachments_entity_idx on attachments(entity_type, entity_id);
create index attachments_restaurant_idx on attachments(restaurant_id);

-- Generic approval-step log usable by purchases, transfers, price-lock
-- changes, payment vouchers, etc. (spec §22, §36).
create table approvals (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action approval_action not null,
  comment text,
  actor_id uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index approvals_entity_idx on approvals(entity_type, entity_id);

create table comments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  body text not null,
  author_id uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index comments_entity_idx on comments(entity_type, entity_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  status notification_status not null default 'unread',
  created_at timestamptz not null default now()
);
create index notifications_profile_idx on notifications(profile_id, status);

-- Append-only audit log. Never updated or deleted by application code.
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  module text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on audit_logs(entity_type, entity_id);
create index audit_logs_actor_idx on audit_logs(actor_id, created_at);
create index audit_logs_module_idx on audit_logs(module, created_at);

alter table attachments enable row level security;
alter table approvals enable row level security;
alter table comments enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;

create policy attachments_select on attachments for select
  using (restaurant_id is null or app.has_restaurant_access(restaurant_id));
create policy attachments_write on attachments for all
  using (restaurant_id is null or app.has_restaurant_access(restaurant_id))
  with check (restaurant_id is null or app.has_restaurant_access(restaurant_id));

create policy approvals_select on approvals for select using (auth.uid() is not null);
create policy approvals_insert on approvals for insert with check (actor_id = auth.uid());

create policy comments_select on comments for select using (auth.uid() is not null);
create policy comments_insert on comments for insert with check (author_id = auth.uid());

create policy notifications_select on notifications for select using (profile_id = auth.uid());
create policy notifications_update on notifications for update
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Audit logs: readable only by users with an explicit audit-viewing
-- permission; never writable directly by client code (posting functions,
-- running as SECURITY DEFINER, insert into it themselves).
create policy audit_logs_select on audit_logs for select using (app.has_permission('audit.view'));
