-- Research schema for Cardiac Digital Twin prototype
-- Apply in Supabase SQL editor or via CLI. RLS denies anon access by default.

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  institution text,
  created_at timestamptz default now()
);

create table if not exists research_records (
  id uuid primary key default gen_random_uuid(),
  source_dataset text,
  record_name text not null,
  sampling_rate double precision,
  duration_seconds double precision,
  lead_count int,
  format text,
  has_annotations boolean default false,
  privacy_status text default 'deidentified',
  created_at timestamptz default now()
);

create table if not exists record_annotations (
  id uuid primary key default gen_random_uuid(),
  record_id uuid references research_records(id) on delete cascade,
  event_type text not null,
  start_time double precision not null,
  end_time double precision,
  annotation_source text
);

create table if not exists processing_runs (
  id uuid primary key default gen_random_uuid(),
  record_id uuid references research_records(id) on delete cascade,
  execution_mode text,
  software_version text,
  processing_parameters jsonb,
  status text,
  created_at timestamptz default now(),
  latency_ms double precision
);

create table if not exists features (
  id uuid primary key default gen_random_uuid(),
  record_id uuid references research_records(id) on delete cascade,
  timestamp double precision,
  feature_vector jsonb,
  feature_schema text
);

create table if not exists patient_baselines (
  id uuid primary key default gen_random_uuid(),
  record_id uuid references research_records(id) on delete cascade,
  patient_group_identifier text,
  baseline_window jsonb,
  baseline_statistics jsonb,
  created_at timestamptz default now()
);

create table if not exists digital_twin_states (
  id uuid primary key default gen_random_uuid(),
  record_id uuid references research_records(id) on delete cascade,
  timestamp double precision,
  state_vector jsonb,
  deviation_score double precision
);

create table if not exists model_runs (
  id uuid primary key default gen_random_uuid(),
  model_name text,
  model_version text,
  dataset_version text,
  observation_window double precision,
  forecast_horizon double precision,
  training_config jsonb,
  metrics jsonb,
  created_at timestamptz default now()
);

create table if not exists forecast_results (
  id uuid primary key default gen_random_uuid(),
  record_id uuid references research_records(id) on delete cascade,
  timestamp double precision,
  target_event text,
  forecast_horizon double precision,
  model_score double precision,
  prediction text,
  ground_truth int,
  lead_time_seconds double precision
);

create table if not exists evaluation_results (
  id uuid primary key default gen_random_uuid(),
  model_id uuid references model_runs(id) on delete cascade,
  metrics jsonb,
  created_at timestamptz default now()
);

create table if not exists hardware_runs (
  id uuid primary key default gen_random_uuid(),
  record_id uuid,
  hardware_mode text,
  board_name text,
  accelerator_name text,
  latency_ms double precision,
  throughput double precision,
  resource_utilization jsonb,
  created_at timestamptz default now()
);

alter table projects enable row level security;
alter table research_records enable row level security;
alter table record_annotations enable row level security;
alter table processing_runs enable row level security;
alter table features enable row level security;
alter table patient_baselines enable row level security;
alter table digital_twin_states enable row level security;
alter table model_runs enable row level security;
alter table forecast_results enable row level security;
alter table evaluation_results enable row level security;
alter table hardware_runs enable row level security;

-- Authenticated researchers may read; writes via service role from the backend.
create policy "research_read_records" on research_records for select to authenticated using (true);
create policy "research_read_annotations" on record_annotations for select to authenticated using (true);
create policy "research_read_models" on model_runs for select to authenticated using (true);
create policy "research_read_eval" on evaluation_results for select to authenticated using (true);
