import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { keepValid, STORE_KEYS, versionedPersistStorage } from './persistence';
import {
  PlayerSchema,
  newId,
  makePlayerId,
  type Player,
  type PlayerId,
} from '../schemas';
import { idbDelBlob, idbGetBlob, idbPutBlob } from '../idb';

interface PlayersState {
  players: Player[];
  add: (data: { name: string; color: string }) => Player;
  update: (
    id: PlayerId,
    patch: Partial<Omit<Player, 'id' | 'createdAt'>>
  ) => void;
  remove: (id: PlayerId) => void;
  setAvatar: (id: PlayerId, blob: Blob) => Promise<void>;
  clearAvatar: (id: PlayerId) => Promise<void>;
  getAvatarUrl: (id: PlayerId) => Promise<string | undefined>;
}

const DEFAULT_PALETTE = [
  '#4a7c2a',
  '#d4892b',
  '#3a7bd5',
  '#c0392b',
  '#7b3fa7',
  '#0e9594',
  '#e67e22',
  '#1abc9c',
  '#f1c40f',
  '#e91e63',
  '#5d8aa8',
  '#34495e',
  '#16a085',
  '#9c27b0',
  '#ff5722',
  '#3f51b5',
];

function nextColor(existing: Player[]): string {
  const used = new Set(existing.map(p => p.color.toLowerCase()));
  const fresh = DEFAULT_PALETTE.find(c => !used.has(c.toLowerCase()));
  return fresh ?? DEFAULT_PALETTE[existing.length % DEFAULT_PALETTE.length]!;
}

export const usePlayersStore = create<PlayersState>()(
  persist(
    (set, get) => ({
      players: [],
      add: ({ name, color }) => {
        const player: Player = PlayerSchema.parse({
          id: makePlayerId(newId()),
          name: name.trim() || 'Joueur',
          color: color || nextColor(get().players),
          createdAt: Date.now(),
        });
        set(state => ({ players: [...state.players, player] }));
        return player;
      },
      update: (id, patch) => {
        set(state => ({
          players: state.players.map(p =>
            p.id === id
              ? PlayerSchema.parse({
                  ...p,
                  ...patch,
                  id: p.id,
                  createdAt: p.createdAt,
                })
              : p
          ),
        }));
      },
      remove: id => {
        const p = get().players.find(x => x.id === id);
        if (p?.avatarBlobKey) void idbDelBlob(p.avatarBlobKey);
        set(state => ({ players: state.players.filter(x => x.id !== id) }));
      },
      setAvatar: async (id, blob) => {
        const key = `avatar_${id}_${Date.now()}`;
        const ok = await idbPutBlob(key, blob);
        if (!ok) return;
        const current = get().players.find(p => p.id === id);
        if (current?.avatarBlobKey && current.avatarBlobKey !== key) {
          void idbDelBlob(current.avatarBlobKey);
        }
        set(state => ({
          players: state.players.map(p =>
            p.id === id ? { ...p, avatarBlobKey: key } : p
          ),
        }));
      },
      clearAvatar: async id => {
        const current = get().players.find(p => p.id === id);
        if (current?.avatarBlobKey) await idbDelBlob(current.avatarBlobKey);
        set(state => ({
          players: state.players.map(p =>
            p.id === id ? { ...p, avatarBlobKey: undefined } : p
          ),
        }));
      },
      getAvatarUrl: async id => {
        const p = get().players.find(x => x.id === id);
        if (!p?.avatarBlobKey) return undefined;
        const blob = await idbGetBlob(p.avatarBlobKey);
        if (!blob) return undefined;
        return URL.createObjectURL(blob);
      },
    }),
    {
      name: STORE_KEYS.players,
      // `version: 1` sans `migrate` : c'est exactement la configuration qui
      // fait qu'un jour de bascule de modèle, `zustand/persist` hydrate
      // l'état INITIAL et laisse le premier `set` réécrire la clé. Le roster
      // passe donc par le magasin versionné du socle, qui valide et met de
      // côté avant toute perte (voir src/store/persistence.ts).
      storage: versionedPersistStorage<{ players: Player[] }>({
        name: STORE_KEYS.players,
        validate: (data, reject) => {
          if (data === null || typeof data !== 'object') {
            throw new Error('mm_players: forme inattendue');
          }
          const s = data as { players?: unknown };
          return { players: keepValid(PlayerSchema, s.players, reject) };
        },
      }),
      partialize: state => ({ players: state.players }),
    }
  )
);

export function pickNextColor(existing: Player[]): string {
  return nextColor(existing);
}

/**
 * Fetch all avatar URLs for the given players. Returns a Map keyed by
 * playerId. URLs are revoked on unmount to avoid leaking blob: URLs into
 * the browser's resource list.
 *
 * The effect is keyed on a *content* signature of the players list
 * (id + avatar key joined into a string) instead of the array reference,
 * because call sites frequently pass an inline default like
 * `current?.config.players ?? []` — that empty array is a fresh ref on
 * every render. Re-running the effect every render would call
 * setUrls(new Map()) every render, which is a fresh Map ref → another
 * re-render → infinite loop → frozen UI. Comparing the signature
 * defuses that landmine while keeping the avatar refresh behaviour.
 */
export function useAvatarUrls(
  players: readonly { id: string; avatarBlobKey?: string }[]
): Map<string, string> {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const signature = players
    .map(p => `${p.id}:${p.avatarBlobKey ?? ''}`)
    .join('|');

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    Promise.all(
      players
        .filter(p => p.avatarBlobKey)
        .map(async p => {
          const blob = await idbGetBlob(p.avatarBlobKey!);
          if (!blob) return null;
          const url = URL.createObjectURL(blob);
          created.push(url);
          return [p.id, url] as const;
        })
    ).then(entries => {
      if (cancelled) {
        created.forEach(u => URL.revokeObjectURL(u));
        return;
      }
      const next = new Map(
        entries.filter((e): e is readonly [string, string] => Boolean(e))
      );
      // Only update state when the resolved URL set actually changed —
      // otherwise React would treat the new Map ref as a state change and
      // re-render for no reason.
      setUrls(prev => {
        if (prev.size !== next.size) return next;
        for (const [k, v] of next) {
          if (prev.get(k) !== v) return next;
        }
        return prev;
      });
    });
    return () => {
      cancelled = true;
      created.forEach(u => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return urls;
}
