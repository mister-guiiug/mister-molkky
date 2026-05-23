import { useRef, useState } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { useSettingsStore } from '../../store/useSettingsStore';
import { RefreshIcon } from '../components/icons';
import { useMatchStore } from '../../store/useMatchStore';
import { usePlayersStore } from '../../store/usePlayersStore';
import {
  getStoredThemePreference,
  setThemePreference,
  type ThemePreference,
} from '../../theme';
import { ExportBundleSchema, type Locale } from '../../schemas';
import { PageContainer } from '../components/layout/PageContainer';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { isSupabaseConfigured } from '../../supabase';
import { forceAppUpdate } from '../../register-sw';
import { AppFooter } from '../components/layout/AppFooter';

declare const __APP_VERSION__: string | undefined;

export function SettingsView() {
  const { t, locale, setLocale } = useI18n();
  const settings = useSettingsStore();
  const players = usePlayersStore(s => s.players);
  const history = useMatchStore(s => s.history);
  const importBundle = useMatchStore(s => s.importBundle);
  const fileInput = useRef<HTMLInputElement>(null);
  const [themePref, setThemePref] = useState<ThemePreference>(
    getStoredThemePreference()
  );
  const [confirmErase, setConfirmErase] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const setTheme = (v: ThemePreference) => {
    setThemePref(v);
    setThemePreference(v);
  };

  const onExport = () => {
    const bundle = ExportBundleSchema.parse({
      version: 1,
      exportedAt: Date.now(),
      players,
      matches: history,
    });
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mister-molkky-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
              // Flip the overlay flag FIRST and synchronously, so the
              // user sees instant feedback even if the SW cleanup is
              // slow. `forceAppUpdate` schedules its own navigation
              // and reload safety net — we don't need to await it.
              setUpdating(true);
              void forceAppUpdate();
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

      <Section label={t('settings.about')}>
        <p
          className="m-0 text-sm leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          {t('settings.aboutText')}
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
          {t('settings.version')}:{' '}
          {typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.1.0'}
        </p>
      </Section>

      <AppFooter />

      <ConfirmDialog
        open={confirmErase}
        message={t('settings.eraseAllConfirm')}
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
