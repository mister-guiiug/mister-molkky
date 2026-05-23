import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { useSettingsStore } from '../../store/useSettingsStore';

export function MatchOnboardingHint() {
  const { t } = useI18n();
  const hasSeen = useSettingsStore(s => s.hasSeenMatchOnboarding);
  const markSeen = useSettingsStore(s => s.markMatchOnboardingSeen);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (hasSeen) return;
    const id = window.setTimeout(() => setShow(true), 400);
    return () => window.clearTimeout(id);
  }, [hasSeen]);

  if (hasSeen || !show) return null;

  const dismiss = () => {
    setShow(false);
    markSeen();
  };

  // Anchored to the viewport top (just under the sticky match header) so it
  // never collides with the validate/miss/undo buttons or the bottom tab
  // bar — those are the most-tapped areas on /partie.
  return (
    <div
      role="status"
      aria-live="polite"
      className="mm-toast-pop fixed left-1/2 z-40 flex max-w-md -translate-x-1/2 flex-col gap-2 rounded-2xl border-2 px-4 py-3 text-center shadow-xl"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--primary)',
        top: 'calc(env(safe-area-inset-top, 0px) + 4.5rem)',
        width: 'min(28rem, calc(100vw - 1.5rem))',
      }}
    >
      <p className="m-0 text-sm font-semibold">
        👆 {t('match.selectFallenPins')} · {t('match.longPressHint')}
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="touch-target rounded-lg px-3 text-sm font-bold text-white"
        style={{ background: 'var(--primary)' }}
      >
        {t('common.confirm')}
      </button>
    </div>
  );
}
