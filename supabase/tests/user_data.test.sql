-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ La synchro par clé — pgTAP. Lancement : `supabase test db`, sur la pile  ║
-- ║ jetable de la CI (`supabase-tests.yml`).                                 ║
-- ║                                                                          ║
-- ║ CE QUE CES TESTS PROUVENT, et qu'une relecture de 0004 ne prouve pas :   ║
-- ║ la table est fermée à la clé anonyme ; une clé ne lit et n'écrit que son ║
-- ║ propre blob ; une écriture fondée sur une version périmée est refusée    ║
-- ║ sans rien écraser ; une clé mal formée ne passe jamais ; effacer efface ;║
-- ║ un an sans échange, et le blob disparaît.                                ║
-- ║                                                                          ║
-- ║ Tout se joue sous `set local role anon`, le rôle de la clé publiée.      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

begin;
select plan(34);

-- Deux clés bien formées (28 caractères crockford32) et une presque bonne.
-- A = AAAABBBBCCCCDDDDEEEEFFFFGGGG, B = 0000111122223333444455556666.

-- ── La table est fermée ───────────────────────────────────────────────────

set local role anon;

select throws_ok(
  $$ select count(*) from public.user_data $$,
  '42501', null,
  'anon ne peut pas lire la table'
);
select throws_ok(
  $$ insert into public.user_data (key_hash, payload) values ('\x00', '{}') $$,
  '42501', null,
  'ni y écrire directement'
);
select throws_ok(
  $$ update public.user_data set payload = '{}' $$,
  '42501', null,
  'ni remplacer le blob d''un autre'
);
select throws_ok(
  $$ delete from public.user_data $$,
  '42501', null,
  'ni effacer'
);
select throws_ok(
  $$ truncate public.user_data $$,
  '42501', null,
  'ni vider la table, ce que la RLS ne couvre pas'
);

reset role;
set local role authenticated;

select throws_ok(
  $$ select count(*) from public.user_data $$,
  '42501', null,
  'authenticated non plus : ce dépôt n''a pas de compte'
);

reset role;

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'user_data'),
  0,
  'aucune policy sur la table'
);
select ok(
  (select relrowsecurity from pg_class
    where oid = 'public.user_data'::regclass),
  'et la RLS active : sans policy, seconde barrière derrière les privilèges'
);
select ok(
  has_function_privilege('anon', 'public.sync_pull(text)', 'execute')
  and has_function_privilege('anon', 'public.sync_push(text, jsonb, bigint)', 'execute')
  and has_function_privilege('anon', 'public.sync_delete(text)', 'execute'),
  'anon exécute les trois portes de la synchro'
);
select ok(
  not has_function_privilege('authenticated', 'public.sync_pull(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.sync_push(text, jsonb, bigint)', 'execute')
  and not has_function_privilege('authenticated', 'public.sync_delete(text)', 'execute'),
  'authenticated n''en exécute aucune'
);

-- ── Le chemin de l'application, sous la clé publique ──────────────────────

set local role anon;

select is(
  public.sync_pull('AAAABBBBCCCCDDDDEEEEFFFFGGGG'),
  null,
  'une clé neuve ne lit rien : rien n''a encore été envoyé'
);
select is(
  public.sync_push(
    'AAAABBBBCCCCDDDDEEEEFFFFGGGG', '{"v":1,"history":["m1"]}', 0
  ) ->> 'version',
  '1',
  'le premier envoi crée le blob, en version 1'
);
select is(
  public.sync_pull('AAAABBBBCCCCDDDDEEEEFFFFGGGG') -> 'payload' -> 'history',
  '["m1"]'::jsonb,
  'la clé relit ce qu''elle a envoyé'
);
select is(
  public.sync_pull('0000111122223333444455556666'),
  null,
  'une autre clé ne lit rien du blob de la première'
);

select throws_ok(
  $$ select public.sync_push(
       'AAAABBBBCCCCDDDDEEEEFFFFGGGG', '{"v":1,"history":["autre"]}', 0) $$,
  'PT409', null,
  'une création alors qu''un blob existe déjà est refusée'
);
select is(
  public.sync_push(
    'AAAABBBBCCCCDDDDEEEEFFFFGGGG', '{"v":1,"history":["m1","m2"]}', 1
  ) ->> 'version',
  '2',
  'un envoi fondé sur la version lue passe, et l''incrémente'
);
select throws_ok(
  $$ select public.sync_push(
       'AAAABBBBCCCCDDDDEEEEFFFFGGGG', '{"v":1,"history":["m9"]}', 1) $$,
  'PT409', null,
  'un envoi fondé sur une version périmée est refusé'
);
select is(
  public.sync_pull('AAAABBBBCCCCDDDDEEEEFFFFGGGG') -> 'payload' -> 'history',
  '["m1", "m2"]'::jsonb,
  'et il n''a rien écrasé : l''union de l''autre appareil est intacte'
);

select throws_ok(
  $$ select public.sync_pull('AAAABBBBCCCCDDDDEEEEFFFFGGGI') $$,
  '22023', null,
  'une clé hors alphabet est refusée'
);
select throws_ok(
  $$ select public.sync_pull('AAAA') $$,
  '22023', null,
  'une clé courte, donc devinable, aussi'
);
select throws_ok(
  $$ select public.sync_push('aaaabbbbccccddddeeeeffffgggg', '{}', 0) $$,
  '22023', null,
  'le client normalise avant l''envoi : la base ne rattrape pas les minuscules'
);
select throws_ok(
  $$ select public.sync_push('0000111122223333444455556666', '[]', 0) $$,
  '22023', null,
  'un blob qui n''est pas un objet est refusé'
);
select throws_ok(
  $$ select public.sync_push(
       '0000111122223333444455556666',
       jsonb_build_object('v', 1, 'x', repeat('x', 8388608)),
       0) $$,
  '22023', null,
  'un volume démesuré est refusé'
);
select throws_ok(
  $$ select public.sync_push('0000111122223333444455556666', '{}', -1) $$,
  '22023', null,
  'une version négative est refusée'
);

reset role;

select is(
  (select key_hash from public.user_data),
  sha256(convert_to('AAAABBBBCCCCDDDDEEEEFFFFGGGG', 'UTF8')),
  'la base ne garde de la clé que son haché'
);

-- ── Effacer ───────────────────────────────────────────────────────────────

set local role anon;

select ok(
  public.sync_delete('AAAABBBBCCCCDDDDEEEEFFFFGGGG'),
  'la clé efface son blob'
);
select is(
  public.sync_pull('AAAABBBBCCCCDDDDEEEEFFFFGGGG'),
  null,
  'qui n''est plus lisible'
);
select ok(
  not public.sync_delete('AAAABBBBCCCCDDDDEEEEFFFFGGGG'),
  'effacer une seconde fois ne trouve plus rien'
);
select throws_ok(
  $$ select public.sync_delete('AAAA') $$,
  '22023', null,
  'et une clé mal formée n''efface rien'
);

-- ── Un an sans échange ────────────────────────────────────────────────────
--
-- Deux blobs posés sous `postgres`, à la date de leur dernier échange :
-- H (HHHHJJJJKKKKMMMMNNNNPPPPQQQQ) muet depuis 366 jours, R
-- (RRRRSSSSTTTTVVVVWWWWXXXXYYYY) depuis 364.

reset role;

insert into public.user_data (key_hash, payload, version, seen_at)
values
  (sha256(convert_to('HHHHJJJJKKKKMMMMNNNNPPPPQQQQ', 'UTF8')),
   '{"v":1}', 7, now() - interval '366 days'),
  (sha256(convert_to('RRRRSSSSTTTTVVVVWWWWXXXXYYYY', 'UTF8')),
   '{"v":1}', 3, now() - interval '364 days');

set local role anon;

select is(
  public.sync_pull('HHHHJJJJKKKKMMMMNNNNPPPPQQQQ'),
  null,
  'un an sans échange : le blob est introuvable'
);
select is(
  public.sync_pull('RRRRSSSSTTTTVVVVWWWWXXXXYYYY') ->> 'version',
  '3',
  'à 364 jours, il se lit encore'
);

reset role;

select is(
  (select count(*)::int from public.user_data
    where key_hash = sha256(convert_to('HHHHJJJJKKKKMMMMNNNNPPPPQQQQ', 'UTF8'))),
  0,
  'et la lecture suivante l''a purgé'
);
select is(
  (select seen_at from public.user_data
    where key_hash = sha256(convert_to('RRRRSSSSTTTTVVVVWWWWXXXXYYYY', 'UTF8'))),
  now(),
  'lire est un échange : le compteur de l''autre repart de zéro'
);

-- Le cas délicat : une clé qui revient après un an lit `null`, donc envoie en
-- version 0, alors que son vieux blob attend peut-être encore la purge. Sans
-- la purge AVANT l'écriture, l'insertion buterait sur la clé primaire.
insert into public.user_data (key_hash, payload, version, seen_at)
values
  (sha256(convert_to('HHHHJJJJKKKKMMMMNNNNPPPPQQQQ', 'UTF8')),
   '{"v":1}', 7, now() - interval '400 days');

set local role anon;

select is(
  public.sync_push(
    'HHHHJJJJKKKKMMMMNNNNPPPPQQQQ', '{"v":1,"history":["neuf"]}', 0
  ) ->> 'version',
  '1',
  'une clé revenue après un an repart d''un blob neuf, sans conflit'
);

select * from finish();
rollback;
