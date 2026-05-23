import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/useI18n';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'mm_install_dismissed';

export function PwaInstallPrompt() {
  const { t } = useI18n();
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // localStorage can be absent (some webviews, very old browsers) or
    // throw (Safari private mode pre-iOS 17). Treat any error as "not
    // dismissed yet" so the prompt still works on a fresh install.
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
      /* ignore */
    }
    if (dismissed) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);
    return () =>
      window.removeEventListener(
        'beforeinstallprompt',
        handler as EventListener
      );
  }, []);

  if (!event) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      /* ignore */
    }
    setEvent(null);
  };

  const install = async () => {
    await event.prompt();
    await event.userChoice;
    setEvent(null);
  };

  return (
    <div
      role="dialog"
      aria-label={t('install.text')}
      className="bottom-safe-3 mm-toast-pop fixed left-1/2 z-40 flex max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <p className="m-0 flex-1 text-sm font-semibold">{t('install.text')}</p>
      <button
        type="button"
        onClick={dismiss}
        className="text-xs font-semibold"
        style={{ color: 'var(--muted)' }}
      >
        {t('install.dismiss')}
      </button>
      <button
        type="button"
        onClick={install}
        className="touch-target rounded-lg px-3 text-sm font-bold text-white"
        style={{ background: 'var(--primary)' }}
      >
        {t('install.button')}
      </button>
    </div>
  );
}
