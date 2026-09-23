-- Pure staging/review data. AI never writes financial tables directly — see
-- docs/business-workflows.md §AI review flow.
create table ai_scan_jobs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  job_type text not null check (job_type in ('invoice', 'labour_list', 'sales_document')),
  status ai_scan_status not null default 'queued',
  attachment_id uuid,
  error_message text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on ai_scan_jobs
  for each row execute function app.set_updated_at();
create index ai_scan_jobs_restaurant_idx on ai_scan_jobs(restaurant_id, status);

create table ai_scan_results (
  id uuid primary key default gen_random_uuid(),
  ai_scan_job_id uuid not null references ai_scan_jobs(id) on delete cascade,
  raw_response jsonb not null default '{}'::jsonb,
  review_status ai_review_status not null default 'pending_review',
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  resulting_entity_type text check (resulting_entity_type in ('purchase', 'employee', 'sales_entry')),
  resulting_entity_id uuid,
  created_at timestamptz not null default now()
);
create index ai_scan_results_job_idx on ai_scan_results(ai_scan_job_id);

create table ai_extracted_items (
  id uuid primary key default gen_random_uuid(),
  ai_scan_result_id uuid not null references ai_scan_results(id) on delete cascade,
  field_name text not null,
  extracted_value text,
  is_uncertain boolean not null default false,
  created_at timestamptz not null default now()
);
create index ai_extracted_items_result_idx on ai_extracted_items(ai_scan_result_id);

create table ai_confidence_scores (
  id uuid primary key default gen_random_uuid(),
  ai_scan_result_id uuid not null references ai_scan_results(id) on delete cascade,
  field_name text not null,
  confidence numeric(5,2) not null check (confidence >= 0 and confidence <= 100)
);
create index ai_confidence_scores_result_idx on ai_confidence_scores(ai_scan_result_id);

alter table ai_scan_jobs enable row level security;
alter table ai_scan_results enable row level security;
alter table ai_extracted_items enable row level security;
alter table ai_confidence_scores enable row level security;

create policy ai_scan_jobs_select on ai_scan_jobs for select
  using (app.has_restaurant_access(restaurant_id));
create policy ai_scan_jobs_write on ai_scan_jobs for all
  using (app.has_restaurant_access(restaurant_id) and app.has_permission('purchases.create'))
  with check (app.has_restaurant_access(restaurant_id) and app.has_permission('purchases.create'));

create policy ai_scan_results_select on ai_scan_results for select
  using (exists (select 1 from ai_scan_jobs j where j.id = ai_scan_job_id and app.has_restaurant_access(j.restaurant_id)));
create policy ai_scan_results_write on ai_scan_results for all
  using (exists (select 1 from ai_scan_jobs j where j.id = ai_scan_job_id and app.has_restaurant_access(j.restaurant_id) and app.has_permission('purchases.create')))
  with check (exists (select 1 from ai_scan_jobs j where j.id = ai_scan_job_id and app.has_restaurant_access(j.restaurant_id) and app.has_permission('purchases.create')));

create policy ai_extracted_items_select on ai_extracted_items for select
  using (exists (select 1 from ai_scan_results r join ai_scan_jobs j on j.id = r.ai_scan_job_id where r.id = ai_scan_result_id and app.has_restaurant_access(j.restaurant_id)));
create policy ai_extracted_items_write on ai_extracted_items for all
  using (exists (select 1 from ai_scan_results r join ai_scan_jobs j on j.id = r.ai_scan_job_id where r.id = ai_scan_result_id and app.has_restaurant_access(j.restaurant_id) and app.has_permission('purchases.create')))
  with check (exists (select 1 from ai_scan_results r join ai_scan_jobs j on j.id = r.ai_scan_job_id where r.id = ai_scan_result_id and app.has_restaurant_access(j.restaurant_id) and app.has_permission('purchases.create')));

create policy ai_confidence_scores_select on ai_confidence_scores for select
  using (exists (select 1 from ai_scan_results r join ai_scan_jobs j on j.id = r.ai_scan_job_id where r.id = ai_scan_result_id and app.has_restaurant_access(j.restaurant_id)));
create policy ai_confidence_scores_write on ai_confidence_scores for all
  using (exists (select 1 from ai_scan_results r join ai_scan_jobs j on j.id = r.ai_scan_job_id where r.id = ai_scan_result_id and app.has_restaurant_access(j.restaurant_id) and app.has_permission('purchases.create')))
  with check (exists (select 1 from ai_scan_results r join ai_scan_jobs j on j.id = r.ai_scan_job_id where r.id = ai_scan_result_id and app.has_restaurant_access(j.restaurant_id) and app.has_permission('purchases.create')));
