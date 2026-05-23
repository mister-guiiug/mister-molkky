import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeLocalStorage } from '../storage';
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
  update: (id: PlayerId, patch: Partial<Omit<Player, 'id' | 'createdAt'>>) => void;
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
              ? PlayerSchema.parse({ ...p, ...patch, id: p.id, createdAt: p.createdAt })
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
      name: 'mm_players',
      storage: createJSONStorage(() => safeLocalStorage()),
      version: 1,
    }
  )
);

export function pickNextColor(existing: Player[]): string {
  return nextColor(existing);
}
