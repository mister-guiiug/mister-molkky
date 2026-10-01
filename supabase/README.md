# Supabase — Mister Mölkky

Mister Mölkky fonctionne **entièrement hors ligne**. Supabase n'alimente que deux
couches optionnelles (le direct multi-appareils et la synchro par clé) et le
ping anti-pause. Ce dossier décrit l'état de la base du projet hébergé,
**comment le SQL y arrive**, et où il est éprouvé.

## Comment une migration est appliquée ici

**Par la CI.** [`supabase-migrations.yml`](../.github/workflows/supabase-migrations.yml)
appelle le réutilisable du socle (`supabase link`, puis `supabase db push`) à
chaque poussée sur `main` qui touche `migrations/`. On le lance aussi à la main :

```bash
gh workflow run "Supabase migrations" -R mister-guiiug/mister-molkky --ref main
```

Il lui faut deux secrets, à poser une fois (Settings → Secrets and variables →
Actions). Sans eux, il s'arrête en le disant, avant tout lien au projet.

| Secret                  | Où le trouver                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | jeton d'accès personnel du compte : supabase.com → Account → Access Tokens                                                                  |
| `SUPABASE_DB_PASSWORD`  | mot de passe de la base : Project Settings → Database. Le réinitialiser ne casse rien ici : l'app ne parle à la base que par la clé anonyme |

```bash
gh secret set SUPABASE_ACCESS_TOKEN -R mister-guiiug/mister-molkky
gh secret set SUPABASE_DB_PASSWORD -R mister-guiiug/mister-molkky
```

`gh` demande la valeur sans l'écrire dans l'historique du terminal. La
référence du projet, elle, est publique (elle est dans l'URL) : le workflow
l'écrit en clair.

Le jeton doit venir d'un compte qui **voit le projet**. Sinon, `supabase link`
répond 403 (« Your account does not have the necessary privileges to access
this endpoint ») et rien n'est appliqué. Le jeton est valide (un jeton faux
donnerait 401), mais son compte n'a pas accès au projet. C'est arrivé au
premier essai, le 01/10/2026 ; un nouveau jeton a réglé le problème.

> **Un fichier présent n'est pas un fichier appliqué.** C'est la leçon qui a
> coûté trois jours de ping rouge, puis onze jours de direct en panne : le SQL
> du direct a vécu dans [`../docs/live-supabase.md`](../docs/live-supabase.md)
> depuis la naissance du dépôt, avec sa consigne « à coller dans l'éditeur
> SQL », et personne ne l'a jamais collé. Elle a resservi le 01/10/2026 :
> `0003` et `0004` étaient fusionnées et déployées depuis la veille, mais
> absentes de la base jusqu'au premier run de la CI, le jour même. Après
> chaque ajout ici, **vérifier la base**, pas le dossier.

**Le premier run a tout rejoué, et c'était voulu.** `0001` et `0002` avaient
été appliquées par l'API de gestion (`POST /v1/projects/<ref>/database/query`),
qui ne demande pas le mot de passe de la base : le schéma `supabase_migrations`
était resté **vide**. Le premier `supabase db push`, le 01/10/2026, a donc
rejoué `0001` → `0004`, puis les a inscrites. C'est pour cela que chaque
migration devait rester rejouable sans effet de bord. Désormais, `db push` ne
joue que ce qui manque.

## Où le SQL est éprouvé : la CI

[`supabase-tests.yml`](../.github/workflows/supabase-tests.yml) démarre une
pile Supabase **jetable**, y applique les migrations depuis zéro — exactement ce
que ferait un `supabase db push` ici — puis joue les tests pgTAP de
[`tests/`](./tests). Aucun secret, rien ne touche le projet hébergé. Le poste
de développement n'a pas de démon Docker : c'est le seul endroit où les
migrations s'exécutent avant la production.

| Fichier                       | Ce qu'il tient                                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `structure-securite.test.sql` | aucune table de `public` sans RLS ; les fonctions `security definer` exécutables par `anon` sont exactement la liste relue (le fichier du parc)                           |
| `live_matches.test.sql`       | la table fermée à `anon` et `authenticated` ; lire au code, écrire au code et au secret ; la partie finie gelée ; l'expiration et la purge                                |
| `user_data.test.sql`          | la table fermée ; une clé ne lit, n'écrit et n'efface que son blob ; l'envoi sur une version périmée refusé sans rien écraser ; les clés mal formées ; un an sans échange |

Les tests jouent sous `set local role anon` : c'est le rôle que PostgREST prend
pour la clé publiée. Sans lui, la session garde les droits de `postgres`, TOUT
passe, et un test serait vert et faux.

## État de la base

Relevé en lecture seule le 01/10/2026, juste après le premier run de la CI,
avec la clé anonyme du bundle (aucune ligne lue) : **tout `migrations/` est en
base**.

| Objet                                            | En base                                          | Décrit où                               |
| ------------------------------------------------ | ------------------------------------------------ | --------------------------------------- |
| `public.keep_alive`                              | oui                                              | `migrations/0001_keep_alive.sql`        |
| `public.live_matches`                            | oui, **fermée** (401, `42501`)                   | `0002`, fermée par `0003`               |
| `public.touch_updated_at()`                      | oui                                              | `migrations/0002_live_matches.sql`      |
| publication `supabase_realtime` → `live_matches` | non, retirée par `0003`                          | `0002`, `0003`                          |
| `live_match_create`, `_get`, `_push`, `_finish`  | oui (`_get` d'un code inconnu : `null`)          | `migrations/0003_live_matches_rpc.sql`  |
| `public.user_data`                               | oui, **fermée** (401, `42501`)                   | `migrations/0004_user_data_par_cle.sql` |
| `sync_pull`, `sync_push`, `sync_delete`          | oui (`sync_pull` d'une clé mal formée : `22023`) | `migrations/0004_user_data_par_cle.sql` |

Les refus de `live_match_push` et `_finish` (`P0002`) et le conflit de
`sync_push` (`40001`) arrivent en **HTTP 500** : PostgREST range les classes
`P0` (sauf `P0001`) et `40` parmi les erreurs serveur, là où une entrée refusée
(`22023`) donne 400. L'app ne regarde jamais le statut : la synchro
reconnaît `40001` à son code, et le direct traite tout refus comme un échec.
Dans les journaux de Supabase, ces 500 sont des refus, pas des pannes.

La connexion anonyme est coupée sur le projet (`anonymous_users: false` dans
`/auth/v1/settings`), et c'est très bien ainsi : plus rien ne s'en sert depuis
`0004`.

### `live_matches` après `0003`

- **Aucun accès direct** : ni privilège ni policy pour `anon` et
  `authenticated`. La RLS reste active, sans policy : seconde barrière derrière
  les privilèges.
- **Quatre fonctions `security definer`**, exécutables par `anon` seul : lire
  exige le code exact (`live_match_get`), écrire exige le code **et** le secret
  d'hôte (`live_match_push`, `live_match_finish`). Le secret naît dans la base
  à la création (`live_match_create`), n'est rendu qu'une fois et n'est gardé
  que haché.
- **Une partie finie est gelée**, et **une partie muette depuis 24 h est
  introuvable** ; chaque création purge les parties expirées.
- **Plus de `postgres_changes`** : Realtime rejoue la policy `select` de
  l'abonné avant de livrer, et il n'y en a plus. Le direct passe par Broadcast
  (canal `molkky-live:<code>`), un signal sans données après lequel le
  spectateur relit la base — voir
  [`../docs/live-supabase.md`](../docs/live-supabase.md).

Sous `0002`, la policy `select … using (true)` laissait une seule requête
lister toutes les parties en cours, codes et noms de joueurs compris ; la
policy `update` laissait réécrire les lancers de toute partie non finie à
quiconque en tenait l'`id`, rendu à chaque spectateur ; et rien n'était purgé.

### `user_data` après `0004`

- **La clé de synchro est l'identité** : 28 caractères crockford32 tirés sur
  l'appareil et partagés par QR. Ni compte, ni connexion anonyme. La base n'en
  garde que le haché (SHA-256), clé primaire de la table.
- **Aucun accès direct** pour `anon` ni `authenticated`, RLS active sans
  policy. **Trois fonctions `security definer`**, exécutables par `anon`
  seul, exigent une clé bien formée : `sync_pull` lit, `sync_push` écrit,
  `sync_delete` efface.
- **L'écriture est conditionnelle** : `sync_push` prend la version lue avant la
  fusion, et refuse (`40001`) si un autre appareil a écrit entre-temps.
- **Un an sans échange, et le blob s'efface** : `seen_at` date la dernière
  lecture ou le dernier envoi ; chaque échange purge les blobs expirés, et un
  blob expiré est introuvable d'ici là. La purge passe AVANT l'écriture : une
  clé qui revient après un an lit `null`, envoie en version 0, et doit trouver
  la place libre.

Le SQL que `docs/cloud-sync.md` demandait de coller à la main (une table
indexée par `auth.uid()`, plus la connexion anonyme à activer) n'a jamais été
appliqué, et ne l'est plus nulle part : il ne pouvait rien réunir, chaque
navigateur ayant sa propre identité anonyme.

### Vérifier après une migration

Avec l'URL du projet et sa clé **anonyme** (celle du bundle — jamais la clé
`service_role`). `limit=0` : si la migration n'est pas passée, la sonde ne
ramène quand même aucune ligne.

```bash
# La table ne se lit plus : 401, « permission denied for table live_matches ».
curl -s "$SUPABASE_URL/rest/v1/live_matches?select=code&limit=0" -H "apikey: $ANON_KEY"

# La lecture par code répond, et ne rend rien pour un code inconnu : null.
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/live_match_get" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"p_code":"ZZZZZZ"}'

# Même chose pour la synchro : la table ne se lit pas (401)…
curl -s "$SUPABASE_URL/rest/v1/user_data?select=version&limit=0" -H "apikey: $ANON_KEY"

# … et une clé bien formée qui n'a rien envoyé ne lit rien : null.
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/sync_pull" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"p_key":"0000000000000000000000000000"}'
```

Ensuite, le cycle complet du direct, Realtime compris :
[`../scripts/verify-live-cycle.mjs`](../scripts/verify-live-cycle.mjs) joue
l'hôte et le spectateur avec deux clients, les appels de l'app et les refus
attendus.

```bash
VITE_SUPABASE_URL=https://ajrfrxiwvcmtbzodbwey.supabase.co \
VITE_SUPABASE_ANON_KEY=$(gh variable get VITE_SUPABASE_ANON_KEY -R mister-guiiug/mister-molkky) \
node scripts/verify-live-cycle.mjs
```

Le script refuse toute autre clé que l'anonyme. Il laisse une partie de test,
finie et sans donnée personnelle, introuvable au bout de 24 h et effacée à la
création suivante. Premiers passages le 01/10/2026 : 18 contrôles sur 18 ; le
spectateur relit 0,1 à 0,5 s après chaque signal.

Puis une partie réelle : diffuser depuis un téléphone, suivre depuis un autre,
jouer jusqu'au vainqueur. Le spectateur doit recevoir chaque lancer, **le
lancer gagnant compris**. Et pour la synchro : créer une clé sur un appareil,
la scanner sur un autre, « Envoyer » des deux côtés — chacun doit retrouver
les parties de l'autre.

> **Le cache de schéma de PostgREST.** Il sert ses 404 depuis un cache rechargé
> de façon asynchrone après un DDL : `0003` et `0004` finissent donc par
> `notify pgrst, 'reload schema'`. Si les fonctions répondent encore 404 juste
> après l'application, attendre quelques dizaines de secondes avant de
> chercher ailleurs.

## Vérifier le ping sans attendre le cron

```bash
gh workflow run "Supabase keep-alive" -R mister-guiiug/mister-molkky --ref main
```

Le cron ne passe que tous les trois jours : un correctif qu'on ne déclenche pas
à la main n'est pas vérifié, il est espéré.
