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

## 3. Apply the SQL migrations

The schema lives in
[`supabase/migrations/0002_live_matches.sql`](../supabase/migrations/0002_live_matches.sql)
(the table) and
[`supabase/migrations/0003_live_matches_rpc.sql`](../supabase/migrations/0003_live_matches_rpc.sql)
(the functions that are now its only door) — apply them with the CLI, not by
hand:

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
  the match menu, the app calls `live_match_create` with a short code (6
  chars, Crockford base32) and the current state. The database answers with a
  **host secret**, returned this once and stored only as a SHA-256 hash.
- Every throw, edit or finish goes through `live_match_push` or
  `live_match_finish`, which demand the code **and** the host secret. Right
  after each write, the host sends a **signal** on the Realtime Broadcast
  channel `molkky-live:<code>`.
- A **viewer** joins from another device by typing the code or scanning the
  QR. The app reads the match with `live_match_get(code)`, listens to the
  channel, and reads the match again on every signal — and on every
  (re)subscription, which catches up on anything missed during a drop. The
  signal carries **no data**: a forged one only triggers a re-read of the
  database, never a fake score on screen.
- Only the host can write. Viewers see live updates within a round trip but
  cannot modify the match.

## 5. Security notes

- The anon key is intentionally exposed in the bundle. Since `0003`, it has
  **no direct access** to `live_matches` at all: no table privilege, no
  policy. Row level security stays on, without a policy, as a second barrier.
  The four `security definer` functions above are the only door, and only
  `anon` may execute them — `authenticated` gets nothing, this app has no
  accounts.
- **The code gates reads.** `live_match_get` returns the match whose code is
  given, and nothing else — no listing, and neither the internal `id` nor the
  host secret in the answer. A policy could never do that: it filters rows by
  what they contain, not by what the client asked for. Until `0003`, a single
  request listed every live match, codes and player names included.
- **The code alone does not let you write.** Writes need the host secret,
  which the viewers never see. Until `0003`, anyone holding a match `id` —
  handed to every viewer — could rewrite its throws.
- **The code is still the only secret for reading.** Anyone you give it to
  sees the player names and the scores. With 32⁶ ≈ 10⁹ codes and few matches
  alive at any time, guessing one is impractical, not impossible: do not use
  the live mode for anything you would not show a stranger.
- A **finished** match is frozen: neither function writes a match whose
  `finished_at` is set.
- **Matches are erased 24 hours after their last write.** Every function
  ignores an expired match, and each new match purges the expired ones — see
  the comments at the top of `0003` for why this is not a cron job.
- The database side of all of this is exercised by pgTAP in CI
  ([`supabase/tests/live_matches.test.sql`](../supabase/tests/live_matches.test.sql)),
  under the `anon` role PostgREST uses for the published key.
