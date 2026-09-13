-- Mister Mölkky — 0002 — la table du direct multi-appareils.
--
-- POURQUOI ELLE ARRIVE SI TARD. Son SQL existait depuis la naissance du dépôt,
-- mais dans `docs/live-supabase.md`, sous la consigne « à coller dans l'éditeur
-- SQL du tableau de bord ». Personne ne l'a jamais collé : le relevé du
-- 13/09/2026 a trouvé la base du projet entièrement vide depuis sa création le
-- 02/09, et le direct échouait donc en production dès le premier geste — l'hôte
-- ne parvenait pas à créer la partie. Un fichier présent n'est pas un fichier
-- appliqué, et un fichier qu'aucun outil ne lit ne le sera jamais : c'est pour
-- cela que ce SQL déménage ici, et que le document ne le porte plus.
--
-- REJOUABLE, ET CE N'EST PAS UNE COQUETTERIE. Le schéma `supabase_migrations`
-- de ce projet est VIDE (relevé du 13/09) : les deux migrations de ce dossier y
-- ont été posées par l'API de gestion, hors historique. Le jour où quelqu'un
-- lancera `supabase db push`, la CLI ne trouvera aucune trace et les rejouera
-- TOUTES depuis le début. Chaque instruction ci-dessous doit donc survivre à un
-- second passage : `if not exists`, `drop policy if exists`, `or replace`, et un
-- bloc `do $$` pour la publication (cf. plus bas).

-- La ligne est la source de vérité tant que la partie est en cours ; une fois
-- terminée, l'hôte la recopie dans son historique local. `gen_random_uuid()`
-- vient du cœur de Postgres depuis la 13 (le projet est en 17.6) : inutile de
-- qualifier `extensions.`, contrairement aux fonctions de pgcrypto.
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

-- `updated_at` est tenu par la base, jamais par le client : le trigger l'écrase
-- à chaque écriture. Sans lui, un hôte à l'horloge fausse — ou malveillant —
-- déciderait de la fraîcheur que lisent les spectateurs.
--
-- `INSERT OR UPDATE`, ET PAS SEULEMENT `UPDATE`. La valeur par défaut de la
-- colonne ne protège de rien : un défaut ne s'applique qu'à la colonne ABSENTE
-- de l'insert, donc un client qui envoie `updated_at` la pose telle quelle. Le
-- document d'origine ne couvrait que l'UPDATE ; la sonde du 13/09 l'a confirmé
-- en faisant accepter un `updated_at` daté de l'an 2000 à la création.
--
-- `search_path` FIGÉ À VIDE. Une fonction sans `search_path` explicite prend
-- celui de l'appelant : n'importe qui pouvant créer un schéma peut alors lui
-- faire résoudre un autre `now()`. Le vide suffit ici parce que `pg_catalog`
-- reste implicitement en tête — c'est justement pourquoi il vaut mieux que
-- `public`, qui mettrait au passage les fonctions du schéma `extensions` hors
-- de portée si cette fonction venait à en appeler une.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists live_matches_touch on public.live_matches;

create trigger live_matches_touch
  before insert or update on public.live_matches
  for each row execute function public.touch_updated_at();

-- LE DIRECT EST LA PUBLICATION, PAS LA TABLE. Sans cette ligne, les écritures
-- de l'hôte arrivent bien en base mais aucun spectateur n'est réveillé : le
-- canal `postgres_changes` reste silencieux et le tableau de score se fige sans
-- un mot d'erreur. `alter publication … add table` n'a pas de forme
-- `if not exists` et rend `42710` au second passage, ce qui interromprait tout
-- rejeu de cette migration : le test sur `pg_publication_tables` est ce qui la
-- rend rejouable. La publication `supabase_realtime`, elle, existe déjà sur tout
-- projet hébergé (vérifié ici le 13/09 : présente, et vide).
do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'live_matches'
  ) then
    alter publication supabase_realtime add table public.live_matches;
  end if;
end;
$$;

alter table public.live_matches enable row level security;

drop policy if exists "anon read live_matches" on public.live_matches;
drop policy if exists "anon create live_matches" on public.live_matches;
drop policy if exists "anon update live_matches" on public.live_matches;
-- Les trois noms du document d'origine, que ce dépôt n'a jamais appliqués mais
-- qu'un tableau de bord a pu recevoir à la main : les retirer évite que deux
-- policies permissives ne se combinent par OU et n'annulent le resserrement
-- ci-dessous.
drop policy if exists "anon can read live matches" on public.live_matches;
drop policy if exists "anon can insert live matches" on public.live_matches;
drop policy if exists "anon can update live matches" on public.live_matches;

-- LECTURE OUVERTE, ET IL FAUT LE DIRE PLUTÔT QUE LE CROIRE. Le document
-- affirmait que « le code à 6 caractères suffit à garder l'accès » : c'est FAUX
-- avec cette policy, et aucune policy ne peut le rendre vrai. Une policy filtre
-- des lignes selon ce que la ligne contient, pas selon ce que le client a
-- demandé : elle ne peut pas exiger qu'on ait filtré sur `code`. Un porteur de
-- la clé anonyme — publiée dans le bundle — peut donc énumérer les parties en
-- cours, codes et noms de joueurs compris.
--
-- On la garde quand même, parce que le direct en dépend deux fois : l'insert de
-- l'hôte renvoie `id, code` (un RETURNING exige le droit de lire), et Realtime
-- rejoue cette policy sous le rôle `anon` avant de livrer chaque UPDATE — sans
-- elle, le canal se connecte et ne délivre rien.
--
-- La fermer VRAIMENT demanderait de changer l'application, pas la base : lecture
-- par fonction `security definer` prenant le code en argument, et un secret
-- d'hôte pour distinguer l'hôte du spectateur — qui reçoit aujourd'hui l'`id`
-- complet dans sa réponse de jointure. Hors périmètre ici, et à faire avant que
-- le direct ne serve à autre chose qu'une partie entre amis.
create policy "anon read live_matches" on public.live_matches for select to anon
using (true);

create policy "anon create live_matches" on public.live_matches for insert to anon
with check (true);

-- UNE PARTIE TERMINÉE EST GELÉE. `using` porte sur l'ANCIENNE ligne : une ligne
-- dont `finished_at` est déjà posé n'est plus modifiable par personne, ce qui
-- protège le résultat d'une partie finie et rejoint au niveau de la base la
-- garde `status === 'finished'` du store.
--
-- `with check (true)` EST OBLIGATOIRE, ET CE N'EST PAS UNE REDONDANCE. Omis,
-- PostgreSQL réutilise l'expression du `using` comme contrôle de la NOUVELLE
-- ligne : l'écriture de fin de partie — celle qui pose justement `finished_at` —
-- se refuserait elle-même.
--
-- Éprouvé le 13/09/2026 sur une table jetable, parce que les deux modes d'échec
-- de la RLS se confondent facilement et qu'ils ne se corrigent pas pareil : un
-- `using` qui ne retient pas la ligne la rend invisible et l'update touche zéro
-- ligne **sans erreur** ; un `with check` violé, lui, LÈVE — ici
-- `42501 new row violates row-level security policy`. C'est donc le second, et
-- l'échec serait bruyant : `pushLiveState` relaie l'erreur et le store affiche
-- une puce. Bruyant, mais au pire moment — le vainqueur n'atteindrait jamais
-- les spectateurs.
create policy "anon update live_matches" on public.live_matches for update to anon
using (finished_at is null)
with check (true);

-- LES PRIVILÈGES DE TABLE, EN PLUS DES POLICIES. Une policy filtre des LIGNES ;
-- le privilège autorise la COMMANDE. Relevé sur ce projet le 13/09/2026, le
-- masque hérité par défaut pour `anon` et `authenticated` sur toute nouvelle
-- table de `public` est `arwdDxtm` — soit INSERT, SELECT, UPDATE, DELETE,
-- **TRUNCATE**, REFERENCES, TRIGGER et MAINTAIN. Or la RLS ne couvre PAS
-- `truncate` : sans la reprise ci-dessous, n'importe quel porteur de la clé
-- anonyme peut vider la table d'un coup, quelles que soient les policies.
--
-- `delete` n'est pas rendu : l'application n'en émet aucun, et les parties
-- finies doivent le rester. `authenticated` ne reçoit rien du tout — ce dépôt
-- n'a pas de compte (`[auth] enabled = false`), et un rôle qui n'existe pas dans
-- l'application ne doit rien pouvoir.
revoke all on table public.live_matches from anon, authenticated;

grant select, insert, update on table public.live_matches to anon;

-- CE QUI N'EST PAS ICI : le ménage. Les lignes s'accumulent sans limite, et un
-- projet Free a un quota de base. Le document d'origine proposait un
-- `delete … where started_at < now() - interval '24 hours'` par pg_cron ; il n'a
-- pas sa place dans une migration rejouable, et personne ne l'a planifié. À
-- reprendre le jour où le volume compte — aujourd'hui la table est vide.
