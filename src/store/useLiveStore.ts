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
import { createLogger } from '@mister-guiiug/dev-pwa-config/logger';

const log = createLogger('store');

export type LiveRole = 'none' | 'host' | 'viewer';

interface LiveState {
  role: LiveRole;
  matchId: string | null;
  code: string | null;
  /** Latest payload received from Supabase (viewer side). */
  remote: LiveMatchRow | null;
  /** Last error, surfaced to UI banners. */
  error: string | null;
  status: 'idle' | 'connecting' | 'live' | 'finished' | 'reconnecting';
  subscription: LiveSubscription | null;
  /** Auto-reconnect: tracks failed attempts so we give up after a few. */
  reconnectAttempts: number;

  startHost: (
    state: CurrentMatchState
  ) => Promise<{ code: string; id: string }>;
  pushThrows: (throws: Throw[]) => Promise<void>;
  pushFinish: (winnerId: string) => Promise<void>;
  stopHost: () => void;

  startViewer: (code: string) => Promise<LiveMatchRow>;
  stopViewer: () => void;

  clear: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 4000;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export const useLiveStore = create<LiveState>()((set, get) => ({
  role: 'none',
  matchId: null,
  code: null,
  remote: null,
  error: null,
  status: 'idle',
  subscription: null,
  reconnectAttempts: 0,

  startHost: async state => {
    set({ status: 'connecting', error: null });
    try {
      const { id, code } = await createLiveMatch(state);
      const sub = await subscribeLiveMatch(
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
    const { matchId, role, status } = get();
    // status==='finished' guard: once the host has pushed the winner we
    // stop mirroring throws — otherwise a quick Rematch would push throws
    // of the NEW match into the old (finished) row, and the next finish
    // would target an already-archived row.
    if (!matchId || role !== 'host' || status === 'finished') return;
    try {
      await pushLiveState(matchId, { throws });
    } catch (err) {
      log.warn('[live] pushThrows failed:', { error: err });
      set({ error: (err as Error).message });
    }
  },

  pushFinish: async winnerId => {
    const { matchId, role, status } = get();
    if (!matchId || role !== 'host' || status === 'finished') return;
    // Flip status first so any concurrent pushThrows from the React
    // effects can short-circuit before they hit the network.
    set({ status: 'finished' });
    try {
      await pushLiveState(matchId, {
        winner_id: winnerId,
        finished_at: new Date().toISOString(),
      });
    } catch (err) {
      log.warn('[live] pushFinish failed:', { error: err });
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
    // Cancel any pending reconnect from a previous session — a fresh
    // user-initiated join takes priority.
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    try {
      const row = await joinLiveMatch(code);
      const sub = await subscribeLiveMatch(
        row.id,
        next => {
          // Successful update — clear any error chip + reset retry budget.
          set({ remote: next, error: null, reconnectAttempts: 0 });
        },
        err => {
          set({ error: err.message });
          scheduleViewerReconnect(set, get, code);
        }
      );
      set({
        role: 'viewer',
        matchId: row.id,
        code: row.code,
        remote: row,
        status: row.finished_at ? 'finished' : 'live',
        subscription: sub,
        reconnectAttempts: 0,
      });
      return row;
    } catch (err) {
      set({ status: 'idle', error: (err as Error).message });
      scheduleViewerReconnect(set, get, code);
      throw err;
    }
  },

  stopViewer: () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    get().subscription?.unsubscribe();
    set({
      role: 'none',
      matchId: null,
      code: null,
      remote: null,
      status: 'idle',
      subscription: null,
      reconnectAttempts: 0,
    });
  },

  clear: () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    get().subscription?.unsubscribe();
    set({
      role: 'none',
      matchId: null,
      code: null,
      remote: null,
      error: null,
      status: 'idle',
      subscription: null,
      reconnectAttempts: 0,
    });
  },
}));

/**
 * Schedule a viewer reconnect attempt. Backs off after a few tries and
 * stops so we don't loop forever on a permanently unreachable backend.
 * Re-runs `startViewer` which re-creates a fresh subscription.
 */
function scheduleViewerReconnect(
  set: (partial: Partial<LiveState>) => void,
  get: () => LiveState,
  code: string
): void {
  const { reconnectAttempts, role } = get();
  // Stop if the user navigated away or we already burned through retries.
  if (role !== 'viewer' && get().status === 'idle') return;
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  set({ status: 'reconnecting', reconnectAttempts: reconnectAttempts + 1 });
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    // Re-enter via startViewer — that path correctly resets subscription
    // ref and retry counter on success.
    void useLiveStore
      .getState()
      .startViewer(code)
      .catch(() => undefined);
  }, RECONNECT_DELAY_MS);
}
