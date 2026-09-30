-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Le direct — pgTAP. Lancement : `supabase test db`, sur la pile jetable   ║
-- ║ de la CI (`supabase-tests.yml`) : le poste n'a pas de démon Docker.      ║
-- ║                                                                          ║
-- ║ CE QUE CES TESTS PROUVENT, et qu'une relecture de 0003 ne prouve pas :   ║
-- ║ la table est fermée à la clé anonyme ; le code suffit pour lire et ne    ║
-- ║ suffit pas pour écrire ; une partie finie est gelée ; une partie muette  ║
-- ║ depuis 24 h n'est plus lisible, et la création suivante la purge.        ║
-- ║                                                                          ║
-- ║ `set local role anon` : c'est le rôle que PostgREST prend pour la clé    ║
-- ║ publiée. Sans lui, la session garde les droits de `postgres` et TOUT     ║
-- ║ passe — le test serait vert et faux.                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

begin;
select plan(41);

-- ── La table est fermée ───────────────────────────────────────────────────

set local role anon;

select throws_ok(
  $$ select count(*) from public.live_matches $$,
  '42501', null,
  'anon ne peut plus lire la table : fini, l''énumération des parties'
);
select throws_ok(
  $$ insert into public.live_matches (code, config) values ('ZZZZZZ', '{}') $$,
  '42501', null,
  'ni y insérer une ligne sans passer par la création'
);
select throws_ok(
  $$ update public.live_matches set throws = '[]' $$,
  '42501', null,
  'ni réécrire les lancers d''une partie'
);
select throws_ok(
  $$ delete from public.live_matches $$,
  '42501', null,
  'ni effacer'
);
select throws_ok(
  $$ truncate public.live_matches $$,
  '42501', null,
  'ni vider la table, ce que la RLS ne couvre pas'
);

reset role;
set local role authenticated;

select throws_ok(
  $$ select count(*) from public.live_matches $$,
  '42501', null,
  'authenticated non plus : ce dépôt n''a pas de compte'
);

reset role;

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'live_matches'),
  0,
  'plus aucune policy sur la table'
);
select ok(
  (select relrowsecurity from pg_class
    where oid = 'public.live_matches'::regclass),
  'et la RLS reste active : sans policy, seconde barrière derrière les privilèges'
);
select is_empty(
  $$ select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'live_matches' $$,
  'la table a quitté la publication Realtime : le direct passe par Broadcast'
);

select ok(
  has_function_privilege('anon', 'public.live_match_create(text, jsonb, jsonb)', 'execute')
  and has_function_privilege('anon', 'public.live_match_get(text)', 'execute')
  and has_function_privilege('anon', 'public.live_match_push(text, uuid, jsonb)', 'execute')
  and has_function_privilege('anon', 'public.live_match_finish(text, uuid, jsonb, text)', 'execute'),
  'anon exécute les quatre portes du direct'
);
select ok(
  not has_function_privilege('authenticated', 'public.live_match_create(text, jsonb, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.live_match_get(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.live_match_push(text, uuid, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.live_match_finish(text, uuid, jsonb, text)', 'execute'),
  'authenticated n''en exécute aucune'
);

-- ── Le chemin de l'application, sous la clé publique ──────────────────────

set local role anon;

-- Le secret rendu à l'hôte est gardé dans un réglage de la transaction, pour
-- les écritures qui suivent.
select ok(
  set_config(
    'test.hote',
    public.live_match_create(
      'MZ7K2A',
      '{"players":[{"id":"p1","name":"Alice"},{"id":"p2","name":"Bob"}]}',
      '[]'
    )::text,
    true
  ) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  'l''hôte crée une partie, et la base lui rend son secret'
);

select is(
  public.live_match_get('MZ7K2A') -> 'config' -> 'players' -> 0 ->> 'name',
  'Alice',
  'le porteur du code lit la partie'
);
select ok(
  not (public.live_match_get('MZ7K2A') ?| array['id', 'host_token_hash']),
  'la réponse ne porte ni l''id ni le secret'
);
select is(
  public.live_match_get('MZ7K2B'),
  null,
  'un code voisin ne lit rien'
);

select lives_ok(
  format(
    $$ select public.live_match_push('MZ7K2A', %L, '[{"id":"t1","playerId":"p1"}]') $$,
    current_setting('test.hote')
  ),
  'l''hôte pousse ses lancers'
);
select is(
  jsonb_array_length(public.live_match_get('MZ7K2A') -> 'throws'),
  1,
  'et le spectateur les lit'
);
select throws_ok(
  $$ select public.live_match_push('MZ7K2A', gen_random_uuid(), '[]') $$,
  'P0002', null,
  'le code seul ne suffit pas pour écrire : il faut le secret d''hôte'
);
select throws_ok(
  $$ select public.live_match_push('MZ7K2A', null, '[]') $$,
  'P0002', null,
  'sans secret non plus'
);
select is(
  jsonb_array_length(public.live_match_get('MZ7K2A') -> 'throws'),
  1,
  'et les lancers de l''hôte sont intacts'
);

select throws_ok(
  $$ select public.live_match_create('MZ7K2A', '{}', '[]') $$,
  '23505', null,
  'un code déjà pris lève 23505 : le client en tire un autre'
);
select throws_ok(
  $$ select public.live_match_create('mz7k2a', '{}', '[]') $$,
  '22023', null,
  'un code hors format est refusé'
);
select throws_ok(
  $$ select public.live_match_create('MZ7K2C', '[]', '[]') $$,
  '22023', null,
  'une configuration qui n''est pas un objet est refusée'
);
select throws_ok(
  $$ select public.live_match_create('MZ7K2C', '{}', '{}') $$,
  '22023', null,
  'des lancers qui ne sont pas une liste sont refusés'
);
select throws_ok(
  $$ select public.live_match_create(
       'MZ7K2C',
       '{}',
       (select jsonb_agg(repeat('x', 1024)) from generate_series(1, 600))
     ) $$,
  '22023', null,
  'un volume démesuré est refusé'
);

select throws_ok(
  format(
    $$ select public.live_match_finish('MZ7K2A', %L, '[]', '') $$,
    current_setting('test.hote')
  ),
  '22023', null,
  'un vainqueur vide est refusé'
);
select lives_ok(
  format(
    $$ select public.live_match_finish(
         'MZ7K2A', %L,
         '[{"id":"t1","playerId":"p1"},{"id":"t2","playerId":"p2"}]',
         'p2'
       ) $$,
    current_setting('test.hote')
  ),
  'l''hôte clôt la partie'
);
select is(
  public.live_match_get('MZ7K2A') ->> 'winner_id',
  'p2',
  'le vainqueur est lisible'
);
select is(
  jsonb_array_length(public.live_match_get('MZ7K2A') -> 'throws'),
  2,
  'avec le lancer gagnant, qui voyage avec la clôture'
);
select isnt(
  public.live_match_get('MZ7K2A') ->> 'finished_at',
  null,
  'l''heure de fin est posée par la base'
);
select throws_ok(
  format(
    $$ select public.live_match_push('MZ7K2A', %L, '[]') $$,
    current_setting('test.hote')
  ),
  'P0002', null,
  'une partie finie est gelée, même pour son hôte'
);
select throws_ok(
  format(
    $$ select public.live_match_finish('MZ7K2A', %L, '[]', 'p1') $$,
    current_setting('test.hote')
  ),
  'P0002', null,
  'et son vainqueur ne se réécrit pas'
);

reset role;

select is(
  (select host_token_hash from public.live_matches where code = 'MZ7K2A'),
  sha256(uuid_send(current_setting('test.hote')::uuid)),
  'la base ne garde du secret que son haché'
);

-- ── L'expiration et la purge ──────────────────────────────────────────────
--
-- Deux parties d'un autre âge. Le trigger de 0002 écrase `updated_at` à chaque
-- écriture — c'est tout son rôle — : on le suspend le temps de les antidater.

alter table public.live_matches disable trigger live_matches_touch;
insert into public.live_matches (code, config, host_token_hash, updated_at)
values
  ('VIEUX1', '{}',
   sha256(uuid_send('00000000-0000-4000-8000-000000000001'::uuid)),
   now() - interval '25 hours'),
  ('RECENT', '{}',
   sha256(uuid_send('00000000-0000-4000-8000-000000000002'::uuid)),
   now() - interval '23 hours');
alter table public.live_matches enable trigger live_matches_touch;

set local role anon;

select is(
  public.live_match_get('VIEUX1'),
  null,
  'muette depuis plus de 24 h, une partie est introuvable, purgée ou non'
);
select isnt(
  public.live_match_get('RECENT'),
  null,
  'à 23 h, elle se lit encore'
);
select throws_ok(
  $$ select public.live_match_push(
       'VIEUX1', '00000000-0000-4000-8000-000000000001', '[]') $$,
  'P0002', null,
  'expirée, elle ne s''écrit plus, même avec son secret'
);
select throws_ok(
  $$ select public.live_match_finish(
       'VIEUX1', '00000000-0000-4000-8000-000000000001', '[]', 'p1') $$,
  'P0002', null,
  'ni ne se clôt'
);
select lives_ok(
  $$ select public.live_match_create('NEUF01', '{}', '[]') $$,
  'une nouvelle partie se crée'
);

reset role;

select is(
  (select count(*)::int from public.live_matches where code = 'VIEUX1'),
  0,
  'et sa création a purgé la partie expirée'
);
select is(
  (select count(*)::int from public.live_matches where code = 'RECENT'),
  1,
  'sans toucher à une partie encore vivante'
);
select is(
  (select count(*)::int from public.live_matches where code = 'MZ7K2A'),
  1,
  'ni à celle qu''on vient de finir'
);

select * from finish();
rollback;
