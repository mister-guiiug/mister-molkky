import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QrScanner from 'qr-scanner';
import { useI18n } from '../../i18n/useI18n';
import { useLiveStore } from '../../store/useLiveStore';
import { isSupabaseConfigured } from '../../supabase';
import { normalizeCode } from '../../live/liveMatch';
import { PageContainer } from '../components/layout/PageContainer';
import { CameraIcon } from '../components/icons';

export function JoinLiveView() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const startViewer = useLiveStore(s => s.startViewer);
  const supabaseReady = isSupabaseConfigured();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Submit is invoked from the QR-scanner callback inside an effect that
  // should NOT re-run on every render — stash the latest version in a
  // ref so the effect can read it without listing `submit` as a dep.
  const submit = async (rawCode: string) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await startViewer(rawCode);
      const normalized = normalizeCode(rawCode);
      navigate(`/direct/${normalized}`);
    } catch (err) {
      setError(t('live.joinFailed'));
      void err;
    } finally {
      setBusy(false);
    }
  };
  const submitRef = useRef(submit);
  submitRef.current = submit;

  /**
   * Click handler — just mounts the video element. We can't `new QrScanner`
   * here because the <video> ref is null until React has rendered the
   * conditional branch where it lives. That was the original bug: a tap
   * on "Scanner le QR" returned silently because videoRef.current was
   * null. The scanner itself is wired up in the effect below, once React
   * has flushed the new DOM.
   */
  const startScan = () => {
    setError(null);
    setScanning(true);
  };

  const stopScan = () => {
    setScanning(false);
  };

  // When `scanning` flips true, the <video> mounts and React commits the
  // ref. This effect picks it up and starts QrScanner; on cleanup (or
  // when scanning flips false) it stops + destroys the camera stream so
  // we never leak a torch-on flashlight.
  useEffect(() => {
    if (!scanning) return;
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    const scanner = new QrScanner(
      video,
      result => {
        // Accept both the raw code and a full /direct/CODE URL.
        const url = result.data ?? '';
        const match = url.match(/direct\/([A-Za-z0-9]+)/);
        const candidate = match?.[1] ?? url;
        const normalized = normalizeCode(candidate);
        if (normalized.length !== 6) return;
        setCode(normalized);
        scanner.stop();
        scanner.destroy();
        scannerRef.current = null;
        setScanning(false);
        void submitRef.current(normalized);
      },
      {
        highlightScanRegion: true,
        highlightCodeOutline: true,
        // Prefer the rear camera on phones — front-cam scanning is a
        // gymnastic exercise nobody asked for.
        preferredCamera: 'environment',
        returnDetailedScanResult: true,
      }
    );
    scannerRef.current = scanner;

    scanner.start().catch((err: unknown) => {
      if (cancelled) return;
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Camera unavailable';
      setError(message);
      scanner.destroy();
      scannerRef.current = null;
      setScanning(false);
    });

    return () => {
      cancelled = true;
      scanner.stop();
      scanner.destroy();
      scannerRef.current = null;
    };
  }, [scanning]);

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
          maxLength={6}
          className="touch-target rounded-xl border-2 px-4 py-3 text-center font-mono text-2xl font-black tracking-[0.3em]"
          style={{
            background: 'var(--surface-input)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
          }}
        />
        <button
          type="submit"
          disabled={code.length !== 6 || busy}
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
            onClick={stopScan}
            className="touch-target rounded-lg border px-3 py-2 font-semibold"
            style={{ borderColor: 'var(--border)' }}
          >
            {t('live.joinCancelScan')}
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
    </PageContainer>
  );
}
