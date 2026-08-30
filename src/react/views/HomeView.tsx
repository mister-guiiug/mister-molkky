import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import { useMatchStore } from '../../store/useMatchStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useTemplatesStore } from '../../store/useTemplatesStore';
import { usePlayersStore } from '../../store/usePlayersStore';
import { ROUTES } from '../../routes';
import { MatchConfigSchema, type MatchTemplate } from '../../schemas';
import { PageContainer } from '../components/layout/PageContainer';
import { Logo } from '../components/Logo';
import { Modal } from '../components/Modal';
import { MatchSetupWizard } from '../components/MatchSetupWizard';
import { WelcomeTutorial } from '../components/WelcomeTutorial';
import { PwaInstallPrompt } from '../components/PwaInstallPrompt';
import { ConfirmDialog } from '@mister-guiiug/dev-wpa-config/react/confirm-dialog';
import { LiveIcon, PlayIcon, TargetIcon, TrashIcon } from '../components/icons';
import { isSupabaseConfigured } from '../../supabase';
import { AppFooter } from '../components/layout/AppFooter';

export function HomeView() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [setupOpen, setSetupOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<MatchTemplate | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MatchTemplate | null>(
    null
  );
  const current = useMatchStore(s => s.current);
  const startMatch = useMatchStore(s => s.startMatch);
  const hasSeenWelcome = useSettingsStore(s => s.hasSeenWelcome);
  const templates = useTemplatesStore(s => s.templates);
  const removeTemplate = useTemplatesStore(s => s.remove);
  const roster = usePlayersStore(s => s.players);

  const launchTemplate = (tpl: MatchTemplate) => {
    const players = tpl.playerIds
      .map(id => roster.find(p => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    if (players.length < 2) {
      setEditTemplate(tpl);
      return;
    }
    const config = MatchConfigSchema.parse({
      players,
      targetScore: tpl.targetScore,
      overshootPenalty: tpl.overshootPenalty,
      maxMisses: tpl.maxMisses,
      teamMode: tpl.teamMode,
      shufflePlayers: false,
    });
    startMatch(config);
    navigate(ROUTES.match);
  };

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

        {isSupabaseConfigured() && (
          <button
            type="button"
            onClick={() => navigate(ROUTES.joinLive)}
            className="touch-target flex items-center justify-between rounded-2xl border-2 px-5 py-3 text-left font-bold"
            style={{
              borderColor: 'var(--primary)',
              color: 'var(--primary)',
            }}
          >
            <span className="flex items-center gap-2">
              <LiveIcon size={20} />
              {t('live.join')}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider">
              {t('live.activeBadge')}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => navigate(ROUTES.practice)}
          className="touch-target flex items-center justify-between rounded-2xl border-2 px-5 py-3 text-left font-bold"
          style={{
            borderColor: 'var(--accent)',
            color: 'var(--accent)',
          }}
        >
          <span className="flex items-center gap-2">
            <TargetIcon size={20} />
            {t('practice.cta')}
          </span>
        </button>

        {templates.length > 0 && (
          <section
            className="rounded-2xl border p-4"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface)',
            }}
          >
            <h2
              className="m-0 mb-3 text-xs font-bold uppercase"
              style={{ color: 'var(--muted)' }}
            >
              {t('home.templates')}
            </h2>
            <ul className="flex flex-col gap-2">
              {templates.map(tpl => {
                const missingPlayers = tpl.playerIds.filter(
                  id => !roster.some(p => p.id === id)
                ).length;
                return (
                  <li key={tpl.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => launchTemplate(tpl)}
                      className="touch-target flex flex-1 items-center justify-between rounded-lg border px-3 py-2 text-left"
                      style={{
                        borderColor: 'var(--border)',
                      }}
                    >
                      <span>
                        <span className="block font-bold">{tpl.name}</span>
                        <span
                          className="block text-xs"
                          style={{ color: 'var(--muted)' }}
                        >
                          {tpl.targetScore} pts · {tpl.playerIds.length} joueurs
                          {missingPlayers > 0 &&
                            ` · ${missingPlayers} manquant(s)`}
                        </span>
                      </span>
                      <PlayIcon size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(tpl)}
                      className="touch-target rounded-full p-2"
                      aria-label={t('common.delete')}
                      style={{ color: 'var(--muted)' }}
                    >
                      <TrashIcon size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

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
        open={setupOpen || Boolean(editTemplate)}
        onClose={() => {
          setSetupOpen(false);
          setEditTemplate(null);
        }}
        title={t('setup.title')}
        size="lg"
      >
        <MatchSetupWizard
          onClose={() => {
            setSetupOpen(false);
            setEditTemplate(null);
          }}
          initialTemplate={editTemplate ?? undefined}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={t('home.templateDelete')}
        destructive
        onConfirm={() => {
          if (confirmDelete) removeTemplate(confirmDelete.id);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      <AppFooter />

      {!hasSeenWelcome && <WelcomeTutorial />}
      <PwaInstallPrompt />
    </PageContainer>
  );
}
