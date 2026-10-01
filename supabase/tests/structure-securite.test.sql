-- mister-molkky : trois invariants de sécurité de la base. pgTAP, joué par
-- `supabase test db` sur la pile jetable de la CI.
--
-- 1. Aucune table de `public` sans RLS. Supabase expose `public` à la clé
--    anon du bundle : une table sans RLS y est ouverte à quiconque a cette
--    clé, dans la limite de ses privilèges.
-- 2. Les fonctions SECURITY DEFINER qu'`anon` peut exécuter forment une liste
--    RELUE. Une telle fonction s'exécute sous son propriétaire (`postgres`,
--    qui porte BYPASSRLS) : elle contourne la RLS, et seul son propre
--    contrôle de l'appelant protège les données. Supabase accorde EXECUTE à
--    `anon` sur toute fonction créée dans `public`, par un privilège PAR
--    DÉFAUT, et `revoke … from public` ne le retire pas : il faut nommer
--    `anon`. Une fonction neuve absente de la liste fait échouer ce test :
--    lui retirer `anon`, ou l'ajouter après avoir relu son contrôle de
--    l'appelant.
-- 3. Aucune fonction de `public` ne lève `40001` (`serialization_failure`).
--    PostgREST prend ce code pour un échec de sérialisation passager et
--    rejoue la transaction SANS FIN : la requête ne répond jamais, et le
--    backend tourne jusqu'à ce qu'on le tue (PostgREST 14, corrigé en 16).
--    Un conflit métier se signale par `PT409`, rendu en HTTP 409. Ajouté le
--    01/10/2026, après la boucle provoquée par `sync_push` en production ;
--    à reporter dans les autres applications du parc.
--
-- Le même fichier vit dans chaque application Supabase du parc (29/09/2026).
-- Les tables et fonctions d'une extension ne relèvent pas des migrations :
-- elles sont écartées.

create extension if not exists pgtap with schema extensions;

set search_path to public, extensions;

begin;

select plan(3);

select is_empty(
  $$
    select c.relname::text
      from pg_class c
     where c.relnamespace = 'public'::regnamespace
       and c.relkind in ('r', 'p')
       and not c.relrowsecurity
       and not exists (
         select 1 from pg_depend d
          where d.classid = 'pg_class'::regclass
            and d.objid = c.oid
            and d.deptype = 'e'
       )
  $$,
  'aucune table de public sans RLS'
);

select set_eq(
  $$
    select p.proname::text
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.prokind = 'f'
       and p.prosecdef
       and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
       and has_function_privilege('anon', p.oid, 'execute')
       and not exists (
         select 1 from pg_depend d
          where d.classid = 'pg_proc'::regclass
            and d.objid = p.oid
            and d.deptype = 'e'
       )
  $$,
  array[
    -- Le direct (0003) : le code est une clé. Lire exige le code exact ;
    -- écrire exige le code ET le secret d'hôte, dont la base ne garde que le
    -- haché. Éprouvées une à une dans `live_matches.test.sql`.
    'live_match_create',
    'live_match_finish',
    'live_match_get',
    'live_match_push',
    -- La synchro (0004) : la clé est l'identité. Chaque fonction exige une clé
    -- bien formée et ne touche que le blob de son haché. Éprouvées une à une
    -- dans `user_data.test.sql`.
    'sync_delete',
    'sync_pull',
    'sync_push'
  ],
  'les fonctions SECURITY DEFINER exécutables par anon sont exactement la liste relue'
);

-- Le corps entier est lu, commentaires compris : une fonction qui ne fait que
-- CITER le code échoue aussi. C'est voulu, la règle reste simple à tenir.
select is_empty(
  $$
    select p.proname::text
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.prokind in ('f', 'p')
       and pg_get_functiondef(p.oid) ~* '40001|serialization_failure'
       and not exists (
         select 1 from pg_depend d
          where d.classid = 'pg_proc'::regclass
            and d.objid = p.oid
            and d.deptype = 'e'
       )
  $$,
  'aucune fonction de public ne lève 40001 : PostgREST la rejouerait sans fin'
);

select * from finish();

rollback;
