# Cloud sync (multi-device)

The app's "Sync cloud" toggle in **Paramètres** pushes / pulls a single
JSON blob — `{ players, history, templates, settings }` — to a Supabase
table so the same user can play on multiple devices and keep their data
consistent.

This is a **last-write-wins** implementation, scope-limited:

- One blob per user, replaced wholesale on every push.
- No per-record merging — push from device A then pull on device B and
  device B replaces its local data with A's.
- The user controls when to push / pull via two buttons.

To enable the feature in your Supabase project you must:

1. Apply the SQL migration below (one-time, in the SQL editor).
2. Enable **Anonymous sign-ins** in **Authentication → Providers**.

## SQL migration

```sql
-- One row per authenticated user, with a JSON payload of all their data.
create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

-- A user can only see and modify their own row.
create policy "user_data_select_own"
  on public.user_data for select
  using (auth.uid() = user_id);

create policy "user_data_insert_own"
  on public.user_data for insert
  with check (auth.uid() = user_id);

create policy "user_data_update_own"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

## How users opt in

Settings → **Sync cloud (multi-device)** toggle → app calls
`signInAnonymously()` on first push. The anonymous user id persists in
the browser via Supabase's session token (localStorage), so subsequent
visits resume the same identity automatically.

If the user clears their browser data the anonymous identity is lost —
this is intentional, no separate "delete account" flow is needed.

## Known limitations

- Last-write-wins only. Two devices editing simultaneously: last to push
  wins; the other device must pull to see the latest.
- No real-time mirroring. The user clicks "Push" / "Pull" on demand.
  Auto-sync on save is intentionally NOT implemented in this version to
  avoid surprise overwrites.
- Account recovery requires the anon session token. Losing it is
  equivalent to losing the data — for now we don't expose a way to
  upgrade to a real email/password account.
