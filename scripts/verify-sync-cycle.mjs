#!/usr/bin/env node
/**
 * LE CYCLE COMPLET DE LA SYNCHRO, CONTRE UN PROJET SUPABASE RÉEL.
 *
 * Usage :
 *   VITE_SUPABASE_URL=https://<ref>.supabase.co \
 *   VITE_SUPABASE_ANON_KEY=<clé anonyme du bundle> \
 *   node scripts/verify-sync-cycle.mjs
 *
 * Deux appareils sur une clé neuve, comme après un scan de QR : A envoie, B
 * récupère puis envoie à son tour ; A envoie sur une version périmée — refus,
 * rien d'écrasé ; A envoie encore pendant que B écrit, et rattrape le conflit
 * comme « Envoyer » dans l'app (relire, refusionner, renvoyer) ; A efface
 * enfin le blob. Mêmes appels que `src/cloudSync.ts`, même boucle que
 * `pushNow` (`src/store/useSyncStore.ts`). Les refus attendus y passent aussi :
 * table fermée, autre clé, clé mal formée, contenu qui n'est pas un objet,
 * version négative, seconde création sur la même clé.
 *
 * Les tests pgTAP éprouvent le SQL sur une pile jetable ; ce script éprouve
 * le projet hébergé, PostgREST compris. À lancer après une migration ou un
 * doute sur la synchro. Le pendant du direct est `verify-live-cycle.mjs`.
 *
 * IL EXIGE LA MIGRATION 0005. Son premier passage, le 01/10/2026, a trouvé
 * que `sync_push` levait `40001` pour un conflit, code que PostgREST rejoue
 * sans fin : la requête n'a jamais répondu, et une boucle a tourné en
 * production jusqu'à ce qu'on l'arrête. Le conflit est en `PT409` (HTTP 409)
 * depuis 0005. Chaque requête est bornée à 15 s : une boucle se voit tout de
 * suite, mais elle reste à arrêter côté base (voir `supabase/README.md`).
 *
 * IL NE LAISSE RIEN : la clé, tirée pour l'occasion, est effacée à la fin,
 * même après un échec. Comme dans l'app, chaque lecture et chaque envoi
 * purgent au passage les blobs restés un an sans échange.
 *
 * Clé ANONYME seulement : une clé `service_role` passerait outre les
 * privilèges, et le script mesurerait autre chose que ce que vit l'app.
 *
 * Sortie : 0 si tout passe ; 1 si un contrôle échoue (les autres tournent
 * quand même) ; 2 si la configuration manque ou si l'ensemble dépasse 90 s.
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

/** Une requête qui ne répond pas en 15 s échoue, au lieu de pendre. */
const REQUEST_TIMEOUT_MS = 15000;
const boundedFetch = (input, init = {}) =>
  fetch(input, {
    ...init,
    signal: AbortSignal.any(
      [init.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)].filter(Boolean)
    ),
  });

const options = {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 10 } },
  global: { fetch: boundedFetch },
};
const deviceA = createClient(URL, KEY, options);
const deviceB = createClient(URL, KEY, options);

/** Une clé comme `generateSyncKey` : 28 caractères crockford32, sans biais. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const newKey = () =>
  Array.from(
    crypto.getRandomValues(new Uint8Array(28)),
    b => ALPHABET[b % 32]
  ).join('');
const key = newKey();

let failures = 0;
function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`${ok ? 'OK' : 'KO'}  ${label}${detail ? ` : ${detail}` : ''}`);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** « Effacer du cloud » sur la clé de test : le seul nettoyage nécessaire. */
let erased = false;
async function erase() {
  if (erased) return;
  const { error } = await deviceA.rpc('sync_delete', { p_key: key });
  if (error) {
    console.log(`KO  effacement de la clé de test : ${error.code}`);
  } else {
    erased = true;
  }
}

const watchdog = setTimeout(async () => {
  console.log('KO  délai global dépassé (90 s)');
  await Promise.race([erase(), sleep(5000)]);
  process.exit(2);
}, 90000);

/** `pullSync` : le blob de la clé, ou `null` si elle n'a rien envoyé. */
async function pull(client, k = key) {
  const { data, error } = await client.rpc('sync_pull', { p_key: k });
  if (error) throw error;
  return data;
}

/** `pushSync`, sans lever : le contrôle lit lui-même `error.code`. */
function push(client, payload, version) {
  return client.rpc('sync_push', {
    p_key: key,
    p_payload: payload,
    p_version: version,
  });
}

const t0 = Date.now();
const local = {
  A: {
    players: [{ id: 'essai-a', name: 'Essai A', createdAt: t0 }],
    history: [{ id: 'essai-partie-a', finishedAt: t0 + 1 }],
  },
  B: {
    players: [{ id: 'essai-b', name: 'Essai B', createdAt: t0 }],
    history: [{ id: 'essai-partie-b', finishedAt: t0 + 2 }],
  },
};

/** L'union par identifiant, comme `mergeSnapshots`. */
const union = (mine = [], theirs = []) => [
  ...new Map([...mine, ...theirs].map(item => [item.id, item])).values(),
];
const payloadOf = snapshot => ({
  v: 1,
  players: snapshot.players,
  history: snapshot.history,
  templates: [],
  settings: {},
  pushedAt: Date.now(),
});

/**
 * « Envoyer », comme `pushNow` : lire, fusionner, envoyer à la version lue,
 * et recommencer sur conflit, trois essais au plus. `beforeFirstPush` glisse
 * l'écriture d'un autre appareil entre la première lecture et son envoi.
 */
const MAX_PUSH_ATTEMPTS = 3;
async function send(client, device, beforeFirstPush) {
  for (let attempt = 1; ; attempt += 1) {
    const remote = await pull(client);
    local[device] = {
      players: union(local[device].players, remote?.payload.players),
      history: union(local[device].history, remote?.payload.history),
    };
    if (attempt === 1 && beforeFirstPush) await beforeFirstPush();
    const { data, error } = await push(
      client,
      payloadOf(local[device]),
      remote?.version ?? 0
    );
    if (!error) return { version: data.version, attempts: attempt };
    if (error.code !== 'PT409' || attempt >= MAX_PUSH_ATTEMPTS) throw error;
  }
}

const blob = remote =>
  remote
    ? `version ${remote.version}, ${remote.payload.players.length} joueur(s), ${remote.payload.history.length} partie(s)`
    : 'rien';

console.log(`Clé de test : ${key.slice(0, 4)}…${key.slice(-4)}\n`);

try {
  // 0. La table elle-même reste fermée.
  {
    const { error } = await deviceA
      .from('user_data')
      .select('version')
      .limit(0);
    check(
      'lecture directe de user_data refusée',
      error?.code === '42501',
      error?.code ?? 'acceptée !'
    );
  }

  // 1. Une clé neuve n'a rien à lire.
  check('une clé neuve ne lit rien', (await pull(deviceA)) === null);

  // 2. A envoie le premier : version 0, puis 1.
  {
    const result = await send(deviceA, 'A');
    check(
      'A envoie sur la clé neuve',
      result.version === 1,
      `version ${result.version}`
    );
  }

  // 3. B, sur la même clé, récupère ce que A a envoyé ; une autre clé, rien.
  {
    const remote = await pull(deviceB);
    check(
      'B récupère l’envoi de A',
      remote?.version === 1 &&
        remote.payload.players.some(p => p.id === 'essai-a'),
      blob(remote)
    );
    check(
      'une autre clé ne lit rien',
      (await pull(deviceB, newKey())) === null
    );
  }

  // 4. B envoie à son tour : l'union des deux appareils, version 2.
  {
    const result = await send(deviceB, 'B');
    const remote = await pull(deviceA);
    check(
      'B envoie l’union',
      result.version === 2 && remote?.payload.players.length === 2,
      blob(remote)
    );
  }

  // 5. A envoie sur la version qu'il avait lue (1) : refusé, rien d'écrasé.
  {
    const { error, status } = await push(deviceA, payloadOf(local.A), 1);
    check(
      'envoi sur une version périmée refusé, tout de suite',
      error?.code === 'PT409' && status === 409,
      `${error?.code ?? 'accepté !'}, HTTP ${status}`
    );
    const remote = await pull(deviceA);
    check(
      'le refus n’a rien écrasé',
      remote?.version === 2 && remote.payload.players.length === 2,
      blob(remote)
    );
  }

  // 6. A envoie pendant que B écrit : conflit, puis relire, refusionner,
  //    renvoyer — sans rien perdre de part et d'autre.
  {
    const result = await send(deviceA, 'A', async () => {
      await send(deviceB, 'B');
    });
    const remote = await pull(deviceB);
    check(
      'A rattrape le conflit au deuxième essai',
      result.attempts === 2 && result.version === 4,
      `${result.attempts} essais, version ${result.version}`
    );
    check(
      'rien de perdu : les deux appareils au complet',
      remote?.version === 4 &&
        remote.payload.players.length === 2 &&
        remote.payload.history.length === 2,
      blob(remote)
    );
  }

  // 7. Les entrées refusées ne laissent rien.
  {
    const second = await push(deviceB, payloadOf(local.B), 0);
    check(
      'une seconde création sur la même clé est refusée',
      second.error?.code === 'PT409' && second.status === 409,
      `${second.error?.code ?? 'acceptée !'}, HTTP ${second.status}`
    );
    const short = await deviceA.rpc('sync_pull', { p_key: key.slice(0, 27) });
    check(
      'clé trop courte refusée',
      short.error?.code === '22023',
      short.error?.code ?? 'acceptée !'
    );
    // U n'est pas dans l'alphabet crockford32.
    const foreign = await deviceA.rpc('sync_delete', { p_key: 'U'.repeat(28) });
    check(
      'clé hors alphabet refusée',
      foreign.error?.code === '22023',
      foreign.error?.code ?? 'acceptée !'
    );
    const array = await push(deviceA, [], 4);
    check(
      'contenu qui n’est pas un objet refusé',
      array.error?.code === '22023',
      array.error?.code ?? 'accepté !'
    );
    const negative = await push(deviceA, payloadOf(local.A), -1);
    check(
      'version négative refusée',
      negative.error?.code === '22023',
      negative.error?.code ?? 'acceptée !'
    );
    const remote = await pull(deviceA);
    check('les refus n’ont rien écrit', remote?.version === 4, blob(remote));
  }

  // 8. « Effacer du cloud » : le blob disparaît pour tous les appareils.
  {
    const { data, error } = await deviceA.rpc('sync_delete', { p_key: key });
    erased = !error && data === true;
    check('A efface le blob', erased, error?.code ?? '');
    check('B ne lit plus rien', (await pull(deviceB)) === null);
    const again = await deviceA.rpc('sync_delete', { p_key: key });
    check(
      'un second effacement ne trouve rien',
      !again.error && again.data === false,
      again.error?.code ?? ''
    );
  }
} catch (err) {
  check('déroulé interrompu', false, `${err.code ?? ''} ${err.message ?? err}`);
} finally {
  await erase();
  clearTimeout(watchdog);
}

console.log(
  `\n${failures === 0 ? 'Tout est passé' : `${failures} échec(s)`} en ${Date.now() - t0} ms.` +
    (erased
      ? ' Clé de test effacée : rien ne reste en base.'
      : ' La clé de test n’a pas pu être effacée.')
);
process.exit(failures === 0 ? 0 : 1);
