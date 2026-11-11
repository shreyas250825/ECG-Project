-- ============================================================
-- Migration 003: Storage buckets and access policies
-- Apply via Supabase SQL Editor or CLI
-- ============================================================

-- ── Create private storage buckets ───────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'ecg-recordings',
    'ecg-recordings',
    false,
    52428800,  -- 50 MB per file
    array['text/csv', 'application/octet-stream', 'application/x-hdf5',
          'text/plain', 'application/zip']
  ),
  (
    'user-avatars',
    'user-avatars',
    false,
    2097152,   -- 2 MB per file
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'research-exports',
    'research-exports',
    false,
    104857600, -- 100 MB per file
    array['application/json', 'text/csv', 'application/zip',
          'application/octet-stream']
  )
on conflict (id) do nothing;

-- ── ECG recordings storage policies ──────────────────────────
-- Users can only read/write/delete files under their own user_id prefix

create policy "ecg-recordings: upload own files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ecg-recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "ecg-recordings: read own files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ecg-recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "ecg-recordings: delete own files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'ecg-recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── User avatars storage policies ────────────────────────────
create policy "user-avatars: upload own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "user-avatars: read own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "user-avatars: delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Research exports storage policies ────────────────────────
create policy "research-exports: upload own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'research-exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "research-exports: read own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'research-exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "research-exports: delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'research-exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
