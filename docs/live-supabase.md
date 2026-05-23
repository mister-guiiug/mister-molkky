# Live multi-device (Supabase)

Mister Mölkky stays **fully offline** by default. The "live" feature (host a
match on one device, follow it in real time on others via a shareable code
or QR) is an opt-in layer powered by Supabase.

## 1. Create a free Supabase project

1. Sign up at <https://supabase.com> (free tier is enough).
2. Create a new project. Note the **Project URL** and the **anon public key**
   from `Project Settings → API`.

## 2. Configure the app

Drop the two values in `.env.local` (git-ignored):

```ini
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

For the deployed Pages build, add the same as **repository secrets**
(`Settings → Secrets and variables → Actions`) and adjust `deploy.yml` to
forward them at build time:

```yaml
- name: Build
  env:
    VITE_BASE_PATH: /${{ github.event.repository.name }}/
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
  run: npm run build
```

Restart `npm run dev` after editing `.env.local`.

## 3. Apply the SQL migration

Open your Supabase SQL editor (`SQL Editor → New query`) and run:

```sql
-- Table for live match state. The row is the source of truth while the
-- match is live; once finished, the host writes it to local history.
create table if not exists public.live_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  config jsonb not null,
  throws jsonb not null default '[]'::jsonb,
  winner_id text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Auto-bump updated_at so realtime subscribers always see a fresh value.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists live_matches_touch on public.live_matches;
create trigger live_matches_touch
  before update on public.live_matches
  for each row execute function public.touch_updated_at();

-- Realtime: enable change-data-capture on the table.
alter publication supabase_realtime add table public.live_matches;

-- Anon (un-authenticated) clients can create, read and update live matches.
-- The shareable 6-char code already gates access; no PII is stored.
alter table public.live_matches enable row level security;

create policy "anon can read live matches"
  on public.live_matches for select using (true);

create policy "anon can insert live matches"
  on public.live_matches for insert with check (true);

create policy "anon can update live matches"
  on public.live_matches for update using (true);

-- Optional: garbage-collect matches older than 24h. Run on a schedule via
-- pg_cron or Supabase scheduled functions.
-- delete from public.live_matches where started_at < now() - interval '24 hours';
```

## 4. How it works

- The **host** creates the match locally. When they toggle "Share live" in
  the match menu, the app inserts a row in `live_matches` with a short code
  (6 chars base32). Subsequent throws/edits/finish are mirrored to that row.
- A **viewer** joins from another device by typing the code or scanning the
  QR. The app subscribes to changes on that row via Supabase Realtime and
  re-renders the read-only scoreboard on every update.
- Only the host can write. Viewers see live updates with sub-second latency
  but cannot modify the match.

## 5. Security notes

- The anon key is intentionally exposed in the bundle — it is rate-limited
  and gated by RLS policies. With the policies above, anyone who knows the
  6-char code can read AND update a match. This is fine for casual play; if
  you need stronger isolation, swap the policies for authenticated writes.
- No personal data is stored. Player names live only as strings inside the
  match config payload.
