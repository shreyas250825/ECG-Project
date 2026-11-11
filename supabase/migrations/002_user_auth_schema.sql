-- ============================================================
-- Migration 002: User-scoped auth schema
-- Apply via: Supabase SQL editor, supabase db push, or psql
-- ============================================================

-- ── 1. profiles ─────────────────────────────────────────────
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text,
  avatar_url   text,
  role         text not null default 'researcher',
  institution  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'researcher'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger: keep updated_at current
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated_at before update on profiles
  for each row execute function public.set_updated_at();

-- ── 2. recordings ────────────────────────────────────────────
create table if not exists recordings (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  title               text not null,
  file_name           text not null,
  storage_path        text,
  file_type           text,
  file_size           bigint,
  recording_source    text,
  dataset_name        text,
  duration_seconds    double precision,
  sampling_rate       double precision,
  lead_information    text,
  is_synthetic        boolean not null default false,
  recording_metadata  jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger recordings_updated_at before update on recordings
  for each row execute function public.set_updated_at();

create index if not exists recordings_user_id_idx    on recordings(user_id);
create index if not exists recordings_created_at_idx on recordings(created_at desc);

-- ── 3. ecg_analyses ──────────────────────────────────────────
create table if not exists ecg_analyses (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  recording_id           uuid not null references recordings(id) on delete cascade,
  analysis_status        text not null default 'pending',
  signal_quality         double precision,
  heart_rate             double precision,
  hrv_metrics            jsonb,
  r_peak_count           int,
  extracted_features     jsonb,
  preprocessing_metadata jsonb,
  analysis_summary       text,
  error_message          text,
  created_at             timestamptz not null default now(),
  completed_at           timestamptz
);

create index if not exists ecg_analyses_user_id_idx      on ecg_analyses(user_id);
create index if not exists ecg_analyses_recording_id_idx on ecg_analyses(recording_id);
create index if not exists ecg_analyses_created_at_idx   on ecg_analyses(created_at desc);

-- ── 4. digital_twin_states ───────────────────────────────────
create table if not exists digital_twin_states (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  recording_id           uuid not null references recordings(id) on delete cascade,
  analysis_id            uuid references ecg_analyses(id) on delete set null,
  baseline_data          jsonb,
  state_vector           jsonb,
  physiological_features jsonb,
  deviation_metrics      jsonb,
  state_metadata         jsonb,
  created_at             timestamptz not null default now()
);

create index if not exists twin_states_user_id_idx      on digital_twin_states(user_id);
create index if not exists twin_states_recording_id_idx on digital_twin_states(recording_id);
create index if not exists twin_states_created_at_idx   on digital_twin_states(created_at);

-- ── 5. forecasts ─────────────────────────────────────────────
create table if not exists forecasts (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  recording_id             uuid not null references recordings(id) on delete cascade,
  analysis_id              uuid references ecg_analyses(id) on delete set null,
  digital_twin_state_id    uuid references digital_twin_states(id) on delete set null,
  model_name               text,
  model_version            text,
  observation_window       double precision,
  prediction_horizon       double precision,
  forecast_output          jsonb,
  uncertainty_data         jsonb,
  experimental_risk_estimate double precision,
  forecast_status          text not null default 'pending',
  created_at               timestamptz not null default now()
);

create index if not exists forecasts_user_id_idx      on forecasts(user_id);
create index if not exists forecasts_recording_id_idx on forecasts(recording_id);
create index if not exists forecasts_created_at_idx   on forecasts(created_at desc);

-- ── 6. experiments ───────────────────────────────────────────
create table if not exists experiments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  recording_id      uuid references recordings(id) on delete set null,
  analysis_id       uuid references ecg_analyses(id) on delete set null,
  experiment_name   text not null,
  experiment_type   text not null,
  parameters        jsonb,
  results           jsonb,
  experiment_status text not null default 'pending',
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);

create index if not exists experiments_user_id_idx    on experiments(user_id);
create index if not exists experiments_created_at_idx on experiments(created_at desc);

-- ── 7. user_preferences ──────────────────────────────────────
create table if not exists user_preferences (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null unique references auth.users(id) on delete cascade,
  theme                     text not null default 'light',
  preferred_visualization   text not null default 'cardiac_state',
  anatomy_labels_enabled    boolean not null default false,
  auto_rotate_enabled       boolean not null default false,
  notification_preferences  jsonb,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create trigger user_prefs_updated_at before update on user_preferences
  for each row execute function public.set_updated_at();

create index if not exists user_prefs_user_id_idx on user_preferences(user_id);

-- ── 8. audit_events (append-only) ───────────────────────────
create table if not exists audit_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  event_type    text not null,
  resource_type text,
  resource_id   uuid,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists audit_user_id_idx    on audit_events(user_id);
create index if not exists audit_created_at_idx on audit_events(created_at desc);

-- ══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════

alter table profiles           enable row level security;
alter table recordings         enable row level security;
alter table ecg_analyses       enable row level security;
alter table digital_twin_states enable row level security;
alter table forecasts          enable row level security;
alter table experiments        enable row level security;
alter table user_preferences   enable row level security;
alter table audit_events       enable row level security;

-- ── profiles ─────────────────────────────────────────────────
create policy "profiles: own read"
  on profiles for select to authenticated
  using (id = auth.uid());

create policy "profiles: own update (no role change)"
  on profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));

-- ── recordings ───────────────────────────────────────────────
create policy "recordings: own read"
  on recordings for select to authenticated
  using (user_id = auth.uid());

create policy "recordings: own insert"
  on recordings for insert to authenticated
  with check (user_id = auth.uid());

create policy "recordings: own update"
  on recordings for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "recordings: own delete"
  on recordings for delete to authenticated
  using (user_id = auth.uid());

-- ── ecg_analyses ─────────────────────────────────────────────
create policy "analyses: own read"
  on ecg_analyses for select to authenticated
  using (user_id = auth.uid());

create policy "analyses: own insert"
  on ecg_analyses for insert to authenticated
  with check (user_id = auth.uid());

create policy "analyses: own update"
  on ecg_analyses for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "analyses: own delete"
  on ecg_analyses for delete to authenticated
  using (user_id = auth.uid());

-- ── digital_twin_states ──────────────────────────────────────
create policy "twin: own read"
  on digital_twin_states for select to authenticated
  using (user_id = auth.uid());

create policy "twin: own insert"
  on digital_twin_states for insert to authenticated
  with check (user_id = auth.uid());

create policy "twin: own delete"
  on digital_twin_states for delete to authenticated
  using (user_id = auth.uid());

-- ── forecasts ────────────────────────────────────────────────
create policy "forecasts: own read"
  on forecasts for select to authenticated
  using (user_id = auth.uid());

create policy "forecasts: own insert"
  on forecasts for insert to authenticated
  with check (user_id = auth.uid());

create policy "forecasts: own delete"
  on forecasts for delete to authenticated
  using (user_id = auth.uid());

-- ── experiments ──────────────────────────────────────────────
create policy "experiments: own read"
  on experiments for select to authenticated
  using (user_id = auth.uid());

create policy "experiments: own insert"
  on experiments for insert to authenticated
  with check (user_id = auth.uid());

create policy "experiments: own update"
  on experiments for update to authenticated
  using (user_id = auth.uid());

create policy "experiments: own delete"
  on experiments for delete to authenticated
  using (user_id = auth.uid());

-- ── user_preferences ─────────────────────────────────────────
create policy "prefs: own read"
  on user_preferences for select to authenticated
  using (user_id = auth.uid());

create policy "prefs: own upsert"
  on user_preferences for insert to authenticated
  with check (user_id = auth.uid());

create policy "prefs: own update"
  on user_preferences for update to authenticated
  using (user_id = auth.uid());

-- ── audit_events ─────────────────────────────────────────────
-- Users can read their own audit events; only service role can insert
create policy "audit: own read"
  on audit_events for select to authenticated
  using (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════
-- STORAGE BUCKETS
-- Run these separately via Supabase Dashboard > Storage, or
-- via supabase storage API if CLI is available.
-- ══════════════════════════════════════════════════════════════
-- insert into storage.buckets (id, name, public) values
--   ('ecg-recordings', 'ecg-recordings', false),
--   ('user-avatars',   'user-avatars',   false),
--   ('research-exports','research-exports',false)
-- on conflict (id) do nothing;

-- Storage RLS: users can only access their own files (path prefix = user_id)
-- create policy "ecg: own files"
--   on storage.objects for all to authenticated
--   using  (bucket_id = 'ecg-recordings' and (storage.foldername(name))[1] = auth.uid()::text)
--   with check (bucket_id = 'ecg-recordings' and (storage.foldername(name))[1] = auth.uid()::text);
