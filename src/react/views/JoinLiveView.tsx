import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQrScanner } from '@mister-guiiug/dev-wpa-config/react/use-qr-scanner';
import { useI18n } from '../../i18n/useI18n';
import { useLiveStore } from '../../store/useLiveStore';
import { isSupabaseConfigured } from '../../supabase';
import { CODE_LENGTH, normalizeCode } from '../../live/liveMatch';
import { ROUTES } from '../../routes';
import { PageContainer } from '../components/layout/PageContainer';
import { CameraIcon } from '../components/icons';

export function JoinLiveView() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const startViewer = useLiveStore(s => s.startViewer);
  const supabaseReady = isSupabaseConfigured();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Submit is invoked from the QR-scanner callback, which must stay stable
  // across renders — stash the latest version in a ref so the callback can
  // read it without retriggering the camera effect.
  const submit = async (rawCode: string) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const row = await startViewer(rawCode);
      // Naviguer avec le code CANONIQUE (celui de la ligne trouvée) : avec
      // la rustine de compat de `joinLiveMatch`, le code saisi peut différer
      // du code stocké (ancien alphabet, confusion I/O corrigée).
      navigate(`${ROUTES.spectator}/${row.code}`);
    } catch (err) {
      setError(t('live.joinFailed'));
      void err;
    } finally {
      setBusy(false);
    }
  };
  const submitRef = useRef(submit);
  submitRef.current = submit;

  // Cycle de vie caméra délégué au socle (promu depuis cette vue) : import
  // paresseux de `qr-scanner` au premier `start()`, câblage dans un effet
  // une fois la <video> commitée, stop + destroy garantis au nettoyage — et
  // arrêt SYNCHRONE au premier décodage (`stopOnScan`, défaut).
  const {
    videoRef,
    scanning,
    error: scanError,
    start,
    stop,
  } = useQrScanner({
    onScan: data => {
      // Accept both the raw code and a full /live/CODE URL.
      const match = data.match(/live\/([A-Za-z0-9]+)/);
      const candidate = match?.[1] ?? data;
      const normalized = normalizeCode(candidate);
      if (normalized.length !== CODE_LENGTH) return;
      setCode(normalized);
      void submitRef.current(normalized);
    },
  });

  const startScan = () => {
    setError(null);
    start();
  };

  const displayError = error ?? scanError?.message ?? null;

  if (!supabaseReady) {
    return (
      <PageContainer>
        <h1 className="mt-4 text-2xl font-black">{t('live.joinTitle')}</h1>
        <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
          {t('live.notConfigured')}
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <h1 className="mt-4 text-2xl font-black">{t('live.joinTitle')}</h1>
      <p className="mb-4 mt-2 text-sm" style={{ color: 'var(--muted)' }}>
        {t('live.joinHint')}
      </p>

      <form
        onSubmit={e => {
          e.preventDefault();
          void submit(code);
        }}
        className="flex flex-col gap-3"
      >
        <input
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          value={code}
          onChange={e => setCode(normalizeCode(e.target.value))}
          placeholder="MZ7K2A"
          maxLength={CODE_LENGTH}
          className="touch-target rounded-xl border-2 px-4 py-3 text-center font-mono text-2xl font-black tracking-[0.3em]"
          style={{
            background: 'var(--surface-input)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
          }}
        />
        <button
          type="submit"
          disabled={code.length !== CODE_LENGTH || busy}
          className="touch-target rounded-lg px-4 py-3 font-bold text-white disabled:opacity-50"
          style={{ background: 'var(--primary)' }}
        >
          {busy ? t('common.loading') : t('live.joinSubmit')}
        </button>
      </form>

      <div className="my-4 flex items-center gap-2">
        <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          {t('common.or')}
        </span>
        <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
      </div>

      {!scanning ? (
        <button
          type="button"
          onClick={startScan}
          className="touch-target flex w-full items-center justify-center gap-2 rounded-lg border-2 py-3 font-bold"
          style={{
            borderColor: 'var(--primary)',
            color: 'var(--primary)',
          }}
        >
          <CameraIcon size={20} />
          {t('live.joinScan')}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <video
            ref={videoRef}
            className="aspect-square w-full rounded-2xl bg-black object-cover"
            playsInline
            muted
          />
          <button
            type="button"
            onClick={stop}
            className="touch-target rounded-lg border px-3 py-2 font-semibold"
            style={{ borderColor: 'var(--border)' }}
          >
            {t('live.joinCancelScan')}
          </button>
        </div>
      )}

      {displayError && (
        <p className="mt-3 text-sm" style={{ color: 'var(--danger)' }}>
          {displayError}
        </p>
      )}
    </PageContainer>
  );
}
