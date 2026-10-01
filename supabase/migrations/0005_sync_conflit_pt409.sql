-- Mister Mölkky — 0005 — un conflit de synchro ne fait plus tourner PostgREST.
--
-- LE DÉFAUT. `sync_push` (0004) signalait une version périmée par `40001`, le
-- code de l'échec de sérialisation. PostgREST le prend pour un échec PASSAGER
-- et rejoue la transaction, sans fin : la fonction relève le même conflit à
-- chaque tour, la requête ne répond jamais, et le backend tourne à plein
-- jusqu'à ce qu'on le tue. Supabase le documente (PostgREST 14, corrigé en 16) :
-- https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b
--
-- Les tests pgTAP ne pouvaient pas le voir : ils appellent le SQL sans passer
-- par PostgREST. C'est `scripts/verify-sync-cycle.mjs`, joué contre la
-- production le 01/10/2026, qui l'a trouvé — en y laissant une boucle qu'il a
-- fallu arrêter à la main. Dans l'app, deux appareils qui envoient au même
-- moment auraient figé « Envoyer » de la même façon.
--
-- LE CORRECTIF. Le conflit se signale par `PT409` : PostgREST rend un code
-- `PTxyz` en HTTP xyz, ici 409 Conflict, et ne le rejoue pas. Le client
-- (`src/cloudSync.ts`) reconnaît ce code. Rien d'autre ne change : mêmes
-- contrôles, même purge, même écriture conditionnelle.
--
-- LA GARDE. `supabase/tests/structure-securite.test.sql` refuse désormais
-- toute fonction de `public` qui mentionne l'ancien code.
--
-- REJOUABLE : `create or replace` sur la même signature, puis les droits de
-- 0004 réaffirmés à l'identique.

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
    raise exception 'sync: version conflict' using errcode = 'PT409';
  end if;

  return jsonb_build_object('version', v_version, 'updated_at', v_updated_at);
end;
$$;

-- Les droits de 0004, à l'identique : `create or replace` les garde, mais une
-- migration rejouée sur une base neuve ne doit rien supposer.
revoke all on function public.sync_push(text, jsonb, bigint)
  from public, anon, authenticated;
grant execute on function public.sync_push(text, jsonb, bigint) to anon;

notify pgrst, 'reload schema';
