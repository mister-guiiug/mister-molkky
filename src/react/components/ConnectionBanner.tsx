import { ConnectionBanner as SocleConnectionBanner } from '@mister-guiiug/dev-wpa-config/react/connection-banner';
import { useI18n } from '../../i18n';

/**
 * Bandeau « hors ligne », posé UNE SEULE FOIS par `Shell`.
 *
 * REMPLACE `OfflineIndicator`, QUI DISPARAISSAIT ET REVENAIT. L'ancienne pastille
 * lisait `useOnline` sans temporisation : sur un terrain de Mölkky — c'est-à-dire
 * dehors, en bord de réseau — chaque micro-coupure la faisait clignoter. Le
 * composant du socle n'apparaît qu'après 1,5 s HORS LIGNE CONTINU. C'est
 * exactement le défaut que cette app avait le plus de raisons de rencontrer.
 *
 * ELLE CHANGE AUSSI DE PLACE. La pastille était `fixed` en bas au centre, au même
 * endroit que le bandeau de mise à jour (`styles.css`, z-index 9999) et que
 * l'invite d'installation : trois éléments pour un seul emplacement, aucun ne
 * sachant que les autres existent. Le bandeau est désormais EN HAUT et DANS LE
 * FLUX — plus rien à recouvrir, plus rien qui le recouvre.
 *
 * Le texte reste celui de l'app, et il est important : « vos données sont
 * sauvegardées localement ». Sur ce terrain, la partie en cours ne dépend de
 * personne — le bandeau informe, il n'alarme pas.
 */
export function ConnectionBanner() {
  const { t } = useI18n();
  return (
    <SocleConnectionBanner
      label={`● ${t('offline.title')}`}
      className="mm-toast-pop sticky top-0 z-40 mx-auto mt-2 w-[calc(100%-1.5rem)] max-w-md"
    />
  );
}
