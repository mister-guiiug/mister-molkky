import { create } from 'zustand';
import {
  createLiveMatch,
  joinLiveMatch,
  pushLiveState,
  subscribeLiveMatch,
  type LiveMatchRow,
  type LiveSubscription,
} from '../live/liveMatch';
import type { CurrentMatchState, Throw } from '../schemas';

export type LiveRole = 'none' | 'host' | 'viewer';

interface LiveState {
  role: LiveRole;
  matchId: string | null;
  code: string | null;
  /** Latest payload received from Supabase (viewer side). */
  remote: LiveMatchRow | null;
  /** Last error, surfaced to UI banners. */
  error: string | null;
  status: 'idle' | 'connecting' | 'live' | 'finished';
  subscription: LiveSubscription | null;

  startHost: (state: CurrentMatchState) => Promise<{ code: string; id: string }>;
  pushThrows: (throws: Throw[]) => Promise<void>;
  pushFinish: (winnerId: string) => Promise<void>;
  stopHost: () => void;

  startViewer: (code: string) => Promise<LiveMatchRow>;
  stopViewer: () => void;

  clear: () => void;
}

export const useLiveStore = create<LiveState>()((set, get) => ({
  role: 'none',
  matchId: null,
  code: null,
  remote: null,
  error: null,
  status: 'idle',
  subscription: null,

  startHost: async state => {
    set({ status: 'connecting', error: null });
    try {
      const { id, code } = await createLiveMatch(state);
      const sub = subscribeLiveMatch(
        id,
        row => set({ remote: row }),
        err => set({ error: err.message })
      );
      set({
        role: 'host',
        matchId: id,
        code,
        status: 'live',
        subscription: sub,
      });
      return { id, code };
    } catch (err) {
      set({ status: 'idle', error: (err as Error).message });
      throw err;
    }
  },

  pushThrows: async throws => {
    const { matchId, role } = get();
    if (!matchId || role !== 'host') return;
    try {
      await pushLiveState(matchId, { throws });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  pushFinish: async winnerId => {
    const { matchId, role } = get();
    if (!matchId || role !== 'host') return;
    try {
      await pushLiveState(matchId, {
        winner_id: winnerId,
        finished_at: new Date().toISOString(),
      });
      set({ status: 'finished' });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  stopHost: () => {
    get().subscription?.unsubscribe();
    set({
      role: 'none',
      matchId: null,
      code: null,
      remote: null,
      status: 'idle',
      subscription: null,
    });
  },

  startViewer: async code => {
    set({ status: 'connecting', error: null });
    try {
      const row = await joinLiveMatch(code);
      const sub = subscribeLiveMatch(
        row.id,
        next => set({ remote: next }),
        err => set({ error: err.message })
      );
      set({
        role: 'viewer',
        matchId: row.id,
        code: row.code,
        remote: row,
        status: row.finished_at ? 'finished' : 'live',
        subscription: sub,
      });
      return row;
    } catch (err) {
      set({ status: 'idle', error: (err as Error).message });
      throw err;
    }
  },

  stopViewer: () => {
    get().subscription?.unsubscribe();
    set({
      role: 'none',
      matchId: null,
      code: null,
      remote: null,
      status: 'idle',
      subscription: null,
    });
  },

  clear: () => {
    get().subscription?.unsubscribe();
    set({
      role: 'none',
      matchId: null,
      code: null,
      remote: null,
      error: null,
      status: 'idle',
      subscription: null,
    });
  },
}));
