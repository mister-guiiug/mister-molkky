import { useRef, useState } from 'react';
import { useActionGuard } from '@mister-guiiug/dev-wpa-config/react/use-action-guard';
import { useI18n } from '../../i18n';
import { useSettingsStore } from '../../store/useSettingsStore';
import { CoffeeIcon, RefreshIcon } from '../components/icons';
import { Logo } from '../components/Logo';
import { useMatchStore } from '../../store/useMatchStore';
import { usePlayersStore } from '../../store/usePlayersStore';
import {
  useThemeContext,
  type ThemePreference,
} from '@mister-guiiug/dev-wpa-config/react';
import { ExportBundleSchema, type Locale } from '../../schemas';
import { PageContainer } from '../components/layout/PageContainer';
import { ConfirmDialog } from '@mister-guiiug/dev-wpa-config/react/confirm-dialog';
import { isSupabaseConfigured } from '../../supabase';
import { applyUpdate } from '@mister-guiiug/dev-wpa-config/sw-update';
import { AppFooter } from '../components/layout/AppFooter';
import { useSyncStore } from '../../store/useSyncStore';
import { dateSlug, downloadJson } from '@mister-guiiug/dev-wpa-config/download';
import { FamilyApps } from '@mister-guiiug/dev-wpa-config/react';

declare const __APP_VERSION__: string | undefined;

const REPO_URL = 'https://github.com/mister-guiiug/mister-molkky';
const BMAC_URL = 'https://buymeacoffee.com/mister.guiiug';

export function SettingsView() {
  const { t, locale, setLocale } = useI18n();
  const settings = useSettingsStore();
  const players = usePlayersStore(s => s.players);
  const history = useMatchStore(s => s.history);
  const importBundle = useMatchStore(s => s.importBundle);
  const fileInput = useRef<HTMLInputElement>(null);
  // État partagé du ThemeProvider monté dans main.tsx (persistance, écoute du
  // thème système et <meta theme-color> comprises). L'ancien écran gardait SA
  // copie dans un useState : elle ne bougeait plus si le thème changeait
  // ailleurs. Hors fournisseur (test isolé), repli inerte sur `system`.
  const themeCtx = useThemeContext();
  const themePref = (themeCtx?.theme ?? 'system') as ThemePreference;
  const [confirmErase, setConfirmErase] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const setTheme = (v: ThemePreference) => {
    themeCtx?.setTheme(v);
  };

  const onExport = () => {
    const bundle = ExportBundleSchema.parse({
      version: 1,
      exportedAt: Date.now(),
      players,
      matches: history,
    });
    downloadJson(bundle, `mister-molkky-${dateSlug()}.json`);
  };

  const onImport = async (file: File) => {
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const res = importBundle(raw);
      if (res.ok) {
        setFeedback(t('settings.importApplied', { n: res.applied ?? 0 }));
      } else {
        setFeedback(t('settings.importFailed'));
      }
    } catch {
      setFeedback(t('settings.importFailed'));
    }
    if (fileInput.current) fileInput.current.value = '';
  };

  const onEraseAll = () => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    location.reload();
  };

  return (
    <PageContainer>
      <h1 className="m-0 mt-4 mb-4 text-2xl font-black">
        {t('settings.title')}
      </h1>

      <Section label={t('settings.theme')}>
        <div className="flex gap-2">
          {(['light', 'dark', 'system'] as ThemePreference[]).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setTheme(v)}
              className="touch-target flex-1 rounded-lg border px-3 text-sm font-bold"
              style={{
                background:
                  themePref === v
                    ? 'color-mix(in srgb, var(--primary) 16%, var(--surface))'
                    : 'var(--surface)',
                borderColor:
                  themePref === v ? 'var(--primary)' : 'var(--border)',
              }}
            >
              {t(
                v === 'light'
                  ? 'settings.themeLight'
                  : v === 'dark'
                    ? 'settings.themeDark'
                    : 'settings.themeSystem'
              )}
            </button>
          ))}
        </div>
      </Section>

      <Section label={t('settings.language')}>
        <div className="flex gap-2">
          {(['fr', 'en'] as Locale[]).map(l => (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              className="touch-target flex-1 rounded-lg border px-3 text-sm font-bold uppercase"
              style={{
                background:
                  locale === l
                    ? 'color-mix(in srgb, var(--primary) 16%, var(--surface))'
                    : 'var(--surface)',
                borderColor: locale === l ? 'var(--primary)' : 'var(--border)',
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </Section>

      <Section label={t('settings.sounds')}>
        <Toggle
          checked={settings.sounds}
          onChange={settings.toggleSounds}
          label={t('settings.sounds')}
        />
      </Section>

      <Section label={t('settings.vibrations')}>
        <Toggle
          checked={settings.vibrations}
          onChange={settings.toggleVibrations}
          label={t('settings.vibrations')}
        />
      </Section>

      <Section label={t('settings.wakeLock')}>
        <Toggle
          checked={settings.wakeLock}
          onChange={settings.toggleWakeLock}
          label={t('settings.wakeLock')}
          hint={t('settings.wakeLockHint')}
        />
      </Section>

      <Section label={t('settings.outdoor')}>
        <Toggle
          checked={settings.outdoor}
          onChange={settings.toggleOutdoor}
          label={t('settings.outdoor')}
          hint={t('settings.outdoorHint')}
        />
      </Section>

      <Section label={t('settings.colorblind')}>
        <Toggle
          checked={settings.colorblind}
          onChange={settings.toggleColorblind}
          label={t('settings.colorblind')}
          hint={t('settings.colorblindHint')}
        />
      </Section>

      <Section label={t('settings.coach')}>
        <Toggle
          checked={settings.coach}
          onChange={settings.toggleCoach}
          label={t('settings.coach')}
          hint={t('settings.coachHint')}
        />
      </Section>

      <Section label={t('settings.voiceAnnouncer')}>
        <Toggle
          checked={settings.voiceAnnouncer}
          onChange={settings.toggleVoiceAnnouncer}
          label={t('settings.voiceAnnouncer')}
          hint={t('settings.voiceAnnouncerHint')}
        />
      </Section>

      <Section label={t('settings.export')}>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onExport}
            className="touch-target rounded-lg border px-4 text-sm font-bold"
            style={{ borderColor: 'var(--border)' }}
          >
            {t('settings.export')}
          </button>
          <label
            className="touch-target flex cursor-pointer items-center justify-center rounded-lg border px-4 text-sm font-bold"
            style={{ borderColor: 'var(--border)' }}
          >
            {t('settings.import')}
            <input
              ref={fileInput}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async e => {
                const f = e.target.files?.[0];
                if (f) await onImport(f);
              }}
            />
          </label>
          {feedback && (
            <p className="m-0 text-xs" style={{ color: 'var(--muted)' }}>
              {feedback}
            </p>
          )}
        </div>
      </Section>

      <Section label={t('settings.forceUpdate')}>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={updating}
            onClick={() => {
              // On lève le voile D'ABORD et de façon synchrone : le retour
              // est immédiat même si le nettoyage du service worker traîne.
              // `applyUpdate` programme sa propre navigation et sa minuterie
              // de secours — inutile de l'attendre.
              setUpdating(true);
              // `hard: true` — DÉLIBÉRÉ, et c'est ce que faisait déjà
              // `forceAppUpdate()`. Trois raisons de ne pas prendre le chemin
              // doux ici :
              //   1. Le libellé de ce bouton PROMET la purge :
              //      « Vide le cache de l'application et recharge » (clé
              //      settings.forceUpdateHint). Le chemin doux, lui, GARDE le
              //      cache quand un worker attend — le bouton mentirait.
              //   2. On n'arrive sur ce bouton que parce qu'on soupçonne
              //      quelque chose de périmé. Le cache est précisément le
              //      suspect.
              //   3. C'est aussi ce que fait le `UpdateButton` du socle
              //      (`forceUpdate` = `run({ hard: true })`) : même sémantique
              //      pour le même écran.
              // Le chemin doux, lui, est le bon pour le BANDEAU (SocleUpdates)
              // — il n'apparaît que quand un worker attend vraiment.
              //
              // La cible d'atterrissage ne change pas : sur le chemin de la
              // purge, le socle vise la PORTÉE du worker, soit `/mister-molkky/`
              // — exactement le `BASE_URL` que `forceAppUpdate` visait. C'est
              // aussi la seule URL que GitHub Pages sait servir : les routes
              // profondes n'existent que par le `navigateFallback` du worker
              // qu'on vient de purger.
              void applyUpdate({ hard: true });
            }}
            className="touch-target flex items-center justify-center gap-2 rounded-lg border px-4 text-sm font-bold disabled:opacity-50"
            style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
          >
            <RefreshIcon
              size={18}
              className={updating ? 'animate-spin' : undefined}
            />
            {updating
              ? t('settings.forceUpdateInProgress')
              : t('settings.forceUpdate')}
          </button>
          <p className="m-0 text-xs" style={{ color: 'var(--muted)' }}>
            {t('settings.forceUpdateHint')}
          </p>
        </div>
      </Section>

      <Section label={t('settings.eraseAll')}>
        <button
          type="button"
          onClick={() => setConfirmErase(true)}
          className="touch-target rounded-lg border px-4 text-sm font-bold"
          style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
        >
          {t('settings.eraseAll')}
        </button>
      </Section>

      <Section label={t('live.settingsTitle')}>
        {isSupabaseConfigured() ? (
          <p
            className="m-0 flex items-center gap-2 text-sm font-semibold"
            style={{ color: 'var(--success)' }}
          >
            ● {t('live.settingsConfigured')}
          </p>
        ) : (
          <p className="m-0 text-sm" style={{ color: 'var(--muted)' }}>
            {t('live.settingsNotConfigured')}
          </p>
        )}
      </Section>

      {isSupabaseConfigured() && <CloudSyncSection />}

      <Section label={t('settings.about')}>
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size={56} />
          <div>
            <p className="m-0 text-base font-black">Mister Mölkky</p>
            <p className="m-0 text-xs" style={{ color: 'var(--muted)' }}>
              {t('settings.version')}{' '}
              {typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.1.0'}
            </p>
          </div>
          <p
            className="m-0 text-sm leading-relaxed"
            style={{ color: 'var(--muted)' }}
          >
            {t('settings.aboutText')}
          </p>
          <div
            className="flex w-full gap-2 border-t pt-3"
            style={{ borderColor: 'var(--border)' }}
          >
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              {t('settings.sourceCode')}
            </a>
            <a
              href={BMAC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-yellow-900 transition hover:brightness-95"
              style={{ background: '#fbbf24' }}
            >
              <CoffeeIcon size={14} />
              {t('settings.buyCoffee')}
            </a>
          </div>
        </div>
      </Section>

      {/* Nos autres applications — grille partagée (FamilyApps). Source /
          sponsor sont déjà couverts par la section « À propos » et l'AppFooter,
          donc on masque ces cartes et on n'affiche QUE la grille des autres
          apps. Le composant rend son propre <h3> (masqué en CSS puisque la
          Section fournit déjà son <h2>). */}
      <Section label={t('family.title')}>
        <p
          className="m-0 mb-3 text-sm leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          {t('family.lead')}
        </p>
        <div className="mm-family">
          <FamilyApps
            currentAppId="mister-molkky"
            showSource={false}
            showSponsor={false}
            labels={{
              otherApps: t('family.title'),
              maturity: {
                alpha: t('family.maturityAlpha'),
                beta: t('family.maturityBeta'),
                stable: t('family.maturityStable'),
              },
            }}
          />
        </div>
      </Section>

      <AppFooter />

      <ConfirmDialog
        open={confirmErase}
        title={t('settings.eraseAllConfirm')}
        destructive
        onConfirm={onEraseAll}
        onCancel={() => setConfirmErase(false)}
      />

      {updating && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3"
          style={{
            background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <RefreshIcon
            size={40}
            className="animate-spin"
            style={{ color: 'var(--primary)' }}
          />
          <p className="m-0 text-sm font-semibold">
            {t('settings.forceUpdateInProgress')}
          </p>
        </div>
      )}
    </PageContainer>
  );
}

/**
 * "Sync cloud" Settings section. Opt-in toggle + push/pull buttons.
 * Hidden when Supabase isn't configured (avoids tempting the user
 * with a feature that can't work without a backend).
 */
function CloudSyncSection() {
  const { t, locale } = useI18n();
  const enabled = useSyncStore(s => s.enabled);
  const status = useSyncStore(s => s.status);
  const lastSyncAt = useSyncStore(s => s.lastSyncAt);
  const error = useSyncStore(s => s.error);
  const toggleEnabled = useSyncStore(s => s.toggleEnabled);
  const pushNow = useSyncStore(s => s.pushNow);
  const pullNow = useSyncStore(s => s.pullNow);
  // Envoyer/récupérer parlent à Supabase (connexion anonyme + une requête) :
  // rien de tout cela n'aboutit hors ligne. Le BASCULE, lui, n'est pas gardée —
  // c'est un simple drapeau local, on peut l'armer sans réseau pour plus tard.
  const guard = useActionGuard({ online: true });

  return (
    <Section label={t('settings.cloudSync')}>
      <div className="flex flex-col gap-3">
        <Toggle
          checked={enabled}
          onChange={toggleEnabled}
          label={t('settings.cloudSync')}
          hint={t('settings.cloudSyncHint')}
        />
        {enabled && (
          <>
            <div className="flex gap-2">
              <button
                type="button"
                {...guard.disabledProps}
                onClick={guard.wrap(() => void pushNow())}
                disabled={status === 'syncing'}
                className="touch-target flex-1 rounded-lg border-2 px-3 text-sm font-bold disabled:opacity-50 aria-disabled:opacity-50"
                style={{
                  borderColor: 'var(--primary)',
                  color: 'var(--primary)',
                }}
              >
                {t('settings.cloudPush')}
              </button>
              <button
                type="button"
                {...guard.disabledProps}
                onClick={guard.wrap(() => void pullNow())}
                disabled={status === 'syncing'}
                className="touch-target flex-1 rounded-lg border-2 px-3 text-sm font-bold disabled:opacity-50 aria-disabled:opacity-50"
                style={{
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                }}
              >
                {t('settings.cloudPull')}
              </button>
            </div>
            {guard.reason && (
              <p
                role="status"
                className="m-0 text-xs"
                style={{ color: 'var(--muted)' }}
              >
                {guard.reason}
              </p>
            )}
            {status === 'syncing' && (
              <p className="m-0 text-xs" style={{ color: 'var(--muted)' }}>
                {t('settings.cloudSyncing')}
              </p>
            )}
            {status === 'ok' && lastSyncAt && (
              <p className="m-0 text-xs" style={{ color: 'var(--success)' }}>
                {t('settings.cloudLastSync', {
                  date: new Date(lastSyncAt).toLocaleString(locale),
                })}
              </p>
            )}
            {status === 'error' && error && (
              <p className="m-0 text-xs" style={{ color: 'var(--danger)' }}>
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </Section>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4">
      <h2
        className="mb-2 text-xs font-bold uppercase"
        style={{ color: 'var(--muted)' }}
      >
        {label}
      </h2>
      <div
        className="rounded-2xl border p-3"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        {children}
      </div>
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-1 h-5 w-5"
        aria-label={label}
      />
      <span className="flex-1">
        <span className="block font-semibold">{label}</span>
        {hint && (
          <span className="block text-xs" style={{ color: 'var(--muted)' }}>
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}
