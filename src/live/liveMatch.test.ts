import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALPHABETS } from '@mister-guiiug/dev-pwa-config/pairing';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CurrentMatchState } from '../schemas';
import { getSupabase } from '../supabase';
import {
  buildLiveShareUrl,
  CODE_LENGTH,
  createLiveMatch,
  extractScannedCode,
  joinLiveMatch,
  normalizeCode,
} from './liveMatch';

vi.mock('../supabase', () => ({
  getSupabase: vi.fn(),
}));

/**
 * Client Supabase minimal : `rows` associe un code à sa ligne ; chaque
 * `.eq('code', …)` est journalisé dans `queried`, chaque insert dans
 * `inserted` (et réussit).
 */
function fakeClient(rows: Record<string, { id: string; code: string }>) {
  const queried: string[] = [];
  const inserted: string[] = [];
  const client = {
    from: () => ({
      select: () => ({
        eq: (_column: string, value: string) => ({
          single: () => {
            queried.push(value);
            const row = rows[value];
            return Promise.resolve(
              row
                ? { data: row, error: null }
                : { data: null, error: { code: 'PGRST116' } }
            );
          },
        }),
      }),
      insert: (row: { code: string }) => {
        inserted.push(row.code);
        return {
          select: () => ({
            single: () =>
              Promise.resolve({
                data: { id: `id-${row.code}`, code: row.code },
                error: null,
              }),
          }),
        };
      },
    }),
  };
  return { client: client as unknown as SupabaseClient, queried, inserted };
}

function useClient(rows: Record<string, { id: string; code: string }> = {}) {
  const fake = fakeClient(rows);
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
      MZ1K0W: { id: 'a', code: 'MZ1K0W' },
    });
    const row = await joinLiveMatch('mz1k0w');
    expect(row.code).toBe('MZ1K0W');
    expect(queried).toEqual(['MZ1K0W']);
  });

  it('corrige les confusions I/L/O vers un nouveau code', async () => {
    const { queried } = useClient({
      AB11K0: { id: 'b', code: 'AB11K0' },
    });
    // I → 1, L → 1, O → 0 : les corrections Crockford, DANS l’alphabet.
    const row = await joinLiveMatch('abILkO');
    expect(row.code).toBe('AB11K0');
    expect(queried).toEqual(['AB11K0']);
  });

  it('retombe sur la normalisation héritée pour un ancien code (L, U)', async () => {
    const { queried } = useClient({
      MZLKUW: { id: 'c', code: 'MZLKUW' },
    });
    // Normalisé Crockford, 'mzlkuw' donnerait 'MZ1KW' (L → 1, U écarté) :
    // 5 caractères, candidat écarté — seul le repli hérité part en requête.
    const row = await joinLiveMatch('mzlkuw');
    expect(row.code).toBe('MZLKUW');
    expect(queried).toEqual(['MZLKUW']);
  });

  it('essaie Crockford d’abord, l’hérité ensuite, quand les deux sont plausibles', async () => {
    const { queried } = useClient({
      ABLK2A: { id: 'd', code: 'ABLK2A' },
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
  it('engendre des codes crockford32 de 6 caractères, jamais I/L/O/U', async () => {
    const { inserted } = useClient();
    const state = { config: {}, throws: [] } as unknown as CurrentMatchState;
    for (let i = 0; i < 25; i += 1) {
      const { code } = await createLiveMatch(state);
      expect(code).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
    }
    expect(inserted).toHaveLength(25);
  });
});
