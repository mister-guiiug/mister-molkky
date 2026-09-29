# Supabase — Mister Mölkky

Mister Mölkky fonctionne **entièrement hors ligne**. Supabase n'alimente que deux
couches optionnelles (le direct multi-appareils et la synchro par clé) et le
ping anti-pause. Ce dossier décrit l'état de la base du projet hébergé,
**comment le SQL y arrive**, et où il est éprouvé.

## Comment une migration est appliquée ici

**À la main, pour l'instant.** Ce dépôt n'a pas de workflow
`supabase-migrations.yml`, parce qu'il n'a aucun des secrets qu'il exigerait
(`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`). Un
workflow qui les réclamerait rougirait à chaque poussée sans rien appliquer.

```bash
supabase link --project-ref <ref>   # Project Settings → General → Reference ID
supabase db push
```

> **Un fichier présent n'est pas un fichier appliqué.** C'est la leçon qui a
> coûté trois jours de ping rouge, puis onze jours de direct en panne : le SQL
> du direct a vécu dans [`../docs/live-supabase.md`](../docs/live-supabase.md)
> depuis la naissance du dépôt, avec sa consigne « à coller dans l'éditeur
> SQL », et personne ne l'a jamais collé. Après chaque ajout ici, **vérifier
> la base**, pas le dossier.

`0001` et `0002` ont été appliquées par l'API de gestion
(`POST /v1/projects/<ref>/database/query`), qui ne demande pas le mot de passe
de la base. Le schéma `supabase_migrations` est donc resté **vide** : un futur
`supabase db push` rejouera tout depuis `0001`. C'est pour cela que chaque
migration doit rester rejouable sans effet de bord — ce n'est pas une précaution
théorique, c'est l'état réel du projet.

## Où le SQL est éprouvé : la CI

[`supabase-tests.yml`](../.github/workflows/supabase-tests.yml) démarre une
pile Supabase **jetable**, y applique les migrations depuis zéro — exactement ce
que ferait un `supabase db push` ici — puis joue les tests pgTAP de
[`tests/`](./tests). Aucun secret, rien ne touche le projet hébergé. Le poste
de développement n'a pas de démon Docker : c'est le seul endroit où les
migrations s'exécutent avant la production.

| Fichier                       | Ce qu'il tient                                                                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `structure-securite.test.sql` | aucune table de `public` sans RLS ; les fonctions `security definer` exécutables par `anon` sont exactement la liste relue (le fichier du parc)      |
| `live_matches.test.sql`       | la table fermée à `anon` et `authenticated` ; lire au code, écrire au code et au secret ; la partie finie gelée ; l'expiration et la purge           |
| `user_data.test.sql`          | la table fermée ; une clé ne lit, n'écrit et n'efface que son blob ; l'envoi sur une version périmée refusé sans rien écraser ; les clés mal formées |

Les tests jouent sous `set local role anon` : c'est le rôle que PostgREST prend
pour la clé publiée. Sans lui, la session garde les droits de `postgres`, TOUT
passe, et un test serait vert et faux.

## État de la base

Relevé en lecture seule le 29/09/2026 : `0001` et `0002` sont en base,
**`0003` et `0004` restent à appliquer**.

| Objet                                            | En base                 | Décrit où                               |
| ------------------------------------------------ | ----------------------- | --------------------------------------- |
| `public.keep_alive`                              | oui                     | `migrations/0001_keep_alive.sql`        |
| `public.live_matches`                            | oui                     | `0002`, fermée par `0003`               |
| `public.touch_updated_at()`                      | oui                     | `migrations/0002_live_matches.sql`      |
| publication `supabase_realtime` → `live_matches` | oui, retirée par `0003` | `0002`, `0003`                          |
| `live_match_create`, `_get`, `_push`, `_finish`  | **non**                 | `migrations/0003_live_matches_rpc.sql`  |
| `public.user_data`                               | **non** (404)           | `migrations/0004_user_data_par_cle.sql` |
| `sync_pull`, `sync_push`, `sync_delete`          | **non**                 | `migrations/0004_user_data_par_cle.sql` |

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
- **Pas de purge automatique** : c'est la donnée de l'utilisateur, elle reste
  jusqu'à ce qu'il l'efface depuis l'app.

Le SQL que `docs/cloud-sync.md` demandait de coller à la main (une table
indexée par `auth.uid()`, plus la connexion anonyme à activer) n'a jamais été
appliqué, et ne l'est plus nulle part : il ne pouvait rien réunir, chaque
navigateur ayant sa propre identité anonyme.

### Vérifier après `supabase db push`

Avec l'URL du projet et sa clé **anonyme** (celle du bundle — jamais la clé
`service_role`) :

```bash
# La table ne se lit plus : 401, « permission denied for table live_matches ».
curl -s "$SUPABASE_URL/rest/v1/live_matches?select=code" -H "apikey: $ANON_KEY"

# La lecture par code répond, et ne rend rien pour un code inconnu : null.
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/live_match_get" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"p_code":"ZZZZZZ"}'

# Même chose pour la synchro : la table ne se lit pas (401)…
curl -s "$SUPABASE_URL/rest/v1/user_data?select=version" -H "apikey: $ANON_KEY"

# … et une clé bien formée qui n'a rien envoyé ne lit rien : null.
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/sync_pull" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"p_key":"0000000000000000000000000000"}'
```

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
