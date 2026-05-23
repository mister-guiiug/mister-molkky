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

  return (
    <div
      role="status"
      aria-live="polite"
      className="bottom-safe-3 mm-toast-pop fixed left-1/2 z-30 flex max-w-md -translate-x-1/2 flex-col gap-2 rounded-2xl border-2 px-4 py-3 text-center shadow-xl"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--primary)',
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
