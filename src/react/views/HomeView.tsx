import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import { useMatchStore } from '../../store/useMatchStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { ROUTES } from '../../routes';
import { PageContainer } from '../components/layout/PageContainer';
import { Logo } from '../components/Logo';
import { Modal } from '../components/Modal';
import { MatchSetupWizard } from '../components/MatchSetupWizard';
import { WelcomeTutorial } from '../components/WelcomeTutorial';
import { PwaInstallPrompt } from '../components/PwaInstallPrompt';
import { PlayIcon } from '../components/icons';

export function HomeView() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [setupOpen, setSetupOpen] = useState(false);
  const current = useMatchStore(s => s.current);
  const hasSeenWelcome = useSettingsStore(s => s.hasSeenWelcome);

  return (
    <PageContainer>
      <header className="mb-6 flex items-center gap-3 pt-6">
        <Logo size={56} />
        <div>
          <h1 className="m-0 text-2xl font-black leading-tight">
            {t('appName')}
          </h1>
          <p className="m-0 text-sm" style={{ color: 'var(--muted)' }}>
            {t('tagline')}
          </p>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        {current && (
          <button
            type="button"
            onClick={() => navigate(ROUTES.match)}
            className="touch-target mm-glow flex items-center justify-between rounded-2xl border-2 px-5 py-4 text-left font-bold shadow-lg"
            style={{
              borderColor: 'var(--primary)',
              background:
                'color-mix(in srgb, var(--primary) 8%, var(--surface))',
              color: 'var(--primary)',
            }}
          >
            <span>{t('home.resumeMatch')}</span>
            <PlayIcon size={24} />
          </button>
        )}

        <button
          type="button"
          onClick={() => setSetupOpen(true)}
          className="touch-target flex items-center justify-between rounded-2xl px-5 py-4 text-left font-bold text-white shadow-lg"
          style={{ background: 'var(--primary)' }}
        >
          <span className="text-lg">{t('home.newMatch')}</span>
          <PlayIcon size={28} />
        </button>

        <section
          className="rounded-2xl border p-5"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <h2 className="m-0 mb-2 text-base font-bold">
            {t('home.aboutGame')}
          </h2>
          <p
            className="m-0 text-sm leading-relaxed"
            style={{ color: 'var(--muted)' }}
          >
            {t('home.aboutGameText')}
          </p>
        </section>
      </section>

      <Modal
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        title={t('setup.title')}
        size="lg"
      >
        <MatchSetupWizard onClose={() => setSetupOpen(false)} />
      </Modal>

      {!hasSeenWelcome && <WelcomeTutorial />}
      <PwaInstallPrompt />
    </PageContainer>
  );
}
