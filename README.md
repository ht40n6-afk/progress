# Personal Life Gamification Tracker

A Vite + React single-page app for tracking daily entries, goals, plans, rewards, and XP.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

Vite outputs the production build to `dist/`.

## Deploying to Vercel

This project is ready to deploy as a static Vite site.

Use the following Vercel project settings:

- **Framework Preset:** Vite (or Other)
- **Install Command:** `npm install`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

No additional dependencies or environment secrets are required for a standard deployment.

## Supabase auth + manual cloud sync setup

Add these environment variables in local `.env` and in Vercel project settings:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Use this SQL in Supabase SQL editor:

```sql
create table if not exists public.user_app_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_app_data enable row level security;

create policy "users can read own app data"
on public.user_app_data
for select
using (auth.uid() = user_id);

create policy "users can insert own app data"
on public.user_app_data
for insert
with check (auth.uid() = user_id);

create policy "users can update own app data"
on public.user_app_data
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

In app Settings:
- Use **Account** section to Sign Up / Login / Logout.
- Use **Cloud Sync** section:
  - **Save to Cloud** uploads full current app JSON.
  - **Load from Cloud** downloads and replaces local app data after confirmation.
