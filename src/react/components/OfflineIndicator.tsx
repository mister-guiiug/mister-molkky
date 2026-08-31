import { useOnline } from '@mister-guiiug/dev-wpa-config/react/use-online';
import { useI18n } from '../../i18n';

export function OfflineIndicator() {
  const online = useOnline();
  const { t } = useI18n();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="bottom-safe-3 mm-toast-pop fixed left-1/2 z-40 -translate-x-1/2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lg"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        color: 'var(--muted)',
      }}
    >
      ● {t('offline.title')}
    </div>
  );
}
