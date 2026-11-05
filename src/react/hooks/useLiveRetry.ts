import { useRetryWhenOnline } from '@mister-guiiug/dev-pwa-config/react/use-retry-when-online';
import { useLiveStore } from '../../store/useLiveStore';

/**
 * Renvoie au retour du réseau ce que l'hôte d'un direct n'a pas pu envoyer :
 * la clôture de la partie, ou le dernier miroir de lancers.
 *
 * POSÉ PAR `Shell`, DONC SUR TOUS LES ÉCRANS. La clôture part au moment où la
 * partie se termine, et l'hôte quitte souvent l'écran de partie aussitôt
 * (historique, accueil, revanche) : un renvoi monté sur `MatchView` seul
 * mourrait avec lui.
 *
 * Le geste vient du socle (`useRetryWhenOnline`) : un répit après l'évènement
 * `online` (le DNS et le TLS ne suivent pas l'interface), et UNE tentative par
 * retour du réseau — un renvoi qui échoue en ligne ne boucle pas. Le bouton
 * « Réessayer » de `LivePendingNotice` couvre le reste.
 */
export function useLiveRetry(): void {
  const pending = useLiveStore(
    s =>
      s.role === 'host' &&
      (s.pendingFinish !== null || s.pendingThrows !== null)
  );
  const retry = useLiveStore(s => s.retryPending);
  useRetryWhenOnline(pending, retry);
}
