# Supabase Setup — Cardiac Digital Twin

This document describes how to configure Supabase for the Cardiac Digital Twin research platform.

---

## 1. Prerequisites

- Node.js ≥ 18
- A [Supabase](https://supabase.com) account and project
- The frontend running at `http://localhost:5173` (or whichever port Vite assigns)

---

## 2. Create a Supabase project

1. Go to [app.supabase.com](https://app.supabase.com) → New project.
2. Choose a region close to your users.
3. Set a strong database password and save it securely — you will not need it in the frontend.
4. Wait for the project to finish provisioning (~60 seconds).

---

## 3. Required environment variables

### Frontend (`frontend/.env`)

Copy `frontend/.env.example` to `frontend/.env` and fill in:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
```

Find these values in:
**Supabase Dashboard → Project Settings → API**

- `VITE_SUPABASE_URL` = Project URL
- `VITE_SUPABASE_ANON_KEY` = `anon` / `public` key (safe to use in browser with RLS)

> **Never expose** the `service_role` key in frontend code.

### Backend (`.env` at repo root or `backend/.env`)

The Python FastAPI backend uses the service role key **server-side only**:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

---

## 4. Run the database migration

### Option A — Supabase SQL Editor (easiest)

1. Go to **Dashboard → SQL Editor → New query**.
2. Copy the contents of `supabase/migrations/002_user_auth_schema.sql`.
3. Paste and click **Run**.

If you are starting fresh, also run `supabase/migrations/001_init.sql` first.

### Option B — Supabase CLI

```bash
npx supabase login
npx supabase link --project-ref your-project-id
npx supabase db push
```

---

## 5. Configure email authentication

In **Dashboard → Authentication → Providers**:

- Ensure **Email** is enabled.
- Configure **Email confirmation** as needed:
  - For development: you can disable confirmation so signup is instant.
  - For production: enable confirmation so users must verify their email.

---

## 6. Configure password reset redirect URLs

In **Dashboard → Authentication → URL Configuration**:

Add these to **Redirect URLs**:

```
http://localhost:5173/reset-password
http://localhost:5173/auth/callback
https://your-production-domain.com/reset-password
https://your-production-domain.com/auth/callback
```

The **Site URL** should be:
```
http://localhost:5173
```
(change to production URL when deploying)

---

## 7. Configure storage buckets

In **Dashboard → Storage**, create three buckets:

| Bucket name         | Public | Purpose                        |
|---------------------|--------|--------------------------------|
| `ecg-recordings`    | No     | Private ECG file uploads       |
| `user-avatars`      | No     | User profile pictures          |
| `research-exports`  | No     | Exported research data         |

### Storage RLS policies for `ecg-recordings`

In **Storage → Policies**, add a policy on `storage.objects`:

```sql
-- Users can only access files in their own folder (path prefix = their user_id)
create policy "ecg: own files"
  on storage.objects for all to authenticated
  using  (bucket_id = 'ecg-recordings' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'ecg-recordings' and (storage.foldername(name))[1] = auth.uid()::text);
```

---

## 8. Verify RLS policies

To test that Row Level Security is working correctly:

### Test as an authenticated user

```sql
-- In SQL Editor, switch to a test user role:
set role authenticated;
set local request.jwt.claims to '{"sub": "your-test-user-uuid", "role": "authenticated"}';

-- Should return only that user's recordings:
select * from recordings;

-- Should return empty for another user's data:
select * from recordings where user_id = 'another-user-uuid';
```

### Test cross-user isolation (should return 0 rows)

```sql
-- If user A's ID is 'uuid-a', logged in as user B:
select * from recordings where user_id = 'uuid-a';
-- Expected: 0 rows
```

---

## 9. Run the application locally

### Start the backend

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

### Start the frontend

```bash
cd frontend
npm install
cp .env.example .env   # then fill in your Supabase credentials
npm run dev
```

The app will be available at `http://localhost:5173`.

The backend API proxy is configured in `vite.config.ts`:
- `/api/*` → `http://127.0.0.1:8000`
- `/ws/*`  → `ws://127.0.0.1:8000`

---

## 10. Demo / offline mode

If `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are not set, the application runs in **demo mode**:

- Authentication is bypassed (all routes are accessible).
- Data is stored in the FastAPI in-memory store only (not persisted across restarts).
- A warning banner is shown in the app header.

This is the default for local development without Supabase credentials.

---

## 11. Security notes

- The `anon` key is designed to be used in browser clients — it is not secret.
- RLS policies enforce that users can only access their own data at the **database level**.
- Never put the `service_role` key in frontend code or commit it to version control.
- Do not store passwords in the `profiles` table — Supabase Auth handles all password hashing internally.
- ECG recordings are stored in a private bucket — they are not publicly accessible.
- This is a research prototype. Real patient data requires appropriate privacy review, consent, and regulatory compliance before use.

---

## 12. Generating TypeScript types (optional)

To regenerate `frontend/src/lib/database.types.ts` from your live schema:

```bash
npx supabase gen types typescript \
  --project-id your-project-id \
  --schema public \
  > frontend/src/lib/database.types.ts
```

---

## 13. Useful Supabase CLI commands

```bash
# Check migration status
npx supabase db diff

# Apply pending migrations
npx supabase db push

# Reset local database (destructive)
npx supabase db reset

# View logs
npx supabase logs
```
