import { useState } from 'react';
import { Sheet } from '@mister-guiiug/dev-pwa-config/react/sheet';
import { useI18n } from '../../i18n';
import { useSettingsStore } from '../../store/useSettingsStore';
import { AlertIcon, PointerClickIcon, TargetIcon, UserXIcon } from './icons';

export function WelcomeTutorial() {
  const { t } = useI18n();
  const markSeen = useSettingsStore(s => s.markWelcomeSeen);
  const [open, setOpen] = useState(true);

  const dismiss = () => {
    setOpen(false);
    markSeen();
  };

  return (
    <Sheet open={open} onClose={dismiss} title={t('welcome.title')}>
      <ul className="mb-5 flex flex-col gap-3 text-sm leading-relaxed">
        <li className="flex items-start gap-2">
          <TargetIcon
            size={18}
            className="mt-0.5 shrink-0"
            style={{ color: 'var(--primary)' }}
          />
          <span>{t('welcome.p1')}</span>
        </li>
        <li className="flex items-start gap-2">
          <PointerClickIcon
            size={18}
            className="mt-0.5 shrink-0"
            style={{ color: 'var(--primary)' }}
          />
          <span>{t('welcome.p2')}</span>
        </li>
        <li className="flex items-start gap-2">
          <AlertIcon size={18} className="mt-0.5 shrink-0 text-amber-500" />
          <span>{t('welcome.p3')}</span>
        </li>
        <li className="flex items-start gap-2">
          <UserXIcon size={18} className="mt-0.5 shrink-0 text-red-500" />
          <span>{t('welcome.p4')}</span>
        </li>
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
    </Sheet>
  );
}
