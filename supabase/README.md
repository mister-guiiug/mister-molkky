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
> coûté trois jours de ping rouge : le SQL du direct vit dans
> [`../docs/live-supabase.md`](../docs/live-supabase.md) depuis la naissance du
> dépôt, avec sa consigne « à coller dans l'éditeur SQL », et personne ne l'a
> jamais collé. Après chaque ajout ici, **vérifier la base**, pas le dossier.

## État de la base au 13/09/2026

| Objet                 | En base | Décrit où                                 |
| --------------------- | ------- | ----------------------------------------- |
| `public.keep_alive`   | **oui** | `migrations/0001_keep_alive.sql`          |
| `public.live_matches` | **non** | `docs/live-supabase.md` (hors migrations) |

`live_matches` absente signifie que **le direct ne peut pas fonctionner en
production** : l'hôte échoue à créer la partie. Le ping anti-pause n'était que
le messager — le relevé du 13/09 a trouvé la base entièrement vide. Décrire
cette table en migration est le correctif de fond, hors du périmètre de ce
changement-ci.

## Vérifier le ping sans attendre le cron

```bash
gh workflow run "Supabase keep-alive" -R mister-guiiug/mister-molkky --ref main
```

Le cron ne passe que tous les trois jours : un correctif qu'on ne déclenche pas
à la main n'est pas vérifié, il est espéré. Compter quelques dizaines de
secondes après un `db push` avant de pinger — PostgREST sert ses 404 depuis un
cache de schéma qu'il recharge de façon asynchrone après un DDL.
