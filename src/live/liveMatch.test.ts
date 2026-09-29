import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALPHABETS } from '@mister-guiiug/dev-pwa-config/pairing';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CurrentMatchState, Throw } from '../schemas';
import { getSupabase } from '../supabase';
import {
  buildLiveShareUrl,
  CODE_LENGTH,
  createLiveMatch,
  extractScannedCode,
  finishLiveMatch,
  joinLiveMatch,
  liveTopic,
  normalizeCode,
  pushLiveThrows,
  subscribeLiveMatch,
  type LiveMatchRow,
} from './liveMatch';

vi.mock('../supabase', () => ({
  getSupabase: vi.fn(),
}));

type RpcArgs = Record<string, unknown>;
type RpcResult = { data: unknown; error: { code: string } | null };

/** Un canal Realtime minimal : ce que le code en appelle, rien de plus. */
function fakeChannel(topic: string) {
  const channel = {
    topic,
    listeners: [] as Array<() => void>,
    status: null as ((status: string, err?: Error) => void) | null,
    sent: [] as Array<{ event: string; payload: unknown }>,
    on(_type: string, _filter: unknown, listener: () => void) {
      channel.listeners.push(listener);
      return channel;
    },
    subscribe(callback: (status: string, err?: Error) => void) {
      channel.status = callback;
      return channel;
    },
    httpSend(event: string, payload: unknown) {
      channel.sent.push({ event, payload });
      return Promise.resolve({ success: true });
    },
    /** Ce que ferait le serveur : livrer un signal aux abonnés. */
    ping() {
      for (const listener of channel.listeners) listener();
    },
  };
  return channel;
}

/**
 * Client Supabase minimal. `rows` associe un code à l'état que rend
 * `live_match_get` ; chaque appel RPC est journalisé dans `calls`. `rpc`
 * remplace, au besoin, la réponse par défaut d'une fonction.
 */
function fakeClient(
  rows: Record<string, Partial<LiveMatchRow>>,
  rpc?: (fn: string, args: RpcArgs) => Promise<RpcResult> | undefined
) {
  const calls: Array<{ fn: string; args: RpcArgs }> = [];
  /** Les codes demandés à `live_match_get`, dans l'ordre. */
  const queried: unknown[] = [];
  /** Les codes proposés à `live_match_create`, dans l'ordre. */
  const inserted: unknown[] = [];
  const channels: Array<ReturnType<typeof fakeChannel>> = [];
  const removed: Array<ReturnType<typeof fakeChannel>> = [];
  const client = {
    rpc: (fn: string, args: RpcArgs): Promise<RpcResult> => {
      calls.push({ fn, args });
      if (fn === 'live_match_get') queried.push(args.p_code);
      if (fn === 'live_match_create') inserted.push(args.p_code);
      const custom = rpc?.(fn, args);
      if (custom) return custom;
      if (fn === 'live_match_get') {
        const row = rows[args.p_code as string] ?? null;
        return Promise.resolve({ data: row, error: null });
      }
      if (fn === 'live_match_create') {
        return Promise.resolve({ data: `hote-${args.p_code}`, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    channel: (topic: string) => {
      const channel = fakeChannel(topic);
      channels.push(channel);
      return channel;
    },
    removeChannel: (channel: ReturnType<typeof fakeChannel>) => {
      removed.push(channel);
      return Promise.resolve('ok');
    },
  };
  return {
    client: client as unknown as SupabaseClient,
    calls,
    queried,
    inserted,
    channels,
    removed,
  };
}

function useClient(
  rows: Record<string, Partial<LiveMatchRow>> = {},
  rpc?: (fn: string, args: RpcArgs) => Promise<RpcResult> | undefined
) {
  const fake = fakeClient(rows, rpc);
  vi.mocked(getSupabase).mockResolvedValue(fake.client);
  return fake;
}

beforeEach(() => {
  vi.mocked(getSupabase).mockReset();
});

describe('compatibilité des alphabets — les prémisses de la rustine', () => {
  it('ancien − nouveau = {L, U} et nouveau − ancien = {0, 1}', () => {
    // Si un de ces écarts bouge dans le socle, la rustine de compat de
    // liveMatch.ts est à réviser — ce test le dira avant la production.
    const legacy = new Set(ALPHABETS.antiConfusion.chars);
    const modern = new Set(ALPHABETS.crockford32.chars);
    expect([...legacy].filter(c => !modern.has(c)).sort()).toEqual(['L', 'U']);
    expect([...modern].filter(c => !legacy.has(c)).sort()).toEqual(['0', '1']);
  });

  it('les corrections crockford32 restent DANS son alphabet (le bug local corrigé)', () => {
    const { chars, aliases = {} } = ALPHABETS.crockford32;
    for (const [confused, target] of Object.entries(aliases)) {
      expect(chars).not.toContain(confused);
      expect(chars).toContain(target);
    }
  });

  it('tout caractère des deux alphabets survit à la normalisation de saisie', () => {
    for (const c of ALPHABETS.crockford32.chars + ALPHABETS.antiConfusion.chars)
      expect(normalizeCode(c)).toBe(c);
  });
});

describe('normalizeCode — saisie sur l’union des deux alphabets', () => {
  it('met en majuscules et écarte séparateurs et bruit de collage', () => {
    expect(normalizeCode(' mz7-k2a ')).toBe('MZ7K2A');
  });

  it('corrige I → 1 et O → 0 (hors des deux alphabets)', () => {
    expect(normalizeCode('ABIO23')).toBe('AB1023');
  });

  it('préserve L et U, légitimes dans les anciens codes', () => {
    expect(normalizeCode('MZLKUW')).toBe('MZLKUW');
  });

  it('accepte 0 et 1, légitimes dans les nouveaux codes', () => {
    expect(normalizeCode('MZ1K0W')).toBe('MZ1K0W');
  });

  it('borne la saisie à CODE_LENGTH', () => {
    expect(normalizeCode('MZ7K2AXY')).toBe('MZ7K2A');
    expect(normalizeCode('MZ7K2AXY')).toHaveLength(CODE_LENGTH);
  });
});

describe('URL de partage ↔ scan — l’aller-retour sur la route réelle', () => {
  const origin = 'https://mister-guiiug.github.io';

  it('construit l’URL sur ROUTES.spectator (/live) — plus jamais /direct', () => {
    expect(buildLiveShareUrl(origin, '/mister-molkky/', 'MZ7K2A')).toBe(
      'https://mister-guiiug.github.io/mister-molkky/live/MZ7K2A'
    );
  });

  it('gère la base racine du dev sans doubler le slash', () => {
    expect(buildLiveShareUrl('http://localhost:5173', '/', 'MZ7K2A')).toBe(
      'http://localhost:5173/live/MZ7K2A'
    );
  });

  it('extrait le code de l’URL qu’il vient de construire (aller-retour)', () => {
    const url = buildLiveShareUrl(origin, '/mister-molkky/', 'MZ7K2A');
    expect(extractScannedCode(url)).toBe('MZ7K2A');
  });

  it('accepte l’ancien chemin /direct/CODE des QR déjà imprimés ou partagés', () => {
    expect(extractScannedCode(`${origin}/mister-molkky/direct/MZ7K2A`)).toBe(
      'MZ7K2A'
    );
    // Un vieux QR peut aussi porter un code de l’ancien alphabet (L, U) :
    // l’extraction les préserve, la résolution `joinLiveMatch` fait le reste.
    expect(extractScannedCode(`${origin}/mister-molkky/direct/MZLKUW`)).toBe(
      'MZLKUW'
    );
  });

  it('tolère une URL en majuscules (mode alphanumérique des QR)', () => {
    expect(extractScannedCode(`${origin}/MISTER-MOLKKY/LIVE/MZ7K2A`)).toBe(
      'MZ7K2A'
    );
  });

  it('accepte un code brut, normalisé comme la saisie (minuscules, I → 1, O → 0)', () => {
    expect(extractScannedCode('mz7k2a')).toBe('MZ7K2A');
    expect(extractScannedCode('MZIOKA')).toBe('MZ10KA');
  });

  it('renvoie null quand le contenu ne porte aucun code exploitable', () => {
    expect(extractScannedCode('AB')).toBeNull();
    expect(extractScannedCode('')).toBeNull();
  });
});

describe('joinLiveMatch — résolution Crockford avec repli hérité', () => {
  it('trouve un nouveau code (0/1) via la normalisation Crockford', async () => {
    const { queried } = useClient({
      MZ1K0W: { code: 'MZ1K0W' },
    });
    const row = await joinLiveMatch('mz1k0w');
    expect(row.code).toBe('MZ1K0W');
    expect(queried).toEqual(['MZ1K0W']);
  });

  it('corrige les confusions I/L/O vers un nouveau code', async () => {
    const { queried } = useClient({
      AB11K0: { code: 'AB11K0' },
    });
    // I → 1, L → 1, O → 0 : les corrections Crockford, DANS l’alphabet.
    const row = await joinLiveMatch('abILkO');
    expect(row.code).toBe('AB11K0');
    expect(queried).toEqual(['AB11K0']);
  });

  it('retombe sur la normalisation héritée pour un ancien code (L, U)', async () => {
    const { queried } = useClient({
      MZLKUW: { code: 'MZLKUW' },
    });
    // Normalisé Crockford, 'mzlkuw' donnerait 'MZ1KW' (L → 1, U écarté) :
    // 5 caractères, candidat écarté — seul le repli hérité part en requête.
    const row = await joinLiveMatch('mzlkuw');
    expect(row.code).toBe('MZLKUW');
    expect(queried).toEqual(['MZLKUW']);
  });

  it('essaie Crockford d’abord, l’hérité ensuite, quand les deux sont plausibles', async () => {
    const { queried } = useClient({
      ABLK2A: { code: 'ABLK2A' },
    });
    const row = await joinLiveMatch('AB1LK2A');
    expect(row.code).toBe('ABLK2A');
    expect(queried).toEqual(['AB11K2', 'ABLK2A']);
  });

  it('rejette une saisie trop courte sans requête', async () => {
    const { queried } = useClient();
    await expect(joinLiveMatch('AB')).rejects.toThrow('Invalid code');
    expect(queried).toEqual([]);
  });

  it('échoue en « Match not found » après épuisement des candidats', async () => {
    const { queried } = useClient();
    await expect(joinLiveMatch('MZ7K2A')).rejects.toThrow('Match not found');
    // Les deux normalisations coïncident : une seule requête part.
    expect(queried).toEqual(['MZ7K2A']);
  });
});

describe('createLiveMatch — génération par le socle', () => {
  const state = { config: {}, throws: [] } as unknown as CurrentMatchState;

  it('engendre des codes crockford32 de 6 caractères, jamais I/L/O/U', async () => {
    const fake = useClient();
    for (let i = 0; i < 25; i += 1) {
      const { code } = await createLiveMatch(state);
      expect(code).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
    }
    expect(fake.inserted).toHaveLength(25);
  });

  it('rend le secret d’hôte que la base a tiré, avec le code proposé', async () => {
    const fake = useClient();
    const { code, hostToken } = await createLiveMatch(state);
    expect(fake.inserted).toEqual([code]);
    expect(hostToken).toBe(`hote-${code}`);
  });

  it('tire un autre code quand la base répond 23505 (code déjà pris)', async () => {
    let first = true;
    const fake = useClient({}, fn => {
      if (fn !== 'live_match_create' || !first) return undefined;
      first = false;
      return Promise.resolve({ data: null, error: { code: '23505' } });
    });
    const { code } = await createLiveMatch(state);
    expect(fake.inserted).toHaveLength(2);
    expect(code).toBe(fake.inserted[1]);
  });

  it('relaie toute autre erreur sans réessayer', async () => {
    const fake = useClient({}, () =>
      Promise.resolve({ data: null, error: { code: '42501' } })
    );
    await expect(createLiveMatch(state)).rejects.toMatchObject({
      code: '42501',
    });
    expect(fake.inserted).toHaveLength(1);
  });
});

describe('écritures de l’hôte — le secret, puis le signal', () => {
  const throws = [{ id: 't1' }] as unknown as Throw[];

  it('pousse les lancers avec le secret, puis signale sur le canal du code', async () => {
    const fake = useClient();
    await pushLiveThrows('MZ7K2A', 'secret', throws);

    expect(fake.calls).toEqual([
      {
        fn: 'live_match_push',
        args: { p_code: 'MZ7K2A', p_host_token: 'secret', p_throws: throws },
      },
    ]);
    const [channel] = fake.channels;
    expect(channel?.topic).toBe(liveTopic('MZ7K2A'));
    // Le signal ne porte AUCUNE donnée : le spectateur relit la base.
    expect(channel?.sent).toEqual([{ event: 'update', payload: {} }]);
    expect(fake.removed).toEqual([channel]);
  });

  it('clôt avec les derniers lancers et le vainqueur, puis signale', async () => {
    const fake = useClient();
    await finishLiveMatch('MZ7K2A', 'secret', throws, 'p-a');

    expect(fake.calls).toEqual([
      {
        fn: 'live_match_finish',
        args: {
          p_code: 'MZ7K2A',
          p_host_token: 'secret',
          p_throws: throws,
          p_winner_id: 'p-a',
        },
      },
    ]);
    expect(fake.channels[0]?.sent).toHaveLength(1);
  });

  it('ne signale rien quand la base refuse l’écriture', async () => {
    const fake = useClient({}, () =>
      Promise.resolve({ data: null, error: { code: 'P0002' } })
    );
    await expect(
      pushLiveThrows('MZ7K2A', 'mauvais-secret', throws)
    ).rejects.toMatchObject({ code: 'P0002' });
    expect(fake.channels).toHaveLength(0);
  });
});

describe('subscribeLiveMatch — un signal, une relecture', () => {
  const row = { code: 'MZ7K2A', throws: [] } as Partial<LiveMatchRow>;

  it('relit l’état à l’abonnement, puis à chaque signal', async () => {
    const fake = useClient({ MZ7K2A: row });
    const onChange = vi.fn();
    await subscribeLiveMatch('MZ7K2A', onChange);
    const [channel] = fake.channels;
    expect(channel?.topic).toBe(liveTopic('MZ7K2A'));

    channel?.status?.('SUBSCRIBED');
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));

    channel?.ping();
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
    expect(onChange).toHaveBeenLastCalledWith(row);
    expect(fake.queried).toEqual(['MZ7K2A', 'MZ7K2A']);
  });

  it('une seule relecture en vol : trois signaux rapprochés en coûtent deux', async () => {
    let release: () => void = () => undefined;
    let held = true;
    const fake = useClient({ MZ7K2A: row }, fn => {
      if (fn !== 'live_match_get' || !held) return undefined;
      held = false;
      return new Promise(resolve => {
        release = () => resolve({ data: row, error: null });
      });
    });
    const onChange = vi.fn();
    await subscribeLiveMatch('MZ7K2A', onChange);
    const [channel] = fake.channels;

    channel?.ping();
    channel?.ping();
    channel?.ping();
    await vi.waitFor(() => expect(fake.queried).toHaveLength(1));

    release();
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
    expect(fake.queried).toHaveLength(2);
  });

  it('se tait une fois désabonné, et retire son canal', async () => {
    const fake = useClient({ MZ7K2A: row });
    const onChange = vi.fn();
    const subscription = await subscribeLiveMatch('MZ7K2A', onChange);
    const [channel] = fake.channels;

    await subscription.unsubscribe();
    channel?.ping();
    channel?.status?.('SUBSCRIBED');
    await Promise.resolve();

    expect(fake.removed).toEqual([channel]);
    expect(fake.queried).toEqual([]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('remonte une erreur de canal', async () => {
    const fake = useClient({ MZ7K2A: row });
    const onError = vi.fn();
    await subscribeLiveMatch('MZ7K2A', vi.fn(), onError);

    fake.channels[0]?.status?.('TIMED_OUT');

    expect(onError).toHaveBeenCalledWith(
      new Error('Realtime channel status: TIMED_OUT')
    );
  });
});
