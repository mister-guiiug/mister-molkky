-- Mister Mölkky — 0003 — le direct ne se lit plus qu'avec son code.
--
-- LE DÉFAUT CORRIGÉ. Sous 0002, `live_matches` était lisible par tout porteur
-- de la clé anonyme — publiée dans le bundle — par la policy
-- `select … using (true)` : une seule requête listait toutes les parties,
-- codes et noms de joueurs compris. La policy `update` laissait en outre
-- réécrire les lancers de n'importe quelle partie en cours, et l'`id` qu'il
-- fallait pour viser la ligne était justement rendu à chaque spectateur. Et
-- rien n'était jamais purgé. Relevé en lecture seule sur le projet hébergé le
-- 29/09/2026.
--
-- LE MODÈLE, DÉSORMAIS : LE CODE EST UNE CLÉ.
--   · `anon` et `authenticated` n'ont plus AUCUN accès direct à la table : ni
--     privilège, ni policy. La RLS reste active et sans policy : seconde
--     barrière, si un privilège revenait un jour par mégarde.
--   · Quatre fonctions `security definer` sont la seule porte. Lire exige le
--     code ; écrire exige le code ET le secret d'hôte.
--   · Le secret d'hôte naît dans la base, n'est rendu qu'une fois — à l'hôte,
--     à la création — et n'est conservé que haché.
--
-- POURQUOI DES FONCTIONS ET PAS UNE POLICY. Une policy filtre les lignes selon
-- ce qu'elles contiennent, jamais selon ce que le client a demandé : elle ne
-- peut pas exiger qu'on ait filtré sur `code`. Une fonction qui prend le code
-- en argument, si.
--
-- CE QUE ÇA COÛTE AU TEMPS RÉEL. Realtime rejoue la policy `select` sous le
-- rôle de l'abonné avant de livrer chaque changement (`postgres_changes`) :
-- sans lecture ouverte, plus rien n'arrive aux spectateurs. Le direct passe
-- donc par Broadcast : après chaque écriture, l'hôte émet un signal sur le
-- canal `molkky-live:<code>`, et chaque spectateur relit l'état par
-- `live_match_get`. Le signal ne porte AUCUNE donnée : un porteur du code qui
-- en forgerait un ne provoquerait qu'une relecture de la base. La table quitte
-- donc la publication `supabase_realtime`, où elle ne servait plus à rien.
--
-- LA PURGE, À L'ÉCRITURE. Une partie disparaît 24 h après sa dernière
-- écriture. Le ménage a lieu à chaque création de partie — la seule écriture
-- qui fait grossir la table — et les trois autres fonctions ignorent déjà une
-- ligne expirée qui attendrait encore son ménage : la borne tient même si
-- personne ne crée de partie pendant des semaines. Pas de pg_cron : une
-- extension à activer et une tâche à surveiller, pour un ménage que la
-- création fait aussi bien. La même durée revient en cinq endroits de ce
-- fichier, et `supabase/tests/live_matches.test.sql` les éprouve tous.
--
-- REJOUABLE, comme 0001 et 0002 : le schéma `supabase_migrations` du projet
-- est vide, et un futur `supabase db push` rejouera tout depuis 0001.

-- Le haché du secret d'hôte. Nul pour les lignes nées sous 0002 : elles n'ont
-- pas de secret, ne sont donc plus modifiables par personne, et partent avec
-- la purge.
alter table public.live_matches
  add column if not exists host_token_hash bytea;

-- La purge et l'expiration filtrent sur `updated_at`.
create index if not exists live_matches_updated_at_idx
  on public.live_matches (updated_at);

-- PLUS AUCUN ACCÈS DIRECT. Les trois policies de 0002, plus les trois noms du
-- document d'origine qu'un tableau de bord a pu recevoir à la main.
drop policy if exists "anon read live_matches" on public.live_matches;
drop policy if exists "anon create live_matches" on public.live_matches;
drop policy if exists "anon update live_matches" on public.live_matches;
drop policy if exists "anon can read live matches" on public.live_matches;
drop policy if exists "anon can insert live matches" on public.live_matches;
drop policy if exists "anon can update live matches" on public.live_matches;

revoke all on table public.live_matches from anon, authenticated;

-- Déjà posée par 0002, redite pour qu'aucun rejeu partiel ne la laisse
-- tomber : sans policy, la RLS refuse tout à qui n'a pas BYPASSRLS.
alter table public.live_matches enable row level security;

-- Le pendant exact du bloc de 0002 : `drop table` n'a pas de forme
-- `if exists` dans une publication et lèverait au second passage.
do $$
begin
  if exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'live_matches'
  ) then
    alter publication supabase_realtime drop table public.live_matches;
  end if;
end;
$$;

-- `search_path` figé à vide dans les quatre fonctions, pour la raison donnée
-- dans 0002 à `touch_updated_at` : tout ce qu'elles appellent vit dans
-- `pg_catalog`, qui reste implicitement en tête. `uuid_send` rend les 16
-- octets du secret, que `sha256` hache.

-- CRÉER. L'hôte fournit le code (tiré par le socle `/pairing`, crockford32) et
-- l'état de départ ; la base rend le secret d'hôte, et ne le rendra plus
-- jamais. Un code déjà pris lève `23505` : le client en tire un autre.
--
-- Les bornes de taille sont larges — seize joueurs sur soixante tours, soit
-- 960 lancers d'environ 235 octets, font quelque 220 Kio, moins de la moitié
-- de la borne — et servent seulement à ce qu'une clé publique ne puisse pas
-- déposer n'importe quel volume.
create or replace function public.live_match_create(
  p_code text,
  p_config jsonb,
  p_throws jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token uuid := gen_random_uuid();
begin
  if p_code is null or p_code !~ '^[0-9A-Z]{6}$' then
    raise exception 'live match: invalid code' using errcode = '22023';
  end if;
  if p_config is null
     or jsonb_typeof(p_config) <> 'object'
     or octet_length(p_config::text) > 65536 then
    raise exception 'live match: invalid config' using errcode = '22023';
  end if;
  if p_throws is null
     or jsonb_typeof(p_throws) <> 'array'
     or octet_length(p_throws::text) > 524288 then
    raise exception 'live match: invalid throws' using errcode = '22023';
  end if;

  delete from public.live_matches
   where updated_at < now() - interval '24 hours';

  insert into public.live_matches (code, config, throws, host_token_hash)
  values (p_code, p_config, p_throws, sha256(uuid_send(v_token)));

  return v_token;
end;
$$;

-- LIRE. L'état d'une partie, à qui en donne le code exact — ni `id` ni secret
-- dans la réponse. Une partie expirée est introuvable, purgée ou non. `null`
-- quand rien ne correspond : le client essaie alors son code suivant.
create or replace function public.live_match_get(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'code', m.code,
           'config', m.config,
           'throws', m.throws,
           'winner_id', m.winner_id,
           'started_at', m.started_at,
           'updated_at', m.updated_at,
           'finished_at', m.finished_at
         )
    from public.live_matches m
   where m.code = p_code
     and m.updated_at >= now() - interval '24 hours'
$$;

-- POUSSER LES LANCERS. Le code ET le secret, sur une partie ni finie ni
-- expirée. Toute autre combinaison lève `P0002` — PostgREST rend 404 — sans
-- dire laquelle des conditions a manqué. Lever plutôt que toucher zéro ligne
-- en silence : `pushThrows` relaie l'erreur, et le store affiche une puce.
create or replace function public.live_match_push(
  p_code text,
  p_host_token uuid,
  p_throws jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_throws is null
     or jsonb_typeof(p_throws) <> 'array'
     or octet_length(p_throws::text) > 524288 then
    raise exception 'live match: invalid throws' using errcode = '22023';
  end if;

  update public.live_matches
     set throws = p_throws
   where code = p_code
     and host_token_hash = sha256(uuid_send(p_host_token))
     and finished_at is null
     and updated_at >= now() - interval '24 hours';

  if not found then
    raise exception 'live match: not found' using errcode = 'P0002';
  end if;
end;
$$;

-- CLORE. Les derniers lancers, le vainqueur et l'heure de fin, d'un seul
-- geste, puis la partie est gelée — plus rien ne l'écrit.
--
-- LES LANCERS VOYAGENT AUSSI ICI, et c'est la correction d'un trou. Le lancer
-- gagnant fait passer la partie de `current` à l'historique dans le même rendu
-- React : l'effet qui recopie `current.throws` ne voyait jamais ce dernier
-- lancer, et les spectateurs recevaient le vainqueur sans le coup qui l'avait
-- fait gagner. `finished_at` vient de la base, pas de l'horloge de l'hôte.
create or replace function public.live_match_finish(
  p_code text,
  p_host_token uuid,
  p_throws jsonb,
  p_winner_id text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_throws is null
     or jsonb_typeof(p_throws) <> 'array'
     or octet_length(p_throws::text) > 524288 then
    raise exception 'live match: invalid throws' using errcode = '22023';
  end if;
  if p_winner_id is null
     or length(p_winner_id) = 0
     or length(p_winner_id) > 100 then
    raise exception 'live match: invalid winner' using errcode = '22023';
  end if;

  update public.live_matches
     set throws = p_throws,
         winner_id = p_winner_id,
         finished_at = now()
   where code = p_code
     and host_token_hash = sha256(uuid_send(p_host_token))
     and finished_at is null
     and updated_at >= now() - interval '24 hours';

  if not found then
    raise exception 'live match: not found' using errcode = 'P0002';
  end if;
end;
$$;

-- LES DROITS D'EXÉCUTION. Toute fonction neuve de `public` est exécutable par
-- `anon` ET `authenticated` d'office — par un privilège PAR DÉFAUT de
-- Supabase, que `revoke … from public` ne retire pas : il faut nommer les
-- rôles. On reprend tout, puis on rend à `anon` seul, comme la table sous
-- 0002 : ce dépôt n'a pas de compte, et un rôle qui n'existe pas dans
-- l'application ne doit rien pouvoir. Chacune de ces fonctions contrôle son
-- appelant par ce qu'il sait (le code, le secret) : c'est ce contrôle, relu
-- dans `supabase/tests/structure-securite.test.sql`, qui autorise `anon`.
revoke all on function public.live_match_create(text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.live_match_get(text)
  from public, anon, authenticated;
revoke all on function public.live_match_push(text, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.live_match_finish(text, uuid, jsonb, text)
  from public, anon, authenticated;

grant execute on function public.live_match_create(text, jsonb, jsonb) to anon;
grant execute on function public.live_match_get(text) to anon;
grant execute on function public.live_match_push(text, uuid, jsonb) to anon;
grant execute on function public.live_match_finish(text, uuid, jsonb, text)
  to anon;

-- Le premier ménage, sans attendre la prochaine création : la table n'a
-- jamais été purgée depuis 0002. Rejouable, puisqu'il ne retire que ce qui est
-- déjà expiré.
delete from public.live_matches
 where updated_at < now() - interval '24 hours';

-- PostgREST sert ses routes depuis un cache de schéma ; sans ce signal, les
-- quatre fonctions répondraient 404 le temps qu'il se recharge de lui-même.
notify pgrst, 'reload schema';
