-- Mister Mölkky — 0001 — la table du ping anti-pause.
--
-- POURQUOI ELLE EXISTE. Un projet Supabase Free se met en pause après sept
-- jours sans requête. Le workflow `supabase-keepalive.yml` fait donc un SELECT
-- anonyme tous les trois jours pour remettre le compteur à zéro — mais il le
-- faisait sur une table qui n'existait pas, et PostgREST répondait `PGRST205`
-- en HTTP 404 (13/09/2026, et les 07 et 10/09 avant lui). Un 404 n'est pas une
-- requête de base : PostgREST le tranche sur son cache de schéma, sans toucher
-- à Postgres. Le ping ne réveillait donc RIEN, et le rouge périodique était le
-- seul signe que la protection était en trompe-l'œil.
--
-- POURQUOI ELLE EST LA PREMIÈRE MIGRATION D'UN DÉPÔT DÉJÀ ANCIEN. Ce dépôt
-- n'avait pas de dossier `supabase/` : sa base était vide depuis la création du
-- projet le 02/09/2026. Voir `supabase/README.md` pour ce qui reste à appliquer.
--
-- Rejouable sans effet de bord : `if not exists`, `drop policy if exists`, et
-- un insert conditionnel.

create table if not exists public.keep_alive (
  id bigint generated always as identity primary key,
  pinged_at timestamptz not null default now()
);

-- RLS ACTIVÉE MÊME ICI. Sans elle, la table serait en lecture ET en écriture
-- pour n'importe quel porteur de la clé anonyme — qui est publiée dans le
-- bundle de l'application. Avec elle, tout est refusé par défaut, et seule la
-- policy ci-dessous rouvre quelque chose.
alter table public.keep_alive enable row level security;

-- UNE SEULE POLICY, ET ELLE NE COUVRE QUE `select`. Aucune policy `insert`,
-- `update` ou `delete` n'existe, donc la RLS refuse toute écriture par l'API.
drop policy if exists "anon read keep_alive" on public.keep_alive;

create policy "anon read keep_alive" on public.keep_alive for select to anon
using (true);

-- LES PRIVILÈGES SONT REPRIS PUIS REDONNÉS UN PAR UN, ET CE N'EST PAS UNE
-- REDONDANCE AVEC LA POLICY CI-DESSUS. Une policy filtre des LIGNES ; le
-- privilège de table, lui, autorise la COMMANDE — les deux sont nécessaires, et
-- ils tombent pour des raisons indépendantes. Relevé sur ce projet le
-- 13/09/2026 : `anon` et `authenticated` héritaient par défaut de INSERT,
-- UPDATE, DELETE **et TRUNCATE** sur toute nouvelle table de `public`. La seule
-- chose qui empêchait un porteur de la clé anonyme — publiée dans le bundle —
-- d'écrire dans cette table était donc la RLS, à elle seule. Un `alter table …
-- disable row level security` fait un jour par commodité, ou une policy
-- ajoutée trop large, et la table devient publique en écriture sans que rien ne
-- le signale.
--
-- Après ces deux lignes il reste deux barrières indépendantes au lieu d'une, et
-- le ping ne perd rien : il ne fait qu'un SELECT.
--
-- Le `grant` explicite sert en outre à survivre au retrait de l'exposition
-- automatique des nouvelles tables côté Supabase (`auto_expose_new_tables`,
-- supprimé le 30/10/2026 au profit du refus systématique) : sans lui, rejouer
-- cette migration après cette date rendrait `42501` en HTTP 401 — une panne
-- qui ressemble de loin à celle qu'on corrige ici, avec une autre cause.
revoke all on table public.keep_alive from anon, authenticated;

grant select on table public.keep_alive to anon;

-- Une ligne de départ : le SELECT compterait comme activité même à vide, mais
-- une table peuplée rend le dernier ping lisible depuis le tableau de bord.
-- La condition — et non un `on conflict do nothing`, qui ne déclenche jamais
-- sur une clé `identity` — est ce qui rend l'insert rejouable.
insert into public.keep_alive (pinged_at)
select now()
where not exists (select 1 from public.keep_alive);
