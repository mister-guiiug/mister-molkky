import { create } from 'zustand';
import {
  createLiveMatch,
  finishLiveMatch,
  joinLiveMatch,
  pushLiveThrows,
  subscribeLiveMatch,
  type LiveMatchRow,
  type LiveSubscription,
} from '../live/liveMatch';
import type { CurrentMatchState, Throw } from '../schemas';
import { createLogger } from '@mister-guiiug/dev-pwa-config/logger';

const log = createLogger('store');

export type LiveRole = 'none' | 'host' | 'viewer';

/** La clôture d'un direct, telle qu'elle part au serveur. */
export interface PendingFinish {
  winnerId: string;
  throws: Throw[];
}

interface LiveState {
  role: LiveRole;
  /**
   * Le secret d'hôte rendu par `live_match_create` — côté hôte seulement, et
   * en mémoire seulement : la base ne le rend qu'une fois, et un rechargement
   * met fin à la diffusion de toute façon. Sans lui, plus rien ne s'écrit.
   */
  hostToken: string | null;
  code: string | null;
  /** Latest payload received from Supabase (viewer side). */
  remote: LiveMatchRow | null;
  /** Last error, surfaced to UI banners. */
  error: string | null;
  status: 'idle' | 'connecting' | 'live' | 'finished' | 'reconnecting';
  /** L'abonnement du spectateur ; l'hôte n'écoute rien, il signale. */
  subscription: LiveSubscription | null;
  /** Auto-reconnect: tracks failed attempts so we give up after a few. */
  reconnectAttempts: number;
  /**
   * LA CLÔTURE QUI N'EST PAS PARTIE — hors ligne, le plus souvent.
   *
   * `status` passe à `'finished'` AVANT l'appel réseau, pour que les miroirs
   * de lancers s'arrêtent net (voir `pushFinish`). Mais un échec ne laissait
   * qu'une erreur : la clôture était perdue, jamais retentée, et le garde
   * `status === 'finished'` refusait toute nouvelle tentative. Les
   * spectateurs restaient devant une partie qui ne finissait jamais.
   *
   * Elle attend donc ICI, distincte du statut, jusqu'à ce que le serveur
   * l'accepte : `retryPending` la renvoie au retour du réseau
   * (`useLiveRetry`), et l'hôte voit qu'elle attend (`LivePendingNotice`).
   *
   * EN MÉMOIRE, PAS PERSISTÉE — comme tout ce magasin : le secret d'hôte ne
   * survit pas à un rechargement, et sans lui aucune clôture ne peut partir.
   */
  pendingFinish: PendingFinish | null;
  /**
   * Le dernier miroir de lancers qui a échoué. Le lancer suivant le
   * remplacerait, mais un hôte coupé du réseau en fin de manche n'en joue
   * peut-être plus : il repart lui aussi au retour du réseau.
   */
  pendingThrows: Throw[] | null;

  startHost: (state: CurrentMatchState) => Promise<{ code: string }>;
  pushThrows: (throws: Throw[]) => Promise<void>;
  /** Les lancers d'ARRIVÉE, pas ceux du dernier miroir : voir `finishLiveMatch`. */
  pushFinish: (winnerId: string, throws: Throw[]) => Promise<void>;
  stopHost: () => void;
  /**
   * Renvoie ce qui attend : la clôture si elle attend (elle porte les lancers
   * d'arrivée), sinon le dernier miroir. Sans effet si rien n'attend ou si un
   * renvoi est déjà en vol.
   */
  retryPending: () => Promise<void>;

  startViewer: (code: string) => Promise<LiveMatchRow>;
  stopViewer: () => void;

  clear: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 4000;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Le numéro du dernier miroir demandé. Les miroirs partent sans s'attendre
 * (un par rendu) et peuvent revenir dans le désordre : seul l'échec du PLUS
 * RÉCENT mérite d'être renvoyé — renvoyer un plus ancien effacerait des
 * lancers chez les spectateurs.
 */
let throwsSeq = 0;
/** Un renvoi est en vol : `retryPending` n'en lance pas un second. */
let retrying = false;

/**
 * « Partie introuvable » : la base ne prend plus d'écriture sur cette ligne —
 * déjà close (la clôture précédente était passée, seule sa réponse s'est
 * perdue), expirée, ou visée avec un mauvais secret. Insister n'y changerait
 * rien. `live_match_push` et `live_match_finish` lèvent alors `P0002`.
 */
function isGone(err: unknown): boolean {
  const { code, message } = (err ?? {}) as {
    code?: unknown;
    message?: unknown;
  };
  return (
    code === 'P0002' ||
    (typeof message === 'string' && /live match: not found/i.test(message))
  );
}

export const useLiveStore = create<LiveState>()((set, get) => ({
  role: 'none',
  hostToken: null,
  code: null,
  remote: null,
  error: null,
  status: 'idle',
  subscription: null,
  reconnectAttempts: 0,
  pendingFinish: null,
  pendingThrows: null,

  startHost: async state => {
    set({ status: 'connecting', error: null });
    try {
      const { code, hostToken } = await createLiveMatch(state);
      set({
        role: 'host',
        hostToken,
        code,
        status: 'live',
      });
      return { code };
    } catch (err) {
      set({ status: 'idle', error: (err as Error).message });
      throw err;
    }
  },

  pushThrows: async throws => {
    const { code, hostToken, role, status } = get();
    // status==='finished' guard: once the host has pushed the winner we
    // stop mirroring throws — otherwise a quick Rematch would push throws
    // of the NEW match into the old (finished) row, and the next finish
    // would target an already-archived row.
    if (!code || !hostToken || role !== 'host' || status === 'finished') return;
    const seq = ++throwsSeq;
    try {
      await pushLiveThrows(code, hostToken, throws);
      // Le miroir le plus récent est passé : plus rien n'attend.
      if (seq === throwsSeq && get().pendingThrows) {
        set({ pendingThrows: null, error: null });
      }
    } catch (err) {
      log.warn('[live] pushThrows failed:', { error: err });
      // Un miroir plus récent (ou la clôture) est déjà parti : celui-ci est
      // périmé. Une partie introuvable ne prendra pas davantage un renvoi.
      const latest = seq === throwsSeq;
      set({
        error: (err as Error).message,
        ...(latest ? { pendingThrows: isGone(err) ? null : throws } : {}),
      });
    }
  },

  pushFinish: async (winnerId, throws) => {
    const { code, hostToken, role, status } = get();
    if (!code || !hostToken || role !== 'host' || status === 'finished') return;
    // Flip status first so any concurrent pushThrows from the React
    // effects can short-circuit before they hit the network. La clôture
    // emporte les lancers d'arrivée : un miroir en attente — ou encore en
    // vol, d'où le numéro avancé — est périmé.
    throwsSeq += 1;
    set({ status: 'finished', pendingThrows: null });
    try {
      await finishLiveMatch(code, hostToken, throws, winnerId);
    } catch (err) {
      log.warn('[live] pushFinish failed:', { error: err });
      // Le statut reste `finished` (les miroirs restent coupés) ; la clôture,
      // elle, attend d'être renvoyée. Une partie introuvable ne se clôt pas.
      set({
        error: (err as Error).message,
        pendingFinish: isGone(err) ? null : { winnerId, throws },
      });
    }
  },

  stopHost: () => {
    set({
      role: 'none',
      hostToken: null,
      code: null,
      remote: null,
      status: 'idle',
      pendingFinish: null,
      pendingThrows: null,
    });
  },

  retryPending: async () => {
    const { code, hostToken, role, pendingFinish, pendingThrows } = get();
    if (retrying || !code || !hostToken || role !== 'host') return;
    if (!pendingFinish && !pendingThrows) return;
    retrying = true;
    try {
      if (pendingFinish) {
        try {
          await finishLiveMatch(
            code,
            hostToken,
            pendingFinish.throws,
            pendingFinish.winnerId
          );
          set({ pendingFinish: null, error: null });
        } catch (err) {
          log.warn('[live] retry finish failed:', { error: err });
          // Introuvable AU RENVOI : le plus souvent, la première clôture
          // était passée et seule sa réponse s'est perdue. Plus rien à
          // envoyer, et rien à reprocher à l'hôte.
          if (isGone(err)) set({ pendingFinish: null, error: null });
          else set({ error: (err as Error).message });
        }
        return;
      }
      if (pendingThrows) await get().pushThrows(pendingThrows);
    } finally {
      retrying = false;
    }
  },

  startViewer: async code => {
    set({ status: 'connecting', error: null });
    // Cancel any pending reconnect from a previous session — a fresh
    // user-initiated join takes priority.
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    // L'abonnement précédent (reconnexion, tirer-pour-rafraîchir) est retiré
    // AVANT d'en demander un autre sur le même canal : voir
    // `LiveSubscription.unsubscribe`.
    const previous = get().subscription;
    if (previous) {
      set({ subscription: null });
      await previous.unsubscribe();
    }
    try {
      const row = await joinLiveMatch(code);
      const sub = await subscribeLiveMatch(
        row.code,
        next => {
          // Successful update — clear any error chip + reset retry budget.
          set({
            remote: next,
            status: next.finished_at ? 'finished' : 'live',
            error: null,
            reconnectAttempts: 0,
          });
        },
        err => {
          set({ error: err.message });
          scheduleViewerReconnect(set, get, code);
        }
      );
      set({
        role: 'viewer',
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
    void get().subscription?.unsubscribe();
    set({
      role: 'none',
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
    void get().subscription?.unsubscribe();
    set({
      role: 'none',
      hostToken: null,
      code: null,
      remote: null,
      error: null,
      status: 'idle',
      subscription: null,
      reconnectAttempts: 0,
      pendingFinish: null,
      pendingThrows: null,
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
