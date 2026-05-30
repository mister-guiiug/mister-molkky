import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/useI18n';

interface EliminationToastProps {
  playerName: string | null;
  onDismiss: () => void;
}

export function EliminationToast({
  playerName,
  onDismiss,
}: EliminationToastProps) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!playerName) {
      setShow(false);
      return;
    }
    setShow(true);
    const id = window.setTimeout(() => {
      setShow(false);
      window.setTimeout(onDismiss, 200);
    }, 2400);
    return () => window.clearTimeout(id);
  }, [playerName, onDismiss]);

  if (!playerName || !show) return null;
  return (
    <div
      role="status"
      aria-live="assertive"
      className="bottom-safe-3 mm-toast-pop fixed left-1/2 z-40 -translate-x-1/2 rounded-2xl border-2 px-5 py-3 text-center text-base font-bold shadow-2xl"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--danger)',
        color: 'var(--danger)',
      }}
    >
      ✗ {t('match.eliminationMessage', { name: playerName })}
    </div>
  );
}
