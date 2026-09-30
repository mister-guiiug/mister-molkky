-- Mister Mölkky — 0004 — la synchro entre appareils, par une clé partagée.
--
-- CE QUI EXISTAIT, ET NE POUVAIT PAS MARCHER. L'écran Réglages proposait une
-- « Sync cloud (multi-appareils) » adossée à la connexion anonyme de Supabase
-- et à une table `user_data` indexée par `auth.uid()`. Relevé du 29/09/2026,
-- en lecture seule : la table n'a jamais existé sur le projet (PostgREST
-- répond 404) et la connexion anonyme y est coupée (`anonymous_users: false`).
-- Rétablir les deux n'aurait rien réuni : une identité anonyme vit dans UN
-- navigateur, chaque appareil aurait eu la sienne — et le client ne gardait
-- même pas sa session (`persistSession: false`), si bien que chaque lancement
-- en créait une neuve. « Récupérer » ne retrouvait rien, même sur le téléphone
-- qui avait envoyé.
--
-- LE MODÈLE : LA CLÉ EST L'IDENTITÉ. Un appareil tire une clé de synchro
-- (28 caractères crockford32, soit 140 bits), l'affiche en QR, et les autres
-- la scannent. Qui détient la clé lit et remplace le blob ; personne d'autre.
-- Ni compte, ni connexion anonyme, ni réglage du tableau de bord.
--   · `anon` et `authenticated` n'ont AUCUN accès direct à la table : ni
--     privilège, ni policy. La RLS est active, sans policy : seconde barrière.
--   · Trois fonctions `security definer` sont la seule porte, et chacune exige
--     la clé. La base n'en garde que le haché : une fuite de la table ne donne
--     accès à aucun blob.
--
-- L'ÉCRITURE EST CONDITIONNELLE. `sync_push` prend la version lue juste avant
-- la fusion, et refuse (`40001`) si un autre appareil a écrit entre-temps :
-- le client relit, refusionne, et renvoie. Sans cela, deux appareils qui
-- envoient au même moment écrasaient l'union de l'autre — exactement la perte
-- que la fusion par identifiant (`src/sync/merge.ts`) devait supprimer.
--
-- UN AN SANS ÉCHANGE, ET LE BLOB S'EFFACE (choix du 30/09/2026). Un échange,
-- c'est une lecture OU un envoi : `seen_at` en garde la date. Chaque échange
-- purge les blobs expirés, et un blob expiré est introuvable d'ici là, purgé
-- ou non. Rien de perdu : le cloud n'est qu'un relais, chaque appareil garde
-- ses propres données, et un envoi recrée le blob. Sans cette borne, le blob
-- d'une clé perdue sur tous les appareils — noms de joueurs compris — serait
-- resté pour toujours, sans que personne ne puisse plus l'effacer. La durée
-- revient en deux endroits de ce fichier, éprouvés dans
-- `supabase/tests/user_data.test.sql`.
--
-- REJOUABLE, comme les migrations précédentes : le schéma
-- `supabase_migrations` du projet est vide.

-- `version` compte les écritures : 1 à la création, +1 à chaque envoi.
-- `seen_at` date le dernier échange, lecture comprise.
create table if not exists public.user_data (
  key_hash bytea primary key,
  payload jsonb not null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);

-- La purge filtre sur `seen_at`.
create index if not exists user_data_seen_at_idx
  on public.user_data (seen_at);

alter table public.user_data enable row level security;

-- Le masque par défaut de `public` donne à `anon` et `authenticated` toutes
-- les commandes, TRUNCATE compris, que la RLS ne couvre pas (voir 0001). Tout
-- est repris, et rien n'est rendu : les fonctions ci-dessous s'exécutent sous
-- leur propriétaire.
revoke all on table public.user_data from anon, authenticated;

-- La forme d'une clé, contrôlée par les trois fonctions : 28 caractères de
-- l'alphabet de Crockford, sans I, L, O ni U — ce que tire le socle
-- `/pairing`, normalisé par le client avant l'envoi. Une clé courte ou
-- choisie à la main serait devinable : elle est refusée (`22023`).

-- LIRE. Le blob, sa version et sa date, à qui donne la clé ; `null` si la clé
-- n'a encore rien envoyé, si son blob a été effacé, ou s'il a expiré. Une
-- lecture est un échange : elle purge les blobs expirés, puis remet le
-- compteur de celui-ci à zéro — d'où `volatile`, et un `update … returning`
-- au lieu d'un `select`.
create or replace function public.sync_pull(p_key text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_key is null or p_key !~ '^[0-9A-HJKMNP-TV-Z]{28}$' then
    raise exception 'sync: invalid key' using errcode = '22023';
  end if;

  delete from public.user_data
   where seen_at < now() - interval '365 days';

  update public.user_data d
     set seen_at = now()
   where d.key_hash = sha256(convert_to(p_key, 'UTF8'))
  returning jsonb_build_object(
              'payload', d.payload,
              'version', d.version,
              'updated_at', d.updated_at
            )
    into v_result;

  return v_result;
end;
$$;

-- ÉCRIRE, À CONDITION. `p_version` est la version lue avant la fusion, 0 si
-- rien n'était encore écrit. La ligne n'est créée ou remplacée que si elle
-- en est toujours là ; sinon `40001`, et rien n'est écrit. Deux créations
-- simultanées se départagent par la clé primaire (`on conflict do nothing`),
-- deux remplacements par le verrou de ligne : le second relit la version
-- après le premier et ne la trouve plus.
--
-- LA PURGE PASSE AVANT L'ÉCRITURE. Une clé qui revient après un an lit
-- `null` et envoie donc en version 0 : si son vieux blob attendait encore la
-- purge, l'insertion buterait sur la clé primaire, et le client relirait
-- `null` et buterait encore — trois conflits, puis une erreur à l'écran.
--
-- La borne de taille est large — deux cents parties d'une quarantaine de Kio
-- chacune — et sert seulement à ce qu'une clé publique ne puisse pas déposer
-- n'importe quel volume.
create or replace function public.sync_push(
  p_key text,
  p_payload jsonb,
  p_version bigint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hash bytea;
  v_version bigint;
  v_updated_at timestamptz;
begin
  if p_key is null or p_key !~ '^[0-9A-HJKMNP-TV-Z]{28}$' then
    raise exception 'sync: invalid key' using errcode = '22023';
  end if;
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or octet_length(p_payload::text) > 8388608 then
    raise exception 'sync: invalid payload' using errcode = '22023';
  end if;
  if p_version is null or p_version < 0 then
    raise exception 'sync: invalid version' using errcode = '22023';
  end if;

  delete from public.user_data
   where seen_at < now() - interval '365 days';

  v_hash := sha256(convert_to(p_key, 'UTF8'));

  if p_version = 0 then
    insert into public.user_data (key_hash, payload)
    values (v_hash, p_payload)
    on conflict (key_hash) do nothing
    returning version, updated_at into v_version, v_updated_at;
  else
    update public.user_data
       set payload = p_payload,
           version = version + 1,
           updated_at = now(),
           seen_at = now()
     where key_hash = v_hash
       and version = p_version
    returning version, updated_at into v_version, v_updated_at;
  end if;

  if v_version is null then
    raise exception 'sync: version conflict' using errcode = '40001';
  end if;

  return jsonb_build_object('version', v_version, 'updated_at', v_updated_at);
end;
$$;

-- EFFACER. Le blob de la clé, s'il existe ; `true` s'il y en avait un. Un
-- autre appareil qui garde la clé peut en recréer un en envoyant : l'écran le
-- dit au moment d'effacer.
create or replace function public.sync_delete(p_key text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_key is null or p_key !~ '^[0-9A-HJKMNP-TV-Z]{28}$' then
    raise exception 'sync: invalid key' using errcode = '22023';
  end if;

  delete from public.user_data
   where key_hash = sha256(convert_to(p_key, 'UTF8'));

  return found;
end;
$$;

-- LES DROITS D'EXÉCUTION, sur le modèle de 0003 : tout est repris à `public`,
-- `anon` et `authenticated` — qu'une fonction neuve de `public` reçoit d'office
-- — puis rendu à `anon` seul. Ce dépôt n'a pas de compte. Chaque fonction
-- contrôle son appelant par la clé : c'est ce contrôle, relu dans
-- `supabase/tests/structure-securite.test.sql`, qui autorise `anon`.
revoke all on function public.sync_pull(text)
  from public, anon, authenticated;
revoke all on function public.sync_push(text, jsonb, bigint)
  from public, anon, authenticated;
revoke all on function public.sync_delete(text)
  from public, anon, authenticated;

grant execute on function public.sync_pull(text) to anon;
grant execute on function public.sync_push(text, jsonb, bigint) to anon;
grant execute on function public.sync_delete(text) to anon;

-- Sans ce signal, PostgREST servirait des 404 le temps de recharger son cache
-- de schéma de lui-même (voir 0003).
notify pgrst, 'reload schema';
