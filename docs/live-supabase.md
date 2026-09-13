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

The schema lives in
[`supabase/migrations/0002_live_matches.sql`](../supabase/migrations/0002_live_matches.sql)
— apply it with the CLI, not by hand:

```bash
supabase link --project-ref <ref>   # Project Settings → General → Reference ID
supabase db push
```

See [`supabase/README.md`](../supabase/README.md) for how migrations reach the
hosted project and what is currently in the database.

> This page used to carry the SQL itself, under a "paste it in the dashboard
> SQL editor" note. Nobody ever pasted it: the database was found **empty** on
> 13/09/2026, more than a week after the project was created, and hosting a
> live match failed in production the whole time. The SQL now has exactly one
> home — the migration — so the two cannot drift apart.

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

- The anon key is intentionally exposed in the bundle. What limits it is the
  migration's RLS policies **and** its table privileges — `select`, `insert`
  and `update` for `anon`, nothing else. A brand-new table in `public` hands
  `anon` INSERT/UPDATE/DELETE/**TRUNCATE** by default, and RLS does not cover
  `truncate`: the migration revokes the lot and grants back verb by verb.
- **The 6-char code does not gate reads.** An earlier version of this page
  claimed it did. A policy filters rows by what the row contains, not by what
  the client asked for — it cannot require that you filtered on `code`. So
  anyone holding the anon key can list the live matches, codes and player
  names included, and update any of them. That is acceptable for casual play
  among friends; it is not isolation.
- Closing that properly means changing the **app**, not the policies: reads
  behind a `security definer` function taking the code as an argument, plus a
  host secret to tell host from viewer (a viewer is handed the full row,
  `id` included, when it joins). Realtime also replays the `select` policy as
  `anon` before delivering each update, so the read cannot simply be shut.
- A **finished** match is frozen: the update policy only accepts rows whose
  `finished_at` is still null, so a result cannot be rewritten after the fact.
- Player names are stored as strings inside the match config payload, and are
  readable by anyone with the anon key — see the second point above.
