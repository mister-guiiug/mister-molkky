import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { MaximizeIcon, MinimizeIcon } from './icons';

export function FullscreenToggle() {
  const { t } = useI18n();
  const [fs, setFs] = useState(false);

  useEffect(() => {
    const handler = () => setFs(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handler);
    handler();
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  if (!document.documentElement.requestFullscreen) return null;

  const toggle = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={fs ? t('a11y.exitFullscreen') : t('a11y.fullscreen')}
      className="touch-target rounded-full p-2"
      style={{
        background: 'transparent',
        color: 'var(--muted)',
      }}
    >
      {fs ? <MinimizeIcon /> : <MaximizeIcon />}
    </button>
  );
}
