#!/usr/bin/env node
/**
 * LE CYCLE COMPLET DU DIRECT, CONTRE UN PROJET SUPABASE RÉEL.
 *
 * Usage :
 *   VITE_SUPABASE_URL=https://<ref>.supabase.co \
 *   VITE_SUPABASE_ANON_KEY=<clé anonyme du bundle> \
 *   node scripts/verify-live-cycle.mjs
 *
 * Deux clients, comme deux téléphones : l'hôte crée la partie, pousse des
 * lancers et la clôt ; le spectateur s'abonne au canal `molkky-live:<code>` et
 * relit par code à chaque signal. Mêmes appels et mêmes options que
 * `src/live/liveMatch.ts` et `src/supabase.ts`. Les refus attendus y passent
 * aussi : table fermée, autre code, autre secret, lancers mal formés, code
 * déjà pris, écriture après la fin.
 *
 * Les tests pgTAP éprouvent le SQL sur une pile jetable ; ce script éprouve
 * le projet hébergé, Realtime compris, que la CI n'atteint pas. À lancer
 * après une migration ou un doute sur le direct.
 *
 * IL ÉCRIT : une partie de test, finie, sans donnée personnelle (« Essai A »
 * contre « Essai B »). Aucune fonction ne l'efface ; elle devient introuvable
 * 24 h après sa dernière écriture et part à la création de partie suivante.
 *
 * Clé ANONYME seulement : une clé `service_role` passerait outre les
 * privilèges, et le script mesurerait autre chose que ce que vit l'app.
 *
 * Sortie : 0 si tout passe ; 1 si un contrôle échoue (les autres tournent
 * quand même, sauf après une création ratée) ; 2 si la configuration manque
 * ou si l'ensemble dépasse 90 s.
 */

import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!URL || !KEY) {
  console.error('VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont requis.');
  process.exit(2);
}

/** Le rôle porté par la clé : `anon` attendu, rien d'autre. */
function keyRole(key) {
  if (key.startsWith('sb_publishable_')) return 'anon';
  try {
    const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).role ?? null;
  } catch {
    return null;
  }
}

if (keyRole(KEY) !== 'anon') {
  console.error(
    'Clé anonyme seulement (celle du bundle), jamais service_role.'
  );
  process.exit(2);
}

const options = {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 10 } },
};
const host = createClient(URL, KEY, options);
const viewer = createClient(URL, KEY, options);

/** L'alphabet des codes de l'app (crockford32) : 256 = 8 × 32, sans biais. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const code = Array.from(
  crypto.getRandomValues(new Uint8Array(6)),
  b => ALPHABET[b % 32]
).join('');
const topic = `molkky-live:${code}`;

let failures = 0;
function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`${ok ? 'OK' : 'KO'}  ${label}${detail ? ` : ${detail}` : ''}`);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(predicate, ms = 10000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (predicate()) return true;
    await sleep(50);
  }
  return predicate();
}

const watchdog = setTimeout(() => {
  console.log('KO  délai global dépassé (90 s)');
  process.exit(2);
}, 90000);

const t0 = Date.now();
const A = 'essai-a';
const B = 'essai-b';
const config = {
  players: [
    { id: A, name: 'Essai A', color: '#4a7c2a', createdAt: 1 },
    { id: B, name: 'Essai B', color: '#d4892b', createdAt: 2 },
  ],
  targetScore: 50,
};
const lancer = (i, playerId, fallenPins) => ({
  id: `essai-${i}`,
  playerId,
  timestamp: t0 + i * 1000,
  fallenPins,
});
// A vise la 12, B rate trois fois : éliminé, A gagne au sixième lancer.
const SIX = [
  lancer(1, A, [12]),
  lancer(2, B, []),
  lancer(3, A, [12]),
  lancer(4, B, []),
  lancer(5, A, [12]),
  lancer(6, B, []),
];

console.log(`Partie de test : ${code}\n`);

// 0. La table elle-même reste fermée.
{
  const { error } = await viewer.from('live_matches').select('code').limit(0);
  check(
    'lecture directe de live_matches refusée',
    error?.code === '42501',
    error?.code ?? 'acceptée !'
  );
}

// 1. L'hôte crée la partie et reçoit son secret, une seule fois.
const created = await host.rpc('live_match_create', {
  p_code: code,
  p_config: config,
  p_throws: [],
});
const hostToken = created.data;
check(
  'live_match_create rend un secret d’hôte',
  !created.error && /^[0-9a-f-]{36}$/.test(String(hostToken)),
  created.error ? `${created.error.code} ${created.error.message}` : ''
);
if (created.error) process.exit(1);

{
  const { error } = await host.rpc('live_match_create', {
    p_code: code,
    p_config: config,
    p_throws: [],
  });
  check(
    'un code déjà pris est refusé (l’app en tire un autre)',
    error?.code === '23505',
    error?.code ?? 'accepté !'
  );
}

// 2. Le spectateur s'abonne, relit à l'abonnement puis à chaque signal — une
//    seule relecture en vol, comme `subscribeLiveMatch`.
const seen = { signals: 0, rows: [] };
let inFlight = false;
let again = false;
async function refresh() {
  if (inFlight) {
    again = true;
    return;
  }
  inFlight = true;
  try {
    do {
      again = false;
      const { data, error } = await viewer.rpc('live_match_get', {
        p_code: code,
      });
      if (error) throw error;
      if (data) seen.rows.push({ at: Date.now(), row: data });
    } while (again);
  } catch (err) {
    check('relecture du spectateur', false, err.message ?? String(err));
  } finally {
    inFlight = false;
  }
}
const last = () => seen.rows.at(-1)?.row;

let subscribedAt = 0;
const channel = viewer
  .channel(topic)
  .on('broadcast', { event: 'update' }, () => {
    seen.signals += 1;
    void refresh();
  })
  .subscribe((status, err) => {
    if (status === 'SUBSCRIBED') {
      subscribedAt = Date.now();
      void refresh();
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      check('canal du spectateur', false, `${status} ${err?.message ?? ''}`);
    }
  });

check('abonnement du spectateur', await waitFor(() => subscribedAt > 0), topic);
check(
  'état initial relu à l’abonnement',
  await waitFor(() => last()?.code === code),
  last()
    ? `${last().throws.length} lancer, ${last().config.players.length} joueurs`
    : 'rien'
);

{
  const other = code.slice(0, 5) + (code[5] === 'Z' ? 'Y' : 'Z');
  const { data, error } = await viewer.rpc('live_match_get', {
    p_code: other,
  });
  check(
    'un autre code ne lit rien',
    !error && data === null,
    error?.code ?? ''
  );
}

/** Le signal de l'hôte, par l'API REST de Realtime : `signalLiveUpdate`. */
async function signal() {
  const ch = host.channel(topic);
  try {
    return await ch.httpSend('update', {});
  } finally {
    void host.removeChannel(ch);
  }
}

// 3. L'hôte pousse deux lancers, puis signale.
{
  const { error } = await host.rpc('live_match_push', {
    p_code: code,
    p_host_token: hostToken,
    p_throws: SIX.slice(0, 2),
  });
  check(
    'live_match_push avec le secret',
    !error,
    error ? `${error.code} ${error.message}` : ''
  );
  const sentAt = Date.now();
  const res = await signal();
  check('signal envoyé', res?.success !== false, JSON.stringify(res));
  const ok = await waitFor(
    () => seen.signals >= 1 && last()?.throws.length === 2
  );
  const got = seen.rows.find(r => r.row.throws.length === 2);
  check(
    'le spectateur voit les deux lancers',
    ok,
    got ? `${got.at - sentAt} ms après le signal` : `${seen.signals} signal`
  );
}

// 4. Les écritures refusées ne laissent rien.
{
  const { error } = await viewer.rpc('live_match_push', {
    p_code: code,
    p_host_token: crypto.randomUUID(),
    p_throws: SIX.slice(0, 3),
  });
  check(
    'push avec un autre secret refusé',
    error?.code === 'P0002',
    error?.code ?? 'accepté !'
  );
}
{
  const { error } = await host.rpc('live_match_push', {
    p_code: code,
    p_host_token: hostToken,
    p_throws: { pas: 'un tableau' },
  });
  check(
    'push de lancers mal formés refusé',
    error?.code === '22023',
    error?.code ?? 'accepté !'
  );
}
{
  const { data } = await viewer.rpc('live_match_get', { p_code: code });
  check(
    'les refus n’ont rien écrit',
    data?.throws.length === 2,
    `${data?.throws.length} lancers`
  );
}

// 5. L'hôte clôt avec le lancer gagnant, puis signale.
{
  const { error } = await host.rpc('live_match_finish', {
    p_code: code,
    p_host_token: hostToken,
    p_throws: SIX,
    p_winner_id: A,
  });
  check(
    'live_match_finish avec le secret',
    !error,
    error ? `${error.code} ${error.message}` : ''
  );
  const sentAt = Date.now();
  const res = await signal();
  check('second signal envoyé', res?.success !== false, JSON.stringify(res));
  const ok = await waitFor(() => seen.signals >= 2 && !!last()?.finished_at);
  const got = seen.rows.find(r => r.row.finished_at);
  check(
    'le spectateur voit la fin, lancer gagnant compris',
    ok && last().winner_id === A && last().throws.length === 6,
    got
      ? `${got.at - sentAt} ms après le signal, ${got.row.throws.length} lancers`
      : 'rien'
  );
}

// 6. Une partie finie est gelée.
{
  const push = await host.rpc('live_match_push', {
    p_code: code,
    p_host_token: hostToken,
    p_throws: SIX.slice(0, 1),
  });
  check(
    'push après la fin refusé',
    push.error?.code === 'P0002',
    push.error?.code ?? 'accepté !'
  );
  const finish = await host.rpc('live_match_finish', {
    p_code: code,
    p_host_token: hostToken,
    p_throws: SIX.slice(0, 1),
    p_winner_id: B,
  });
  check(
    'seconde clôture refusée',
    finish.error?.code === 'P0002',
    finish.error?.code ?? 'acceptée !'
  );
  const { data } = await viewer.rpc('live_match_get', { p_code: code });
  check(
    'état final intact',
    data?.winner_id === A && data?.throws.length === 6,
    `${data?.throws.length} lancers`
  );
}

await viewer.removeChannel(channel);
await host.removeAllChannels();
clearTimeout(watchdog);
console.log(
  `\n${failures === 0 ? 'Tout est passé' : `${failures} échec(s)`} en ${Date.now() - t0} ms.` +
    ` Partie ${code} : introuvable dans 24 h, purgée à la création suivante.`
);
process.exit(failures === 0 ? 0 : 1);
