import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { buildLiveShareUrl } from '../../live/liveMatch';
import { useLiveStore } from '../../store/useLiveStore';
import { useMatchStore } from '../../store/useMatchStore';
import { isSupabaseConfigured } from '../../supabase';
import { qrToDataUrl } from '@mister-guiiug/dev-wpa-config/qr';
import { shareOrCopy } from '@mister-guiiug/dev-wpa-config/share';
import { useActionGuard } from '@mister-guiiug/dev-wpa-config/react/use-action-guard';
import { Modal } from './Modal';
import { Skeleton } from './Skeleton';
import { CheckIcon, ShareIcon } from './icons';

interface LiveShareSheetProps {
  open: boolean;
  onClose: () => void;
}

export function LiveShareSheet({ open, onClose }: LiveShareSheetProps) {
  const { t } = useI18n();
  const current = useMatchStore(s => s.current);
  const role = useLiveStore(s => s.role);
  const liveCode = useLiveStore(s => s.code);
  const liveError = useLiveStore(s => s.error);
  const startHost = useLiveStore(s => s.startHost);
  const stopHost = useLiveStore(s => s.stopHost);
  const supabaseReady = isSupabaseConfigured();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  // Démarrer un partage INSÈRE une ligne dans Supabase : impossible hors ligne.
  // Le libellé du motif vient des libellés du socle (fr + en, exactement les
  // deux langues de l'app), via le `LabelsProvider` déjà monté par `AppRouter`.
  const guard = useActionGuard({ online: true });

  const shareUrl =
    liveCode && typeof window !== 'undefined'
      ? buildLiveShareUrl(
          window.location.origin,
          import.meta.env.BASE_URL,
          liveCode
        )
      : null;

  useEffect(() => {
    if (!shareUrl) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    // Le module socle `/qr` charge sa peer `qrcode` (~50 ko) paresseusement
    // — le poids n'est téléchargé que si la feuille de partage s'ouvre,
    // exactement l'ancien `import('qrcode')` local.
    void qrToDataUrl(shareUrl, {
      margin: 1,
      width: 240,
      color: { dark: '#1b1d18', light: '#ffffff' },
    })
      .then(url => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        /* leave qrDataUrl null — the code text below is still shareable */
      });
    return () => {
      cancelled = true;
    };
  }, [shareUrl]);

  const handleStart = async () => {
    if (!current) return;
    setBusy(true);
    try {
      await startHost(current);
    } catch (err) {
      setFeedback((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!liveCode) return;
    const result = await shareOrCopy({
      title: t('appName'),
      text: t('live.shareText', { code: liveCode }),
      url: shareUrl ?? undefined,
    });
    // L'utilisateur a refermé la feuille de partage : ce n'est ni un succès
    // ni un échec — on n'affiche rien (contrat du socle).
    if (result === 'cancelled') return;
    setFeedback(
      result === 'shared'
        ? t('toast.shared')
        : result === 'copied'
          ? t('toast.copied')
          : t('toast.failed')
    );
  };

  const handleStop = () => {
    stopHost();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('live.shareTitle')} size="md">
      {!supabaseReady ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm" style={{ color: 'var(--muted)' }}>
            {t('live.notConfigured')}
          </p>
          <p className="m-0 text-xs" style={{ color: 'var(--muted)' }}>
            <code>docs/live-supabase.md</code>
          </p>
        </div>
      ) : role !== 'host' || !liveCode ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm" style={{ color: 'var(--muted)' }}>
            {t('live.shareIntro')}
          </p>
          <button
            type="button"
            {...guard.disabledProps}
            onClick={guard.wrap(handleStart)}
            disabled={busy || !current}
            className="touch-target rounded-lg px-4 py-2 font-bold text-white disabled:opacity-50 aria-disabled:opacity-50"
            style={{ background: 'var(--primary)' }}
          >
            {busy ? t('common.loading') : t('live.startSharing')}
          </button>
          {guard.reason && (
            <p
              role="status"
              className="m-0 text-xs"
              style={{ color: 'var(--muted)' }}
            >
              {guard.reason}
            </p>
          )}
          {liveError && (
            <p className="m-0 text-xs" style={{ color: 'var(--danger)' }}>
              {liveError}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={t('live.qrAlt')}
              className="h-56 w-56 rounded-lg border"
              style={{ borderColor: 'var(--border)' }}
            />
          ) : (
            // Hold the QR's footprint while `qrcode` lazy-loads + encodes
            // so the sheet doesn't jump when the image pops in.
            <Skeleton width={224} height={224} rounded="lg" />
          )}
          <div className="flex flex-col items-center gap-1">
            <p
              className="m-0 text-xs uppercase"
              style={{ color: 'var(--muted)' }}
            >
              {t('live.codeLabel')}
            </p>
            <p
              className="m-0 font-mono text-3xl font-black tracking-[0.3em]"
              style={{ color: 'var(--primary)' }}
            >
              {liveCode}
            </p>
          </div>
          <p
            className="m-0 text-center text-xs"
            style={{ color: 'var(--muted)' }}
          >
            {t('live.shareHint')}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="touch-target flex items-center gap-2 rounded-lg border px-3 font-semibold"
              style={{ borderColor: 'var(--border)' }}
            >
              <ShareIcon size={16} /> {t('common.save')}
            </button>
            <button
              type="button"
              onClick={handleStop}
              className="touch-target rounded-lg border px-3 font-semibold"
              style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
            >
              {t('live.stopSharing')}
            </button>
          </div>
          {feedback && (
            <p
              className="m-0 flex items-center gap-1 text-xs"
              style={{ color: 'var(--success)' }}
            >
              <CheckIcon size={14} /> {feedback}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
