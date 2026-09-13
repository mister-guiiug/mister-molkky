# Supabase — Mister Mölkky

Mister Mölkky fonctionne **entièrement hors ligne**. Supabase n'alimente qu'une
couche optionnelle (le direct multi-appareils) et le ping anti-pause. Ce dossier
décrit l'état de la base du projet hébergé, et **comment le SQL y arrive**.

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
> SQL », et personne ne l'a jamais collé. Il est désormais dans
> `migrations/0002_live_matches.sql`, et le document n'en garde qu'un renvoi —
> deux copies d'un même SQL vieillissent séparément. Après chaque ajout ici,
> **vérifier la base**, pas le dossier.

Les deux migrations de ce dossier ont été appliquées par l'API de gestion
(`POST /v1/projects/<ref>/database/query`), qui ne demande pas le mot de passe
de la base. Le schéma `supabase_migrations` est donc resté **vide** : un futur
`supabase db push` rejouera tout depuis `0001`. C'est pour cela que chaque
migration doit rester rejouable sans effet de bord — ce n'est pas une précaution
théorique, c'est l'état réel du projet.

## État de la base au 13/09/2026

| Objet                                            | En base | Décrit où                          |
| ------------------------------------------------ | ------- | ---------------------------------- |
| `public.keep_alive`                              | **oui** | `migrations/0001_keep_alive.sql`   |
| `public.live_matches`                            | **oui** | `migrations/0002_live_matches.sql` |
| `public.touch_updated_at()`                      | **oui** | `migrations/0002_live_matches.sql` |
| publication `supabase_realtime` → `live_matches` | **oui** | `migrations/0002_live_matches.sql` |

Droits relevés sur `live_matches` après application : RLS active, trois policies
nommant `anon` (`select` ouvert, `insert` ouvert, `update` refusé dès que
`finished_at` est posé), et les seuls privilèges `SELECT`, `INSERT`, `UPDATE`
pour `anon` — `authenticated` n'a **rien**.

### Ce qui a été éprouvé, et comment

Chaque ligne ci-dessous a été jouée sur le projet hébergé sous le rôle `anon`,
puis rejouée par PostgREST avec la vraie clé anonyme — le chemin exact de
l'application. Un « OK » sur zéro ligne n'est pas un succès : ce sont les
**comptes de lignes** qui font foi.

| Geste de l'app                         | Attendu          | Obtenu            |
| -------------------------------------- | ---------------- | ----------------- |
| `createLiveMatch` (insert + returning) | la ligne revient | 201, ligne rendue |
| `joinLiveMatch` (select par code)      | 1 ligne          | 1 ligne           |
| `pushThrows` (update)                  | 1 ligne          | 1 ligne           |
| `pushFinish` (pose `finished_at`)      | **1 ligne**      | 1 ligne           |
| update après la fin                    | 0 ligne          | 0 ligne           |
| `delete`                               | refusé           | `42501`           |
| `truncate`                             | refusé           | `42501`           |
| `updated_at` forgé par le client       | écrasé           | écrasé            |
| livraison Realtime à un spectateur     | l'UPDATE arrive  | reçu              |

La quatrième ligne est celle qui compte : c'est le `with check (true)` explicite
de la policy `update` qui la rend possible. Sans lui, PostgreSQL réutilise le
`using (finished_at is null)` pour contrôler la NOUVELLE ligne, et l'écriture de
fin de partie se refuse elle-même.

Les deux modes d'échec de la RLS se ressemblent et ne se corrigent pas pareil —
éprouvés ici sur une table jetable plutôt que déduits :

| Ce qui bloque                   | Ce qu'on observe                                            |
| ------------------------------- | ----------------------------------------------------------- |
| `using` ne retient pas la ligne | 0 ligne touchée, **aucune erreur** (la 5ᵉ ligne du tableau) |
| `with check` violé              | **lève** `42501 new row violates row-level security policy` |

Le cas du `with check` omis est donc bruyant, pas silencieux : `pushLiveState`
relaie l'erreur et le store affiche une puce. Bruyant au pire moment — le
vainqueur n'atteint jamais les spectateurs.

> **Deux délais de propagation, après un DDL.** PostgREST sert ses 404 depuis un
> cache de schéma rechargé de façon asynchrone (quelques dizaines de secondes).
> Realtime a le sien : la première sonde d'abonnement, lancée juste après
> l'ajout de la table à la publication, s'est abonnée avec succès et n'a **rien
> reçu** pendant 20 s ; la même sonde relancée une minute plus tard a reçu
> l'événement. Un direct muet dans la minute qui suit une migration n'est donc
> pas forcément cassé — le vérifier deux fois avant de chercher ailleurs.

## Vérifier le ping sans attendre le cron

```bash
gh workflow run "Supabase keep-alive" -R mister-guiiug/mister-molkky --ref main
```

Le cron ne passe que tous les trois jours : un correctif qu'on ne déclenche pas
à la main n'est pas vérifié, il est espéré. Compter quelques dizaines de
secondes après un `db push` avant de pinger — PostgREST sert ses 404 depuis un
cache de schéma qu'il recharge de façon asynchrone après un DDL.
