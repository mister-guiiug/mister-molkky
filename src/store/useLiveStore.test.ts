import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Throw } from '../schemas';
import { finishLiveMatch, pushLiveThrows } from '../live/liveMatch';
import { useLiveStore } from './useLiveStore';

/**
 * CE QUE CE FICHIER TIENT : CE QUE L'HÔTE D'UN DIRECT N'A PAS PU ENVOYER NE SE
 * PERD PLUS.
 *
 * `pushFinish` passe le statut à `finished` AVANT l'appel réseau, pour couper
 * net les miroirs de lancers. Hors ligne, l'appel échouait, seule une erreur
 * restait, et le garde `status === 'finished'` refusait toute nouvelle
 * tentative : la clôture était perdue, et les spectateurs restaient devant une
 * partie qui ne finissait jamais (audit hors ligne du 05/11/2026).
 *
 * Le transport est remplacé : c'est le CONTRAT du magasin qu'on éprouve — ce
 * qui attend, ce qui repart, ce qui est oublié — pas Supabase.
 */
vi.mock('../live/liveMatch', () => ({
  createLiveMatch: vi.fn(),
  finishLiveMatch: vi.fn(),
  joinLiveMatch: vi.fn(),
  pushLiveThrows: vi.fn(),
  subscribeLiveMatch: vi.fn(),
}));

const finish = vi.mocked(finishLiveMatch);
const push = vi.mocked(pushLiveThrows);

const THROWS = [{ id: 't1' }, { id: 't2' }] as unknown as Throw[];
const OFFLINE = new TypeError('Failed to fetch');
/** Ce que rend la base quand la ligne ne prend plus d'écriture. */
const GONE = { code: 'P0002', message: 'live match: not found' };

beforeEach(() => {
  // `resetAllMocks`, pas `clearAllMocks` : une réponse programmée par un
  // test et jamais consommée ne doit pas répondre à la place du suivant.
  vi.resetAllMocks();
  useLiveStore.setState({
    role: 'host',
    code: 'ABC123',
    hostToken: 'secret',
    status: 'live',
    error: null,
    pendingFinish: null,
    pendingThrows: null,
  });
});

afterEach(() => {
  useLiveStore.getState().clear();
});

describe('la clôture du direct', () => {
  it('hors ligne, reste à envoyer au lieu d’être perdue', async () => {
    finish.mockRejectedValueOnce(OFFLINE);

    await useLiveStore.getState().pushFinish('p-a', THROWS);

    const state = useLiveStore.getState();
    // Le statut ne bouge pas : les miroirs de lancers restent coupés.
    expect(state.status).toBe('finished');
    expect(state.pendingFinish).toEqual({ winnerId: 'p-a', throws: THROWS });
  });

  it('pendant qu’elle attend, aucun miroir de lancers ne part', async () => {
    finish.mockRejectedValueOnce(OFFLINE);
    await useLiveStore.getState().pushFinish('p-a', THROWS);

    await useLiveStore.getState().pushThrows(THROWS);

    expect(push).not.toHaveBeenCalled();
  });

  it('repart au renvoi, avec le même vainqueur et les mêmes lancers', async () => {
    finish.mockRejectedValueOnce(OFFLINE);
    await useLiveStore.getState().pushFinish('p-a', THROWS);
    finish.mockResolvedValueOnce();

    await useLiveStore.getState().retryPending();

    expect(finish).toHaveBeenCalledTimes(2);
    expect(finish).toHaveBeenLastCalledWith('ABC123', 'secret', THROWS, 'p-a');
    expect(useLiveStore.getState().pendingFinish).toBeNull();
    expect(useLiveStore.getState().error).toBeNull();
  });

  it('attend encore si le renvoi échoue aussi', async () => {
    finish.mockRejectedValueOnce(OFFLINE).mockRejectedValueOnce(OFFLINE);
    await useLiveStore.getState().pushFinish('p-a', THROWS);

    await useLiveStore.getState().retryPending();

    expect(useLiveStore.getState().pendingFinish).not.toBeNull();
  });

  it('introuvable au renvoi : la première était passée, rien n’attend plus', async () => {
    // L'accusé de réception s'est perdu : la base a clos la partie, et la
    // seconde clôture lève « not found ». Ce n'est pas un échec à montrer.
    finish.mockRejectedValueOnce(OFFLINE).mockRejectedValueOnce(GONE);
    await useLiveStore.getState().pushFinish('p-a', THROWS);

    await useLiveStore.getState().retryPending();

    expect(useLiveStore.getState().pendingFinish).toBeNull();
    expect(useLiveStore.getState().error).toBeNull();
  });

  it('une partie introuvable dès le premier envoi ne se met pas en attente', async () => {
    finish.mockRejectedValueOnce(GONE);

    await useLiveStore.getState().pushFinish('p-a', THROWS);

    expect(useLiveStore.getState().pendingFinish).toBeNull();
    expect(useLiveStore.getState().error).toBe('live match: not found');
  });

  it('arrêter la diffusion oublie ce qui attendait', async () => {
    finish.mockRejectedValueOnce(OFFLINE);
    await useLiveStore.getState().pushFinish('p-a', THROWS);

    useLiveStore.getState().stopHost();

    expect(useLiveStore.getState().pendingFinish).toBeNull();
  });
});

describe('le miroir des lancers', () => {
  it('un miroir échoué attend, et repart au renvoi', async () => {
    push.mockRejectedValueOnce(OFFLINE).mockResolvedValueOnce();

    await useLiveStore.getState().pushThrows(THROWS);
    expect(useLiveStore.getState().pendingThrows).toEqual(THROWS);

    await useLiveStore.getState().retryPending();

    expect(push).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenLastCalledWith('ABC123', 'secret', THROWS);
    expect(useLiveStore.getState().pendingThrows).toBeNull();
  });

  it('un miroir PLUS ANCIEN qui échoue après le suivant n’est pas renvoyé', async () => {
    // Les miroirs partent sans s'attendre : renvoyer l'ancien effacerait le
    // dernier lancer chez les spectateurs.
    let rejectFirst: (err: unknown) => void = () => {};
    push
      .mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectFirst = reject;
          })
      )
      .mockResolvedValueOnce();

    const first = useLiveStore.getState().pushThrows(THROWS.slice(0, 1));
    await useLiveStore.getState().pushThrows(THROWS);
    rejectFirst(OFFLINE);
    await first;

    expect(useLiveStore.getState().pendingThrows).toBeNull();
  });

  it('la clôture remplace un miroir en attente : elle porte les lancers d’arrivée', async () => {
    push.mockRejectedValueOnce(OFFLINE);
    await useLiveStore.getState().pushThrows(THROWS.slice(0, 1));
    finish.mockResolvedValueOnce();

    await useLiveStore.getState().pushFinish('p-a', THROWS);
    await useLiveStore.getState().retryPending();

    expect(useLiveStore.getState().pendingThrows).toBeNull();
    expect(push).toHaveBeenCalledTimes(1);
  });
});
