import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import {
  deleteSync,
  formatSyncKey,
  generateSyncKey,
  parseSyncKey,
  pullSync,
  pushSync,
  SYNC_KEY_LENGTH,
  SyncConflictError,
  syncKeyLink,
  type SyncPayload,
} from './cloudSync';

vi.mock('./supabase', () => ({
  getSupabase: vi.fn(),
}));

const CLE = 'AAAABBBBCCCCDDDDEEEEFFFFGGGG';

/** Un client dont `rpc` rend ce qu'on lui dit, et note ce qu'on lui demande. */
function useRpc(result: {
  data: unknown;
  error: { code: string; message: string } | null;
}) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return Promise.resolve(result);
    },
  };
  vi.mocked(getSupabase).mockResolvedValue(client as unknown as SupabaseClient);
  return calls;
}

beforeEach(() => {
  vi.mocked(getSupabase).mockReset();
});

describe('la clé de synchro', () => {
  it('se tire en 28 caractères crockford32 (140 bits), jamais I/L/O/U', () => {
    const keys = new Set(Array.from({ length: 50 }, generateSyncKey));
    expect(keys.size).toBe(50);
    for (const key of keys) {
      expect(key).toHaveLength(SYNC_KEY_LENGTH);
      expect(key).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]+$/);
    }
  });

  it('se lit par groupes de quatre, et se relit telle quelle', () => {
    expect(formatSyncKey(CLE)).toBe('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GGGG');
    expect(parseSyncKey(formatSyncKey(CLE))).toBe(CLE);
  });

  it('se reconnaît saisie à la main : minuscules, espaces, confusions I/L/O', () => {
    expect(parseSyncKey(' aaaa bbbb cccc dddd eeee ffff gggg ')).toBe(CLE);
    expect(parseSyncKey('0000 1111 2222 3333 4444 5555 666I')).toBe(
      '0000111122223333444455556661'
    );
    expect(parseSyncKey('OOOO 1111 2222 3333 4444 5555 6666')).toBe(
      '0000111122223333444455556666'
    );
  });

  it('se reconnaît dans le lien de son QR, aller-retour compris', () => {
    expect(syncKeyLink(CLE)).toBe(`molkky:sync?key=${CLE}`);
    expect(parseSyncKey(syncKeyLink(CLE))).toBe(CLE);
  });

  it('refuse une clé incomplète ou trop longue', () => {
    expect(parseSyncKey('AAAA-BBBB-CCCC')).toBeNull();
    expect(parseSyncKey(`${CLE}A`)).toBeNull();
    expect(parseSyncKey('')).toBeNull();
  });

  it('refuse tout ce qui n’est pas une clé, même normalisable en 28 caractères', () => {
    // 28 caractères de l'alphabet une fois la ponctuation écartée : sans le
    // filtre, cette phrase deviendrait une clé PRÉVISIBLE.
    expect(parseSyncKey('AAAA.BBBB.CCCC.DDDD.EEEE.FFFF.GGGG')).toBeNull();
    expect(
      parseSyncKey('https://mister-guiiug.github.io/mister-molkky/live/MZ7K2A')
    ).toBeNull();
    // Le lien d'une AUTRE action (le direct, par exemple) n'est pas une clé.
    expect(parseSyncKey(`molkky:live?key=${CLE}`)).toBeNull();
  });
});

describe('le transport', () => {
  const payload = { v: 1, history: [] } as unknown as SyncPayload;

  it('lit le blob et sa version par la clé', async () => {
    const calls = useRpc({
      data: { payload, version: 3, updated_at: '2026-09-30T12:00:00+00:00' },
      error: null,
    });
    await expect(pullSync(CLE)).resolves.toEqual({
      payload,
      version: 3,
      updatedAt: '2026-09-30T12:00:00+00:00',
    });
    expect(calls).toEqual([{ fn: 'sync_pull', args: { p_key: CLE } }]);
  });

  it('rend null quand la clé n’a encore rien envoyé', async () => {
    useRpc({ data: null, error: null });
    await expect(pullSync(CLE)).resolves.toBeNull();
  });

  it('envoie la version lue, et rend la nouvelle', async () => {
    const calls = useRpc({
      data: { version: 4, updated_at: '2026-09-30T12:01:00+00:00' },
      error: null,
    });
    await expect(pushSync(CLE, payload, 3)).resolves.toEqual({
      payload,
      version: 4,
      updatedAt: '2026-09-30T12:01:00+00:00',
    });
    expect(calls).toEqual([
      {
        fn: 'sync_push',
        args: { p_key: CLE, p_payload: payload, p_version: 3 },
      },
    ]);
  });

  it('traduit le refus de la base (PT409) en conflit, à relire', async () => {
    useRpc({
      data: null,
      error: { code: 'PT409', message: 'sync: version conflict' },
    });
    await expect(pushSync(CLE, payload, 3)).rejects.toBeInstanceOf(
      SyncConflictError
    );
  });

  // L'ancien code ne doit plus rien vouloir dire : la base ne le lève plus,
  // et PostgREST le rejouait sans fin au lieu de le rendre.
  it('ne tient plus 40001 pour un conflit', async () => {
    useRpc({
      data: null,
      error: { code: '40001', message: 'could not serialize access' },
    });
    await expect(pushSync(CLE, payload, 3)).rejects.not.toBeInstanceOf(
      SyncConflictError
    );
  });

  it('relaie toute autre erreur telle quelle', async () => {
    useRpc({
      data: null,
      error: { code: '22023', message: 'sync: invalid key' },
    });
    await expect(pushSync(CLE, payload, 0)).rejects.toThrow(
      'sync: invalid key'
    );
  });

  it('efface, et dit s’il y avait quelque chose', async () => {
    const calls = useRpc({ data: true, error: null });
    await expect(deleteSync(CLE)).resolves.toBe(true);
    expect(calls).toEqual([{ fn: 'sync_delete', args: { p_key: CLE } }]);
  });
});
