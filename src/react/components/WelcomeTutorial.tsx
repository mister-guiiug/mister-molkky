import { useState } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { useSettingsStore } from '../../store/useSettingsStore';
import { Modal } from './Modal';

export function WelcomeTutorial() {
  const { t } = useI18n();
  const markSeen = useSettingsStore(s => s.markWelcomeSeen);
  const [open, setOpen] = useState(true);

  const dismiss = () => {
    setOpen(false);
    markSeen();
  };

  return (
    <Modal open={open} onClose={dismiss} title={t('welcome.title')}>
      <ul className="mb-5 flex flex-col gap-2 text-sm leading-relaxed">
        <li>🎯 {t('welcome.p1')}</li>
        <li>👆 {t('welcome.p2')}</li>
        <li>⚠️ {t('welcome.p3')}</li>
        <li>❌ {t('welcome.p4')}</li>
      </ul>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="touch-target rounded-lg border px-4 font-semibold"
          style={{ borderColor: 'var(--border)' }}
        >
          {t('welcome.skip')}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="touch-target rounded-lg px-5 font-bold text-white"
          style={{ background: 'var(--primary)' }}
        >
          {t('welcome.cta')}
        </button>
      </div>
    </Modal>
  );
}
