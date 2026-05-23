import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QrScanner from 'qr-scanner';
import { useI18n } from '../../i18n/useI18n';
import { useLiveStore } from '../../store/useLiveStore';
import { isSupabaseConfigured } from '../../supabase';
import { normalizeCode } from '../../live/liveMatch';
import { PageContainer } from '../components/layout/PageContainer';

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

  useEffect(() => {
    return () => {
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, []);

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

  const startScan = async () => {
    if (!videoRef.current) return;
    setError(null);
    const scanner = new QrScanner(
      videoRef.current,
      result => {
        const url = result.data;
        const match = url.match(/direct\/([A-Za-z0-9]+)/);
        const candidate = match?.[1] ?? url;
        const normalized = normalizeCode(candidate);
        if (normalized.length === 6) {
          setCode(normalized);
          scanner.stop();
          setScanning(false);
          void submit(normalized);
        }
      },
      { highlightScanRegion: true, highlightCodeOutline: true }
    );
    scannerRef.current = scanner;
    try {
      await scanner.start();
      setScanning(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const stopScan = () => {
    scannerRef.current?.stop();
    scannerRef.current?.destroy();
    scannerRef.current = null;
    setScanning(false);
  };

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
          className="touch-target w-full rounded-lg border-2 py-3 font-bold"
          style={{
            borderColor: 'var(--primary)',
            color: 'var(--primary)',
          }}
        >
          📷 {t('live.joinScan')}
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
