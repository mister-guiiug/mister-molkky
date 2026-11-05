import { useI18n } from '../../i18n';
import { useLiveStore } from '../../store/useLiveStore';

/**
 * « La fin du direct n'est pas encore partie » — à l'hôte, sur tous les
 * écrans, tant que c'est vrai.
 *
 * Hors ligne, la clôture d'un direct échouait sans bruit : la partie était
 * finie ici, et figée « en cours » chez les spectateurs, sans que l'hôte le
 * sache. Elle attend désormais son renvoi (`pendingFinish`), et ce bandeau le
 * dit. Il disparaît de lui-même dès que le serveur l'accepte.
 *
 * Le bouton couvre le cas que le renvoi automatique ne couvre pas : un réseau
 * présent mais qui ne répond pas (portail captif, serveur lent), où aucun
 * évènement `online` ne viendra.
 */
export function LivePendingNotice() {
  const { t } = useI18n();
  const pending = useLiveStore(
    s => s.role === 'host' && s.pendingFinish !== null
  );
  const retry = useLiveStore(s => s.retryPending);

  if (!pending) return null;

  return (
    <div
      role="status"
      className="mx-auto mt-2 flex w-[calc(100%-1.5rem)] max-w-md items-center gap-3 rounded-lg border px-3 py-2 text-sm"
      style={{ borderColor: 'var(--warning)', background: 'var(--surface)' }}
    >
      <p className="m-0 flex-1">{t('live.finishPending')}</p>
      <button
        type="button"
        onClick={() => void retry()}
        className="touch-target rounded-lg border px-3 font-semibold"
        style={{ borderColor: 'var(--border)' }}
      >
        {t('live.retry')}
      </button>
    </div>
  );
}
